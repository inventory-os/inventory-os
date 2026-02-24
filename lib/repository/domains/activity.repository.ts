import { randomUUID } from "node:crypto"
import { desc, eq } from "drizzle-orm"
import type { ActivityRecord } from "@/lib/types"
import { ensureCoreSchema } from "@/lib/repository/domains/setup.repository"
import { getDomainRuntime } from "@/lib/repository/domain-runtime"

let lastActivityPruneAt = 0

function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

async function pruneOldActivitiesIfNeeded(force = false): Promise<void> {
  const now = Date.now()
  if (!force && now - lastActivityPruneAt < 10 * 60 * 1000) {
    return
  }

  lastActivityPruneAt = now
  const cutoff = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { orm, tables } = getDomainRuntime()
  const rows = await orm
    .select({ id: tables.activityEventsTable.id, createdAt: tables.activityEventsTable.createdAt })
    .from(tables.activityEventsTable)

  const oldIds = (rows as Array<{ id: string; createdAt: string }>)
    .filter((row) => row.createdAt < cutoff)
    .map((row) => row.id)
  if (oldIds.length === 0) {
    return
  }

  for (const id of oldIds) {
    await orm.delete(tables.activityEventsTable).where(eq(tables.activityEventsTable.id, id))
  }
}

export async function recordActivityEvent(input: {
  type: string
  actorMemberId?: string | null
  actorName: string
  subjectType: "asset" | "location" | "booking" | "auth" | "settings" | "system" | "other"
  subjectId?: string | null
  subjectName?: string | null
  message: string
}): Promise<void> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  await orm.insert(tables.activityEventsTable).values({
    id: makeId("ACT"),
    type: input.type,
    actorMemberId: input.actorMemberId ?? null,
    actorName: input.actorName.trim() || "System",
    subjectType: input.subjectType,
    subjectId: input.subjectId ?? null,
    subjectName: input.subjectName ?? null,
    message: input.message,
    createdAt: new Date().toISOString(),
  })

  await pruneOldActivitiesIfNeeded(false)
}

export async function listActivityEvents(input: {
  page: number
  pageSize: number
  search?: string
  type?: string | null
}): Promise<{
  events: ActivityRecord[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}> {
  await ensureCoreSchema()
  await pruneOldActivitiesIfNeeded(false)
  const { orm, tables } = getDomainRuntime()

  const page = Math.max(1, Number(input.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(input.pageSize) || 20))
  const offset = (page - 1) * pageSize
  const search = (input.search ?? "").trim().toLowerCase()
  const type = (input.type ?? "all").trim().toLowerCase()

  const rows = await orm
    .select({
      id: tables.activityEventsTable.id,
      type: tables.activityEventsTable.type,
      actorMemberId: tables.activityEventsTable.actorMemberId,
      actorName: tables.activityEventsTable.actorName,
      subjectType: tables.activityEventsTable.subjectType,
      subjectId: tables.activityEventsTable.subjectId,
      subjectName: tables.activityEventsTable.subjectName,
      message: tables.activityEventsTable.message,
      createdAt: tables.activityEventsTable.createdAt,
    })
    .from(tables.activityEventsTable)
    .orderBy(desc(tables.activityEventsTable.createdAt))

  const filtered = (
    rows as Array<{
      id: string
      type: string
      actorMemberId: string | null
      actorName: string
      subjectType: "asset" | "location" | "booking" | "auth" | "settings" | "system" | "other"
      subjectId: string | null
      subjectName: string | null
      message: string
      createdAt: string
    }>
  ).filter((row) => {
    const matchesType = type === "all" || row.type.toLowerCase() === type || row.subjectType.toLowerCase() === type
    const searchable =
      `${row.type} ${row.actorName} ${row.subjectType} ${row.subjectId ?? ""} ${row.subjectName ?? ""} ${row.message}`.toLowerCase()
    const matchesSearch = search.length === 0 || searchable.includes(search)
    return matchesType && matchesSearch
  })

  const paged = filtered.slice(offset, offset + pageSize)
  const total = filtered.length

  return {
    events: paged.map((row) => ({
      id: row.id,
      type: row.type,
      actorMemberId: row.actorMemberId,
      actorName: row.actorName,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      message: row.message,
      createdAt: row.createdAt,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}
