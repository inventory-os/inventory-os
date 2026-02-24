import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import type { Producer } from "@/lib/types"
import { ensureCoreSchema } from "@/lib/repository/domains/setup.repository"
import { getDomainRuntime } from "@/lib/repository/domain-runtime"

type ProducerWriteInput = {
  name: string
  websiteUrl: string
  domain: string
  description?: string | null
  logoUrl?: string | null
  sourceUrl: string
}

function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

function mapProducerRow(row: {
  id: string
  name: string
  websiteUrl: string
  domain: string
  description: string | null
  logoUrl: string | null
  sourceUrl: string
  createdAt: string
}): Producer {
  return {
    id: row.id,
    name: row.name,
    websiteUrl: row.websiteUrl,
    domain: row.domain,
    description: row.description,
    logoUrl: row.logoUrl,
    sourceUrl: row.sourceUrl,
    createdAt: row.createdAt,
  }
}

function normalizeProducerInput(input: ProducerWriteInput): Required<ProducerWriteInput> {
  return {
    name: input.name.trim(),
    websiteUrl: input.websiteUrl.trim(),
    domain: input.domain.trim(),
    description: input.description?.trim() || null,
    logoUrl: input.logoUrl?.trim() || null,
    sourceUrl: input.sourceUrl.trim(),
  }
}

export async function listProducers(): Promise<Producer[]> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const rows = await orm
    .select({
      id: tables.producersTable.id,
      name: tables.producersTable.name,
      websiteUrl: tables.producersTable.websiteUrl,
      domain: tables.producersTable.domain,
      description: tables.producersTable.description,
      logoUrl: tables.producersTable.logoUrl,
      sourceUrl: tables.producersTable.sourceUrl,
      createdAt: tables.producersTable.createdAt,
    })
    .from(tables.producersTable)
    .orderBy(tables.producersTable.createdAt)

  return (
    rows as Array<{
      id: string
      name: string
      websiteUrl: string
      domain: string
      description: string | null
      logoUrl: string | null
      sourceUrl: string
      createdAt: string
    }>
  )
    .reverse()
    .map(mapProducerRow)
}

export async function createProducer(input: ProducerWriteInput): Promise<Producer> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()
  const normalized = normalizeProducerInput(input)

  const existing = await orm
    .select({ id: tables.producersTable.id })
    .from(tables.producersTable)
    .where(eq(tables.producersTable.websiteUrl, normalized.websiteUrl))
    .limit(1)

  if (existing[0]) {
    await orm
      .update(tables.producersTable)
      .set({
        name: normalized.name,
        domain: normalized.domain,
        description: normalized.description,
        logoUrl: normalized.logoUrl,
        sourceUrl: normalized.sourceUrl,
      })
      .where(eq(tables.producersTable.id, existing[0].id))

    const updated = await orm
      .select({
        id: tables.producersTable.id,
        name: tables.producersTable.name,
        websiteUrl: tables.producersTable.websiteUrl,
        domain: tables.producersTable.domain,
        description: tables.producersTable.description,
        logoUrl: tables.producersTable.logoUrl,
        sourceUrl: tables.producersTable.sourceUrl,
        createdAt: tables.producersTable.createdAt,
      })
      .from(tables.producersTable)
      .where(eq(tables.producersTable.id, existing[0].id))
      .limit(1)

    if (!updated[0]) {
      throw new Error("Failed to update producer")
    }

    return mapProducerRow(
      updated[0] as {
        id: string
        name: string
        websiteUrl: string
        domain: string
        description: string | null
        logoUrl: string | null
        sourceUrl: string
        createdAt: string
      },
    )
  }

  const id = makeId("PROD")
  await orm.insert(tables.producersTable).values({
    id,
    name: normalized.name,
    websiteUrl: normalized.websiteUrl,
    domain: normalized.domain,
    description: normalized.description,
    logoUrl: normalized.logoUrl,
    sourceUrl: normalized.sourceUrl,
    createdAt: new Date().toISOString(),
  })

  const created = await orm
    .select({
      id: tables.producersTable.id,
      name: tables.producersTable.name,
      websiteUrl: tables.producersTable.websiteUrl,
      domain: tables.producersTable.domain,
      description: tables.producersTable.description,
      logoUrl: tables.producersTable.logoUrl,
      sourceUrl: tables.producersTable.sourceUrl,
      createdAt: tables.producersTable.createdAt,
    })
    .from(tables.producersTable)
    .where(eq(tables.producersTable.id, id))
    .limit(1)

  if (!created[0]) {
    throw new Error("Failed to create producer")
  }

  return mapProducerRow(
    created[0] as {
      id: string
      name: string
      websiteUrl: string
      domain: string
      description: string | null
      logoUrl: string | null
      sourceUrl: string
      createdAt: string
    },
  )
}

export async function updateProducer(id: string, input: ProducerWriteInput): Promise<Producer | null> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()
  const normalized = normalizeProducerInput(input)

  const existing = await orm
    .select({ id: tables.producersTable.id })
    .from(tables.producersTable)
    .where(eq(tables.producersTable.id, id))
    .limit(1)

  if (!existing[0]) {
    return null
  }

  await orm
    .update(tables.producersTable)
    .set({
      name: normalized.name,
      websiteUrl: normalized.websiteUrl,
      domain: normalized.domain,
      description: normalized.description,
      logoUrl: normalized.logoUrl,
      sourceUrl: normalized.sourceUrl,
    })
    .where(eq(tables.producersTable.id, id))

  const updated = await orm
    .select({
      id: tables.producersTable.id,
      name: tables.producersTable.name,
      websiteUrl: tables.producersTable.websiteUrl,
      domain: tables.producersTable.domain,
      description: tables.producersTable.description,
      logoUrl: tables.producersTable.logoUrl,
      sourceUrl: tables.producersTable.sourceUrl,
      createdAt: tables.producersTable.createdAt,
    })
    .from(tables.producersTable)
    .where(eq(tables.producersTable.id, id))
    .limit(1)

  if (!updated[0]) {
    throw new Error("Failed to update producer")
  }

  return mapProducerRow(
    updated[0] as {
      id: string
      name: string
      websiteUrl: string
      domain: string
      description: string | null
      logoUrl: string | null
      sourceUrl: string
      createdAt: string
    },
  )
}

export async function deleteProducer(id: string): Promise<boolean> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const existing = await orm
    .select({ id: tables.producersTable.id })
    .from(tables.producersTable)
    .where(eq(tables.producersTable.id, id))
    .limit(1)

  if (!existing[0]) {
    return false
  }

  await orm.update(tables.assetsTable).set({ producerId: null }).where(eq(tables.assetsTable.producerId, id))

  await orm.delete(tables.producersTable).where(eq(tables.producersTable.id, id))
  return true
}
