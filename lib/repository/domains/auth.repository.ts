import { randomUUID } from "node:crypto"
import { and, desc, eq } from "drizzle-orm"
import type { AuthUser } from "@/lib/types"
import { ensureCoreSchema } from "@/lib/repository/domains/setup.repository"
import { getDomainRuntime } from "@/lib/repository/domain-runtime"

type UpdateAuthUserInput = Partial<{
  oidcSub: string
  email: string
  displayName: string
  roles: string[]
  active: boolean
}>

type OidcBindInput = {
  issuer: string
  sub: string
  email: string
  displayName: string
  roles: string[]
  jitCreate: boolean
}

type LdapUpsertInput = {
  issuer: string
  sub: string
  email: string
  displayName: string
  role: string
  active?: boolean
}

function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

function toAuthUser(row: {
  id: string
  oidcIssuer: string
  oidcSub: string
  email: string
  displayName: string
  rolesJson: string
  active: number
  source: "jit" | "ldap"
  createdAt: string
  updatedAt: string
}): AuthUser {
  let roles: string[] = ["member"]
  try {
    const parsed = JSON.parse(row.rolesJson)
    if (Array.isArray(parsed)) {
      roles = parsed.filter((value): value is string => typeof value === "string")
    }
  } catch {}

  return {
    id: row.id,
    oidcIssuer: row.oidcIssuer,
    oidcSub: row.oidcSub,
    email: row.email,
    displayName: row.displayName,
    roles,
    active: Number(row.active) === 1,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function getAuthUserByWhere(whereClause: any): Promise<AuthUser | null> {
  const { orm, tables } = getDomainRuntime()
  const rows = await orm
    .select({
      id: tables.authUsersTable.id,
      oidcIssuer: tables.authUsersTable.oidcIssuer,
      oidcSub: tables.authUsersTable.oidcSub,
      email: tables.authUsersTable.email,
      displayName: tables.authUsersTable.displayName,
      rolesJson: tables.authUsersTable.rolesJson,
      active: tables.authUsersTable.active,
      source: tables.authUsersTable.source,
      createdAt: tables.authUsersTable.createdAt,
      updatedAt: tables.authUsersTable.updatedAt,
    })
    .from(tables.authUsersTable)
    .where(whereClause)
    .limit(1)

  const row = rows[0] as
    | {
        id: string
        oidcIssuer: string
        oidcSub: string
        email: string
        displayName: string
        rolesJson: string
        active: number
        source: "jit" | "ldap"
        createdAt: string
        updatedAt: string
      }
    | undefined

  return row ? toAuthUser(row) : null
}

export async function listAuthUsers(): Promise<AuthUser[]> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const rows = await orm
    .select({
      id: tables.authUsersTable.id,
      oidcIssuer: tables.authUsersTable.oidcIssuer,
      oidcSub: tables.authUsersTable.oidcSub,
      email: tables.authUsersTable.email,
      displayName: tables.authUsersTable.displayName,
      rolesJson: tables.authUsersTable.rolesJson,
      active: tables.authUsersTable.active,
      source: tables.authUsersTable.source,
      createdAt: tables.authUsersTable.createdAt,
      updatedAt: tables.authUsersTable.updatedAt,
    })
    .from(tables.authUsersTable)
    .orderBy(desc(tables.authUsersTable.createdAt))

  return (
    rows as Array<{
      id: string
      oidcIssuer: string
      oidcSub: string
      email: string
      displayName: string
      rolesJson: string
      active: number
      source: "jit" | "ldap"
      createdAt: string
      updatedAt: string
    }>
  ).map(toAuthUser)
}

export async function findAuthUserBySubject(issuer: string, sub: string): Promise<AuthUser | null> {
  await ensureCoreSchema()
  const { tables } = getDomainRuntime()
  return getAuthUserByWhere(and(eq(tables.authUsersTable.oidcIssuer, issuer), eq(tables.authUsersTable.oidcSub, sub)))
}

export async function findAuthUserByEmail(email: string): Promise<AuthUser | null> {
  await ensureCoreSchema()
  const normalized = email.toLowerCase()
  const users = await listAuthUsers()
  return users.find((user) => user.email.toLowerCase() === normalized) ?? null
}

export async function findAuthUserById(id: string): Promise<AuthUser | null> {
  await ensureCoreSchema()
  const { tables } = getDomainRuntime()
  return getAuthUserByWhere(eq(tables.authUsersTable.id, id))
}

export async function updateAuthUserById(id: string, input: UpdateAuthUserInput): Promise<AuthUser | null> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const existing = await findAuthUserById(id)
  if (!existing) {
    return null
  }

  await orm
    .update(tables.authUsersTable)
    .set({
      oidcSub: input.oidcSub ?? existing.oidcSub,
      email: input.email ? input.email.toLowerCase() : existing.email,
      displayName: input.displayName ?? existing.displayName,
      rolesJson: input.roles ? JSON.stringify(input.roles) : JSON.stringify(existing.roles),
      active: typeof input.active === "boolean" ? (input.active ? 1 : 0) : existing.active ? 1 : 0,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tables.authUsersTable.id, id))

  return findAuthUserById(id)
}

