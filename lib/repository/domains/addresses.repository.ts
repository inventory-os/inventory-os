import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import type { AddressRecord } from "@/lib/types"
import { ensureCoreSchema } from "@/lib/repository/domains/setup.repository"
import { getDomainRuntime } from "@/lib/repository/domain-runtime"

type AddressWriteInput = {
  label: string
  addressLine1: string
  addressLine2?: string | null
  postalCode: string
  city: string
  country: string
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

function normalizeAddressInput(input: AddressWriteInput): Required<AddressWriteInput> {
  return {
    label: input.label.trim(),
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2?.trim() || null,
    postalCode: input.postalCode.trim(),
    city: input.city.trim(),
    country: input.country.trim(),
  }
}

function mapAddressRow(
  row: {
    id: string
    label: string
    addressLine1: string
    addressLine2: string | null
    postalCode: string
    city: string
    country: string
  },
  locationCount: number,
): AddressRecord {
  return {
    id: row.id,
    label: row.label,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    postalCode: row.postalCode,
    city: row.city,
    country: row.country,
    fullAddress: formatLocationAddress({
      line1: row.addressLine1,
      line2: row.addressLine2,
      postalCode: row.postalCode,
      city: row.city,
      country: row.country,
    }),
    locationCount,
  }
}

export async function listAddresses(): Promise<AddressRecord[]> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const addresses = await orm
    .select({
      id: tables.addressesTable.id,
      label: tables.addressesTable.label,
      addressLine1: tables.addressesTable.addressLine1,
      addressLine2: tables.addressesTable.addressLine2,
      postalCode: tables.addressesTable.postalCode,
      city: tables.addressesTable.city,
      country: tables.addressesTable.country,
    })
    .from(tables.addressesTable)
    .orderBy(tables.addressesTable.label)

  const locationRows = await orm.select({ addressId: tables.locationsTable.addressId }).from(tables.locationsTable)

  const counts = new Map<string, number>()
  for (const row of locationRows as Array<{ addressId: string | null }>) {
    if (!row.addressId) {
      continue
    }
    counts.set(row.addressId, (counts.get(row.addressId) ?? 0) + 1)
  }

  return (
    addresses as Array<{
      id: string
      label: string
      addressLine1: string
      addressLine2: string | null
      postalCode: string
      city: string
      country: string
    }>
  ).map((row) => mapAddressRow(row, counts.get(row.id) ?? 0))
}

export async function createAddress(input: AddressWriteInput): Promise<AddressRecord> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()
  const normalized = normalizeAddressInput(input)
  const id = makeId("ADR")

  await orm.insert(tables.addressesTable).values({
    id,
    label: normalized.label,
    addressLine1: normalized.addressLine1,
    addressLine2: normalized.addressLine2,
    postalCode: normalized.postalCode,
    city: normalized.city,
    country: normalized.country,
    createdAt: new Date().toISOString(),
  })

  const created = (await listAddresses()).find((entry) => entry.id === id)
  if (!created) {
    throw new Error("Failed to create address")
  }
  return created
}

export async function updateAddress(id: string, input: AddressWriteInput): Promise<AddressRecord | null> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()
  const normalized = normalizeAddressInput(input)

  const existing = await orm
    .select({ id: tables.addressesTable.id })
    .from(tables.addressesTable)
    .where(eq(tables.addressesTable.id, id))
    .limit(1)

  if (!existing[0]) {
    return null
  }

  await orm
    .update(tables.addressesTable)
    .set({
      label: normalized.label,
      addressLine1: normalized.addressLine1,
      addressLine2: normalized.addressLine2,
      postalCode: normalized.postalCode,
      city: normalized.city,
      country: normalized.country,
    })
    .where(eq(tables.addressesTable.id, id))

  await orm
    .update(tables.locationsTable)
    .set({
      address: formatLocationAddress({
        line1: normalized.addressLine1,
        line2: normalized.addressLine2,
        postalCode: normalized.postalCode,
        city: normalized.city,
        country: normalized.country,
      }),
      addressLine1: normalized.addressLine1,
      addressLine2: normalized.addressLine2,
      postalCode: normalized.postalCode,
      city: normalized.city,
      country: normalized.country,
    })
    .where(eq(tables.locationsTable.addressId, id))

  return (await listAddresses()).find((entry) => entry.id === id) ?? null
}

export async function deleteAddress(id: string): Promise<boolean> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const inUseRows = await orm
    .select({ id: tables.locationsTable.id })
    .from(tables.locationsTable)
    .where(eq(tables.locationsTable.addressId, id))
    .limit(1)

  if (inUseRows[0]) {
    throw new Error("Address is linked to one or more locations")
  }

  const existing = await orm
    .select({ id: tables.addressesTable.id })
    .from(tables.addressesTable)
    .where(eq(tables.addressesTable.id, id))
    .limit(1)

  if (!existing[0]) {
    return false
  }

  await orm.delete(tables.addressesTable).where(eq(tables.addressesTable.id, id))
  return true
}
