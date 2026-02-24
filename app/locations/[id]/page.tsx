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
import { ArrowLeft, MapPin, FolderTree, Package, Search } from "lucide-react"
import type { Asset, LocationData } from "@/lib/types"
import { useAppRuntime } from "@/components/app-runtime-provider"
import { trpc } from "@/lib/trpc/react"
import { StyledQrCodeCard } from "@/components/styled-qr-code-card"

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

export default function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t, formatCurrency } = useAppRuntime()
  const [payload, setPayload] = useState<LocationDetailsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [assetSearch, setAssetSearch] = useState("")
  const [assetStatusFilter, setAssetStatusFilter] = useState<Asset["status"] | "all">("all")
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<string | "all">("all")
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const assets = payload?.assets ?? []
  const totalAssets = payload?.pagination?.total ?? assets.length

  const locationDetailsQuery = trpc.locations.details.useQuery(
    {
      id,
      page,
      pageSize,
      search: assetSearch,
      status: assetStatusFilter,
      category: assetCategoryFilter,
    },
    {
      staleTime: 10_000,
    },
  )

  const assetCategories = useMemo(() => {
    return payload?.assetCategories ?? []
  }, [payload])

  useEffect(() => {
    setLoading(locationDetailsQuery.isLoading || locationDetailsQuery.isFetching)
    const data = (locationDetailsQuery.data as LocationDetailsPayload | null | undefined) ?? null
    setPayload(data)
  }, [locationDetailsQuery.data, locationDetailsQuery.isLoading, locationDetailsQuery.isFetching])

  useEffect(() => {
    setPage(1)
  }, [assetSearch, assetStatusFilter, assetCategoryFilter])

  if (loading) {
    return (
      <AppShell>
        <PageHeader
          title={t("locationsLoadingTitle")}
          breadcrumbs={[{ label: t("navLocations"), href: "/locations" }, { label: t("commonLoading") }]}
        />
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {t("locationsLoadingDetails")}
        </div>
      </AppShell>
    )
  }

  if (!payload) {
    return (
      <AppShell>
        <PageHeader
          title={t("locationsNotFoundTitle")}
          breadcrumbs={[{ label: t("navLocations"), href: "/locations" }, { label: t("commonNotFound") }]}
        />
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

  return (
    <AppShell>
      <PageHeader
        title={location.name}
        breadcrumbs={[{ label: t("navLocations"), href: "/locations" }, { label: location.name }]}
      />
      <div className="app-page">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/locations">
              <ArrowLeft className="mr-1.5 size-3.5" />
              {t("locationsBackToList")}
            </Link>
          </Button>
          <Badge variant="secondary">
            {t(`locationsKind${location.kind.charAt(0).toUpperCase()}${location.kind.slice(1)}`)}
          </Badge>
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
                      <Select
                        value={assetStatusFilter}
                        onValueChange={(value) => setAssetStatusFilter(value as Asset["status"] | "all")}
                      >
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
                                <TableCell className="text-right text-xs tabular-nums">
                                  {formatCurrency(asset.value)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>
                          {t("showingCountOf", {
                            current: assets.length,
                            total: totalAssets,
                            label: t("navAssets").toLowerCase(),
                          })}
                        </span>
                        <DataTablePagination
                          page={page}
                          pageSize={pageSize}
                          total={totalAssets}
                          onPageChange={setPage}
                        />
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
                    <Link
                      key={child.id}
                      href={`/locations/${child.id}`}
                      className="block rounded-md border px-3 py-2 hover:bg-muted/40"
                    >
                      <p className="text-sm font-medium">{child.name}</p>
                      <p className="text-xs text-muted-foreground">{child.path}</p>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <StyledQrCodeCard
              title={t("assetQrCardTitle")}
              payload={qrPayload}
              entityName={location.name}
              downloadFileName={`location-${location.id}-qr-styled.png`}
              downloadLabel={t("assetDownloadPng")}
              preparingLabel={t("assetPreparingPng")}
            />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
