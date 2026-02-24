"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  QrCode,
  ScanLine,
  User,
  PackageSearch,
  Barcode,
  ShoppingBag,
  ShieldCheck,
  ClipboardList,
  Layers,
  Tags,
} from "lucide-react"
import type { Asset, LoanRecord } from "@/lib/types"
import { useAppRuntime } from "@/components/app-runtime-provider"

function InfoRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="text-sm">{children}</span>
      </div>
    </div>
  )
}

export function AssetDetailInfo({ asset }: { asset: Asset }) {
  const { t, formatCurrency, formatDate } = useAppRuntime()
  const qrDisplayValue = typeof window === "undefined" ? asset.qrCode : `${window.location.origin}/qr/${asset.id}`

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">{asset.name}</CardTitle>
            <span className="font-mono text-xs text-muted-foreground">{asset.id}</span>
          </div>
          <StatusBadge status={asset.status} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <InfoRow icon={Building2} label={t("assetProducer")}>
            {asset.producerName ?? <span className="text-muted-foreground">—</span>}
          </InfoRow>
          <InfoRow icon={PackageSearch} label={t("assetModel")}>
            {asset.model ?? <span className="text-muted-foreground">—</span>}
          </InfoRow>
          <InfoRow icon={Barcode} label={t("assetSerialSku")}>
            <span className="font-mono text-xs">
              {[asset.serialNumber, asset.sku].filter(Boolean).join(" • ") || "—"}
            </span>
          </InfoRow>
          <InfoRow icon={ShoppingBag} label={t("assetSupplier")}>
            {asset.supplier ?? <span className="text-muted-foreground">—</span>}
          </InfoRow>
          <InfoRow icon={ShieldCheck} label={t("assetWarrantyUntil")}>
            {asset.warrantyUntil ? (
              formatDate(asset.warrantyUntil, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </InfoRow>
          <InfoRow icon={ClipboardList} label={t("assetConditionStock")}>
            {`${asset.condition ?? "good"} • ${asset.quantity ?? 1} qty (min ${asset.minimumQuantity ?? 0})`}
          </InfoRow>
          <InfoRow icon={MapPin} label={t("assetTableLocation")}>
            {asset.location}
          </InfoRow>
          <InfoRow icon={Layers} label={t("assetParentAsset")}>
            {asset.parentAssetName ?? <span className="text-muted-foreground">{t("assetNoParentAsset")}</span>}
          </InfoRow>
          <InfoRow icon={Tags} label={t("commonTags")}>
            {asset.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {asset.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="rounded-full text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">{t("assetNoTags")}</span>
            )}
          </InfoRow>
          <InfoRow icon={User} label={t("assetTableAssignedTo")}>
            {asset.assignedTo ? (
              <div className="flex items-center gap-2">
                <Avatar className="size-5">
                  <AvatarFallback className="bg-primary/10 text-primary text-[9px]">
                    {asset.assignedTo
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                {asset.assignedTo}
              </div>
            ) : (
              <span className="text-muted-foreground">{t("assetUnassigned")}</span>
            )}
          </InfoRow>
          <InfoRow icon={Calendar} label={t("assetPurchaseDate")}>
            {formatDate(asset.purchaseDate, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </InfoRow>
          <InfoRow icon={DollarSign} label={t("assetValue")}>
            {formatCurrency(asset.value)}
          </InfoRow>
          <InfoRow icon={QrCode} label={t("assetQrCode")}>
            {qrDisplayValue}
          </InfoRow>
          <InfoRow icon={ScanLine} label={t("assetLastScanned")}>
            {formatDate(asset.lastScanned, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </InfoRow>
        </div>
        {asset.notes ? (
          <>
            <Separator />
            <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">{asset.notes}</div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function AssetCustodyHistory({ history }: { history: LoanRecord[] }) {
  const { t, formatDate } = useAppRuntime()
  const pageSize = 5
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(history.length / pageSize))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const pagedHistory = useMemo(() => {
    const start = (page - 1) * pageSize
    return history.slice(start, start + pageSize)
  }, [history, page])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{t("assetCustodyHistory")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {pagedHistory.map((entry) => {
            const isCurrent = !entry.returnedAt
            const action = isCurrent ? t("assetCheckedOut") : t("assetReturned")
            const date = formatDate(isCurrent ? entry.borrowedAt : (entry.returnedAt ?? entry.borrowedAt), {
              month: "short",
              day: "numeric",
              year: "numeric",
            })

            return (
              <div key={entry.id} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-6">
                    <AvatarFallback className="bg-secondary text-[9px]">
                      {entry.memberName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">{entry.memberName}</span>
                    <span className="text-[11px] text-muted-foreground">{action}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{date}</span>
                  {isCurrent && (
                    <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20" variant="outline">
                      {t("assetCurrent")}
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
          {history.length === 0 && (
            <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              {t("assetNoCustodyHistory")}
            </div>
          )}
          {history.length > pageSize && (
            <div className="flex items-center justify-between rounded-md border bg-muted/20 px-2.5 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t("uiPrevious")}
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={page === totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                {t("uiNext")}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
