"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { MoreHorizontal, ShieldAlert } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAppRuntime } from "@/components/app-runtime-provider"
import { useCurrentUser } from "@/hooks/use-current-user"
import type { Asset, IncidentRecord, IncidentSeverity, IncidentStatus, IncidentType } from "@/lib/types"

const incidentStatusOptions: IncidentStatus[] = ["open", "investigating", "resolved"]
const incidentSeverityOptions: IncidentSeverity[] = ["low", "medium", "high", "critical"]
const incidentTypeOptions: IncidentType[] = ["damage", "malfunction", "loss", "theft", "safety", "other"]

function incidentStatusLabel(t: (key: string) => string, status: IncidentStatus): string {
  if (status === "open") return t("incidentsStatusOpen")
  if (status === "investigating") return t("incidentsStatusInvestigating")
  return t("incidentsStatusResolved")
}

function incidentSeverityLabel(t: (key: string) => string, severity: IncidentSeverity): string {
  if (severity === "low") return t("incidentsSeverityLow")
  if (severity === "medium") return t("incidentsSeverityMedium")
  if (severity === "high") return t("incidentsSeverityHigh")
  return t("incidentsSeverityCritical")
}

function incidentTypeLabel(t: (key: string) => string, incidentType: IncidentType): string {
  if (incidentType === "damage") return t("incidentsTypeDamage")
  if (incidentType === "malfunction") return t("incidentsTypeMalfunction")
  if (incidentType === "loss") return t("incidentsTypeLoss")
  if (incidentType === "theft") return t("incidentsTypeTheft")
  if (incidentType === "safety") return t("incidentsTypeSafety")
  return t("incidentsTypeOther")
}

function severityClass(value: IncidentSeverity): string {
  if (value === "critical") return "bg-destructive/10 text-destructive border-destructive/20"
  if (value === "high") return "bg-warning/10 text-warning border-warning/20"
  if (value === "medium") return "bg-chart-3/10 text-chart-3 border-chart-3/20"
  return "bg-muted text-muted-foreground border-border"
}

function statusClass(value: IncidentStatus): string {
  if (value === "resolved") return "bg-success/10 text-success border-success/20"
  if (value === "investigating") return "bg-chart-3/10 text-chart-3 border-chart-3/20"
  return "bg-primary/10 text-primary border-primary/20"
}

