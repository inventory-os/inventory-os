"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useAppRuntime } from "@/components/app-runtime-provider"
import { trpc } from "@/lib/trpc/react"

export function TopCategories() {
  const { t } = useAppRuntime()
  const categoriesQuery = trpc.categories.summary.useQuery(undefined, {
    staleTime: 60_000,
  })

  const categories = categoriesQuery.data ?? []

  const total = categories.reduce((sum, cat) => sum + cat.count, 0)

  return (
    <Card className="app-surface">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{t("navCategories")}</CardTitle>
        <CardDescription className="text-xs">
          {t("dashboardTotalCategories", { total: categories.length })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {categories.map((category) => {
          const percentage = total > 0 ? Math.round((category.count / total) * 100) : 0
          return (
            <div key={category.name} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{category.name}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {t("dashboardCategoryAssets", { count: category.count })}
                </span>
              </div>
              <Progress value={percentage} className="h-1.5" />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
