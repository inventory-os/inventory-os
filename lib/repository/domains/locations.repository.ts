import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import type { LocationData, LocationKind } from "@/lib/types"
import { ensureCoreSchema } from "@/lib/repository/domains/setup.repository"
import { getDomainRuntime } from "@/lib/repository/domain-runtime"

type LocationWriteInput = {
  name: string
  addressId?: string | null
  address?: string
  addressLine1?: string
  addressLine2?: string | null
  city?: string
  postalCode?: string
  country?: string
  floorNumber?: string | null
  roomNumber?: string | null
  parentId?: string | null
  kind?: LocationKind
}

function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

function formatLocationAddress(input: {
  line1?: string | null
  line2?: string | null
  city?: string | null
  postalCode?: string | null
  country?: string | null
  fallback?: string | null
}): string {
  const parts: string[] = []
  const line1 = input.line1?.trim()
  const line2 = input.line2?.trim()
  const city = input.city?.trim()
  const postalCode = input.postalCode?.trim()
  const country = input.country?.trim()

  if (line1) {
    parts.push(line1)
  }
  if (line2) {
    parts.push(line2)
  }

  const postalCity = [postalCode, city].filter(Boolean).join(" ")
  if (postalCity) {
    parts.push(postalCity)
  }

  if (country) {
    parts.push(country)
  }

  if (parts.length > 0) {
    return parts.join(", ")
  }

  return input.fallback?.trim() || ""
}

function buildLocationCode(floorNumber?: string | null, roomNumber?: string | null): string | null {
  const floor = floorNumber?.trim() || ""
  const room = roomNumber?.trim() || ""
  if (floor && room) {
    return `${floor}.${room}`
  }
  if (room) {
    return room
  }
  if (floor) {
    return floor
  }
  return null
}

function locationPathLabel(input: { name: string; floorNumber?: string | null; roomNumber?: string | null }): string {
  const code = buildLocationCode(input.floorNumber, input.roomNumber)
  return code ? `${code} ${input.name}` : input.name
}

async function getAddressById(addressId: string) {
  const { orm, tables } = getDomainRuntime()
  const rows = await orm
    .select({
      id: tables.addressesTable.id,
      addressLine1: tables.addressesTable.addressLine1,
      addressLine2: tables.addressesTable.addressLine2,
      city: tables.addressesTable.city,
      postalCode: tables.addressesTable.postalCode,
      country: tables.addressesTable.country,
    })
    .from(tables.addressesTable)
    .where(eq(tables.addressesTable.id, addressId))
    .limit(1)

  return rows[0] as
    | {
        id: string
        addressLine1: string
        addressLine2: string | null
        city: string
        postalCode: string
        country: string
      }
    | undefined
}

