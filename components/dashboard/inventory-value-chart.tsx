"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useAppRuntime } from "@/components/app-runtime-provider"

type InventoryValuePoint = {
  category: string
  value: number
}

export function InventoryValueChart({ data, currency }: { data: InventoryValuePoint[]; currency: string }) {
  const { t } = useAppRuntime()
  const total = data.reduce((sum, row) => sum + row.value, 0)
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  })

  return (
    <Card className="app-surface">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{t("dashboardInventoryValueByCategory")}</CardTitle>
        <CardDescription className="text-xs">
          {t("dashboardTotalValue", { value: formatter.format(total) })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={20} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/40" />
              <XAxis type="number" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
              <YAxis
                type="category"
                dataKey="category"
                tickLine={false}
                axisLine={false}
                width={110}
                className="text-xs fill-muted-foreground"
              />
              <Tooltip
                cursor={{ fill: "var(--color-muted)" }}
                formatter={(value: number) => [formatter.format(Number(value)), t("assetValue")]}
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "12px",
                  fontSize: "12px",
                  boxShadow: "0 8px 24px color-mix(in oklch, var(--color-foreground) 12%, transparent)",
                }}
              />
              <Bar dataKey="value" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
