"use client"

import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { ArrowDownAZ, ArrowUpAZ, ArrowUpDown, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Asset } from "@/lib/types"
import { useAppRuntime } from "@/components/app-runtime-provider"

type AssetSortKey = "name" | "id" | "category" | "status" | "location" | "assignedTo" | "value"
type SortDirection = "asc" | "desc"

interface AssetTableProps {
  assets: Asset[]
  onDeleteAsset?: (id: string) => void
  onDuplicateAsset?: (id: string) => void
  canManage?: boolean
  sortBy?: AssetSortKey
  sortDirection?: SortDirection
  onSortChange?: (key: AssetSortKey) => void
}

function SortableHead({
  label,
  sortKey,
  activeSort,
  sortDirection,
  onSortChange,
  align = "left",
}: {
  label: string
  sortKey: AssetSortKey
  activeSort?: AssetSortKey
  sortDirection?: SortDirection
  onSortChange?: (key: AssetSortKey) => void
  align?: "left" | "right"
}) {
  const isActive = activeSort === sortKey
  const Icon = !isActive ? ArrowUpDown : sortDirection === "asc" ? ArrowUpAZ : ArrowDownAZ

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <Button
        variant="ghost"
        size="sm"
        className={align === "right" ? "h-7 px-1 text-xs ml-auto" : "h-7 px-1 text-xs"}
        onClick={() => onSortChange?.(sortKey)}
      >
        {label}
        <Icon className="ml-1 size-3.5" />
      </Button>
    </TableHead>
  )
}

export function AssetTable({
  assets,
  onDeleteAsset,
  onDuplicateAsset,
  canManage = true,
  sortBy,
  sortDirection,
  onSortChange,
}: AssetTableProps) {
  const { t, formatCurrency } = useAppRuntime()

  return (
    <div className="app-surface overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <SortableHead
              label={t("assetTableAsset")}
              sortKey="name"
              activeSort={sortBy}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
            />
            <SortableHead
              label={t("assetTableId")}
              sortKey="id"
              activeSort={sortBy}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
            />
            <SortableHead
              label={t("assetTableCategory")}
              sortKey="category"
              activeSort={sortBy}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
            />
            <SortableHead
              label={t("assetTableStatus")}
              sortKey="status"
              activeSort={sortBy}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
            />
            <SortableHead
              label={t("assetTableLocation")}
              sortKey="location"
              activeSort={sortBy}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
            />
            <SortableHead
              label={t("assetTableAssignedTo")}
              sortKey="assignedTo"
              activeSort={sortBy}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
            />
            <SortableHead
              label={t("assetTableValue")}
              sortKey="value"
              activeSort={sortBy}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
              align="right"
            />
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => (
            <TableRow key={asset.id} className="hover:bg-muted/30">
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center overflow-hidden rounded-md border bg-muted/20">
                    {asset.thumbnailFileId ? (
                      <img
                        src={`/api/assets/${asset.id}/files/${asset.thumbnailFileId}`}
                        alt={asset.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">{t("commonNotAvailable")}</span>
                    )}
                  </div>
                  <Link
                    href={`/assets/${asset.id}`}
                    className="truncate font-medium hover:text-primary transition-colors"
                  >
                    {asset.name}
                  </Link>
                  {asset.parentAssetName ? (
                    <span className="text-[10px] text-muted-foreground">
                      {t("assetChildOf", { name: asset.parentAssetName })}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs text-muted-foreground">{asset.id}</span>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-[11px]">
                  {asset.category}
                </Badge>
              </TableCell>
              <TableCell>
                <StatusBadge status={asset.status} />
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">{asset.location}</TableCell>
              <TableCell className="text-xs">
                {asset.assignedTo || <span className="text-muted-foreground">{t("assetUnassigned")}</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums text-xs">{formatCurrency(asset.value)}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7">
                      <MoreHorizontal className="size-3.5" />
                      <span className="sr-only">{t("assetTableActions")}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/assets/${asset.id}`}>{t("assetViewDetails")}</Link>
                    </DropdownMenuItem>
                    {canManage ? (
                      <DropdownMenuItem onClick={() => onDuplicateAsset?.(asset.id)}>
                        {t("commonDuplicate")}
                      </DropdownMenuItem>
                    ) : null}
                    {canManage ? (
                      <DropdownMenuItem className="text-destructive" onClick={() => onDeleteAsset?.(asset.id)}>
                        {t("assetDelete")}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
