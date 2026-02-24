import { randomUUID } from "node:crypto"
import { and, desc, eq, isNull, not } from "drizzle-orm"
import type { AssetStatus, NotificationDelivery, NotificationLevel, NotificationRecord, TeamRole } from "@/lib/types"
import { ensureCoreSchema } from "@/lib/repository/domains/setup.repository"
import { getDomainRuntime } from "@/lib/repository/domain-runtime"
import { getNotificationPreferences } from "@/lib/repository/domains/settings.repository"

function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

function addDaysIso(value: Date, days: number): string {
  const copy = new Date(value)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy.toISOString()
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function toNotificationRecord(row: {
  id: string
  recipientMemberId: string
  type: string
  title: string
  message: string
  level: NotificationLevel
  delivery: NotificationDelivery
  linkUrl: string | null
  readAt: string | null
  createdAt: string
}): NotificationRecord {
  return {
    id: row.id,
    recipientMemberId: row.recipientMemberId,
    type: row.type,
    title: row.title,
    message: row.message,
    level: row.level,
    delivery: row.delivery,
    linkUrl: row.linkUrl,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }
}

async function getAdminMemberIds(): Promise<string[]> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()
  const rows = await orm
    .select({ id: tables.membersTable.id })
    .from(tables.membersTable)
    .where(eq(tables.membersTable.role, "admin"))
  return (rows as Array<{ id: string }>).map((row) => row.id)
}

async function createNotification(input: {
  recipientMemberId: string
  type: string
  title: string
  message: string
  level?: NotificationLevel
  delivery?: NotificationDelivery
  linkUrl?: string | null
  eventKey?: string | null
}): Promise<void> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()
  const level = input.level ?? "info"
  const delivery = input.delivery ?? "immediate"
  const eventKey = input.eventKey ?? null

  const values = {
    id: makeId("NTF"),
    recipientMemberId: input.recipientMemberId,
    type: input.type,
    title: input.title,
    message: input.message,
    level,
    delivery,
    linkUrl: input.linkUrl ?? null,
    eventKey,
    readAt: null,
    createdAt: new Date().toISOString(),
  }

  if (eventKey) {
    await orm
      .insert(tables.notificationsTable)
      .values(values)
      .onConflictDoNothing({ target: tables.notificationsTable.eventKey })
    return
  }

  await orm.insert(tables.notificationsTable).values(values)
}

async function createNotificationsForMembers(input: {
  recipientMemberIds: string[]
  type: string
  title: string
  message: string
  level?: NotificationLevel
  delivery?: NotificationDelivery
  linkUrl?: string | null
  eventKey?: string | null
}): Promise<void> {
  const uniqueRecipientIds = [...new Set(input.recipientMemberIds.filter(Boolean))]
  for (const recipientMemberId of uniqueRecipientIds) {
    await createNotification({
      recipientMemberId,
      type: input.type,
      title: input.title,
      message: input.message,
      level: input.level,
      delivery: input.delivery,
      linkUrl: input.linkUrl,
      eventKey: input.eventKey ? `${input.eventKey}:${recipientMemberId}` : null,
    })
  }
}

export async function listNotificationsForMember(memberId: string, limit = 50): Promise<NotificationRecord[]> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))

  const rows = await orm
    .select({
      id: tables.notificationsTable.id,
      recipientMemberId: tables.notificationsTable.recipientMemberId,
      type: tables.notificationsTable.type,
      title: tables.notificationsTable.title,
      message: tables.notificationsTable.message,
      level: tables.notificationsTable.level,
      delivery: tables.notificationsTable.delivery,
      linkUrl: tables.notificationsTable.linkUrl,
      readAt: tables.notificationsTable.readAt,
      createdAt: tables.notificationsTable.createdAt,
    })
    .from(tables.notificationsTable)
    .where(eq(tables.notificationsTable.recipientMemberId, memberId))
    .orderBy(desc(tables.notificationsTable.createdAt))
    .limit(safeLimit)

  return (rows as Array<any>).map(toNotificationRecord)
}

