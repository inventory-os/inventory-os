import { randomUUID } from "node:crypto"
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { databaseClient, db } from "@/lib/db"
import * as pgSchema from "@/lib/db/schema/schema.pg"
import * as sqliteSchema from "@/lib/db/schema/schema.sqlite"
import type { Asset, AssetFile, AssetStatus, LoanRecord } from "@/lib/types"
import { buildAssetQrPayload } from "@/lib/utils/qr-payload"
import { getDomainRuntime } from "@/lib/repository/domain-runtime"
import { ensureCoreSchema } from "@/lib/repository/domains/setup.repository"
import type {
  BorrowAssetInput,
  CreateAssetFileRecordInput,
  CreateAssetInput,
  UpdateAssetInput,
} from "@/lib/types/assets"

type AssetsRepositoryDeps = {
  ensureCoreSchema: () => Promise<void>
}

type AssetJoinedRow = {
  id: string
  name: string
  parentAssetId: string | null
  category: string
  status: string
  producerId: string | null
  producerName: string | null
  model: string | null
  serialNumber: string | null
  sku: string | null
  supplier: string | null
  warrantyUntil: string | null
  assetCondition: "new" | "good" | "fair" | "damaged"
  quantity: number
  minimumQuantity: number
  notes: string | null
  locationId: string | null
  locationName: string | null
  locationFloorNumber: string | null
  locationRoomNumber: string | null
  assignedMemberName: string | null
  value: number
  purchaseDate: string
  lastScanned: string
  tags: string
  createdAt: string
}

