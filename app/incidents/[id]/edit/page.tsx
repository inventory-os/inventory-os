"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useAppRuntime } from "@/components/app-runtime-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import type { Asset, IncidentRecord, IncidentSeverity, IncidentStatus, IncidentType } from "@/lib/data"

const incidentSeverityOptions: IncidentSeverity[] = ["low", "medium", "high", "critical"]
const incidentStatusOptions: IncidentStatus[] = ["open", "investigating", "resolved"]
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

export default function IncidentEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const { t } = useAppRuntime()
  const { isAdmin, loading: userLoading } = useCurrentUser()

  const [incident, setIncident] = useState<IncidentRecord | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [assetId, setAssetId] = useState("")
  const [incidentType, setIncidentType] = useState<IncidentType>("damage")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [severity, setSeverity] = useState<IncidentSeverity>("medium")
  const [status, setStatus] = useState<IncidentStatus>("open")
  const [occurredAt, setOccurredAt] = useState("")
  const [estimatedRepairCost, setEstimatedRepairCost] = useState("")
  const [resolutionNotes, setResolutionNotes] = useState("")

  const loadIncident = async () => {
    setLoading(true)

    const [incidentResponse, assetsResponse] = await Promise.all([
      fetch(`/api/incidents/${id}`, { cache: "no-store" }),
      fetch("/api/assets?page=1&pageSize=200", { cache: "no-store" }),
    ])

    if (incidentResponse.ok) {
      const payload = (await incidentResponse.json()) as { incident: IncidentRecord }
      const loadedIncident = payload.incident
      setIncident(loadedIncident)

      setAssetId(loadedIncident.assetId)
      setIncidentType(loadedIncident.incidentType)
      setTitle(loadedIncident.title)
      setDescription(loadedIncident.description)
      setSeverity(loadedIncident.severity)
      setStatus(loadedIncident.status)
      setOccurredAt(loadedIncident.occurredAt ? loadedIncident.occurredAt.slice(0, 10) : "")
      setEstimatedRepairCost(loadedIncident.estimatedRepairCost === null ? "" : String(loadedIncident.estimatedRepairCost))
      setResolutionNotes(loadedIncident.resolutionNotes ?? "")
    } else {
      setIncident(null)
    }

    if (assetsResponse.ok) {
      const payload = (await assetsResponse.json()) as { assets: Asset[] }
      setAssets(payload.assets ?? [])
    } else {
      setAssets([])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (userLoading || !isAdmin) {
      return
    }

    void loadIncident()
  }, [id, isAdmin, userLoading])

  const saveIncident = async () => {
    if (!incident) {
      return
    }

    setSaving(true)

    const response = await fetch(`/api/incidents/${incident.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId,
        incidentType,
        title,
        description,
        severity,
        status,
        occurredAt: occurredAt || null,
        estimatedRepairCost: estimatedRepairCost.trim().length > 0 ? Number(estimatedRepairCost) : null,
        resolutionNotes: resolutionNotes || null,
      }),
    })

    setSaving(false)
    if (!response.ok) {
      return
    }

    router.push(`/incidents/${incident.id}`)
  }

  if (userLoading || loading) {
    return <AppShell><PageHeader title={t("commonEdit")} breadcrumbs={[{ label: t("navIncidents") }]} /></AppShell>
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <PageHeader title={t("commonEdit")} breadcrumbs={[{ label: t("navIncidents") }]} />
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
        <PageHeader title={t("commonEdit")} breadcrumbs={[{ label: t("navIncidents") }]} />
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
      <PageHeader title={incident.title} breadcrumbs={[{ label: t("navIncidents"), href: "/incidents" }, { label: incident.id, href: `/incidents/${incident.id}` }, { label: t("commonEdit") }]} />
      <div className="app-page">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href={`/incidents/${incident.id}`}>
            <ArrowLeft className="mr-1.5 size-3.5" />
            {t("assetBackToDetails")}
          </Link>
        </Button>

        <div className="mx-auto w-full max-w-5xl space-y-6">
          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-sm font-medium">{t("incidentsDetailTitle")}</CardTitle>
              <CardDescription>{t("incidentsDetailDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t("incidentsAsset")}</Label>
                  <SearchableSelect
                    value={assetId}
                    onValueChange={setAssetId}
                    items={assets.map((asset) => ({ value: asset.id, label: asset.name, description: asset.id }))}
                    placeholder={t("incidentsSelectAsset")}
                    searchPlaceholder={t("searchAssets")}
                    emptyLabel={t("incidentsNoMatches")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("incidentsFieldType")}</Label>
                  <Select value={incidentType} onValueChange={(value) => setIncidentType(value as IncidentType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {incidentTypeOptions.map((value) => (
                        <SelectItem key={value} value={value}>{incidentTypeLabel(t, value)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t("incidentsFieldSeverity")}</Label>
                  <Select value={severity} onValueChange={(value) => setSeverity(value as IncidentSeverity)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {incidentSeverityOptions.map((value) => (
                        <SelectItem key={value} value={value}>{incidentSeverityLabel(t, value)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t("incidentsStatus")}</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as IncidentStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {incidentStatusOptions.map((value) => (
                        <SelectItem key={value} value={value}>{incidentStatusLabel(t, value)}</SelectItem>
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
                <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24" />
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-sm font-medium">{t("incidentsSummary")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t("incidentsOccurredAt")}</Label>
                <Input type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>{t("incidentsEstimatedRepairCost")}</Label>
                <Input type="number" min={0} step="0.01" value={estimatedRepairCost} onChange={(event) => setEstimatedRepairCost(event.target.value)} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>{t("incidentsResolutionNotes")}</Label>
                <Textarea value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} className="min-h-24" />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link href={`/incidents/${incident.id}`}>{t("commonCancel")}</Link>
            </Button>
            <Button onClick={saveIncident} disabled={saving || !assetId || title.trim().length < 3 || description.trim().length < 5}>
              {saving ? t("settingsSaving") : t("settingsSaveChanges")}
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