export async function markNotificationRead(id: string, memberId: string): Promise<boolean> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()
  const rows = await orm
    .select({ id: tables.notificationsTable.id, readAt: tables.notificationsTable.readAt })
    .from(tables.notificationsTable)
    .where(and(eq(tables.notificationsTable.id, id), eq(tables.notificationsTable.recipientMemberId, memberId)))
    .limit(1)

  const existing = rows[0] as { id: string; readAt: string | null } | undefined
  if (!existing) {
    return false
  }

  await orm
    .update(tables.notificationsTable)
    .set({ readAt: existing.readAt ?? new Date().toISOString() })
    .where(and(eq(tables.notificationsTable.id, id), eq(tables.notificationsTable.recipientMemberId, memberId)))

  return true
}

export async function markAllNotificationsRead(memberId: string): Promise<void> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const unreadRows = await orm
    .select({ id: tables.notificationsTable.id })
    .from(tables.notificationsTable)
    .where(and(eq(tables.notificationsTable.recipientMemberId, memberId), isNull(tables.notificationsTable.readAt)))

  const timestamp = new Date().toISOString()
  for (const row of unreadRows as Array<{ id: string }>) {
    await orm
      .update(tables.notificationsTable)
      .set({ readAt: timestamp })
      .where(eq(tables.notificationsTable.id, row.id))
  }
}

export async function deleteNotification(id: string, memberId: string): Promise<boolean> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()
  const rows = await orm
    .select({ id: tables.notificationsTable.id })
    .from(tables.notificationsTable)
    .where(and(eq(tables.notificationsTable.id, id), eq(tables.notificationsTable.recipientMemberId, memberId)))
    .limit(1)

  if (!rows[0]) {
    return false
  }

  await orm
    .delete(tables.notificationsTable)
    .where(and(eq(tables.notificationsTable.id, id), eq(tables.notificationsTable.recipientMemberId, memberId)))
  return true
}

export async function deleteAllNotifications(memberId: string): Promise<void> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()
  await orm.delete(tables.notificationsTable).where(eq(tables.notificationsTable.recipientMemberId, memberId))
}

export async function notifyAssetBorrowed(input: {
  assetId: string
  assetName: string
  memberId: string
  memberName: string
}): Promise<void> {
  const preferences = await getNotificationPreferences()
  if (!preferences.checkoutAlerts) {
    return
  }

  const adminMemberIds = await getAdminMemberIds()

  await createNotification({
    recipientMemberId: input.memberId,
    type: "asset.borrowed",
    title: "Asset assigned to you",
    message: `${input.assetName} has been assigned to you.`,
    level: "info",
    delivery: "immediate",
    linkUrl: `/assets/${input.assetId}`,
  })

  if (preferences.digestEnabled) {
    await createNotificationsForMembers({
      recipientMemberIds: adminMemberIds,
      type: "asset.borrowed",
      title: "Asset borrowed",
      message: `${input.assetName} was borrowed by ${input.memberName}.`,
      level: "info",
      delivery: "digest",
      linkUrl: `/assets/${input.assetId}`,
      eventKey: `asset-borrowed:${input.assetId}:${dayKey(new Date())}`,
    })
  }
}

export async function notifyAssetReturned(input: {
  assetId: string
  assetName: string
  memberId: string
}): Promise<void> {
  const preferences = await getNotificationPreferences()
  if (!preferences.checkoutAlerts) {
    return
  }

  await createNotification({
    recipientMemberId: input.memberId,
    type: "asset.returned",
    title: "Asset return confirmed",
    message: `${input.assetName} was marked as returned.`,
    level: "info",
    delivery: "immediate",
    linkUrl: `/assets/${input.assetId}`,
  })
}

export async function notifyAssetStatusChanged(input: {
  assetId: string
  assetName: string
  fromStatus: AssetStatus
  toStatus: AssetStatus
  assignedMemberId: string | null
}): Promise<void> {
  const preferences = await getNotificationPreferences()
  if (!preferences.maintenanceAlerts) {
    return
  }

  if (input.toStatus !== "maintenance" && input.toStatus !== "retired") {
    return
  }

  const adminMemberIds = await getAdminMemberIds()
  const affectedRecipients = [...adminMemberIds, ...(input.assignedMemberId ? [input.assignedMemberId] : [])]

  await createNotificationsForMembers({
    recipientMemberIds: affectedRecipients,
    type: "asset.status.changed",
    title: `Asset moved to ${input.toStatus}`,
    message: `${input.assetName} changed from ${input.fromStatus} to ${input.toStatus}.`,
    level: input.toStatus === "retired" ? "warning" : "info",
    delivery: "immediate",
    linkUrl: `/assets/${input.assetId}`,
    eventKey: `asset-status:${input.assetId}:${input.toStatus}:${dayKey(new Date())}`,
  })
}

