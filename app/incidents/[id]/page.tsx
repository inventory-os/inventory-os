"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, FileText, Image as ImageIcon, Pencil, Trash2 } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useAppRuntime } from "@/components/app-runtime-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import type { IncidentFile, IncidentRecord, IncidentSeverity, IncidentStatus, IncidentType } from "@/lib/data"

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

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const { t, formatDate, formatCurrency } = useAppRuntime()
  const { isAdmin, loading: userLoading } = useCurrentUser()

  const [incident, setIncident] = useState<IncidentRecord | null>(null)
  const [files, setFiles] = useState<IncidentFile[]>([])
  const [loading, setLoading] = useState(true)
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false)

  const loadIncident = async () => {
    setLoading(true)

    const [incidentResponse, filesResponse] = await Promise.all([
      fetch(`/api/incidents/${id}`, { cache: "no-store" }),
      fetch(`/api/incidents/${id}/files`, { cache: "no-store" }),
    ])

    if (incidentResponse.ok) {
      const payload = (await incidentResponse.json()) as { incident: IncidentRecord }
      setIncident(payload.incident)
    } else {
      setIncident(null)
    }

    if (filesResponse.ok) {
      const payload = (await filesResponse.json()) as { files: IncidentFile[] }
      setFiles(payload.files ?? [])
    } else {
      setFiles([])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (userLoading || !isAdmin) {
      return
    }

    void loadIncident()
  }, [id, isAdmin, userLoading])

  const uploadIncidentFile = async (file: File | null, kind: "image" | "document") => {
    if (!incident || !file) {
      return
    }

    const formData = new FormData()
    formData.set("file", file)
    formData.set("kind", kind)

    const response = await fetch(`/api/incidents/${incident.id}/files`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      return
    }

    await loadIncident()
  }

  const deleteIncidentFile = async (fileId: string) => {
    if (!incident) {
      return
    }

    const response = await fetch(`/api/incidents/${incident.id}/files/${fileId}`, { method: "DELETE" })
    if (!response.ok) {
      return
    }

    await loadIncident()
  }

  const deleteIncidentRecord = async () => {
    if (!incident) {
      return
    }

    const response = await fetch(`/api/incidents/${incident.id}`, { method: "DELETE" })
    if (!response.ok) {
      return
    }

    router.push("/incidents")
  }

  if (userLoading || loading) {
    return <AppShell><PageHeader title={t("navIncidents")} breadcrumbs={[{ label: t("navIncidents") }]} /></AppShell>
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

  if (!incident) {
    return (
      <AppShell>
        <PageHeader title={t("navIncidents")} breadcrumbs={[{ label: t("navIncidents") }]} />
        <div className="app-page">
          <Card className="app-surface">
            <CardContent className="py-8 text-sm text-muted-foreground">{t("commonNotFound")}</CardContent>
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader title={incident.title} breadcrumbs={[{ label: t("navIncidents"), href: "/incidents" }, { label: incident.id }]} />
      <div className="app-page">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/incidents">
              <ArrowLeft className="mr-1.5 size-3.5" />
              {t("incidentsBackToList")}
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">{incident.id}</Badge>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/incidents/${incident.id}/edit`}>
                <Pencil className="mr-1.5 size-3.5" />
                {t("commonEdit")}
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setOpenDeleteDialog(true)}>
              <Trash2 className="mr-1.5 size-3.5" />
              {t("assetDelete")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card className="app-surface">
              <CardHeader>
                <CardTitle className="text-base">{t("incidentsDetailTitle")}</CardTitle>
                <CardDescription>{t("incidentsDetailDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={statusClass(incident.status)}>{incidentStatusLabel(t, incident.status)}</Badge>
                  <Badge variant="outline" className={severityClass(incident.severity)}>{incidentSeverityLabel(t, incident.severity)}</Badge>
                  <Badge variant="secondary">{incidentTypeLabel(t, incident.incidentType)}</Badge>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <p className="text-xs text-muted-foreground">{t("incidentsAsset")}</p>
                    <Link href={`/assets/${incident.assetId}`} className="text-sm font-medium hover:text-primary">{incident.assetName}</Link>
                  </div>
                  <div className="grid gap-1.5">
                    <p className="text-xs text-muted-foreground">{t("incidentsReportedBy")}</p>
                    <p className="text-sm">{incident.reportedBy}</p>
                  </div>
                  <div className="grid gap-1.5">
                    <p className="text-xs text-muted-foreground">{t("incidentsReportedAt")}</p>
                    <p className="text-sm">{formatDate(incident.reportedAt, { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                  <div className="grid gap-1.5">
                    <p className="text-xs text-muted-foreground">{t("incidentsOccurredAt")}</p>
                    <p className="text-sm">{incident.occurredAt ? formatDate(incident.occurredAt, { month: "short", day: "numeric", year: "numeric" }) : "—"}</p>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <p className="text-xs text-muted-foreground">{t("incidentsFieldDescription")}</p>
                  <p className="text-sm whitespace-pre-wrap">{incident.description}</p>
                </div>

                <div className="grid gap-1.5">
                  <p className="text-xs text-muted-foreground">{t("incidentsResolutionNotes")}</p>
                  <p className="text-sm whitespace-pre-wrap">{incident.resolutionNotes?.trim().length ? incident.resolutionNotes : "—"}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="app-surface">
              <CardHeader>
                <CardTitle className="text-base">{t("incidentsAttachments")}</CardTitle>
                <CardDescription>{t("incidentsEvidenceHint")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border border-dashed bg-background p-2">
                    <Label htmlFor="incident-image-upload" className="text-[11px]">{t("incidentsUploadImage")}</Label>
                    <Input
                      id="incident-image-upload"
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const selected = event.target.files?.[0] ?? null
                        void uploadIncidentFile(selected, "image")
                        event.currentTarget.value = ""
                      }}
                    />
                  </div>
                  <div className="rounded-md border border-dashed bg-background p-2">
                    <Label htmlFor="incident-document-upload" className="text-[11px]">{t("incidentsUploadDocument")}</Label>
                    <Input
                      id="incident-document-upload"
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,image/*"
                      onChange={(event) => {
                        const selected = event.target.files?.[0] ?? null
                        void uploadIncidentFile(selected, "document")
                        event.currentTarget.value = ""
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {files.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("incidentsNoAttachments")}</p>
                  ) : (
                    files.map((file) => {
                      const isImage = file.kind === "image" || file.mimeType.startsWith("image/")
                      return (
                        <div key={file.id} className="flex items-center justify-between rounded-md border px-2.5 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            {isImage ? <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" /> : <FileText className="size-3.5 shrink-0 text-muted-foreground" />}
                            <a
                              href={isImage ? `/api/incidents/${incident.id}/files/${file.id}` : `/api/incidents/${incident.id}/files/${file.id}?download=1`}
                              target={isImage ? "_blank" : undefined}
                              rel={isImage ? "noreferrer" : undefined}
                              className="truncate text-xs font-medium hover:text-primary"
                            >
                              {file.originalName}
                            </a>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
                              <a href={`/api/incidents/${incident.id}/files/${file.id}?download=1`}>{t("commonDownload")}</a>
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => void deleteIncidentFile(file.id)}>
                              {t("commonRemove")}
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="app-surface">
              <CardHeader>
                <CardTitle className="text-sm font-medium">{t("incidentsSummary")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("incidentsAttachments")}</span>
                  <span>{files.length}</span>
                </div>
                {incident.estimatedRepairCost !== null ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("incidentsEstimatedRepairCost")}</span>
                    <span>{formatCurrency(incident.estimatedRepairCost)}</span>
                  </div>
                ) : null}
                <div className="pt-2">
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={`/assets/${incident.assetId}`}>{t("assetViewDetails")}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={openDeleteDialog}
        onOpenChange={setOpenDeleteDialog}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription", { name: incident.title })}
        cancelLabel={t("commonCancel")}
        confirmLabel={t("deleteConfirmAction")}
        onConfirm={() => {
          void deleteIncidentRecord()
        }}
      />
    </AppShell>
  )
}
