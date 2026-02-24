import { randomUUID } from "node:crypto"
import { and, desc, eq, inArray } from "drizzle-orm"
import type {
  IncidentFile,
  IncidentFileKind,
  IncidentRecord,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
} from "@/lib/types"
import { ensureCoreSchema } from "@/lib/repository/domains/setup.repository"
import { getDomainRuntime } from "@/lib/repository/domain-runtime"

type IncidentCreateInput = {
  assetId: string
  incidentType: IncidentType
  title: string
  description: string
  severity: IncidentSeverity
  occurredAt?: string | null
  estimatedRepairCost?: number | null
  reportedBy: string
}

type IncidentUpdateInput = {
  assetId?: string
  status?: IncidentStatus
  incidentType?: IncidentType
  severity?: IncidentSeverity
  title?: string
  description?: string
  occurredAt?: string | null
  estimatedRepairCost?: number | null
  resolutionNotes?: string | null
}

type IncidentFileCreateInput = {
  incidentId: string
  kind: IncidentFileKind
  originalName: string
  mimeType: string
  sizeBytes: number
  storageKey: string
}

function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

function toIncidentRecord(
  row: {
    id: string
    assetId: string
    assetName: string | null
    incidentType: IncidentType
    title: string
    description: string
    severity: IncidentSeverity
    status: IncidentStatus
    reportedBy: string
    occurredAt: string | null
    estimatedRepairCost: number | null
    reportedAt: string
    resolvedAt: string | null
    resolutionNotes: string | null
    updatedAt: string
  },
  attachmentCount: number,
): IncidentRecord {
  return {
    id: row.id,
    assetId: row.assetId,
    assetName: row.assetName ?? "Unknown asset",
    incidentType: row.incidentType,
    title: row.title,
    description: row.description,
    severity: row.severity,
    status: row.status,
    reportedBy: row.reportedBy,
    occurredAt: row.occurredAt,
    estimatedRepairCost: row.estimatedRepairCost,
    reportedAt: row.reportedAt,
    resolvedAt: row.resolvedAt,
    resolutionNotes: row.resolutionNotes,
    attachmentCount,
    updatedAt: row.updatedAt,
  }
}

function toIncidentFile(row: {
  id: string
  incidentId: string
  kind: string
  originalName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}): IncidentFile {
  return {
    id: row.id,
    incidentId: row.incidentId,
    kind: row.kind as IncidentFileKind,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: Number(row.sizeBytes),
    createdAt: row.createdAt,
  }
}

export async function listIncidents(input?: {
  assetId?: string
  status?: IncidentStatus | "all" | null
  search?: string
}): Promise<IncidentRecord[]> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const incidentRows = await orm
    .select({
      id: tables.incidentsTable.id,
      assetId: tables.incidentsTable.assetId,
      assetName: tables.assetsTable.name,
      incidentType: tables.incidentsTable.incidentType,
      title: tables.incidentsTable.title,
      description: tables.incidentsTable.description,
      severity: tables.incidentsTable.severity,
      status: tables.incidentsTable.status,
      reportedBy: tables.incidentsTable.reportedBy,
      occurredAt: tables.incidentsTable.occurredAt,
      estimatedRepairCost: tables.incidentsTable.estimatedRepairCost,
      reportedAt: tables.incidentsTable.reportedAt,
      resolvedAt: tables.incidentsTable.resolvedAt,
      resolutionNotes: tables.incidentsTable.resolutionNotes,
      updatedAt: tables.incidentsTable.updatedAt,
    })
    .from(tables.incidentsTable)
    .leftJoin(tables.assetsTable, eq(tables.assetsTable.id, tables.incidentsTable.assetId))
    .orderBy(desc(tables.incidentsTable.reportedAt))

  const incidentIds = (incidentRows as Array<{ id: string }>).map((row) => row.id)
  const fileCounts = new Map<string, number>()
  if (incidentIds.length > 0) {
    const fileRows = await orm
      .select({ incidentId: tables.incidentFilesTable.incidentId })
      .from(tables.incidentFilesTable)
      .where(inArray(tables.incidentFilesTable.incidentId, incidentIds))

    for (const row of fileRows as Array<{ incidentId: string }>) {
      fileCounts.set(row.incidentId, (fileCounts.get(row.incidentId) ?? 0) + 1)
    }
  }

  const normalizedSearch = input?.search?.trim().toLowerCase() ?? ""
  const searchTerms = normalizedSearch
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  const filtered = (
    incidentRows as Array<{
      id: string
      assetId: string
      assetName: string | null
      incidentType: IncidentType
      title: string
      description: string
      severity: IncidentSeverity
      status: IncidentStatus
      reportedBy: string
      occurredAt: string | null
      estimatedRepairCost: number | null
      reportedAt: string
      resolvedAt: string | null
      resolutionNotes: string | null
      updatedAt: string
    }>
  ).filter((row) => {
    const matchesAsset = !input?.assetId || row.assetId === input.assetId
    const matchesStatus = !input?.status || input.status === "all" || row.status === input.status
    const searchable =
      `${row.id} ${row.assetName ?? ""} ${row.title} ${row.description} ${row.severity} ${row.status} ${row.reportedBy}`.toLowerCase()
    const matchesSearch = searchTerms.length === 0 || searchTerms.every((term) => searchable.includes(term))
    return matchesAsset && matchesStatus && matchesSearch
  })

  return filtered.map((row) => toIncidentRecord(row, fileCounts.get(row.id) ?? 0))
}