export async function listLocations(): Promise<LocationData[]> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const locationRows = await orm
    .select({
      id: tables.locationsTable.id,
      name: tables.locationsTable.name,
      address: tables.locationsTable.address,
      addressId: tables.locationsTable.addressId,
      addressLine1: tables.locationsTable.addressLine1,
      addressLine2: tables.locationsTable.addressLine2,
      city: tables.locationsTable.city,
      postalCode: tables.locationsTable.postalCode,
      country: tables.locationsTable.country,
      floorNumber: tables.locationsTable.floorNumber,
      roomNumber: tables.locationsTable.roomNumber,
      kind: tables.locationsTable.kind,
      parentId: tables.locationsTable.parentId,
    })
    .from(tables.locationsTable)
    .orderBy(tables.locationsTable.name)

  const addressRows = await orm
    .select({
      id: tables.addressesTable.id,
      addressLine1: tables.addressesTable.addressLine1,
      addressLine2: tables.addressesTable.addressLine2,
      city: tables.addressesTable.city,
      postalCode: tables.addressesTable.postalCode,
      country: tables.addressesTable.country,
    })
    .from(tables.addressesTable)

  const assetsRows = await orm.select({ locationId: tables.assetsTable.locationId }).from(tables.assetsTable)

  const addressById = new Map(
    (
      addressRows as Array<{
        id: string
        addressLine1: string
        addressLine2: string | null
        city: string
        postalCode: string
        country: string
      }>
    ).map((row) => [row.id, row]),
  )

  const directCounts = new Map<string, number>()
  for (const row of assetsRows as Array<{ locationId: string | null }>) {
    if (!row.locationId) {
      continue
    }
    directCounts.set(row.locationId, (directCounts.get(row.locationId) ?? 0) + 1)
  }

  const base = (
    locationRows as Array<{
      id: string
      name: string
      address: string
      addressId: string | null
      addressLine1: string | null
      addressLine2: string | null
      city: string | null
      postalCode: string | null
      country: string | null
      floorNumber: string | null
      roomNumber: string | null
      kind: string
      parentId: string | null
    }>
  ).map((row) => {
    const linked = row.addressId ? addressById.get(row.addressId) : null
    const addressLine1 = linked?.addressLine1 ?? row.addressLine1 ?? ""
    const addressLine2 = linked?.addressLine2 ?? row.addressLine2
    const city = linked?.city ?? row.city ?? ""
    const postalCode = linked?.postalCode ?? row.postalCode ?? ""
    const country = linked?.country ?? row.country ?? ""

    return {
      id: row.id,
      name: row.name,
      address: formatLocationAddress({
        line1: addressLine1,
        line2: addressLine2,
        city,
        postalCode,
        country,
        fallback: row.address,
      }),
      addressId: row.addressId,
      addressLine1,
      addressLine2,
      city,
      postalCode,
      country,
      floorNumber: row.floorNumber,
      roomNumber: row.roomNumber,
      locationCode: buildLocationCode(row.floorNumber, row.roomNumber),
      kind: (row.kind ?? "building") as LocationKind,
      parentId: row.parentId,
      directAssetCount: directCounts.get(row.id) ?? 0,
    }
  })

  const byId = new Map(base.map((entry) => [entry.id, entry]))
  const children = new Map<string, string[]>()
  for (const entry of base) {
    if (!entry.parentId) {
      continue
    }
    const existing = children.get(entry.parentId) ?? []
    existing.push(entry.id)
    children.set(entry.parentId, existing)
  }

  const metaCache = new Map<string, { level: number; path: string }>()
  const getMeta = (id: string): { level: number; path: string } => {
    const cached = metaCache.get(id)
    if (cached) {
      return cached
    }

    const node = byId.get(id)
    if (!node) {
      return { level: 0, path: "" }
    }

    if (!node.parentId || !byId.has(node.parentId)) {
      const rootMeta = {
        level: 0,
        path: locationPathLabel({ name: node.name, floorNumber: node.floorNumber, roomNumber: node.roomNumber }),
      }
      metaCache.set(id, rootMeta)
      return rootMeta
    }

    const parentMeta = getMeta(node.parentId)
    const meta = {
      level: parentMeta.level + 1,
      path: `${parentMeta.path} / ${locationPathLabel({ name: node.name, floorNumber: node.floorNumber, roomNumber: node.roomNumber })}`,
    }
    metaCache.set(id, meta)
    return meta
  }

  const totalCache = new Map<string, number>()
  const getTotalAssets = (id: string): number => {
    const cached = totalCache.get(id)
    if (cached !== undefined) {
      return cached
    }
    const node = byId.get(id)
    if (!node) {
      return 0
    }
    const childIds = children.get(id) ?? []
    const total = node.directAssetCount + childIds.reduce((sum, childId) => sum + getTotalAssets(childId), 0)
    totalCache.set(id, total)
    return total
  }

  const roots = base
    .filter((entry) => !entry.parentId || !byId.has(entry.parentId))
    .sort((left, right) => left.name.localeCompare(right.name))

  const ordered: LocationData[] = []
  const walk = (id: string) => {
    const node = byId.get(id)
    if (!node) {
      return
    }
    const meta = getMeta(id)
    ordered.push({
      id: node.id,
      name: node.name,
      address: node.address,
      addressId: node.addressId,
      addressLine1: node.addressLine1,
      addressLine2: node.addressLine2,
      city: node.city,
      postalCode: node.postalCode,
      country: node.country,
      floorNumber: node.floorNumber,
      roomNumber: node.roomNumber,
      locationCode: node.locationCode,
      kind: node.kind,
      parentId: node.parentId,
      level: meta.level,
      path: meta.path,
      directAssetCount: node.directAssetCount,
      assetCount: getTotalAssets(id),
    })

    const childIds = (children.get(id) ?? [])
      .slice()
      .sort((left, right) => (byId.get(left)?.name ?? "").localeCompare(byId.get(right)?.name ?? ""))
    for (const childId of childIds) {
      walk(childId)
    }
  }

  for (const root of roots) {
    walk(root.id)
  }

  return ordered
}

