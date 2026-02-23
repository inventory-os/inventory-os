"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { AssetTable } from "@/components/assets/asset-table"
import { AssetFilters } from "@/components/assets/asset-filters"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { TagInput } from "@/components/ui/tag-input"
import { Badge } from "@/components/ui/badge"
import {
  DEFAULT_UNCATEGORIZED_CATEGORY,
  type Asset,
  type AssetCategory,
  type AssetStatus,
  type LocationData,
} from "@/lib/data"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useAppRuntime } from "@/components/app-runtime-provider"

type AssetSortKey = "name" | "id" | "category" | "status" | "location" | "assignedTo" | "value"
type SortDirection = "asc" | "desc"

export default function AssetsPage() {
  const router = useRouter()
  const { isAdmin } = useCurrentUser()
  const { t } = useAppRuntime()
  const [assets, setAssets] = useState<Asset[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [locations, setLocations] = useState<LocationData[]>([])
  const [tagSuggestions, setTagSuggestions] = useState<Array<{ name: string; count: number }>>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all")
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | "all">("all")
  const [tagFilter, setTagFilter] = useState<string | "all">("all")
  const [tagSearch, setTagSearch] = useState("")
  const [sortBy, setSortBy] = useState<AssetSortKey>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [openCreate, setOpenCreate] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingDeleteAssetId, setPendingDeleteAssetId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalAssets, setTotalAssets] = useState(0)

  const [form, setForm] = useState({
    name: "",
    parentAssetId: "none",
    category: DEFAULT_UNCATEGORIZED_CATEGORY as AssetCategory,
    status: "available" as AssetStatus,
    locationId: "none",
    value: "0",
    purchaseDate: new Date().toISOString().slice(0, 10),
    tags: [] as string[],
  })

  const loadData = async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      search,
      status: statusFilter,
      category: categoryFilter,
      tag: tagFilter,
    })

    const [assetsResponse, locationsResponse, categoriesResponse, tagsResponse] = await Promise.all([
      fetch(`/api/assets?${params.toString()}`, { cache: "no-store" }),
      fetch("/api/locations", { cache: "no-store" }),
      fetch("/api/categories", { cache: "no-store" }),
      fetch("/api/tags", { cache: "no-store" }),
    ])

    if (assetsResponse.ok) {
      const payload = await assetsResponse.json()
      setAssets(payload.assets)
      setTotalAssets(payload.pagination?.total ?? payload.assets.length)
    }

    if (locationsResponse.ok) {
      const payload = await locationsResponse.json()
      setLocations(payload.locations)
    }

    if (categoriesResponse.ok) {
      const payload = await categoriesResponse.json()
      const categoryNames = (payload.managedCategories ?? []).map((category: { name: string }) => category.name)
      setCategories(categoryNames)
      if (categoryNames.length > 0) {
        setForm((prev) => ({
          ...prev,
          category: categoryNames.includes(prev.category) ? prev.category : categoryNames[0],
        }))
      }
    }

    if (tagsResponse.ok) {
      const payload = await tagsResponse.json()
      setTagSuggestions(payload.tags ?? [])
    }
  }

  useEffect(() => {
    void loadData()
  }, [page, pageSize, search, statusFilter, categoryFilter, tagFilter])

  const sortedAssets = useMemo(() => {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
    const direction = sortDirection === "asc" ? 1 : -1

    const getSortValue = (asset: Asset): string | number => {
      switch (sortBy) {
        case "name":
          return asset.name
        case "id":
          return asset.id
        case "category":
          return asset.category
        case "status":
          return asset.status
        case "location":
          return asset.location
        case "assignedTo":
          return asset.assignedTo ?? ""
        case "value":
          return asset.value
        default:
          return asset.name
      }
    }

    return [...assets].sort((left, right) => {
      const leftValue = getSortValue(left)
      const rightValue = getSortValue(right)

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction
      }

      return collator.compare(String(leftValue), String(rightValue)) * direction
    })
  }, [assets, sortBy, sortDirection])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, categoryFilter, tagFilter])

  const filteredTags = useMemo(() => {
    const query = tagSearch.trim().toLowerCase()
    if (!query) {
      return tagSuggestions
    }

    return tagSuggestions.filter((entry) => entry.name.toLowerCase().includes(query))
  }, [tagSuggestions, tagSearch])

  const handleSortChange = (key: AssetSortKey) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortBy(key)
    setSortDirection("asc")
  }

  const handleCreateAsset = async () => {
    setIsSaving(true)
    const response = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        parentAssetId: form.parentAssetId === "none" ? null : form.parentAssetId,
        category: form.category,
        status: form.status,
        locationId: form.locationId === "none" ? null : form.locationId,
        value: Number(form.value),
        purchaseDate: form.purchaseDate,
        tags: form.tags,
      }),
    })
    setIsSaving(false)

    if (!response.ok) {
      return
    }

    setOpenCreate(false)
    setForm({
      name: "",
      parentAssetId: "none",
      category: categories[0] ?? DEFAULT_UNCATEGORIZED_CATEGORY,
      status: "available",
      locationId: "none",
      value: "0",
      purchaseDate: new Date().toISOString().slice(0, 10),
      tags: [],
    })
    await loadData()
  }

  const handleDeleteAsset = async (id: string) => {
    const response = await fetch(`/api/assets/${id}`, { method: "DELETE" })
    if (!response.ok) {
      return
    }
    setPendingDeleteAssetId(null)
    await loadData()
  }

  const handleDuplicateAsset = async (id: string) => {
    const response = await fetch(`/api/assets/${id}/duplicate`, { method: "POST" })
    if (!response.ok) {
      return
    }

    const payload = await response.json()
    const duplicatedId = payload.asset?.id as string | undefined
    if (duplicatedId) {
      router.push(`/assets/${duplicatedId}/edit`)
      return
    }

    await loadData()
  }

  const pendingDeleteAsset = pendingDeleteAssetId
    ? assets.find((asset) => asset.id === pendingDeleteAssetId) ?? null
    : null
  const selectedParentAsset = form.parentAssetId === "none"
    ? null
    : assets.find((asset) => asset.id === form.parentAssetId) ?? null

  return (
    <AppShell>
      <PageHeader
        title={t("navAssets")}
        breadcrumbs={[{ label: t("navAssets") }]}
      />
      <div className="app-page">
        <div className="app-hero">
          <h1 className="text-2xl font-semibold tracking-tight">{t("navAssets")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("assetsSubtitle")}
          </p>
        </div>

        <AssetFilters
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          tagFilter={tagFilter}
          onTagChange={setTagFilter}
          tags={tagSuggestions.map((entry) => entry.name)}
          categories={categories}
          onAddAsset={() => setOpenCreate(true)}
          canManage={isAdmin}
        />

        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <aside className="app-surface h-fit space-y-3 p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">{t("commonTags")}</h2>
              {tagFilter !== "all" ? (
                <button
                  type="button"
                  onClick={() => setTagFilter("all")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("filtersAllTags")}
                </button>
              ) : null}
            </div>
            <Input
              value={tagSearch}
              onChange={(event) => setTagSearch(event.target.value)}
              placeholder={t("tagsSearchPlaceholder")}
              className="h-8 text-xs"
            />
            <div className="max-h-[440px] space-y-1 overflow-auto pr-1">
              {filteredTags.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">{t("tagsNoResults")}</p>
              ) : (
                filteredTags.map((entry) => {
                  const active = tagFilter === entry.name
                  return (
                    <button
                      key={entry.name}
                      type="button"
                      onClick={() => setTagFilter(active ? "all" : entry.name)}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors ${active ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                    >
                      <span className="truncate">{entry.name}</span>
                      <Badge variant="secondary" className="ml-2 text-[10px]">{entry.count}</Badge>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          <div className="space-y-4">
            <AssetTable
              assets={sortedAssets}
              onDeleteAsset={setPendingDeleteAssetId}
              onDuplicateAsset={handleDuplicateAsset}
              canManage={isAdmin}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
            />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t("showingCountOf", { current: sortedAssets.length, total: totalAssets, label: t("navAssets").toLowerCase() })}
              </span>
              <DataTablePagination page={page} pageSize={pageSize} total={totalAssets} onPageChange={setPage} />
            </div>
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={pendingDeleteAssetId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteAssetId(null)
          }
        }}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription", { name: pendingDeleteAsset?.name ?? "" })}
        cancelLabel={t("commonCancel")}
        confirmLabel={t("deleteConfirmAction")}
        onConfirm={() => {
          if (pendingDeleteAssetId) {
            void handleDeleteAsset(pendingDeleteAssetId)
          }
        }}
      />

      {isAdmin ? (
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("assetsCreateTitle")}</DialogTitle>
            <DialogDescription>{t("assetsCreateDescription")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="asset-name">{t("commonName")}</Label>
              <Input
                id="asset-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={'MacBook Pro 14"'}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>{t("assetTableCategory")}</Label>
                <SearchableSelect
                  value={form.category}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, category: value as AssetCategory }))}
                  items={categories.map((category) => ({
                    value: category,
                    label: category,
                  }))}
                  placeholder={t("assetTableCategory")}
                  searchPlaceholder={t("assetTableCategory")}
                  emptyLabel={t("globalSearchNoSectionResults")}
                />
              </div>

              <div className="grid gap-2">
                <Label>{t("assetTableStatus")}</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as AssetStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">{t("statusAvailable")}</SelectItem>
                    <SelectItem value="in-use">{t("statusInUse")}</SelectItem>
                    <SelectItem value="maintenance">{t("statusMaintenance")}</SelectItem>
                    <SelectItem value="retired">{t("statusRetired")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>{t("assetParentAsset")}</Label>
                <SearchableSelect
                  value={form.parentAssetId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, parentAssetId: value }))}
                  items={[
                    { value: "none", label: t("assetNoParentAsset") },
                    ...assets.map((asset) => ({
                      value: asset.id,
                      label: asset.name,
                      description: asset.id,
                    })),
                  ]}
                  placeholder={t("assetParentAsset")}
                  searchPlaceholder={t("assetsSearchPlaceholder")}
                  emptyLabel={t("globalSearchNoSectionResults")}
                />
              </div>

              <div className="grid gap-2">
                <Label>{t("assetTableLocation")}</Label>
                <SearchableSelect
                  value={form.locationId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, locationId: value }))}
                  disabled={Boolean(selectedParentAsset)}
                  items={[
                    { value: "none", label: t("assetUnassigned") },
                    ...locations.map((location) => ({
                      value: location.id,
                      label: location.path,
                    })),
                  ]}
                  placeholder={t("assetsChooseLocation")}
                  searchPlaceholder={t("locationsSearch")}
                  emptyLabel={t("globalSearchNoSectionResults")}
                />
                {selectedParentAsset ? (
                  <p className="text-[11px] text-muted-foreground">{t("assetLocationInherited", { name: selectedParentAsset.name })}</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="asset-value">{t("assetValue")}</Label>
                <Input
                  id="asset-value"
                  type="number"
                  min="0"
                  step="1"
                  value={form.value}
                  onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="purchase-date">{t("assetPurchaseDate")}</Label>
                <Input
                  id="purchase-date"
                  type="date"
                  value={form.purchaseDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, purchaseDate: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="asset-tags">{t("commonTags")}</Label>
                <TagInput
                  value={form.tags}
                  onChange={(value) => setForm((prev) => ({ ...prev, tags: value }))}
                  suggestions={tagSuggestions.map((entry) => entry.name)}
                  placeholder={t("assetTagsPlaceholder")}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>
              {t("commonCancel")}
            </Button>
            <Button disabled={isSaving || form.name.trim().length < 2} onClick={handleCreateAsset}>
              {isSaving ? t("settingsSaving") : t("assetsCreateTitle")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      ) : null}
    </AppShell>
  )
}