export async function listAssetIncidents(assetId: string): Promise<IncidentRecord[]> {
  return listIncidents({ assetId })
}

export async function createIncident(input: IncidentCreateInput): Promise<IncidentRecord> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const asset = await orm
    .select({ id: tables.assetsTable.id })
    .from(tables.assetsTable)
    .where(eq(tables.assetsTable.id, input.assetId))
    .limit(1)

  if (!asset[0]) {
    throw new Error("Asset not found")
  }

  const id = makeId("INC")
  const nowIso = new Date().toISOString()

  await orm.insert(tables.incidentsTable).values({
    id,
    assetId: input.assetId,
    incidentType: input.incidentType,
    title: input.title.trim(),
    description: input.description.trim(),
    severity: input.severity,
    status: "open",
    reportedBy: input.reportedBy.trim() || "System",
    occurredAt: input.occurredAt?.trim() ? new Date(input.occurredAt).toISOString() : null,
    estimatedRepairCost: input.estimatedRepairCost ?? null,
    reportedAt: nowIso,
    resolvedAt: null,
    resolutionNotes: null,
    updatedAt: nowIso,
  })

  const created = (await listIncidents()).find((entry) => entry.id === id)
  if (!created) {
    throw new Error("Failed to create incident")
  }
  return created
}

export async function updateIncident(id: string, input: IncidentUpdateInput): Promise<IncidentRecord | null> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const existingRows = await orm
    .select({
      id: tables.incidentsTable.id,
      assetId: tables.incidentsTable.assetId,
      status: tables.incidentsTable.status,
      incidentType: tables.incidentsTable.incidentType,
      severity: tables.incidentsTable.severity,
      title: tables.incidentsTable.title,
      description: tables.incidentsTable.description,
      occurredAt: tables.incidentsTable.occurredAt,
      estimatedRepairCost: tables.incidentsTable.estimatedRepairCost,
      resolutionNotes: tables.incidentsTable.resolutionNotes,
    })
    .from(tables.incidentsTable)
    .where(eq(tables.incidentsTable.id, id))
    .limit(1)

  const existing = existingRows[0] as
    | {
        id: string
        assetId: string
        status: IncidentStatus
        incidentType: IncidentType
        severity: IncidentSeverity
        title: string
        description: string
        occurredAt: string | null
        estimatedRepairCost: number | null
        resolutionNotes: string | null
      }
    | undefined

  if (!existing) {
    return null
  }

  const nextAssetId = input.assetId?.trim() || existing.assetId
  const nextStatus = input.status ?? existing.status
  const nextIncidentType = input.incidentType ?? existing.incidentType
  const nextSeverity = input.severity ?? existing.severity
  const nextTitle = input.title?.trim() || existing.title
  const nextDescription = input.description?.trim() || existing.description
  const nextOccurredAt =
    input.occurredAt === undefined
      ? existing.occurredAt
      : input.occurredAt?.trim()
        ? new Date(input.occurredAt).toISOString()
        : null
  const nextEstimatedRepairCost =
    input.estimatedRepairCost === undefined ? existing.estimatedRepairCost : input.estimatedRepairCost
  const nextResolutionNotes =
    input.resolutionNotes === undefined ? existing.resolutionNotes : input.resolutionNotes?.trim() || null
  const resolvedAt = nextStatus === "resolved" ? new Date().toISOString() : null

  if (nextAssetId !== existing.assetId) {
    const linkedAsset = await orm
      .select({ id: tables.assetsTable.id })
      .from(tables.assetsTable)
      .where(eq(tables.assetsTable.id, nextAssetId))
      .limit(1)

    if (!linkedAsset[0]) {
      throw new Error("Linked asset not found")
    }
  }

  await orm
    .update(tables.incidentsTable)
    .set({
      assetId: nextAssetId,
      status: nextStatus,
      incidentType: nextIncidentType,
      severity: nextSeverity,
      title: nextTitle,
      description: nextDescription,
      occurredAt: nextOccurredAt,
      estimatedRepairCost: nextEstimatedRepairCost,
      resolvedAt,
      resolutionNotes: nextResolutionNotes,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tables.incidentsTable.id, id))

  return (await listIncidents()).find((entry) => entry.id === id) ?? null
}

