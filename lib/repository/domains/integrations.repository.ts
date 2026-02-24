import type { LdapIntegrationSettings } from "@/lib/types"
import { eq } from "drizzle-orm"
import { ensureCoreSchema } from "@/lib/repository/domains/setup.repository"
import { getDomainRuntime } from "@/lib/repository/domain-runtime"

type SaveLdapIntegrationInput = {
  enabled: boolean
  url: string
  bindDn: string
  bindPassword?: string
  baseDn: string
  userFilter: string
  usernameAttribute: string
  emailAttribute: string
  nameAttribute: string
  defaultRole: string
  syncIssuer: string
}

function toLdapSettings(
  row: {
    enabled: number
    url: string
    bindDn: string
    bindPassword: string | null
    baseDn: string
    userFilter: string
    usernameAttribute: string
    emailAttribute: string
    nameAttribute: string
    defaultRole: string
    syncIssuer: string
    updatedAt: string
  } | null,
): LdapIntegrationSettings {
  if (!row) {
    return {
      enabled: false,
      url: "",
      bindDn: "",
      hasBindPassword: false,
      baseDn: "",
      userFilter: "(objectClass=person)",
      usernameAttribute: "uid",
      emailAttribute: "mail",
      nameAttribute: "cn",
      defaultRole: "member",
      syncIssuer: "ldap",
      updatedAt: null,
    }
  }

  return {
    enabled: Number(row.enabled) === 1,
    url: row.url,
    bindDn: row.bindDn,
    hasBindPassword: Boolean(row.bindPassword && row.bindPassword.length > 0),
    baseDn: row.baseDn,
    userFilter: row.userFilter,
    usernameAttribute: row.usernameAttribute,
    emailAttribute: row.emailAttribute,
    nameAttribute: row.nameAttribute,
    defaultRole: row.defaultRole || "member",
    syncIssuer: row.syncIssuer,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  }
}

export async function getLdapIntegrationSettings(): Promise<LdapIntegrationSettings> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const rows = await orm
    .select({
      enabled: tables.ldapIntegrationsTable.enabled,
      url: tables.ldapIntegrationsTable.url,
      bindDn: tables.ldapIntegrationsTable.bindDn,
      bindPassword: tables.ldapIntegrationsTable.bindPassword,
      baseDn: tables.ldapIntegrationsTable.baseDn,
      userFilter: tables.ldapIntegrationsTable.userFilter,
      usernameAttribute: tables.ldapIntegrationsTable.usernameAttribute,
      emailAttribute: tables.ldapIntegrationsTable.emailAttribute,
      nameAttribute: tables.ldapIntegrationsTable.nameAttribute,
      defaultRole: tables.ldapIntegrationsTable.defaultRole,
      syncIssuer: tables.ldapIntegrationsTable.syncIssuer,
      updatedAt: tables.ldapIntegrationsTable.updatedAt,
    })
    .from(tables.ldapIntegrationsTable)
    .where(eq(tables.ldapIntegrationsTable.id, 1))
    .limit(1)

  return toLdapSettings((rows[0] as any) ?? null)
}

export async function saveLdapIntegrationSettings(input: SaveLdapIntegrationInput): Promise<LdapIntegrationSettings> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const existingBindPassword = await getLdapIntegrationBindPassword()
  const bindPassword = input.bindPassword && input.bindPassword.length > 0 ? input.bindPassword : existingBindPassword

  await orm
    .update(tables.ldapIntegrationsTable)
    .set({
      enabled: input.enabled ? 1 : 0,
      url: input.url.trim(),
      bindDn: input.bindDn.trim(),
      bindPassword,
      baseDn: input.baseDn.trim(),
      userFilter: input.userFilter.trim(),
      usernameAttribute: input.usernameAttribute.trim(),
      emailAttribute: input.emailAttribute.trim(),
      nameAttribute: input.nameAttribute.trim(),
      defaultRole: input.defaultRole.trim() || "member",
      syncIssuer: input.syncIssuer.trim(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tables.ldapIntegrationsTable.id, 1))

  return getLdapIntegrationSettings()
}

export async function getLdapIntegrationBindPassword(): Promise<string | null> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const rows = await orm
    .select({ bindPassword: tables.ldapIntegrationsTable.bindPassword })
    .from(tables.ldapIntegrationsTable)
    .where(eq(tables.ldapIntegrationsTable.id, 1))
    .limit(1)

  const row = rows[0] as { bindPassword: string | null } | undefined
  return row?.bindPassword ?? null
}
