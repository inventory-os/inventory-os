"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { useAppRuntime } from "@/components/app-runtime-provider"

type StatusDistributionPoint = {
  name: string
  value: number
  color: string
}

export function StatusDistributionChart({ data }: { data: StatusDistributionPoint[] }) {
  const { t } = useAppRuntime()
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <Card className="app-surface">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{t("dashboardStatusDistribution")}</CardTitle>
        <CardDescription className="text-xs">{t("dashboardTotalAssetsCount", { total })}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-8">
          <div className="relative h-[200px] w-[200px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  innerRadius={60}
                  outerRadius={88}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    boxShadow: "0 8px 24px color-mix(in oklch, var(--color-foreground) 12%, transparent)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{total}</span>
              <span className="text-[10px] text-muted-foreground">{t("locationsTotal")}</span>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {data.map((item) => (
              <div key={item.name} className="flex items-center gap-3">
                <div
                  className="size-3 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex flex-col">
                  <span className="text-xs font-medium">{item.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {t("dashboardPercentOfAssets", { percent: total > 0 ? Math.round((item.value / total) * 100) : 0 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