function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []
  } catch {
    return []
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

function createRepositoryRuntime() {
  if (databaseClient === "pg") {
    return {
      orm: db as NodePgDatabase<Record<string, never>>,
      tables: {
        assetFilesTable: pgSchema.assetFilesTable,
        assetsTable: pgSchema.assetsTable,
        loansTable: pgSchema.loansTable,
        locationsTable: pgSchema.locationsTable,
        membersTable: pgSchema.membersTable,
        producersTable: pgSchema.producersTable,
      },
    }
  }

  return {
    orm: db as BetterSQLite3Database<Record<string, never>>,
    tables: {
      assetFilesTable: sqliteSchema.assetFilesTable,
      assetsTable: sqliteSchema.assetsTable,
      loansTable: sqliteSchema.loansTable,
      locationsTable: sqliteSchema.locationsTable,
      membersTable: sqliteSchema.membersTable,
      producersTable: sqliteSchema.producersTable,
    },
  }
}

export function createAssetsRepository(deps: AssetsRepositoryDeps) {
  const ensureSchema = deps.ensureCoreSchema
  const runtime = createRepositoryRuntime()
  const orm = runtime.orm as any
  const { assetFilesTable, assetsTable, loansTable, locationsTable, membersTable, producersTable } = runtime.tables

  async function fetchParentNames(parentIds: string[]): Promise<Map<string, string>> {
    if (parentIds.length === 0) {
      return new Map()
    }

    const rows = await orm
      .select({ id: assetsTable.id, name: assetsTable.name })
      .from(assetsTable)
      .where(inArray(assetsTable.id, parentIds))

    return new Map(rows.map((row: { id: string; name: string }) => [row.id, row.name]))
  }

  async function fetchThumbnailIds(assetIds: string[]): Promise<Map<string, string>> {
    if (assetIds.length === 0) {
      return new Map()
    }

    const rows = await orm
      .select({
        assetId: assetFilesTable.assetId,
        id: assetFilesTable.id,
        kind: assetFilesTable.kind,
        mimeType: assetFilesTable.mimeType,
        createdAt: assetFilesTable.createdAt,
      })
      .from(assetFilesTable)
      .where(inArray(assetFilesTable.assetId, assetIds))
      .orderBy(asc(assetFilesTable.createdAt))

    const thumbnails = new Map<string, string>()
    for (const row of rows as Array<{ assetId: string; id: string; kind: string; mimeType: string }>) {
      if (thumbnails.has(row.assetId)) {
        continue
      }
      if (row.kind === "image" || row.mimeType.startsWith("image/")) {
        thumbnails.set(row.assetId, row.id)
      }
    }

    return thumbnails
  }

  async function toAssets(rows: AssetJoinedRow[]): Promise<Asset[]> {
    const parentIds = [...new Set(rows.map((row) => row.parentAssetId).filter((id): id is string => Boolean(id)))]
    const parentNames = await fetchParentNames(parentIds)
    const thumbnails = await fetchThumbnailIds(rows.map((row) => row.id))

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      parentAssetId: row.parentAssetId,
      parentAssetName: row.parentAssetId ? (parentNames.get(row.parentAssetId) ?? null) : null,
      category: row.category,
      status: row.status as AssetStatus,
      producerId: row.producerId,
      producerName: row.producerName,
      model: row.model,
      serialNumber: row.serialNumber,
      sku: row.sku,
      supplier: row.supplier,
      warrantyUntil: row.warrantyUntil,
      condition: row.assetCondition,
      quantity: Number(row.quantity ?? 1),
      minimumQuantity: Number(row.minimumQuantity ?? 0),
      notes: row.notes,
      locationId: row.locationId,
      location: formatLocationLabel(row.locationName, row.locationFloorNumber, row.locationRoomNumber),
      assignedTo: row.assignedMemberName,
      qrCode: buildAssetQrPayload(row.id),
      value: Number(row.value),
      purchaseDate: row.purchaseDate,
      lastScanned: row.lastScanned,
      tags: parseTags(row.tags),
      thumbnailFileId: thumbnails.get(row.id) ?? null,
    }))
  }

  async function selectAssetRowsByCondition(condition?: ReturnType<typeof eq>): Promise<AssetJoinedRow[]> {
    const baseQuery = orm
      .select({
        id: assetsTable.id,
        name: assetsTable.name,
        parentAssetId: assetsTable.parentAssetId,
        category: assetsTable.category,
        status: assetsTable.status,
        producerId: assetsTable.producerId,
        producerName: producersTable.name,
        model: assetsTable.model,
        serialNumber: assetsTable.serialNumber,
        sku: assetsTable.sku,
        supplier: assetsTable.supplier,
        warrantyUntil: assetsTable.warrantyUntil,
        assetCondition: assetsTable.assetCondition,
        quantity: assetsTable.quantity,
        minimumQuantity: assetsTable.minimumQuantity,
        notes: assetsTable.notes,
        locationId: assetsTable.locationId,
        locationName: locationsTable.name,
        locationFloorNumber: locationsTable.floorNumber,
        locationRoomNumber: locationsTable.roomNumber,
        assignedMemberName: membersTable.name,
        value: assetsTable.value,
        purchaseDate: assetsTable.purchaseDate,
        lastScanned: assetsTable.lastScanned,
        tags: assetsTable.tags,
        createdAt: assetsTable.createdAt,
      })
      .from(assetsTable)
      .leftJoin(producersTable, eq(producersTable.id, assetsTable.producerId))
      .leftJoin(locationsTable, eq(locationsTable.id, assetsTable.locationId))
      .leftJoin(membersTable, eq(membersTable.id, assetsTable.assignedMemberId))

    if (condition) {
      return baseQuery.where(condition).orderBy(desc(assetsTable.createdAt)) as unknown as Promise<AssetJoinedRow[]>
    }

    return baseQuery.orderBy(desc(assetsTable.createdAt)) as unknown as Promise<AssetJoinedRow[]>
  }

  async function getAssetParentAndLocation(
    id: string,
  ): Promise<{ id: string; parentAssetId: string | null; locationId: string | null } | null> {
    const rows = await orm
      .select({ id: assetsTable.id, parentAssetId: assetsTable.parentAssetId, locationId: assetsTable.locationId })
      .from(assetsTable)
      .where(eq(assetsTable.id, id))
      .limit(1)

    return rows[0] ?? null
  }

  async function resolveRootAsset(
    inputAssetId: string,
  ): Promise<{ rootAssetId: string; rootLocationId: string | null }> {
    let cursorId = inputAssetId
    const visited = new Set<string>()

    while (true) {
      if (visited.has(cursorId)) {
        throw new Error("Invalid nested asset graph")
      }
      visited.add(cursorId)

      const node = await getAssetParentAndLocation(cursorId)
      if (!node) {
        throw new Error("Parent asset not found")
      }

      if (!node.parentAssetId) {
        return { rootAssetId: node.id, rootLocationId: node.locationId }
      }

      cursorId = node.parentAssetId
    }
  }

  async function isDescendantOf(assetId: string, possibleAncestorId: string): Promise<boolean> {
    let cursorId: string | null = assetId
    const visited = new Set<string>()

    while (cursorId) {
      if (visited.has(cursorId)) {
        break
      }
      visited.add(cursorId)

      const node = await getAssetParentAndLocation(cursorId)
      if (!node?.parentAssetId) {
        return false
      }

      if (node.parentAssetId === possibleAncestorId) {
        return true
      }

      cursorId = node.parentAssetId
    }

    return false
  }

  async function cascadeDescendantLocation(rootAssetId: string, locationId: string | null): Promise<void> {
    const rows = await orm.select({ id: assetsTable.id, parentAssetId: assetsTable.parentAssetId }).from(assetsTable)

    const children = new Map<string, string[]>()
    for (const row of rows as Array<{ id: string; parentAssetId: string | null }>) {
      if (!row.parentAssetId) {
        continue
      }
      const list = children.get(row.parentAssetId) ?? []
      list.push(row.id)
      children.set(row.parentAssetId, list)
    }

    const queue = [...(children.get(rootAssetId) ?? [])]
    const descendantIds: string[] = []
    while (queue.length > 0) {
      const current = queue.shift()!
      descendantIds.push(current)
      for (const childId of children.get(current) ?? []) {
        queue.push(childId)
      }
    }

    if (descendantIds.length === 0) {
      return
    }

    await orm
      .update(assetsTable)
      .set({ locationId, lastScanned: todayIso() })
      .where(inArray(assetsTable.id, descendantIds))
  }

  return {
    async listAssets(): Promise<Asset[]> {
      await ensureSchema()
      return toAssets(await selectAssetRowsByCondition())
    },

    async getAssetById(id: string): Promise<Asset | null> {
      await ensureSchema()
      const assets = await toAssets(await selectAssetRowsByCondition(eq(assetsTable.id, id)))
      return assets[0] ?? null
    },

    async createAsset(input: CreateAssetInput): Promise<Asset> {
      await ensureSchema()

      let resolvedLocationId = input.locationId
      if (input.parentAssetId) {
        const parent = await getAssetParentAndLocation(input.parentAssetId)
        if (!parent) {
          throw new Error("Parent asset not found")
        }
        const root = await resolveRootAsset(input.parentAssetId)
        resolvedLocationId = root.rootLocationId
      }

      const id = makeId("AST")
      await orm.insert(assetsTable).values({
        id,
        name: input.name,
        parentAssetId: input.parentAssetId ?? null,
        category: input.category,
        status: input.status,
        producerId: input.producerId ?? null,
        model: input.model ?? null,
        serialNumber: input.serialNumber ?? null,
        sku: input.sku ?? null,
        supplier: input.supplier ?? null,
        warrantyUntil: input.warrantyUntil ?? null,
        assetCondition: input.condition ?? "good",
        quantity: input.quantity ?? 1,
        minimumQuantity: input.minimumQuantity ?? 0,
        notes: input.notes ?? null,
        locationId: resolvedLocationId,
        assignedMemberId: null,
        qrCode: buildAssetQrPayload(id),
        value: input.value,
        purchaseDate: input.purchaseDate,
        lastScanned: todayIso(),
        tags: JSON.stringify(input.tags),
        createdAt: new Date().toISOString(),
      })

      const asset = await this.getAssetById(id)
      if (!asset) {
        throw new Error("Failed to create asset")
      }
      return asset
    },

    async duplicateAsset(sourceAssetId: string): Promise<Asset | null> {
      await ensureSchema()
      const source = await this.getAssetById(sourceAssetId)
      if (!source) {
        return null
      }

      return this.createAsset({
        name: `${source.name} (Copy)`,
        parentAssetId: source.parentAssetId ?? null,
        category: source.category,
        status: source.status,
        producerId: source.producerId ?? null,
        model: source.model ?? null,
        serialNumber: source.serialNumber ?? null,
        sku: source.sku ?? null,
        supplier: source.supplier ?? null,
        warrantyUntil: source.warrantyUntil ?? null,
        condition: source.condition ?? "good",
        quantity: source.quantity ?? 1,
        minimumQuantity: source.minimumQuantity ?? 0,
        notes: source.notes ?? null,
        locationId: source.locationId ?? null,
        value: source.value,
        purchaseDate: source.purchaseDate,
        tags: source.tags,
      })
    },

    async updateAsset(id: string, input: UpdateAssetInput): Promise<Asset | null> {
      await ensureSchema()
      const existing = await this.getAssetById(id)
      if (!existing) {
        return null
      }

      if (input.parentAssetId && input.parentAssetId === id) {
        throw new Error("Asset cannot be its own parent")
      }

      if (input.parentAssetId && (await isDescendantOf(input.parentAssetId, id))) {
        throw new Error("Cannot assign a descendant as parent")
      }

      let resolvedLocationId = input.locationId
      if (input.parentAssetId) {
        const parent = await getAssetParentAndLocation(input.parentAssetId)
        if (!parent) {
          throw new Error("Parent asset not found")
        }
        const root = await resolveRootAsset(input.parentAssetId)
        resolvedLocationId = root.rootLocationId
      }

      await orm
        .update(assetsTable)
        .set({
          name: input.name,
          parentAssetId: input.parentAssetId ?? null,
          category: input.category,
          status: input.status,
          producerId: input.producerId ?? null,
          model: input.model ?? null,
          serialNumber: input.serialNumber ?? null,
          sku: input.sku ?? null,
          supplier: input.supplier ?? null,
          warrantyUntil: input.warrantyUntil ?? null,
          assetCondition: input.condition ?? "good",
          quantity: input.quantity ?? 1,
          minimumQuantity: input.minimumQuantity ?? 0,
          notes: input.notes ?? null,
          locationId: resolvedLocationId,
          value: input.value,
          purchaseDate: input.purchaseDate,
          tags: JSON.stringify(input.tags),
          lastScanned: todayIso(),
        })
        .where(eq(assetsTable.id, id))

      if (!input.parentAssetId && existing.locationId !== resolvedLocationId) {
        await cascadeDescendantLocation(id, resolvedLocationId)
      } else if (existing.parentAssetId !== (input.parentAssetId ?? null)) {
        await cascadeDescendantLocation(id, resolvedLocationId)
      }

      return this.getAssetById(id)
    },

    async deleteAsset(id: string): Promise<boolean> {
      await ensureSchema()
      const existing = await this.getAssetById(id)
      if (!existing) {
        return false
      }
      await orm.delete(assetsTable).where(eq(assetsTable.id, id))
      return true
    },

    async listAssetChildren(parentAssetId: string): Promise<Asset[]> {
      await ensureSchema()
      const rows = await orm
        .select({
          id: assetsTable.id,
          name: assetsTable.name,
          parentAssetId: assetsTable.parentAssetId,
          category: assetsTable.category,
          status: assetsTable.status,
          producerId: assetsTable.producerId,
          producerName: producersTable.name,
          model: assetsTable.model,
          serialNumber: assetsTable.serialNumber,
          sku: assetsTable.sku,
          supplier: assetsTable.supplier,
          warrantyUntil: assetsTable.warrantyUntil,
          assetCondition: assetsTable.assetCondition,
          quantity: assetsTable.quantity,
          minimumQuantity: assetsTable.minimumQuantity,
          notes: assetsTable.notes,
          locationId: assetsTable.locationId,
          locationName: locationsTable.name,
          locationFloorNumber: locationsTable.floorNumber,
          locationRoomNumber: locationsTable.roomNumber,
          assignedMemberName: membersTable.name,
          value: assetsTable.value,
          purchaseDate: assetsTable.purchaseDate,
          lastScanned: assetsTable.lastScanned,
          tags: assetsTable.tags,
          createdAt: assetsTable.createdAt,
        })
        .from(assetsTable)
        .leftJoin(producersTable, eq(producersTable.id, assetsTable.producerId))
        .leftJoin(locationsTable, eq(locationsTable.id, assetsTable.locationId))
        .leftJoin(membersTable, eq(membersTable.id, assetsTable.assignedMemberId))
        .where(eq(assetsTable.parentAssetId, parentAssetId))
        .orderBy(asc(assetsTable.createdAt))

      return toAssets(rows as unknown as AssetJoinedRow[])
    },

    async listAssetTags(): Promise<Array<{ name: string; count: number }>> {
      const assets = await this.listAssets()
      const counts = new Map<string, { name: string; count: number }>()

      for (const asset of assets) {
        for (const raw of asset.tags) {
          const name = raw.trim()
          if (!name) {
            continue
          }
          const key = name.toLowerCase()
          const existing = counts.get(key)
          if (existing) {
            existing.count += 1
          } else {
            counts.set(key, { name, count: 1 })
          }
        }
      }

      return [...counts.values()].sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count
        }
        return left.name.localeCompare(right.name)
      })
    },

    async listAssetFiles(assetId: string): Promise<AssetFile[]> {
      await ensureSchema()
      const rows = await orm
        .select({
          id: assetFilesTable.id,
          asset_id: assetFilesTable.assetId,
          kind: assetFilesTable.kind,
          original_name: assetFilesTable.originalName,
          mime_type: assetFilesTable.mimeType,
          size_bytes: assetFilesTable.sizeBytes,
          created_at: assetFilesTable.createdAt,
        })
        .from(assetFilesTable)
        .where(eq(assetFilesTable.assetId, assetId))
        .orderBy(desc(assetFilesTable.createdAt))

      return rows.map(
        (row: {
          id: string
          asset_id: string
          kind: string
          original_name: string
          mime_type: string
          size_bytes: number
          created_at: string
        }) => ({
          id: row.id,
          assetId: row.asset_id,
          kind: row.kind as AssetFile["kind"],
          originalName: row.original_name,
          mimeType: row.mime_type,
          sizeBytes: Number(row.size_bytes),
          createdAt: row.created_at,
        }),
      )
    },

    async createAssetFileRecord(input: CreateAssetFileRecordInput): Promise<AssetFile> {
      await ensureSchema()
      const fileId = makeId("FILE")

      await orm.insert(assetFilesTable).values({
        id: fileId,
        assetId: input.assetId,
        kind: input.kind,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storageKey: input.storageKey,
        createdAt: new Date().toISOString(),
      })

      const rows = await this.listAssetFiles(input.assetId)
      const created = rows.find((row) => row.id === fileId)
      if (!created) {
        throw new Error("Failed to create asset file record")
      }
      return created
    },

    async getAssetFileById(assetId: string, fileId: string): Promise<(AssetFile & { storageKey: string }) | null> {
      await ensureSchema()
      const rows = await orm
        .select({
          id: assetFilesTable.id,
          asset_id: assetFilesTable.assetId,
          kind: assetFilesTable.kind,
          original_name: assetFilesTable.originalName,
          mime_type: assetFilesTable.mimeType,
          size_bytes: assetFilesTable.sizeBytes,
          created_at: assetFilesTable.createdAt,
          storage_key: assetFilesTable.storageKey,
        })
        .from(assetFilesTable)
        .where(and(eq(assetFilesTable.assetId, assetId), eq(assetFilesTable.id, fileId)))
        .limit(1)

      const row = rows[0] as
        | {
            id: string
            asset_id: string
            kind: string
            original_name: string
            mime_type: string
            size_bytes: number
            created_at: string
            storage_key: string
          }
        | undefined
      if (!row) {
        return null
      }

      return {
        id: row.id,
        assetId: row.asset_id,
        kind: row.kind as AssetFile["kind"],
        originalName: row.original_name,
        mimeType: row.mime_type,
        sizeBytes: Number(row.size_bytes),
        createdAt: row.created_at,
        storageKey: row.storage_key,
      }
    },

    async deleteAssetFileRecord(assetId: string, fileId: string): Promise<{ storageKey: string } | null> {
      await ensureSchema()
      const row = await this.getAssetFileById(assetId, fileId)
      if (!row) {
        return null
      }
      await orm.delete(assetFilesTable).where(and(eq(assetFilesTable.assetId, assetId), eq(assetFilesTable.id, fileId)))
      return { storageKey: row.storageKey }
    },

    async listAssetsByLocationTree(locationId: string): Promise<Asset[]> {
      await ensureSchema()

      const locations = await orm
        .select({ id: locationsTable.id, parentId: locationsTable.parentId })
        .from(locationsTable)

      const queue = [locationId]
      const visited = new Set<string>()
      while (queue.length > 0) {
        const current = queue.shift()
        if (!current || visited.has(current)) {
          continue
        }
        visited.add(current)
        for (const location of locations as Array<{ id: string; parentId: string | null }>) {
          if (location.parentId === current && !visited.has(location.id)) {
            queue.push(location.id)
          }
        }
      }

      if (visited.size === 0) {
        return []
      }

      const rows = await orm
        .select({
          id: assetsTable.id,
          name: assetsTable.name,
          parentAssetId: assetsTable.parentAssetId,
          category: assetsTable.category,
          status: assetsTable.status,
          producerId: assetsTable.producerId,
          producerName: producersTable.name,
          model: assetsTable.model,
          serialNumber: assetsTable.serialNumber,
          sku: assetsTable.sku,
          supplier: assetsTable.supplier,
          warrantyUntil: assetsTable.warrantyUntil,
          assetCondition: assetsTable.assetCondition,
          quantity: assetsTable.quantity,
          minimumQuantity: assetsTable.minimumQuantity,
          notes: assetsTable.notes,
          locationId: assetsTable.locationId,
          locationName: locationsTable.name,
          locationFloorNumber: locationsTable.floorNumber,
          locationRoomNumber: locationsTable.roomNumber,
          assignedMemberName: membersTable.name,
          value: assetsTable.value,
          purchaseDate: assetsTable.purchaseDate,
          lastScanned: assetsTable.lastScanned,
          tags: assetsTable.tags,
          createdAt: assetsTable.createdAt,
        })
        .from(assetsTable)
        .leftJoin(producersTable, eq(producersTable.id, assetsTable.producerId))
        .leftJoin(locationsTable, eq(locationsTable.id, assetsTable.locationId))
        .leftJoin(membersTable, eq(membersTable.id, assetsTable.assignedMemberId))
        .where(inArray(assetsTable.locationId, [...visited]))
        .orderBy(desc(assetsTable.createdAt))

      return toAssets(rows as unknown as AssetJoinedRow[])
    },

    async borrowAsset(input: BorrowAssetInput): Promise<Asset | null> {
      await ensureSchema()

      const rows = await orm
        .select({ status: assetsTable.status })
        .from(assetsTable)
        .where(eq(assetsTable.id, input.assetId))
        .limit(1)

      const current = rows[0] as { status: string } | undefined
      if (!current) {
        return null
      }
      if ((current.status as AssetStatus) === "retired") {
        throw new Error("Retired assets cannot be borrowed")
      }

      await orm
        .update(loansTable)
        .set({ returnedAt: new Date().toISOString() })
        .where(and(eq(loansTable.assetId, input.assetId), isNull(loansTable.returnedAt)))

      await orm.insert(loansTable).values({
        id: makeId("LOAN"),
        assetId: input.assetId,
        memberId: input.memberId,
        borrowedAt: new Date().toISOString(),
        dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : null,
        notes: input.notes ?? null,
      })

      await orm
        .update(assetsTable)
        .set({ assignedMemberId: input.memberId, status: "in-use", lastScanned: todayIso() })
        .where(eq(assetsTable.id, input.assetId))

      return this.getAssetById(input.assetId)
    },

    async returnAsset(assetId: string): Promise<Asset | null> {
      await ensureSchema()

      const rows = await orm
        .select({ id: assetsTable.id })
        .from(assetsTable)
        .where(eq(assetsTable.id, assetId))
        .limit(1)

      if (!rows[0]) {
        return null
      }

      await orm
        .update(loansTable)
        .set({ returnedAt: new Date().toISOString() })
        .where(and(eq(loansTable.assetId, assetId), isNull(loansTable.returnedAt)))

      await orm
        .update(assetsTable)
        .set({ assignedMemberId: null, status: "available", lastScanned: todayIso() })
        .where(eq(assetsTable.id, assetId))

      return this.getAssetById(assetId)
    },
  }
}