export async function notifyLowInventoryForAsset(input: {
  assetId: string
  assetName: string
  quantity: number
  minimumQuantity: number
}): Promise<void> {
  const preferences = await getNotificationPreferences()
  if (!preferences.lowInventoryAlerts) {
    return
  }

  if (input.minimumQuantity <= 0 || input.quantity > input.minimumQuantity) {
    return
  }

  const adminMemberIds = await getAdminMemberIds()
  await createNotificationsForMembers({
    recipientMemberIds: adminMemberIds,
    type: "inventory.low",
    title: "Low inventory",
    message: `${input.assetName} is low on stock (${input.quantity}/${input.minimumQuantity}).`,
    level: "warning",
    delivery: "immediate",
    linkUrl: `/assets/${input.assetId}`,
    eventKey: `low-inventory:${input.assetId}:${dayKey(new Date())}`,
  })
}

export async function notifyMemberRoleChanged(input: {
  memberId: string
  memberName: string
  fromRole: TeamRole
  toRole: TeamRole
}): Promise<void> {
  if (input.fromRole === input.toRole) {
    return
  }

  const adminMemberIds = await getAdminMemberIds()
  await createNotificationsForMembers({
    recipientMemberIds: adminMemberIds,
    type: "security.member-role-changed",
    title: "Member role changed",
    message: `${input.memberName} role changed from ${input.fromRole} to ${input.toRole}.`,
    level: "critical",
    delivery: "immediate",
    linkUrl: `/team/${input.memberId}`,
    eventKey: `member-role:${input.memberId}:${input.fromRole}:${input.toRole}:${dayKey(new Date())}`,
  })
}

export async function notifyLdapSyncFailed(message: string): Promise<void> {
  const adminMemberIds = await getAdminMemberIds()
  await createNotificationsForMembers({
    recipientMemberIds: adminMemberIds,
    type: "security.ldap-sync-failed",
    title: "LDAP sync failed",
    message,
    level: "critical",
    delivery: "immediate",
    linkUrl: "/settings",
    eventKey: `ldap-sync-failed:${dayKey(new Date())}:${message.slice(0, 80)}`,
  })
}

export async function notifyAuthIntegrationFailed(message: string): Promise<void> {
  const adminMemberIds = await getAdminMemberIds()
  await createNotificationsForMembers({
    recipientMemberIds: adminMemberIds,
    type: "security.auth-integration-failed",
    title: "Authentication integration failure",
    message,
    level: "critical",
    delivery: "immediate",
    linkUrl: "/settings",
    eventKey: `auth-failure:${dayKey(new Date())}:${message.slice(0, 80)}`,
  })
}

export async function notifyQrSettingsChanged(changedFields: string[]): Promise<void> {
  if (changedFields.length === 0) {
    return
  }

  const adminMemberIds = await getAdminMemberIds()
  await createNotificationsForMembers({
    recipientMemberIds: adminMemberIds,
    type: "security.qr-settings-changed",
    title: "Public QR settings changed",
    message: `Updated fields: ${changedFields.join(", ")}`,
    level: "critical",
    delivery: "immediate",
    linkUrl: "/settings",
    eventKey: `qr-settings:${dayKey(new Date())}:${changedFields.join("|")}`,
  })
}

