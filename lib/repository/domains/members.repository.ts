import { randomUUID } from "node:crypto"
import { and, desc, eq, isNull } from "drizzle-orm"
import type { AssetCategory, AssetStatus, LoanRecord, TeamMember, TeamRole } from "@/lib/types"
import { ensureCoreSchema } from "@/lib/repository/domains/setup.repository"
import { getDomainRuntime } from "@/lib/repository/domain-runtime"
import { notifyMemberRoleChanged } from "@/lib/repository/domains/notifications.repository"

type MemberWriteInput = {
  name: string
  email: string
  role: TeamRole
}

function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

function toInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("")
}

function normalizeMemberInput(input: MemberWriteInput): MemberWriteInput {
  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
  }
}

function formatLocationLabel(name: string | null, floorNumber: string | null, roomNumber: string | null): string {
  if (!name) {
    return "Unassigned"
  }
  if (floorNumber && floorNumber.trim() && roomNumber && roomNumber.trim()) {
    return `${floorNumber}.${roomNumber} ${name}`
  }
  if (roomNumber && roomNumber.trim()) {
    return `${roomNumber} ${name}`
  }
  if (floorNumber && floorNumber.trim()) {
    return `${floorNumber} ${name}`
  }
  return name
}

export async function listMembers(): Promise<TeamMember[]> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const members = await orm
    .select({
      id: tables.membersTable.id,
      name: tables.membersTable.name,
      email: tables.membersTable.email,
      role: tables.membersTable.role,
    })
    .from(tables.membersTable)
    .orderBy(tables.membersTable.name)

  const assets = await orm.select({ assignedMemberId: tables.assetsTable.assignedMemberId }).from(tables.assetsTable)

  const assignedCounts = new Map<string, number>()
  for (const row of assets as Array<{ assignedMemberId: string | null }>) {
    if (!row.assignedMemberId) {
      continue
    }
    assignedCounts.set(row.assignedMemberId, (assignedCounts.get(row.assignedMemberId) ?? 0) + 1)
  }

  return (members as Array<{ id: string; name: string; email: string; role: TeamRole }>).map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    avatar: toInitials(member.name),
    assetsAssigned: assignedCounts.get(member.id) ?? 0,
  }))
}

export async function findMemberIdByEmail(email: string): Promise<string | null> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()
  const normalizedEmail = email.trim().toLowerCase()

  const rows = await orm
    .select({ id: tables.membersTable.id, email: tables.membersTable.email })
    .from(tables.membersTable)

  const match = (rows as Array<{ id: string; email: string }>).find(
    (row) => row.email.toLowerCase() === normalizedEmail,
  )
  return match?.id ?? null
}

export async function createMember(input: MemberWriteInput): Promise<TeamMember> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()
  const normalized = normalizeMemberInput(input)
  const id = makeId("MEM")

  await orm.insert(tables.membersTable).values({
    id,
    name: normalized.name,
    email: normalized.email,
    role: normalized.role,
    createdAt: new Date().toISOString(),
  })

  return {
    id,
    name: normalized.name,
    email: normalized.email,
    role: normalized.role,
    avatar: toInitials(normalized.name),
    assetsAssigned: 0,
  }
}

