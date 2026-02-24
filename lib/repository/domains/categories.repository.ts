import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { CATEGORY_COLORS, type AssetCategorySummary, type ManagedCategory } from "@/lib/types"
import { ensureCoreSchema } from "@/lib/repository/domains/setup.repository"
import { getDomainRuntime } from "@/lib/repository/domain-runtime"

function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

function normalizeCategoryName(name: string): string {
  const normalized = name.trim()
  if (!normalized) {
    throw new Error("Category name is required")
  }
  return normalized
}

async function getAssetCountsByCategoryName(): Promise<Map<string, number>> {
  const { orm, tables } = getDomainRuntime()
  const rows = await orm.select({ category: tables.assetsTable.category }).from(tables.assetsTable)

  const counts = new Map<string, number>()
  for (const row of rows as Array<{ category: string }>) {
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1)
  }
  return counts
}

export async function listManagedCategories(): Promise<ManagedCategory[]> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const categories = await orm
    .select({ id: tables.categoriesTable.id, name: tables.categoriesTable.name })
    .from(tables.categoriesTable)
    .orderBy(tables.categoriesTable.name)

  const counts = await getAssetCountsByCategoryName()
  return (categories as Array<{ id: string; name: string }>).map((row) => ({
    id: row.id,
    name: row.name,
    assetCount: counts.get(row.name) ?? 0,
  }))
}

export async function createCategory(name: string): Promise<ManagedCategory> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()
  const normalizedName = normalizeCategoryName(name)
  const id = makeId("CAT")

  await orm.insert(tables.categoriesTable).values({
    id,
    name: normalizedName,
    createdAt: new Date().toISOString(),
  })

  return {
    id,
    name: normalizedName,
    assetCount: 0,
  }
}

export async function updateCategory(categoryId: string, name: string): Promise<ManagedCategory | null> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()
  const normalizedName = normalizeCategoryName(name)

  const existing = await orm
    .select({ id: tables.categoriesTable.id, name: tables.categoriesTable.name })
    .from(tables.categoriesTable)
    .where(eq(tables.categoriesTable.id, categoryId))
    .limit(1)

  if (!existing[0]) {
    return null
  }

  await orm
    .update(tables.categoriesTable)
    .set({ name: normalizedName })
    .where(eq(tables.categoriesTable.id, categoryId))

  if (existing[0].name !== normalizedName) {
    await orm
      .update(tables.assetsTable)
      .set({ category: normalizedName })
      .where(eq(tables.assetsTable.category, existing[0].name))
  }

  const counts = await getAssetCountsByCategoryName()
  return {
    id: categoryId,
    name: normalizedName,
    assetCount: counts.get(normalizedName) ?? 0,
  }
}

export async function deleteCategory(categoryId: string): Promise<boolean> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const existing = await orm
    .select({ id: tables.categoriesTable.id, name: tables.categoriesTable.name })
    .from(tables.categoriesTable)
    .where(eq(tables.categoriesTable.id, categoryId))
    .limit(1)

  if (!existing[0]) {
    return false
  }

  if (existing[0].name === "Uncategorized") {
    throw new Error("Uncategorized category cannot be deleted")
  }

  const uncategorized = await orm
    .select({ id: tables.categoriesTable.id })
    .from(tables.categoriesTable)
    .where(eq(tables.categoriesTable.name, "Uncategorized"))
    .limit(1)

  if (!uncategorized[0]) {
    await orm.insert(tables.categoriesTable).values({
      id: makeId("CAT"),
      name: "Uncategorized",
      createdAt: new Date().toISOString(),
    })
  }

  await orm
    .update(tables.assetsTable)
    .set({ category: "Uncategorized" })
    .where(eq(tables.assetsTable.category, existing[0].name))

  await orm.delete(tables.categoriesTable).where(eq(tables.categoriesTable.id, categoryId))
  return true
}

export async function getCategorySummary(): Promise<AssetCategorySummary[]> {
  await ensureCoreSchema()
  const managed = await listManagedCategories()

  return managed.map((entry, index) => ({
    name: entry.name,
    count: entry.assetCount,
    color: CATEGORY_COLORS[entry.name] ?? `bg-chart-${(index % 5) + 1}`,
  }))
}
