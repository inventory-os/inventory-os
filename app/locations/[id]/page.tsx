"use client"

import Link from "next/link"
import { use, useEffect, useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { StatusBadge } from "@/components/status-badge"
import { ArrowDownToLine, ArrowLeft, MapPin, FolderTree, Package, Search, Upload } from "lucide-react"
import type { Asset, LocationData } from "@/lib/data"
import { useAppRuntime } from "@/components/app-runtime-provider"

type LocationDetailsPayload = {
  location: LocationData
  parent: LocationData | null
  children: LocationData[]
  assets: Asset[]
  assetCategories: string[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  qrPayload: string
}

export default function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { t, formatCurrency } = useAppRuntime()
  const [payload, setPayload] = useState<LocationDetailsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDownloadingQr, setIsDownloadingQr] = useState(false)
  const [assetSearch, setAssetSearch] = useState("")
  const [assetStatusFilter, setAssetStatusFilter] = useState<Asset["status"] | "all">("all")
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<string | "all">("all")
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalAssets, setTotalAssets] = useState(0)
  const assets = payload?.assets ?? []

  const assetCategories = useMemo(() => {
    return payload?.assetCategories ?? []
  }, [payload])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search: assetSearch,
        status: assetStatusFilter,
        category: assetCategoryFilter,
      })
      const response = await fetch(`/api/locations/${id}?${params.toString()}`, { cache: "no-store" })
      if (!response.ok) {
        setPayload(null)
        setLoading(false)
        return
      }
      const data = (await response.json()) as LocationDetailsPayload
      setPayload(data)
      setTotalAssets(data.pagination?.total ?? data.assets.length)
      setLoading(false)
    }

    void loadData()
  }, [id, page, pageSize, assetSearch, assetStatusFilter, assetCategoryFilter])

  useEffect(() => {
    setPage(1)
  }, [assetSearch, assetStatusFilter, assetCategoryFilter])

  const handleDownloadStyledQrPng = async () => {
    if (!payload) {
      return
    }

    setIsDownloadingQr(true)

    try {
      const response = await fetch(`/api/locations/${payload.location.id}/qr/styled?size=1024`, { cache: "no-store" })
      if (!response.ok) {
        return
      }

      const svgText = await response.text()
      const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" })
      const svgUrl = URL.createObjectURL(svgBlob)

      const image = new Image()
      image.decoding = "async"

      const loaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error("Failed to load styled QR image"))
      })

      image.src = svgUrl
      await loaded

      const width = image.naturalWidth || 1024
      const height = image.naturalHeight || 1024
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height

      const context = canvas.getContext("2d")
      if (!context) {
        URL.revokeObjectURL(svgUrl)
        return
      }

      context.fillStyle = "#FFFFFF"
      context.fillRect(0, 0, width, height)
      context.drawImage(image, 0, 0, width, height)

      const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
      URL.revokeObjectURL(svgUrl)
      if (!pngBlob) {
        return
      }

      const pngUrl = URL.createObjectURL(pngBlob)
      const link = document.createElement("a")
      link.href = pngUrl
      link.download = `location-${payload.location.id}-qr-styled.png`
      link.click()
      URL.revokeObjectURL(pngUrl)
    } finally {
      setIsDownloadingQr(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader title={t("locationsLoadingTitle")} breadcrumbs={[{ label: t("navLocations"), href: "/locations" }, { label: t("commonLoading") }]} />
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t("locationsLoadingDetails")}</div>
      </AppShell>
    )
  }

  if (!payload) {
    return (
      <AppShell>
        <PageHeader title={t("locationsNotFoundTitle")} breadcrumbs={[{ label: t("navLocations"), href: "/locations" }, { label: t("commonNotFound") }]} />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold">{t("locationsNotFoundTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("locationsNotFoundDescription")}</p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/locations">{t("locationsBackToList")}</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  const { location, parent, children, qrPayload } = payload
  const qrStyledPreviewUrl = `/api/locations/${location.id}/qr/styled?size=320`

  return (
    <AppShell>
      <PageHeader
        title={location.name}
        breadcrumbs={[
          { label: t("navLocations"), href: "/locations" },
          { label: location.name },
        ]}
      />
      <div className="app-page">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/locations">
              <ArrowLeft className="mr-1.5 size-3.5" />
              {t("locationsBackToList")}
            </Link>
          </Button>
          <Badge variant="secondary">{t(`locationsKind${location.kind.charAt(0).toUpperCase()}${location.kind.slice(1)}`)}</Badge>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 space-y-6">
            <Card className="app-surface">
              <CardHeader>
                <CardTitle className="text-sm font-medium">{t("locationsDetailsTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">{t("commonName")}</p>
                  <p className="text-sm font-medium">{location.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("commonId")}</p>
                  <p className="font-mono text-xs">{location.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("locationsPath")}</p>
                  <p className="text-sm">{location.path}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("locationsAddress")}</p>
                  <p className="text-sm">{location.address || t("commonNotAvailable")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("locationsParent")}</p>
                  {parent ? (
                    <Link href={`/locations/${parent.id}`} className="text-sm font-medium hover:text-primary">
                      {parent.name}
                    </Link>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("locationsNoParent")}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("locationsCode")}</p>
                  <p className="text-sm">{location.locationCode || t("commonNotAvailable")}</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card className="app-kpi">
                <CardContent className="flex items-center gap-3 p-4">
                  <MapPin className="size-4 text-primary" />
                  <div>
                    <p className="text-lg font-semibold">{location.directAssetCount}</p>
                    <p className="text-xs text-muted-foreground">{t("locationsDirect")}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="app-kpi">
                <CardContent className="flex items-center gap-3 p-4">
                  <Package className="size-4 text-chart-3" />
                  <div>
                    <p className="text-lg font-semibold">{location.assetCount}</p>
                    <p className="text-xs text-muted-foreground">{t("locationsTotal")}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="app-kpi">
                <CardContent className="flex items-center gap-3 p-4">
                  <FolderTree className="size-4 text-success" />
                  <div>
                    <p className="text-lg font-semibold">{children.length}</p>
                    <p className="text-xs text-muted-foreground">{t("locationsChildren")}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="app-surface">
              <CardHeader>
                <CardTitle className="text-sm font-medium">{t("locationsAssetsInTree")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {location.assetCount === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("locationsNoAssetsInTree")}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative min-w-[220px] flex-1">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={assetSearch}
                          onChange={(event) => setAssetSearch(event.target.value)}
                          placeholder={t("locationsAssetsSearch")}
                          className="pl-8"
                        />
                      </div>
                      <Select value={assetStatusFilter} onValueChange={(value) => setAssetStatusFilter(value as Asset["status"] | "all")}>
                        <SelectTrigger className="w-[170px]">
                          <SelectValue placeholder={t("filtersAllStatus")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("filtersAllStatus")}</SelectItem>
                          <SelectItem value="available">{t("statusAvailable")}</SelectItem>
                          <SelectItem value="in-use">{t("statusInUse")}</SelectItem>
                          <SelectItem value="maintenance">{t("statusMaintenance")}</SelectItem>
                          <SelectItem value="retired">{t("statusRetired")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <SearchableSelect
                        value={assetCategoryFilter}
                        onValueChange={setAssetCategoryFilter}
                        items={[
                          { value: "all", label: t("filtersAllCategories") },
                          ...assetCategories.map((category) => ({ value: category, label: category })),
                        ]}
                        placeholder={t("filtersAllCategories")}
                        searchPlaceholder={t("assetTableCategory")}
                        emptyLabel={t("globalSearchNoSectionResults")}
                        className="w-[190px]"
                      />
                    </div>

                    <div className="overflow-hidden rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>{t("assetTableAsset")}</TableHead>
                            <TableHead>{t("assetTableId")}</TableHead>
                            <TableHead>{t("locationsSubLocation")}</TableHead>
                            <TableHead>{t("assetTableCategory")}</TableHead>
                            <TableHead>{t("assetTableStatus")}</TableHead>
                            <TableHead className="text-right">{t("assetTableValue")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assets.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-xs text-muted-foreground">
                                {t("locationsNoFilteredAssets")}
                              </TableCell>
                            </TableRow>
                          ) : (
                            assets.map((asset) => (
                              <TableRow key={asset.id} className="hover:bg-muted/30">
                                <TableCell>
                                  <Link href={`/assets/${asset.id}`} className="font-medium hover:text-primary">
                                    {asset.name}
                                  </Link>
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">{asset.id}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{asset.location}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="text-[11px]">
                                    {asset.category}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <StatusBadge status={asset.status} />
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">{formatCurrency(asset.value)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>{t("showingCountOf", { current: assets.length, total: totalAssets, label: t("navAssets").toLowerCase() })}</span>
                        <DataTablePagination page={page} pageSize={pageSize} total={totalAssets} onPageChange={setPage} />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="app-surface">
              <CardHeader>
                <CardTitle className="text-sm font-medium">{t("locationsChildrenTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {children.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("locationsNoChildren")}</p>
                ) : (
                  children.map((child) => (
                    <Link key={child.id} href={`/locations/${child.id}`} className="block rounded-md border px-3 py-2 hover:bg-muted/40">
                      <p className="text-sm font-medium">{child.name}</p>
                      <p className="text-xs text-muted-foreground">{child.path}</p>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="app-surface">
              <CardHeader>
                <CardTitle className="text-sm font-medium">{t("assetQrCardTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="mx-auto w-full max-w-[220px] rounded-xl border bg-white p-3">
                  <img src={qrStyledPreviewUrl} alt={`QR for ${location.name}`} className="mx-auto h-auto w-full" />
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground" title={qrPayload}>{qrPayload}</p>
                <Button size="sm" variant="outline" className="w-full" onClick={handleDownloadStyledQrPng} disabled={isDownloadingQr}>
                  {isDownloadingQr ? <Upload className="mr-1.5 size-3.5 animate-spin" /> : <ArrowDownToLine className="mr-1.5 size-3.5" />}
                  {isDownloadingQr ? t("assetPreparingPng") : t("assetDownloadPng")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