export type AssetsRepository = ReturnType<typeof createAssetsRepository>

const repository = createAssetsRepository({ ensureCoreSchema })

export const listAssets = (
  ...args: Parameters<typeof repository.listAssets>
): ReturnType<typeof repository.listAssets> => repository.listAssets(...args)
export const getAssetById = (
  ...args: Parameters<typeof repository.getAssetById>
): ReturnType<typeof repository.getAssetById> => repository.getAssetById(...args)
export const createAsset = (
  ...args: Parameters<typeof repository.createAsset>
): ReturnType<typeof repository.createAsset> => repository.createAsset(...args)
export const duplicateAsset = (
  ...args: Parameters<typeof repository.duplicateAsset>
): ReturnType<typeof repository.duplicateAsset> => repository.duplicateAsset(...args)
export const updateAsset = (
  ...args: Parameters<typeof repository.updateAsset>
): ReturnType<typeof repository.updateAsset> => repository.updateAsset(...args)
export const deleteAsset = (
  ...args: Parameters<typeof repository.deleteAsset>
): ReturnType<typeof repository.deleteAsset> => repository.deleteAsset(...args)
export const listAssetChildren = (
  ...args: Parameters<typeof repository.listAssetChildren>
): ReturnType<typeof repository.listAssetChildren> => repository.listAssetChildren(...args)
export const listAssetTags = (
  ...args: Parameters<typeof repository.listAssetTags>
): ReturnType<typeof repository.listAssetTags> => repository.listAssetTags(...args)
export const listAssetFiles = (
  ...args: Parameters<typeof repository.listAssetFiles>
): ReturnType<typeof repository.listAssetFiles> => repository.listAssetFiles(...args)
export const createAssetFileRecord = (
  ...args: Parameters<typeof repository.createAssetFileRecord>
): ReturnType<typeof repository.createAssetFileRecord> => repository.createAssetFileRecord(...args)
export const getAssetFileById = (
  ...args: Parameters<typeof repository.getAssetFileById>
): ReturnType<typeof repository.getAssetFileById> => repository.getAssetFileById(...args)
export const deleteAssetFileRecord = (
  ...args: Parameters<typeof repository.deleteAssetFileRecord>
): ReturnType<typeof repository.deleteAssetFileRecord> => repository.deleteAssetFileRecord(...args)
export const listAssetsByLocationTree = (
  ...args: Parameters<typeof repository.listAssetsByLocationTree>
): ReturnType<typeof repository.listAssetsByLocationTree> => repository.listAssetsByLocationTree(...args)
export const borrowAsset = (
  ...args: Parameters<typeof repository.borrowAsset>
): ReturnType<typeof repository.borrowAsset> => repository.borrowAsset(...args)
export const returnAsset = (
  ...args: Parameters<typeof repository.returnAsset>
): ReturnType<typeof repository.returnAsset> => repository.returnAsset(...args)

export async function getOpenLoanForAsset(assetId: string): Promise<{ memberId: string; memberName: string } | null> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const rows = await orm
    .select({
      memberId: tables.loansTable.memberId,
      memberName: tables.membersTable.name,
    })
    .from(tables.loansTable)
    .leftJoin(tables.membersTable, eq(tables.membersTable.id, tables.loansTable.memberId))
    .where(and(eq(tables.loansTable.assetId, assetId), isNull(tables.loansTable.returnedAt)))
    .orderBy(desc(tables.loansTable.borrowedAt))

  const open = rows[0] as { memberId: string; memberName: string | null } | undefined
  if (!open || !open.memberName) {
    return null
  }

  return {
    memberId: open.memberId,
    memberName: open.memberName,
  }
}

export async function getAssetHistory(assetId: string): Promise<LoanRecord[]> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const rows = await orm
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
    .where(eq(tables.loansTable.assetId, assetId))
    .orderBy(desc(tables.loansTable.borrowedAt))

  return (
    rows as Array<{
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
  }))
}