export async function getMemberProfile(memberId: string): Promise<{
  member: TeamMember
  assignedAssets: Array<{
    id: string
    name: string
    category: AssetCategory
    status: AssetStatus
    location: string
    borrowedAt: string | null
    dueAt: string | null
  }>
  loanHistory: LoanRecord[]
} | null> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const members = await orm
    .select({
      id: tables.membersTable.id,
      name: tables.membersTable.name,
      email: tables.membersTable.email,
      role: tables.membersTable.role,
    })
    .from(tables.membersTable)
    .where(eq(tables.membersTable.id, memberId))
    .limit(1)

  const memberRow = members[0] as { id: string; name: string; email: string; role: TeamRole } | undefined
  if (!memberRow) {
    return null
  }

  const assignedAssetRows = await orm
    .select({
      id: tables.assetsTable.id,
      name: tables.assetsTable.name,
      category: tables.assetsTable.category,
      status: tables.assetsTable.status,
      locationName: tables.locationsTable.name,
      locationFloorNumber: tables.locationsTable.floorNumber,
      locationRoomNumber: tables.locationsTable.roomNumber,
    })
    .from(tables.assetsTable)
    .leftJoin(tables.locationsTable, eq(tables.locationsTable.id, tables.assetsTable.locationId))
    .where(eq(tables.assetsTable.assignedMemberId, memberId))
    .orderBy(tables.assetsTable.name)

  const openLoanRows = await orm
    .select({
      assetId: tables.loansTable.assetId,
      borrowedAt: tables.loansTable.borrowedAt,
      dueAt: tables.loansTable.dueAt,
    })
    .from(tables.loansTable)
    .where(and(eq(tables.loansTable.memberId, memberId), isNull(tables.loansTable.returnedAt)))

  const openLoanByAssetId = new Map(
    (openLoanRows as Array<{ assetId: string; borrowedAt: string; dueAt: string | null }>).map((row) => [
      row.assetId,
      row,
    ]),
  )

  const loanRows = await orm
    .select({
      id: tables.loansTable.id,
      assetId: tables.loansTable.assetId,
      memberId: tables.loansTable.memberId,
      assetName: tables.assetsTable.name,
      memberName: tables.membersTable.name,
      borrowedAt: tables.loansTable.borrowedAt,
      dueAt: tables.loansTable.dueAt,
      returnedAt: tables.loansTable.returnedAt,
    })
    .from(tables.loansTable)
    .leftJoin(tables.assetsTable, eq(tables.assetsTable.id, tables.loansTable.assetId))
    .leftJoin(tables.membersTable, eq(tables.membersTable.id, tables.loansTable.memberId))
    .where(eq(tables.loansTable.memberId, memberId))
    .orderBy(desc(tables.loansTable.borrowedAt))

  const assignedCount = assignedAssetRows.length

  return {
    member: {
      id: memberRow.id,
      name: memberRow.name,
      email: memberRow.email,
      role: memberRow.role,
      avatar: toInitials(memberRow.name),
      assetsAssigned: assignedCount,
    },
    assignedAssets: (
      assignedAssetRows as Array<{
        id: string
        name: string
        category: AssetCategory
        status: AssetStatus
        locationName: string | null
        locationFloorNumber: string | null
        locationRoomNumber: string | null
      }>
    ).map((row) => {
      const openLoan = openLoanByAssetId.get(row.id)
      return {
        id: row.id,
        name: row.name,
        category: row.category,
        status: row.status,
        location: formatLocationLabel(row.locationName, row.locationFloorNumber, row.locationRoomNumber),
        borrowedAt: openLoan?.borrowedAt ?? null,
        dueAt: openLoan?.dueAt ?? null,
      }
    }),
    loanHistory: (
      loanRows as Array<{
        id: string
        assetId: string
        memberId: string
        assetName: string | null
        memberName: string | null
        borrowedAt: string
        dueAt: string | null
        returnedAt: string | null
      }>
    ).map((row) => ({
      id: row.id,
      assetId: row.assetId,
      memberId: row.memberId,
      assetName: row.assetName ?? "Unknown asset",
      memberName: row.memberName ?? "Unknown member",
      borrowedAt: row.borrowedAt,
      dueAt: row.dueAt,
      returnedAt: row.returnedAt,
    })),
  }
}

export async function upsertMemberByEmail(input: MemberWriteInput): Promise<TeamMember> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()
  const normalized = normalizeMemberInput(input)

  const rows = await orm
    .select({
      id: tables.membersTable.id,
      name: tables.membersTable.name,
      email: tables.membersTable.email,
      role: tables.membersTable.role,
    })
    .from(tables.membersTable)

  const existing = (rows as Array<{ id: string; name: string; email: string; role: TeamRole }>).find(
    (row) => row.email.toLowerCase() === normalized.email,
  )

  if (existing) {
    const previousRole = existing.role
    await orm
      .update(tables.membersTable)
      .set({
        name: normalized.name,
        role: normalized.role,
      })
      .where(eq(tables.membersTable.id, existing.id))

    if (previousRole !== normalized.role) {
      await notifyMemberRoleChanged({
        memberId: existing.id,
        memberName: normalized.name,
        fromRole: previousRole,
        toRole: normalized.role,
      })
    }

    const updatedMember = (await listMembers()).find((member) => member.id === existing.id)
    if (updatedMember) {
      return updatedMember
    }
  }

  return createMember(normalized)
}
