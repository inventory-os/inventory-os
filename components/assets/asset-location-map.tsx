"use client"

import { LocateFixed } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Asset } from "@/lib/types"
import { useAppRuntime } from "@/components/app-runtime-provider"

export function AssetLocationMap({ asset }: { asset: Asset }) {
  const { t } = useAppRuntime()

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <LocateFixed className="size-4 text-primary" />
              </div>
              <CardTitle className="text-sm font-medium">{t("assetLocationTitle")}</CardTitle>
            </div>
            <CardDescription className="text-xs">{t("assetLocationDescription")}</CardDescription>
          </div>
          <Badge variant="secondary" className="text-[10px] font-medium">
            {t("assetTableLocation")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-md bg-muted px-2 py-1">
            {t("assetTableLocation")}: {asset.location || t("assetUnassigned")}
          </span>
          <span className="rounded-md bg-muted px-2 py-1">
            {t("assetTableStatus")}: {asset.status}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
