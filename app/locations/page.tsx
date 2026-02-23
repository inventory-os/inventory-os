"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { ComponentType } from "react"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, MapPin, Building2, Layers3, DoorOpen, Archive, FolderTree, ChevronDown, ChevronRight, Pencil, Search, ChevronsUpDown, Trash2 } from "lucide-react"
import { type AddressRecord, type LocationData, type LocationKind } from "@/lib/data"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useAppRuntime } from "@/components/app-runtime-provider"

const kindOptions: { value: LocationKind }[] = [
  { value: "building" },
  { value: "floor" },
  { value: "room" },
  { value: "storage" },
  { value: "area" },
]

const kindLabelKeys: Record<LocationKind, string> = {
  building: "locationsKindBuilding",
  floor: "locationsKindFloor",
  room: "locationsKindRoom",
  storage: "locationsKindStorage",
  area: "locationsKindArea",
}

const kindIcons: Record<LocationKind, ComponentType<{ className?: string }>> = {
  building: Building2,
  floor: Layers3,
  room: DoorOpen,
  storage: Archive,
  area: MapPin,
}

export default function LocationsPage() {
  const { isAdmin } = useCurrentUser()
  const { t } = useAppRuntime()
  const [locations, setLocations] = useState<LocationData[]>([])
  const [addresses, setAddresses] = useState<AddressRecord[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [kindFilter, setKindFilter] = useState<LocationKind | "all">("all")
  const [open, setOpen] = useState(false)
  const [addressDialogOpen, setAddressDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addressSaving, setAddressSaving] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [addressDialogMode, setAddressDialogMode] = useState<"create" | "edit">("create")
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [pendingDeleteLocation, setPendingDeleteLocation] = useState<LocationData | null>(null)
  const [pendingDeleteAddress, setPendingDeleteAddress] = useState<AddressRecord | null>(null)
  const [dialogParent, setDialogParent] = useState<LocationData | null>(null)
  const [form, setForm] = useState<{
    name: string
    parentId: string
    kind: LocationKind
    addressId: string
    floorNumber: string
    roomNumber: string
  }>({
    name: "",
    parentId: "none",
    kind: "building",
    addressId: "none",
    floorNumber: "",
    roomNumber: "",
  })
  const [addressForm, setAddressForm] = useState({
    label: "",
    addressLine1: "",
    addressLine2: "",
    postalCode: "",
    city: "",
    country: "",
  })

  const loadLocations = async () => {
    const response = await fetch("/api/locations", { cache: "no-store" })
    if (!response.ok) {
      return
    }
    const payload = await response.json()
    setLocations(payload.locations)
    const rootIds = (payload.locations as LocationData[])
      .filter((entry) => !entry.parentId)
      .map((entry) => entry.id)
    setExpandedIds(new Set(rootIds))
  }

  const loadAddresses = async () => {
    const response = await fetch("/api/addresses", { cache: "no-store" })
    if (!response.ok) {
      return
    }
    const payload = await response.json()
    setAddresses(payload.addresses)
  }

  useEffect(() => {
    void Promise.all([loadLocations(), loadAddresses()])
  }, [])

  const saveLocation = async () => {
    setSaving(true)
    const response = await fetch("/api/locations", {
      method: dialogMode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(editingLocationId ? { id: editingLocationId } : {}),
        name: form.name,
        kind: form.kind,
        addressId: form.addressId === "none" ? null : form.addressId,
        floorNumber: form.floorNumber,
        roomNumber: form.roomNumber,
        parentId: form.parentId === "none" ? null : form.parentId,
      }),
    })
    setSaving(false)
    if (!response.ok) {
      return
    }

    setOpen(false)
    setDialogMode("create")
    setEditingLocationId(null)
    setDialogParent(null)
    setForm({
      name: "",
      parentId: "none",
      kind: "building",
      addressId: "none",
      floorNumber: "",
      roomNumber: "",
    })
    await Promise.all([loadLocations(), loadAddresses()])
  }

  const openCreateDialog = (parent?: LocationData) => {
    setDialogMode("create")
    setEditingLocationId(null)
    setDialogParent(parent ?? null)
    setForm({
      name: "",
      parentId: parent?.id ?? "none",
      kind: parent ? (parent.kind === "building" ? "room" : "storage") : "building",
      addressId: parent?.addressId ?? "none",
      floorNumber: parent?.floorNumber ?? "",
      roomNumber: "",
    })
    setOpen(true)
  }

  const openEditDialog = (location: LocationData) => {
    setDialogMode("edit")
    setEditingLocationId(location.id)
    setDialogParent(location.parentId ? (locations.find((entry) => entry.id === location.parentId) ?? null) : null)
    setForm({
      name: location.name,
      parentId: location.parentId ?? "none",
      kind: location.kind,
      addressId: location.addressId ?? "none",
      floorNumber: location.floorNumber ?? "",
      roomNumber: location.roomNumber ?? "",
    })
    setOpen(true)
  }

  const openCreateAddressDialog = () => {
    setAddressDialogMode("create")
    setEditingAddressId(null)
    setAddressForm({
      label: "",
      addressLine1: "",
      addressLine2: "",
      postalCode: "",
      city: "",
      country: "",
    })
    setAddressDialogOpen(true)
  }

  const openEditAddressDialog = (address: AddressRecord) => {
    setAddressDialogMode("edit")
    setEditingAddressId(address.id)
    setAddressForm({
      label: address.label,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 ?? "",
      postalCode: address.postalCode,
      city: address.city,
      country: address.country,
    })
    setAddressDialogOpen(true)
  }

  const saveAddress = async () => {
    setAddressSaving(true)
    const response = await fetch(
      addressDialogMode === "create" ? "/api/addresses" : `/api/addresses/${editingAddressId}`,
      {
        method: addressDialogMode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addressForm),
      },
    )
    setAddressSaving(false)
    if (!response.ok) {
      return
    }

    setAddressDialogOpen(false)
    setAddressDialogMode("create")
    setEditingAddressId(null)
    await Promise.all([loadAddresses(), loadLocations()])
  }

  const removeAddress = async (addressId: string) => {
    const response = await fetch(`/api/addresses/${addressId}`, { method: "DELETE" })
    if (!response.ok) {
      return
    }
    await Promise.all([loadAddresses(), loadLocations()])
  }

  const removeLocation = async (locationId: string) => {
    const response = await fetch(`/api/locations/${locationId}`, { method: "DELETE" })
    if (!response.ok) {
      return
    }
    await loadLocations()
  }

  const totalAssets = locations.reduce((sum, loc) => sum + loc.assetCount, 0)
  const rootLocations = locations.filter((location) => location.level === 0).length
  const deepestLevel = locations.reduce((max, location) => Math.max(max, location.level), 0)

  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations])

  const childrenByParent = useMemo(() => {
    const map = new Map<string, LocationData[]>()
    for (const location of locations) {
      if (!location.parentId) {
        continue
      }
      const existing = map.get(location.parentId) ?? []
      existing.push(location)
      map.set(location.parentId, existing)
    }
    return map
  }, [locations])

  const roots = useMemo(
    () => locations.filter((location) => !location.parentId || !locationById.has(location.parentId)),
    [locationById, locations],
  )

  const allowedParentOptions = locations.filter((location) => location.id !== editingLocationId)

  const visibleIds = useMemo(() => {
    const searchText = search.trim().toLowerCase()
    if (!searchText && kindFilter === "all") {
      return new Set(locations.map((entry) => entry.id))
    }

    const selfMatches = new Map<string, boolean>()
    for (const location of locations) {
      const kindOk = kindFilter === "all" || location.kind === kindFilter
      const textOk =
        !searchText ||
        `${location.name} ${location.path} ${location.address} ${location.kind} ${location.locationCode ?? ""}`.toLowerCase().includes(searchText)
      selfMatches.set(location.id, kindOk && textOk)
    }

    const visible = new Set<string>()

    const walk = (id: string, ancestorMatched: boolean): boolean => {
      const node = locationById.get(id)
      if (!node) {
        return false
      }
      const children = childrenByParent.get(id) ?? []
      const ownMatch = selfMatches.get(id) ?? false
      let hasMatchedChild = false
      for (const child of children) {
        if (walk(child.id, ancestorMatched || ownMatch)) {
          hasMatchedChild = true
        }
      }

      if (ownMatch || ancestorMatched || hasMatchedChild) {
        visible.add(id)
      }

      return ownMatch || hasMatchedChild
    }

    for (const root of roots) {
      walk(root.id, false)
    }

    return visible
  }, [childrenByParent, kindFilter, locationById, locations, roots, search])

  const visibleRows = useMemo(() => {
    const rows: LocationData[] = []

    const walk = (node: LocationData) => {
      if (!visibleIds.has(node.id)) {
        return
      }

      rows.push(node)

      const children = (childrenByParent.get(node.id) ?? []).filter((entry) => visibleIds.has(entry.id))
      if (children.length === 0) {
        return
      }

      if (!expandedIds.has(node.id)) {
        return
      }

      for (const child of children) {
        walk(child)
      }
    }

    for (const root of roots) {
      walk(root)
    }

    return rows
  }, [childrenByParent, expandedIds, roots, visibleIds])

  const toggleExpanded = (id: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedIds(new Set(locations.map((entry) => entry.id)))
  }

  const collapseAll = () => {
    setExpandedIds(new Set(roots.map((entry) => entry.id)))
  }

  return (
    <AppShell>
      <PageHeader title={t("navLocations")} breadcrumbs={[{ label: t("navLocations") }]} />
      <div className="app-page">
        <div className="app-hero flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("navLocations")}</h1>
            <p className="text-sm text-muted-foreground">{t("locationsSubtitle")}</p>
          </div>
          {isAdmin ? (
            <Button size="sm" onClick={() => openCreateDialog()}>
              <Plus className="mr-1.5 size-3.5" />
              {t("locationsAddRoot")}
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="app-kpi">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{locations.length}</p>
                <p className="text-xs text-muted-foreground">{t("locationsTotalNodes")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="app-kpi">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-success/10">
                <MapPin className="size-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{totalAssets}</p>
                <p className="text-xs text-muted-foreground">{t("locationsAggregatedAssets")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="app-kpi">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-chart-3/10">
                <FolderTree className="size-5 text-chart-3" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{deepestLevel + 1}</p>
                <p className="text-xs text-muted-foreground">{t("locationsHierarchyDepth")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="app-surface p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-8"
                placeholder={t("locationsSearch")}
              />
            </div>
            <Select value={kindFilter} onValueChange={(value) => setKindFilter(value as LocationKind | "all")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("locationsType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("locationsAllTypes")}</SelectItem>
                {kindOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(kindLabelKeys[option.value])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={expandAll}>
              <ChevronsUpDown className="mr-1.5 size-3.5" />
              {t("locationsExpandAll")}
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              {t("locationsCollapse")}
            </Button>
          </div>

          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t("showingCountOf", { current: visibleRows.length, total: locations.length, label: t("navLocations").toLowerCase() })}
            </span>
            <span>{rootLocations} {t("locationsRootNodes")}</span>
          </div>

          <div className="max-h-[62vh] overflow-auto pr-1">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("assetTableLocation")}</TableHead>
                  <TableHead>{t("locationsType")}</TableHead>
                  <TableHead>{t("locationsAddress")}</TableHead>
                  <TableHead className="text-right">{t("locationsDirect")}</TableHead>
                  <TableHead className="text-right">{t("locationsTotal")}</TableHead>
                  <TableHead className="w-28 text-right">{t("assetTableActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-xs text-muted-foreground">
                      {t("locationsNoMatches")}
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((location) => {
                    const Icon = kindIcons[location.kind]
                    const childCount = (childrenByParent.get(location.id) ?? []).filter((entry) => visibleIds.has(entry.id)).length
                    const hasChildren = childCount > 0
                    const isExpanded = expandedIds.has(location.id)

                    return (
                      <TableRow key={location.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2" style={{ paddingLeft: `${location.level * 18}px` }}>
                            {hasChildren ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6"
                                onClick={() => toggleExpanded(location.id)}
                              >
                                {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                              </Button>
                            ) : (
                              <span className="inline-block w-6" />
                            )}
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary/70">
                              <Icon className="size-3.5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link href={`/locations/${location.id}`} className="truncate text-sm font-medium hover:text-primary" title={location.name}>
                                  {location.name}
                                </Link>
                                {location.locationCode ? (
                                  <Badge variant="outline" className="h-5 text-[10px]">
                                    {location.locationCode}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="truncate text-[11px] text-muted-foreground" title={location.path}>{location.path}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {t(kindLabelKeys[location.kind])}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[320px] truncate text-xs text-muted-foreground" title={location.address}>
                          {location.address}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{location.directAssetCount}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{location.assetCount}</TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => openEditDialog(location)}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button size="sm" variant="outline" className="h-8" onClick={() => openCreateDialog(location)}>
                                <Plus className="size-3.5" />
                              </Button>
                              <Button size="sm" variant="outline" className="h-8" onClick={() => setPendingDeleteLocation(location)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="app-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t("locationsAddressBookTitle")}</h2>
              <p className="text-xs text-muted-foreground">{t("locationsAddressBookDescription")}</p>
            </div>
            {isAdmin ? (
              <Button size="sm" onClick={openCreateAddressDialog}>
                <Plus className="mr-1.5 size-3.5" />
                {t("locationsAddAddress")}
              </Button>
            ) : null}
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("locationsLabel")}</TableHead>
                <TableHead>{t("locationsAddress")}</TableHead>
                <TableHead className="text-right">{t("locationsLinkedLocations")}</TableHead>
                <TableHead className="w-24 text-right">{t("assetTableActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addresses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs text-muted-foreground">
                    {t("locationsNoAddresses")}
                  </TableCell>
                </TableRow>
              ) : (
                addresses.map((address) => (
                  <TableRow key={address.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{address.label}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{address.fullAddress}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{address.locationCount}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => openEditAddressDialog(address)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-8" onClick={() => setPendingDeleteAddress(address)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={pendingDeleteLocation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteLocation(null)
          }
        }}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription", { name: pendingDeleteLocation?.name ?? "" })}
        cancelLabel={t("commonCancel")}
        confirmLabel={t("deleteConfirmAction")}
        onConfirm={() => {
          if (pendingDeleteLocation) {
            void removeLocation(pendingDeleteLocation.id)
          }
          setPendingDeleteLocation(null)
        }}
      />

      <ConfirmDeleteDialog
        open={pendingDeleteAddress !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteAddress(null)
          }
        }}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription", { name: pendingDeleteAddress?.label ?? "" })}
        cancelLabel={t("commonCancel")}
        confirmLabel={t("deleteConfirmAction")}
        onConfirm={() => {
          if (pendingDeleteAddress) {
            void removeAddress(pendingDeleteAddress.id)
          }
          setPendingDeleteAddress(null)
        }}
      />

      {isAdmin ? (
      <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setDialogMode("create")
            setEditingLocationId(null)
            setDialogParent(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? t("locationsCreateTitle") : t("locationsEditTitle")}</DialogTitle>
            <DialogDescription className="break-words">
              {dialogMode === "create"
                ? dialogParent
                  ? t("locationsCreateChildUnder", { path: dialogParent.path })
                  : t("locationsCreateRootDescription")
                : t("locationsEditDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>{t("commonName")}</Label>
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="grid gap-2 md:grid-cols-2 md:gap-3">
              <div className="grid gap-2">
                <Label>{t("locationsType")}</Label>
                <Select value={form.kind} onValueChange={(value) => setForm((prev) => ({ ...prev, kind: value as LocationKind }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {kindOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(kindLabelKeys[option.value])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label>{t("locationsFloor")}</Label>
                  <Input
                    value={form.floorNumber}
                    onChange={(event) => setForm((prev) => ({ ...prev, floorNumber: event.target.value }))}
                    placeholder={t("locationsFloorPlaceholder")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("locationsRoom")}</Label>
                  <Input
                    value={form.roomNumber}
                    onChange={(event) => setForm((prev) => ({ ...prev, roomNumber: event.target.value }))}
                    placeholder={t("locationsRoomPlaceholder")}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>{t("locationsAddress")}</Label>
              <SearchableSelect
                value={form.addressId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, addressId: value }))}
                items={[
                  { value: "none", label: t("locationsNoLinkedAddress") },
                  ...addresses.map((entry) => ({
                    value: entry.id,
                    label: entry.label,
                    description: entry.fullAddress,
                  })),
                ]}
                placeholder={t("locationsSelectAddress")}
                searchPlaceholder={t("locationsSearch")}
                emptyLabel={t("locationsNoMatches")}
              />
            </div>

            <div className="grid gap-2">
              <Label>{t("locationsParent")}</Label>
              <SearchableSelect
                value={form.parentId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, parentId: value }))}
                items={[
                  { value: "none", label: t("locationsNoParent") },
                  ...allowedParentOptions.map((location) => ({
                    value: location.id,
                    label: location.name,
                    description: location.path,
                  })),
                ]}
                placeholder={t("locationsParent")}
                searchPlaceholder={t("locationsSearch")}
                emptyLabel={t("locationsNoMatches")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("commonCancel")}
            </Button>
            <Button onClick={saveLocation} disabled={saving || form.name.length < 2}>
              {saving ? t("settingsSaving") : dialogMode === "create" ? t("locationsCreateTitle") : t("settingsSaveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addressDialogOpen}
        onOpenChange={(next) => {
          setAddressDialogOpen(next)
          if (!next) {
            setAddressDialogMode("create")
            setEditingAddressId(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{addressDialogMode === "create" ? t("locationsCreateAddress") : t("locationsEditAddress")}</DialogTitle>
            <DialogDescription>{t("locationsAddressBookDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>{t("locationsLabel")}</Label>
              <Input value={addressForm.label} onChange={(event) => setAddressForm((prev) => ({ ...prev, label: event.target.value }))} placeholder={t("locationsLabelPlaceholder")} />
            </div>
            <div className="grid gap-2">
              <Label>{t("locationsAddressLine1")}</Label>
              <Input value={addressForm.addressLine1} onChange={(event) => setAddressForm((prev) => ({ ...prev, addressLine1: event.target.value }))} placeholder={t("locationsAddressLine1Placeholder")} />
            </div>
            <div className="grid gap-2">
              <Label>{t("locationsAddressLine2")}</Label>
              <Input value={addressForm.addressLine2} onChange={(event) => setAddressForm((prev) => ({ ...prev, addressLine2: event.target.value }))} placeholder={t("locationsAddressLine2Placeholder")} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-2">
                <Label>{t("locationsZip")}</Label>
                <Input value={addressForm.postalCode} onChange={(event) => setAddressForm((prev) => ({ ...prev, postalCode: event.target.value }))} placeholder={t("locationsZipPlaceholder")} />
              </div>
              <div className="col-span-2 grid gap-2">
                <Label>{t("locationsCity")}</Label>
                <Input value={addressForm.city} onChange={(event) => setAddressForm((prev) => ({ ...prev, city: event.target.value }))} placeholder={t("locationsCityPlaceholder")} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("locationsCountry")}</Label>
              <Input value={addressForm.country} onChange={(event) => setAddressForm((prev) => ({ ...prev, country: event.target.value }))} placeholder={t("locationsCountryPlaceholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressDialogOpen(false)}>{t("commonCancel")}</Button>
            <Button
              onClick={saveAddress}
              disabled={
                addressSaving ||
                addressForm.label.trim().length < 2 ||
                addressForm.addressLine1.trim().length < 2 ||
                addressForm.postalCode.trim().length < 2 ||
                addressForm.city.trim().length < 2 ||
                addressForm.country.trim().length < 2
              }
            >
              {addressSaving ? t("settingsSaving") : addressDialogMode === "create" ? t("locationsCreateAddress") : t("locationsSaveAddress")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      ) : null}
    </AppShell>
  )
}