export async function deactivateAuthUserById(id: string): Promise<boolean> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const existing = await findAuthUserById(id)
  if (!existing) {
    return false
  }

  await orm
    .update(tables.authUsersTable)
    .set({ active: 0, updatedAt: new Date().toISOString() })
    .where(eq(tables.authUsersTable.id, id))

  return true
}

export async function bindOrCreateAuthUserFromOidc(input: OidcBindInput): Promise<AuthUser | null> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const bySubject = await findAuthUserBySubject(input.issuer, input.sub)
  if (bySubject) {
    await updateAuthUserById(bySubject.id, {
      email: input.email,
      displayName: input.displayName,
      roles: input.roles,
      active: bySubject.active,
    })
    return (await findAuthUserBySubject(input.issuer, input.sub)) ?? bySubject
  }

  const byEmail = await findAuthUserByEmail(input.email)
  if (byEmail) {
    return updateAuthUserById(byEmail.id, {
      oidcSub: input.sub,
      email: input.email,
      displayName: input.displayName,
      roles: input.roles,
    })
  }

  if (!input.jitCreate) {
    return null
  }

  const id = makeId("USR")
  const now = new Date().toISOString()
  await orm.insert(tables.authUsersTable).values({
    id,
    oidcIssuer: input.issuer,
    oidcSub: input.sub,
    email: input.email.toLowerCase(),
    displayName: input.displayName,
    rolesJson: JSON.stringify(input.roles),
    active: 1,
    source: "jit",
    createdAt: now,
    updatedAt: now,
  })

  return findAuthUserById(id)
}

export async function upsertAuthUserFromLdap(input: LdapUpsertInput): Promise<AuthUser> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const existingBySubject = await findAuthUserBySubject(input.issuer, input.sub)
  if (existingBySubject) {
    const updated = await updateAuthUserById(existingBySubject.id, {
      email: input.email,
      displayName: input.displayName,
      roles: [input.role],
      active: input.active ?? true,
    })

    if (updated) {
      await orm
        .update(tables.authUsersTable)
        .set({ source: "ldap", updatedAt: new Date().toISOString() })
        .where(eq(tables.authUsersTable.id, updated.id))
      return (await findAuthUserBySubject(input.issuer, input.sub)) ?? updated
    }
  }

  const existingByEmail = await findAuthUserByEmail(input.email)
  if (existingByEmail) {
    const updated = await updateAuthUserById(existingByEmail.id, {
      oidcSub: input.sub,
      email: input.email,
      displayName: input.displayName,
      roles: [input.role],
      active: input.active ?? true,
    })

    if (updated) {
      await orm
        .update(tables.authUsersTable)
        .set({ source: "ldap", updatedAt: new Date().toISOString() })
        .where(eq(tables.authUsersTable.id, updated.id))
      return updated
    }
  }

  const id = makeId("USR")
  const now = new Date().toISOString()
  await orm.insert(tables.authUsersTable).values({
    id,
    oidcIssuer: input.issuer,
    oidcSub: input.sub,
    email: input.email.toLowerCase(),
    displayName: input.displayName,
    rolesJson: JSON.stringify([input.role]),
    active: input.active === false ? 0 : 1,
    source: "ldap",
    createdAt: now,
    updatedAt: now,
  })

  const created = await findAuthUserById(id)
  if (!created) {
    throw new Error("Failed to create LDAP-synced user")
  }

  return created
}