export async function runDueAndOverdueNotifications(referenceDate = new Date()): Promise<{ created: number }> {
  await ensureCoreSchema()

  const preferences = await getNotificationPreferences()
  if (!preferences.bookingAlerts) {
    return { created: 0 }
  }

  const { orm, tables } = getDomainRuntime()
  const nowIso = referenceDate.toISOString()
  const oneDayLaterIso = addDaysIso(referenceDate, 1)
  const sevenDaysLaterIso = addDaysIso(referenceDate, 7)
  const twoDaysAgoIso = addDaysIso(referenceDate, -2)
  const today = dayKey(referenceDate)
  let created = 0

  const openLoans = await orm
    .select({
      id: tables.loansTable.id,
      assetId: tables.loansTable.assetId,
      assetName: tables.assetsTable.name,
      memberId: tables.loansTable.memberId,
      memberName: tables.membersTable.name,
      dueAt: tables.loansTable.dueAt,
    })
    .from(tables.loansTable)
    .leftJoin(tables.assetsTable, eq(tables.assetsTable.id, tables.loansTable.assetId))
    .leftJoin(tables.membersTable, eq(tables.membersTable.id, tables.loansTable.memberId))
    .where(and(isNull(tables.loansTable.returnedAt), not(isNull(tables.loansTable.dueAt))))

  const adminMemberIds = await getAdminMemberIds()

  for (const loan of openLoans as Array<{
    id: string
    assetId: string
    assetName: string | null
    memberId: string
    memberName: string | null
    dueAt: string | null
  }>) {
    if (!loan.dueAt) {
      continue
    }

    const dueAtIso = new Date(loan.dueAt).toISOString()
    const isDueSoon24h = dueAtIso >= nowIso && dueAtIso <= oneDayLaterIso
    const isDueSoon7d = dueAtIso >= nowIso && dueAtIso <= sevenDaysLaterIso
    const isOverdue = dueAtIso < nowIso
    const isOverdue48h = dueAtIso < twoDaysAgoIso

    if (isDueSoon7d) {
      await createNotification({
        recipientMemberId: loan.memberId,
        type: "loan.due-soon",
        title: "Asset due soon",
        message: `${loan.assetName ?? "Asset"} is due on ${new Date(loan.dueAt).toLocaleDateString()}.`,
        level: isDueSoon24h ? "warning" : "info",
        delivery: "immediate",
        linkUrl: `/assets/${loan.assetId}`,
        eventKey: `due-soon:${loan.id}:${isDueSoon24h ? "24h" : "7d"}`,
      })
      created += 1

      if (preferences.digestEnabled) {
        await createNotificationsForMembers({
          recipientMemberIds: adminMemberIds,
          type: "loan.due-soon",
          title: "Assets due soon",
          message: `${loan.assetName ?? "Asset"} borrowed by ${loan.memberName ?? "Unknown"} is due on ${new Date(loan.dueAt).toLocaleDateString()}.`,
          level: "info",
          delivery: "digest",
          linkUrl: `/assets/${loan.assetId}`,
          eventKey: `due-soon-admin:${loan.id}:${today}`,
        })
        created += adminMemberIds.length
      }
    }

    if (isOverdue) {
      await createNotificationsForMembers({
        recipientMemberIds: [loan.memberId, ...adminMemberIds],
        type: "loan.overdue",
        title: "Asset overdue",
        message: `${loan.assetName ?? "Asset"} is overdue since ${new Date(loan.dueAt).toLocaleDateString()}.`,
        level: "critical",
        delivery: "immediate",
        linkUrl: `/assets/${loan.assetId}`,
        eventKey: `overdue-first:${loan.id}`,
      })

      await createNotificationsForMembers({
        recipientMemberIds: [loan.memberId, ...adminMemberIds],
        type: "loan.overdue-reminder",
        title: "Overdue reminder",
        message: `${loan.assetName ?? "Asset"} is still overdue. Please resolve this booking.`,
        level: "critical",
        delivery: "immediate",
        linkUrl: `/assets/${loan.assetId}`,
        eventKey: `overdue-daily:${loan.id}:${today}`,
      })

      if (isOverdue48h && preferences.digestEnabled) {
        await createNotificationsForMembers({
          recipientMemberIds: adminMemberIds,
          type: "loan.overdue-escalated",
          title: "Overdue escalation (>48h)",
          message: `${loan.assetName ?? "Asset"} borrowed by ${loan.memberName ?? "Unknown"} is overdue for more than 48h.`,
          level: "critical",
          delivery: "digest",
          linkUrl: `/assets/${loan.assetId}`,
          eventKey: `overdue-48h:${loan.id}:${today}`,
        })
      }

      created += 1
    }
  }

  return { created }
}
