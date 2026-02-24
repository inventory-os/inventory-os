"use client"

import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { AssetOverviewChart } from "@/components/dashboard/asset-overview-chart"
import { StatusDistributionChart } from "@/components/dashboard/status-distribution-chart"
import { InventoryValueChart } from "@/components/dashboard/inventory-value-chart"
import { TopCategories } from "@/components/dashboard/top-categories"
import { DollarSign, Package, Users, MapPin, AlertTriangle } from "lucide-react"
import { useAppRuntime } from "@/components/app-runtime-provider"
import { trpc } from "@/lib/trpc/react"

type DashboardStats = {
  totalAssets: number
  activeUsers: number
  locations: number
  maintenance: number
  inventoryValue: number
  monthlyAssetGrowth: { month: string; assets: number }[]
  statusDistribution: { name: string; value: number; color: string }[]
  inventoryValueByCategory: { category: string; value: number }[]
}

export default function DashboardPage() {
  const { t, formatCurrency, config } = useAppRuntime()
  const fallbackStats: DashboardStats = {
    totalAssets: 0,
    activeUsers: 0,
    locations: 0,
    maintenance: 0,
    inventoryValue: 0,
    monthlyAssetGrowth: [],
    statusDistribution: [],
    inventoryValueByCategory: [],
  }

  const statsQuery = trpc.dashboard.stats.useQuery(undefined, {
    staleTime: 60_000,
  })

  const stats = statsQuery.data ?? fallbackStats

  const currentMonthAdditions = stats.monthlyAssetGrowth[stats.monthlyAssetGrowth.length - 1]?.assets ?? 0
  const totalAssetsChange =
    currentMonthAdditions > 0 ? t("statAddedThisMonth", { count: currentMonthAdditions }) : t("statNoAddedThisMonth")

  return (
    <AppShell>
      <PageHeader title={t("navDashboard")} breadcrumbs={[{ label: t("navDashboard") }]} />
      <div className="app-page">
        <div className="app-hero">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{t("navDashboard")}</h1>
          <p className="text-sm text-muted-foreground">{t("dashboardSubtitle")}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title={t("statTotalAssets")}
            value={stats.totalAssets}
            change={totalAssetsChange}
            changeType={currentMonthAdditions > 0 ? "positive" : "neutral"}
            icon={Package}
          />
          <StatCard
            title={t("statActiveUsers")}
            value={stats.activeUsers}
            change={t("statLiveCount")}
            changeType="positive"
            icon={Users}
          />
          <StatCard
            title={t("statLocations")}
            value={stats.locations}
            change={t("statLiveCount")}
            changeType="neutral"
            icon={MapPin}
          />
          <StatCard
            title={t("statMaintenance")}
            value={stats.maintenance}
            change={t("statOfInventory", {
              percent: stats.totalAssets > 0 ? Math.round((stats.maintenance / stats.totalAssets) * 100) : 0,
            })}
            changeType="negative"
            icon={AlertTriangle}
          />
          <StatCard
            title={t("statInventoryValue")}
            value={formatCurrency(Math.round(stats.inventoryValue), { maximumFractionDigits: 0 })}
            change={t("statCurrentTotal")}
            changeType="neutral"
            icon={DollarSign}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AssetOverviewChart data={stats.monthlyAssetGrowth} />
          <StatusDistributionChart data={stats.statusDistribution} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <InventoryValueChart data={stats.inventoryValueByCategory} currency={config.currency} />
          <TopCategories />
        </div>
      </div>
    </AppShell>
  )
}