export async function deleteIncident(id: string): Promise<{ incident: IncidentRecord; storageKeys: string[] } | null> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const incident = (await listIncidents()).find((entry) => entry.id === id)
  if (!incident) {
    return null
  }

  const fileRows = await orm
    .select({ storageKey: tables.incidentFilesTable.storageKey })
    .from(tables.incidentFilesTable)
    .where(eq(tables.incidentFilesTable.incidentId, id))

  await orm.delete(tables.incidentsTable).where(eq(tables.incidentsTable.id, id))

  return {
    incident,
    storageKeys: (fileRows as Array<{ storageKey: string }>).map((row) => row.storageKey),
  }
}

export async function listIncidentFiles(incidentId: string): Promise<IncidentFile[]> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const rows = await orm
    .select({
      id: tables.incidentFilesTable.id,
      incidentId: tables.incidentFilesTable.incidentId,
      kind: tables.incidentFilesTable.kind,
      originalName: tables.incidentFilesTable.originalName,
      mimeType: tables.incidentFilesTable.mimeType,
      sizeBytes: tables.incidentFilesTable.sizeBytes,
      createdAt: tables.incidentFilesTable.createdAt,
    })
    .from(tables.incidentFilesTable)
    .where(eq(tables.incidentFilesTable.incidentId, incidentId))
    .orderBy(desc(tables.incidentFilesTable.createdAt))

  return (
    rows as Array<{
      id: string
      incidentId: string
      kind: string
      originalName: string
      mimeType: string
      sizeBytes: number
      createdAt: string
    }>
  ).map(toIncidentFile)
}

export async function createIncidentFileRecord(input: IncidentFileCreateInput): Promise<IncidentFile> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const fileId = makeId("IFILE")
  await orm.insert(tables.incidentFilesTable).values({
    id: fileId,
    incidentId: input.incidentId,
    kind: input.kind,
    originalName: input.originalName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    storageKey: input.storageKey,
    createdAt: new Date().toISOString(),
  })

  const created = await getIncidentFileById(input.incidentId, fileId)
  if (!created) {
    throw new Error("Failed to create incident file record")
  }

  return {
    id: created.id,
    incidentId: created.incidentId,
    kind: created.kind,
    originalName: created.originalName,
    mimeType: created.mimeType,
    sizeBytes: created.sizeBytes,
    createdAt: created.createdAt,
  }
}

export async function getIncidentFileById(
  incidentId: string,
  fileId: string,
): Promise<(IncidentFile & { storageKey: string }) | null> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const rows = await orm
    .select({
      id: tables.incidentFilesTable.id,
      incidentId: tables.incidentFilesTable.incidentId,
      kind: tables.incidentFilesTable.kind,
      originalName: tables.incidentFilesTable.originalName,
      mimeType: tables.incidentFilesTable.mimeType,
      sizeBytes: tables.incidentFilesTable.sizeBytes,
      createdAt: tables.incidentFilesTable.createdAt,
      storageKey: tables.incidentFilesTable.storageKey,
    })
    .from(tables.incidentFilesTable)
    .where(and(eq(tables.incidentFilesTable.incidentId, incidentId), eq(tables.incidentFilesTable.id, fileId)))
    .limit(1)

  const row = rows[0] as
    | {
        id: string
        incidentId: string
        kind: string
        originalName: string
        mimeType: string
        sizeBytes: number
        createdAt: string
        storageKey: string
      }
    | undefined

  if (!row) {
    return null
  }

  return {
    ...toIncidentFile(row),
    storageKey: row.storageKey,
  }
}

export async function deleteIncidentFileRecord(
  incidentId: string,
  fileId: string,
): Promise<{ storageKey: string } | null> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const row = await getIncidentFileById(incidentId, fileId)
  if (!row) {
    return null
  }

  await orm
    .delete(tables.incidentFilesTable)
    .where(and(eq(tables.incidentFilesTable.incidentId, incidentId), eq(tables.incidentFilesTable.id, fileId)))

  return { storageKey: row.storageKey }
}