export async function getLocationById(id: string): Promise<LocationData | null> {
  const locations = await listLocations()
  return locations.find((location) => location.id === id) ?? null
}

export async function createLocation(input: LocationWriteInput): Promise<LocationData> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  let linkedAddress: Awaited<ReturnType<typeof getAddressById>> | null = null
  if (input.addressId) {
    linkedAddress = (await getAddressById(input.addressId)) ?? null
    if (!linkedAddress) {
      throw new Error("Address not found")
    }
  }

  const addressLine1 = linkedAddress?.addressLine1 || input.addressLine1?.trim() || input.address?.trim() || ""
  const addressLine2 = linkedAddress?.addressLine2 || input.addressLine2?.trim() || null
  const city = linkedAddress?.city || input.city?.trim() || ""
  const postalCode = linkedAddress?.postalCode || input.postalCode?.trim() || ""
  const country = linkedAddress?.country || input.country?.trim() || ""
  const floorNumber = input.floorNumber?.trim() || null
  const roomNumber = input.roomNumber?.trim() || null
  const displayAddress = formatLocationAddress({ line1: addressLine1, line2: addressLine2, city, postalCode, country })

  const id = makeId("LOC")
  await orm.insert(tables.locationsTable).values({
    id,
    name: input.name,
    address: displayAddress,
    addressId: input.addressId ?? null,
    addressLine1: addressLine1 || null,
    addressLine2,
    city: city || null,
    postalCode: postalCode || null,
    country: country || null,
    floorNumber,
    roomNumber,
    parentId: input.parentId ?? null,
    kind: input.kind ?? "building",
    createdAt: new Date().toISOString(),
  })

  const all = await listLocations()
  const created = all.find((location) => location.id === id)
  if (!created) {
    throw new Error("Failed to create location")
  }
  return created
}

export async function updateLocation(id: string, input: LocationWriteInput): Promise<LocationData | null> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  let linkedAddress: Awaited<ReturnType<typeof getAddressById>> | null = null
  if (input.addressId) {
    linkedAddress = (await getAddressById(input.addressId)) ?? null
    if (!linkedAddress) {
      throw new Error("Address not found")
    }
  }

  const addressLine1 = linkedAddress?.addressLine1 || input.addressLine1?.trim() || input.address?.trim() || ""
  const addressLine2 = linkedAddress?.addressLine2 || input.addressLine2?.trim() || null
  const city = linkedAddress?.city || input.city?.trim() || ""
  const postalCode = linkedAddress?.postalCode || input.postalCode?.trim() || ""
  const country = linkedAddress?.country || input.country?.trim() || ""
  const floorNumber = input.floorNumber?.trim() || null
  const roomNumber = input.roomNumber?.trim() || null
  const displayAddress = formatLocationAddress({ line1: addressLine1, line2: addressLine2, city, postalCode, country })

  const existing = await orm
    .select({ id: tables.locationsTable.id })
    .from(tables.locationsTable)
    .where(eq(tables.locationsTable.id, id))
    .limit(1)

  if (!existing[0]) {
    return null
  }

  if (input.parentId === id) {
    throw new Error("Location cannot be its own parent")
  }

  await orm
    .update(tables.locationsTable)
    .set({
      name: input.name,
      address: displayAddress,
      addressId: input.addressId ?? null,
      addressLine1: addressLine1 || null,
      addressLine2,
      city: city || null,
      postalCode: postalCode || null,
      country: country || null,
      floorNumber,
      roomNumber,
      parentId: input.parentId ?? null,
      kind: input.kind ?? "building",
    })
    .where(eq(tables.locationsTable.id, id))

  const all = await listLocations()
  return all.find((location) => location.id === id) ?? null
}

export async function deleteLocation(id: string): Promise<boolean> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const existing = await orm
    .select({ id: tables.locationsTable.id })
    .from(tables.locationsTable)
    .where(eq(tables.locationsTable.id, id))
    .limit(1)

  if (!existing[0]) {
    return false
  }

  await orm.update(tables.assetsTable).set({ locationId: null }).where(eq(tables.assetsTable.locationId, id))

  await orm.delete(tables.locationsTable).where(eq(tables.locationsTable.id, id))
  return true
}
