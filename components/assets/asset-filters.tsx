"use client"

import { Search, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import type { AssetStatus, AssetCategory } from "@/lib/data"
import { useAppRuntime } from "@/components/app-runtime-provider"

interface AssetFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: AssetStatus | "all"
  onStatusChange: (value: AssetStatus | "all") => void
  categoryFilter: AssetCategory | "all"
  onCategoryChange: (value: AssetCategory | "all") => void
  tagFilter: string | "all"
  onTagChange: (value: string | "all") => void
  tags: string[]
  categories: AssetCategory[]
  onAddAsset?: () => void
  canManage?: boolean
}

export function AssetFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  categoryFilter,
  onCategoryChange,
  tagFilter,
  onTagChange,
  tags,
  categories,
  onAddAsset,
  canManage = true,
}: AssetFiltersProps) {
  const { t } = useAppRuntime()

  return (
    <div className="app-surface flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchAssets")}
            className="h-9 pl-8 text-sm"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusChange(v as AssetStatus | "all")}
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder={t("assetTableStatus")} />
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
          value={categoryFilter}
          onValueChange={(v) => onCategoryChange(v as AssetCategory | "all")}
          items={[
            { value: "all", label: t("filtersAllCategories") },
            ...categories.map((category) => ({ value: category, label: category })),
          ]}
          placeholder={t("assetTableCategory")}
          searchPlaceholder={t("assetTableCategory")}
          emptyLabel={t("globalSearchNoSectionResults")}
          className="hidden h-9 w-[160px] sm:flex"
        />
        <SearchableSelect
          value={tagFilter}
          onValueChange={(v) => onTagChange(v as string | "all")}
          items={[
            { value: "all", label: t("filtersAllTags") },
            ...tags.map((tag) => ({ value: tag, label: tag })),
          ]}
          placeholder={t("commonTags")}
          searchPlaceholder={t("tagsSearchPlaceholder")}
          emptyLabel={t("globalSearchNoSectionResults")}
          className="hidden h-9 w-[160px] sm:flex"
        />
      </div>
      {canManage ? (
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-9" onClick={onAddAsset}>
            <Plus className="mr-1.5 size-3.5" />
            {t("assetsAdd")}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
