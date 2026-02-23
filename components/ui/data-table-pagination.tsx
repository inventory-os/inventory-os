"use client"

import { Button } from "@/components/ui/button"

type DataTablePaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function DataTablePagination({ page, pageSize, total, onPageChange }: DataTablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="flex items-center justify-end gap-2">
      <Button size="sm" variant="outline" onClick={() => onPageChange(page - 1)} disabled={!canPrev}>
        Prev
      </Button>
      <span className="text-xs text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button size="sm" variant="outline" onClick={() => onPageChange(page + 1)} disabled={!canNext}>
        Next
      </Button>
    </div>
  )
}