export default function IncidentsPage() {
  const { t, formatDate, formatCurrency } = useAppRuntime()
  const { isAdmin, loading: userLoading } = useCurrentUser()
  const searchParams = useSearchParams()

  const [incidents, setIncidents] = useState<IncidentRecord[]>([])
  const [assets, setAssets] = useState<Asset[]>([])

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | IncidentStatus>("all")
  const [severityFilter, setSeverityFilter] = useState<"all" | IncidentSeverity>("all")
  const [assetFilter, setAssetFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalIncidents, setTotalIncidents] = useState(0)
  const [groupedCounts, setGroupedCounts] = useState({ open: 0, investigating: 0, resolved: 0, critical: 0 })

  const [openCreate, setOpenCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState("")
  const [incidentType, setIncidentType] = useState<IncidentType>("damage")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [severity, setSeverity] = useState<IncidentSeverity>("medium")
  const [occurredAt, setOccurredAt] = useState("")
  const [estimatedRepairCost, setEstimatedRepairCost] = useState("")
  const [pendingDeleteIncidentId, setPendingDeleteIncidentId] = useState<string | null>(null)

  const loadIncidents = async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      search,
      status: statusFilter,
      severity: severityFilter,
    })

    if (assetFilter !== "all") {
      params.set("assetId", assetFilter)
    }

    const response = await fetch(`/api/incidents?${params.toString()}`, { cache: "no-store" })
    if (!response.ok) {
      setIncidents([])
      setTotalIncidents(0)
      setGroupedCounts({ open: 0, investigating: 0, resolved: 0, critical: 0 })
      return
    }

    const payload = (await response.json()) as {
      incidents: IncidentRecord[]
      counts?: { open: number; investigating: number; resolved: number; critical: number }
      pagination?: { total: number }
    }
    setIncidents(payload.incidents ?? [])
    setTotalIncidents(payload.pagination?.total ?? payload.incidents.length)
    setGroupedCounts(payload.counts ?? { open: 0, investigating: 0, resolved: 0, critical: 0 })
  }

  const loadAssets = async () => {
    const response = await fetch("/api/assets?page=1&pageSize=200", { cache: "no-store" })
    if (!response.ok) {
      setAssets([])
      return
    }

    const payload = (await response.json()) as { assets: Asset[] }
    const loadedAssets = payload.assets ?? []
    setAssets(loadedAssets)

    const preselectedAsset = searchParams.get("assetId")
    if (preselectedAsset && loadedAssets.some((asset) => asset.id === preselectedAsset)) {
      setAssetFilter(preselectedAsset)
      if (!selectedAssetId) {
        setSelectedAssetId(preselectedAsset)
      }
      return
    }

    if (!selectedAssetId && loadedAssets.length > 0) {
      setSelectedAssetId(loadedAssets[0]!.id)
    }
  }

  useEffect(() => {
    if (userLoading || !isAdmin) {
      return
    }

    void loadIncidents()
  }, [isAdmin, userLoading, page, pageSize, search, statusFilter, severityFilter, assetFilter])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, severityFilter, assetFilter])

  useEffect(() => {
    if (userLoading || !isAdmin) {
      return
    }

    void loadAssets()
  }, [isAdmin, userLoading])

  const createIncident = async () => {
    if (!selectedAssetId || title.trim().length < 3 || description.trim().length < 5) {
      return
    }

    setCreating(true)
    const response = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: selectedAssetId,
        incidentType,
        title,
        description,
        severity,
        occurredAt: occurredAt || null,
        estimatedRepairCost: estimatedRepairCost.trim().length > 0 ? Number(estimatedRepairCost) : null,
      }),
    })
    setCreating(false)

    if (!response.ok) {
      return
    }

    setOpenCreate(false)
    setTitle("")
    setDescription("")
    setSeverity("medium")
    setIncidentType("damage")
    setOccurredAt("")
    setEstimatedRepairCost("")
    await loadIncidents()
  }

  const deleteIncident = async (id: string) => {
    const response = await fetch(`/api/incidents/${id}`, { method: "DELETE" })
    if (!response.ok) {
      return
    }

    setPendingDeleteIncidentId(null)
    await loadIncidents()
  }

  const pendingDeleteIncident = pendingDeleteIncidentId
    ? (incidents.find((entry) => entry.id === pendingDeleteIncidentId) ?? null)
    : null

  if (userLoading) {
    return (
      <AppShell>
        <PageHeader title={t("navIncidents")} breadcrumbs={[{ label: t("navIncidents") }]} />
      </AppShell>
    )
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <PageHeader title={t("navIncidents")} breadcrumbs={[{ label: t("navIncidents") }]} />
        <div className="app-page">
          <Card className="app-surface">
            <CardContent className="py-8 text-sm text-muted-foreground">{t("incidentsAdminOnly")}</CardContent>
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader title={t("navIncidents")} breadcrumbs={[{ label: t("navIncidents") }]} />
      <div className="app-page">
        <div className="app-hero flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("incidentsTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("incidentsSubtitle")}</p>
          </div>
          <Button size="sm" onClick={() => setOpenCreate(true)}>
            <ShieldAlert className="mr-1.5 size-3.5" />
            {t("incidentsNew")}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="app-kpi">
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground">{t("incidentsStatusOpen")}</p>
              <p className="text-2xl font-semibold">{groupedCounts.open}</p>
            </CardContent>
          </Card>
          <Card className="app-kpi">
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground">{t("incidentsStatusInvestigating")}</p>
              <p className="text-2xl font-semibold">{groupedCounts.investigating}</p>
            </CardContent>
          </Card>
          <Card className="app-kpi">
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground">{t("incidentsStatusResolved")}</p>
              <p className="text-2xl font-semibold">{groupedCounts.resolved}</p>
            </CardContent>
          </Card>
          <Card className="app-kpi">
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground">{t("incidentsSeverityCritical")}</p>
              <p className="text-2xl font-semibold">{groupedCounts.critical}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="app-surface">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("incidentsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("incidentsSearch")}
            />
            <SearchableSelect
              value={assetFilter}
              onValueChange={setAssetFilter}
              items={[
                { value: "all", label: t("filtersAllAssets") },
                ...assets.map((asset) => ({ value: asset.id, label: asset.name, description: asset.id })),
              ]}
              placeholder={t("incidentsAsset")}
              searchPlaceholder={t("searchAssets")}
              emptyLabel={t("incidentsNoMatches")}
            />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | IncidentStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filtersAllStatus")}</SelectItem>
                {incidentStatusOptions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {incidentStatusLabel(t, value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={severityFilter}
              onValueChange={(value) => setSeverityFilter(value as "all" | IncidentSeverity)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("incidentsAllSeverities")}</SelectItem>
                {incidentSeverityOptions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {incidentSeverityLabel(t, value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {incidents.length === 0 ? (
          <Card className="app-surface">
            <CardContent className="py-8 text-sm text-muted-foreground">{t("incidentsNoMatches")}</CardContent>
          </Card>
        ) : (
          <div className="app-surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("incidentsFieldTitle")}</TableHead>
                  <TableHead>{t("assetTableId")}</TableHead>
                  <TableHead>{t("incidentsAsset")}</TableHead>
                  <TableHead>{t("incidentsFieldType")}</TableHead>
                  <TableHead>{t("incidentsFieldSeverity")}</TableHead>
                  <TableHead>{t("incidentsStatus")}</TableHead>
                  <TableHead>{t("incidentsReportedAt")}</TableHead>
                  <TableHead className="text-right">{t("incidentsAttachments")}</TableHead>
                  <TableHead className="text-right">{t("incidentsEstimatedRepairCost")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((incident) => (
                  <TableRow key={incident.id} className="hover:bg-muted/30">
                    <TableCell>
                      <Link
                        href={`/incidents/${incident.id}`}
                        className="block max-w-[280px] truncate font-medium transition-colors hover:text-primary"
                        title={incident.title}
                      >
                        {incident.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{incident.id}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{incident.assetName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{incidentTypeLabel(t, incident.incidentType)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={severityClass(incident.severity)}>
                        {incidentSeverityLabel(t, incident.severity)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusClass(incident.status)}>
                        {incidentStatusLabel(t, incident.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(incident.reportedAt, { month: "short", day: "numeric", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{incident.attachmentCount}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {incident.estimatedRepairCost !== null ? formatCurrency(incident.estimatedRepairCost) : "—"}
                    </TableCell>
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
                            <Link href={`/incidents/${incident.id}`}>{t("assetViewDetails")}</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setPendingDeleteIncidentId(incident.id)}
                          >
                            {t("assetDelete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t("showingCountOf", {
              current: incidents.length,
              total: totalIncidents,
              label: t("navIncidents").toLowerCase(),
            })}
          </span>
          <DataTablePagination page={page} pageSize={pageSize} total={totalIncidents} onPageChange={setPage} />
        </div>
      </div>

      <ConfirmDeleteDialog
        open={pendingDeleteIncidentId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteIncidentId(null)
          }
        }}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription", { name: pendingDeleteIncident?.title ?? "" })}
        cancelLabel={t("commonCancel")}
        confirmLabel={t("deleteConfirmAction")}
        onConfirm={() => {
          if (pendingDeleteIncidentId) {
            void deleteIncident(pendingDeleteIncidentId)
          }
        }}
      />

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("incidentsCreateTitle")}</DialogTitle>
            <DialogDescription>{t("incidentsCreateDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
              {t("incidentsRequiredFields")}
            </div>
            <div className="grid gap-2">
              <Label>{t("incidentsAsset")}</Label>
              <SearchableSelect
                value={selectedAssetId}
                onValueChange={setSelectedAssetId}
                items={assets.map((asset) => ({ value: asset.id, label: asset.name, description: asset.id }))}
                placeholder={t("incidentsSelectAsset")}
                searchPlaceholder={t("searchAssets")}
                emptyLabel={t("incidentsNoMatches")}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t("incidentsFieldType")}</Label>
                <Select value={incidentType} onValueChange={(value) => setIncidentType(value as IncidentType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {incidentTypeOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {incidentTypeLabel(t, value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("incidentsFieldSeverity")}</Label>
                <Select value={severity} onValueChange={(value) => setSeverity(value as IncidentSeverity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {incidentSeverityOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {incidentSeverityLabel(t, value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("incidentsFieldTitle")}</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>{t("incidentsFieldDescription")}</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-24"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t("incidentsOccurredAt")}</Label>
                <Input type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>{t("incidentsEstimatedRepairCost")}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={estimatedRepairCost}
                  onChange={(event) => setEstimatedRepairCost(event.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>
              {t("commonCancel")}
            </Button>
            <Button
              onClick={createIncident}
              disabled={creating || !selectedAssetId || title.trim().length < 3 || description.trim().length < 5}
            >
              {creating ? t("settingsSaving") : t("incidentsCreateAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
