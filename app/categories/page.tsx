"use client"

import { useEffect, useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { type ManagedCategory } from "@/lib/types"
import { DEFAULT_UNCATEGORIZED_CATEGORY } from "@/lib/types"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useAppRuntime } from "@/components/app-runtime-provider"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { trpc } from "@/lib/trpc/react"
import { IsAdmin } from "@/components/is-admin"

export default function CategoriesPage() {
  const { isAdmin } = useCurrentUser()
  const { t } = useAppRuntime()
  const [categories, setCategories] = useState<ManagedCategory[]>([])
  const [search, setSearch] = useState("")
  const [openCreate, setOpenCreate] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ManagedCategory | null>(null)
  const [createName, setCreateName] = useState("")
  const [editName, setEditName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<ManagedCategory | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const managedCategoriesQuery = trpc.categories.list.useQuery(undefined, { staleTime: 30_000 })
  const createCategoryMutation = trpc.categories.create.useMutation()
  const updateCategoryMutation = trpc.categories.update.useMutation()
  const deleteCategoryMutation = trpc.categories.remove.useMutation()

  const filteredCategories = useMemo(() => {
    const terms = search
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean)

    const list = managedCategoriesQuery.data ?? []
    return list.filter((category) => {
      const searchable = `${category.name} ${category.id}`.toLowerCase()
      return terms.length === 0 || terms.every((term) => searchable.includes(term))
    })
  }, [managedCategoriesQuery.data, search])

  const totalCategories = filteredCategories.length
  const pagedCategories = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredCategories.slice(start, start + pageSize)
  }, [filteredCategories, page, pageSize])

  useEffect(() => {
    setCategories(pagedCategories)
  }, [pagedCategories])

  useEffect(() => {
    setPage(1)
  }, [search])

  const handleCreate = async () => {
    setError(null)
    setIsSaving(true)
    try {
      await createCategoryMutation.mutateAsync({ name: createName })
      await managedCategoriesQuery.refetch()
      setCreateName("")
      setOpenCreate(false)
    } catch {
      setError(t("categoriesCreateFailed"))
    } finally {
      setIsSaving(false)
    }
  }

  const openEditDialog = (category: ManagedCategory) => {
    setEditingCategory(category)
    setEditName(category.name)
    setError(null)
    setOpenEdit(true)
  }

  const handleEdit = async () => {
    if (!editingCategory) {
      return
    }

    setError(null)
    setIsSaving(true)
    try {
      await updateCategoryMutation.mutateAsync({ id: editingCategory.id, name: editName })
      await managedCategoriesQuery.refetch()
      setOpenEdit(false)
      setEditingCategory(null)
      setEditName("")
    } catch {
      setError(t("categoriesUpdateFailed"))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (category: ManagedCategory) => {
    await deleteCategoryMutation.mutateAsync({ id: category.id })
    await managedCategoriesQuery.refetch()
  }

  return (
    <AppShell>
      <PageHeader title={t("navCategories")} breadcrumbs={[{ label: t("navCategories") }]} />
      <div className="app-page">
        <div className="app-hero flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("navCategories")}</h1>
            <p className="text-sm text-muted-foreground">{t("categoriesSubtitle")}</p>
          </div>
          <IsAdmin isAdmin={isAdmin}>
            <Button size="sm" onClick={() => setOpenCreate(true)}>
              <Plus className="mr-1.5 size-3.5" />
              {t("categoriesNew")}
            </Button>
          </IsAdmin>
        </div>

        <div className="app-surface space-y-3 p-4">
          <div className="relative sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("categoriesSearch")}
              className="pl-8"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("commonName")}</TableHead>
                <TableHead>{t("navAssets")}</TableHead>
                <TableHead>{t("commonId")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs text-muted-foreground">
                    {t("categoriesNone")}
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-xs tabular-nums">{category.assetCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{category.id}</TableCell>
                    <TableCell>
                      <IsAdmin isAdmin={isAdmin}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7">
                              <MoreHorizontal className="size-3.5" />
                              <span className="sr-only">{t("assetTableActions")}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(category)}>
                              <Pencil className="mr-1.5 size-3.5" />
                              {t("commonEdit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setPendingDeleteCategory(category)}
                              disabled={category.name === DEFAULT_UNCATEGORIZED_CATEGORY}
                            >
                              <Trash2 className="mr-1.5 size-3.5" />
                              {t("commonRemove")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </IsAdmin>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("categoriesShowing", { current: categories.length, total: totalCategories })}</span>
            <DataTablePagination page={page} pageSize={pageSize} total={totalCategories} onPageChange={setPage} />
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={pendingDeleteCategory !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteCategory(null)
          }
        }}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription", { name: pendingDeleteCategory?.name ?? "" })}
        cancelLabel={t("commonCancel")}
        confirmLabel={t("deleteConfirmAction")}
        onConfirm={() => {
          if (pendingDeleteCategory) {
            void handleDelete(pendingDeleteCategory)
          }
          setPendingDeleteCategory(null)
        }}
      />

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("categoriesCreateTitle")}</DialogTitle>
            <DialogDescription>{t("categoriesCreateDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder={t("categoriesNamePlaceholder")}
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>
              {t("commonCancel")}
            </Button>
            <Button onClick={handleCreate} disabled={isSaving || createName.trim().length < 2}>
              {isSaving ? t("settingsSaving") : t("commonCreate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("categoriesEditTitle")}</DialogTitle>
            <DialogDescription>{t("categoriesEditDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Input
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              placeholder={t("categoriesNamePlaceholder")}
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEdit(false)}>
              {t("commonCancel")}
            </Button>
            <Button onClick={handleEdit} disabled={isSaving || editName.trim().length < 2}>
              {isSaving ? t("settingsSaving") : t("commonSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
