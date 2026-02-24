import type { AssetStatus } from "@/lib/types"
import { ensureCoreSchema } from "@/lib/repository/domains/setup.repository"
import { getDomainRuntime } from "@/lib/repository/domain-runtime"

export async function getDashboardStats() {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const [assets, members, locations] = await Promise.all([
    orm
      .select({
        status: tables.assetsTable.status,
        value: tables.assetsTable.value,
        quantity: tables.assetsTable.quantity,
        category: tables.assetsTable.category,
        purchaseDate: tables.assetsTable.purchaseDate,
      })
      .from(tables.assetsTable),
    orm.select({ id: tables.membersTable.id }).from(tables.membersTable),
    orm.select({ id: tables.locationsTable.id }).from(tables.locationsTable),
  ])

  const assetsRows = assets as Array<{
    status: AssetStatus
    value: number
    quantity: number
    category: string
    purchaseDate: string
  }>

  const totalAssets = assetsRows.length
  const activeUsers = members.length
  const locationsCount = locations.length
  const maintenance = assetsRows.filter((asset) => asset.status === "maintenance").length
  const inventoryValue = assetsRows.reduce(
    (sum, asset) => sum + Number(asset.value ?? 0) * Number(asset.quantity ?? 1),
    0,
  )

  const statusMap = new Map<AssetStatus, number>()
  const monthlyMap = new Map<string, number>()
  const categoryValueMap = new Map<string, number>()

  for (const asset of assetsRows) {
    statusMap.set(asset.status, (statusMap.get(asset.status) ?? 0) + 1)

    if (asset.purchaseDate) {
      const key = asset.purchaseDate.slice(0, 7)
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1)
    }

    const category = asset.category
    const value = Number(asset.value ?? 0) * Number(asset.quantity ?? 1)
    categoryValueMap.set(category, (categoryValueMap.get(category) ?? 0) + value)
  }

  const now = new Date()
  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" })
  const monthlyAssetGrowth = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    return {
      month: monthFormatter.format(date),
      assets: monthlyMap.get(key) ?? 0,
    }
  })

  const statusDistribution = [
    { name: "Available", key: "available" as const, color: "var(--color-success)" },
    { name: "In Use", key: "in-use" as const, color: "var(--color-chart-1)" },
    { name: "Maintenance", key: "maintenance" as const, color: "var(--color-warning)" },
    { name: "Retired", key: "retired" as const, color: "var(--color-muted-foreground)" },
  ].map((entry) => ({
    name: entry.name,
    value: statusMap.get(entry.key) ?? 0,
    color: entry.color,
  }))

  const inventoryValueByCategory = Array.from(categoryValueMap.entries())
    .map(([category, value]) => ({
      category,
      value: Math.round(value * 100) / 100,
    }))
    .sort((left, right) => right.value - left.value)

  return {
    totalAssets,
    activeUsers,
    locations: locationsCount,
    maintenance,
    inventoryValue,
    monthlyAssetGrowth,
    statusDistribution,
    inventoryValueByCategory,
  }
}
