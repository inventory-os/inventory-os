"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { TrendingUp } from "lucide-react"
import { useAppRuntime } from "@/components/app-runtime-provider"

type AssetGrowthPoint = {
  month: string
  assets: number
}

export function AssetOverviewChart({ data }: { data: AssetGrowthPoint[] }) {
  const { t } = useAppRuntime()
  const first = data[0]?.assets ?? 0
  const last = data[data.length - 1]?.assets ?? 0
  const growth = first > 0 ? Math.round(((last - first) / first) * 100) : last > 0 ? 100 : 0

  return (
    <Card className="app-surface">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">{t("dashboardNewAssets")}</CardTitle>
            <CardDescription className="text-xs">{t("dashboardLastSixMonths")}</CardDescription>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1">
            <TrendingUp className="size-3 text-success" />
            <span className="text-[11px] font-semibold text-success">{growth >= 0 ? `+${growth}%` : `${growth}%`}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={28}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
              <YAxis tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
              <Tooltip
                cursor={{ fill: "var(--color-muted)" }}
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "12px",
                  fontSize: "12px",
                  boxShadow: "0 8px 24px color-mix(in oklch, var(--color-foreground) 12%, transparent)",
                }}
              />
              <Bar dataKey="assets" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
