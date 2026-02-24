"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { useCurrentUser } from "@/hooks/use-current-user"
import { IsAdmin } from "@/components/is-admin"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { useAppRuntime } from "@/components/app-runtime-provider"
import { trpc } from "@/lib/trpc/react"

type HealthIssue = {
  id: string
  title: string
  severity: "warning" | "critical"
  details: string
  fix: string
}

type HealthPayload = {
  checkedAt: string
  overallOk: boolean
  checks: {
    proxy: boolean
    tls: boolean
    database: boolean
    memory: boolean
  }
  issues: HealthIssue[]
  proxy: {
    ok: boolean
    host: string
    forwardedFor: string | null
    trustedDomainsConfigured: number
    trustedProxiesConfigured: number
    trustedDomainsSource: "env" | "db"
    trustedProxiesSource: "env" | "db"
  }
  tls: {
    ok: boolean
    protocol: string
    forwardedProto: string | null
  }
  server: {
    nodeVersion: string
    platform: string
    arch: string
    uptimeSeconds: number
    cpuCount: number
    memory: {
      usagePercent: number
    }
  }
  stats: {
    totalAssets: number
    activeUsers: number
    locations: number
    maintenance: number
    inventoryValue: number
  }
}

type SecurityResponse = {
  settings: {
    trustedProxies: string[]
    trustedDomains: string[]
  }
  effective: {
    trustedProxies: string[]
    trustedDomains: string[]
    trustedProxiesSource: "env" | "db"
    trustedDomainsSource: "env" | "db"
  }
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        ok ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"
      }
    >
      {ok ? "OK" : "Issue"}
    </Badge>
  )
}

export default function HealthPage() {
  const { t, formatCurrency } = useAppRuntime()
  const { isAdmin, loading: userLoading } = useCurrentUser()

  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)

  const [trustedProxiesDraft, setTrustedProxiesDraft] = useState("")
  const [trustedDomainsDraft, setTrustedDomainsDraft] = useState("")
  const [effectiveConfig, setEffectiveConfig] = useState<SecurityResponse["effective"] | null>(null)
  const [savingSecurity, setSavingSecurity] = useState(false)
  const [securityError, setSecurityError] = useState<string | null>(null)
  const [securityMessage, setSecurityMessage] = useState<string | null>(null)

  const healthQuery = trpc.settings.healthStatus.useQuery(undefined, {
    enabled: !userLoading && isAdmin,
    staleTime: 10_000,
  })

  const securityBundleQuery = trpc.settings.securityBundle.useQuery(undefined, {
    enabled: !userLoading && isAdmin,
    staleTime: 10_000,
  })

  const saveSecurityMutation = trpc.settings.saveSecuritySettings.useMutation()

  useEffect(() => {
    if (healthQuery.data) {
      setHealth(healthQuery.data as HealthPayload)
      setHealthError(null)
    } else if (healthQuery.error) {
      setHealthError(healthQuery.error.message)
    }
  }, [healthQuery.data, healthQuery.error])

  useEffect(() => {
    if (securityBundleQuery.data) {
      const payload = securityBundleQuery.data as SecurityResponse
      setTrustedProxiesDraft(payload.settings.trustedProxies.join("\n"))
      setTrustedDomainsDraft(payload.settings.trustedDomains.join("\n"))
      setEffectiveConfig(payload.effective)
      setSecurityError(null)
    } else if (securityBundleQuery.error) {
      setSecurityError(securityBundleQuery.error.message)
    }
  }, [securityBundleQuery.data, securityBundleQuery.error])

  const saveSecurity = async () => {
    setSavingSecurity(true)
    setSecurityError(null)
    setSecurityMessage(null)

    try {
      const trustedProxies = trustedProxiesDraft
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean)
      const trustedDomains = trustedDomainsDraft
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean)

      const settings = await saveSecurityMutation.mutateAsync({ trustedProxies, trustedDomains })

      setTrustedProxiesDraft(settings.trustedProxies.join("\n"))
      setTrustedDomainsDraft(settings.trustedDomains.join("\n"))
      setSecurityMessage(t("settingsSaved"))
      await Promise.all([securityBundleQuery.refetch(), healthQuery.refetch()])
    } catch (error) {
      setSecurityError(error instanceof Error ? error.message : "Failed to save security settings")
    } finally {
      setSavingSecurity(false)
    }
  }

  const loadingHealth = healthQuery.isLoading || healthQuery.isFetching
  const loadingSecurity = securityBundleQuery.isLoading || securityBundleQuery.isFetching

  if (userLoading) {
    return (
      <AppShell>
        <PageHeader title={t("navHealth")} breadcrumbs={[{ label: t("navHealth") }]} />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader title={t("navHealth")} breadcrumbs={[{ label: t("sidebarManagement") }, { label: t("navHealth") }]} />
      <IsAdmin
        isAdmin={isAdmin}
        loading={userLoading}
        fallback={
          <div className="app-page">
            <Card className="app-surface">
              <CardContent className="py-8 text-sm text-muted-foreground">{t("healthAdminOnly")}</CardContent>
            </Card>
          </div>
        }
      >
        <div className="app-page">
          <div className="app-hero">
            <h1 className="text-2xl font-semibold tracking-tight">{t("navHealth")}</h1>
            <p className="text-sm text-muted-foreground">{t("healthSubtitle")}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="app-surface">
              <CardContent className="p-4">
                <p className="text-[11px] text-muted-foreground">{t("settingsHealthOverall")}</p>
                <div className="mt-2">
                  <StatusBadge ok={health?.overallOk ?? false} />
                </div>
              </CardContent>
            </Card>
            <Card className="app-surface">
              <CardContent className="p-4">
                <p className="text-[11px] text-muted-foreground">{t("settingsHealthProxy")}</p>
                <div className="mt-2">
                  <StatusBadge ok={health?.checks.proxy ?? false} />
                </div>
              </CardContent>
            </Card>
            <Card className="app-surface">
              <CardContent className="p-4">
                <p className="text-[11px] text-muted-foreground">{t("settingsHealthTls")}</p>
                <div className="mt-2">
                  <StatusBadge ok={health?.checks.tls ?? false} />
                </div>
              </CardContent>
            </Card>
            <Card className="app-surface">
              <CardContent className="p-4">
                <p className="text-[11px] text-muted-foreground">{t("settingsHealthDatabase")}</p>
                <div className="mt-2">
                  <StatusBadge ok={health?.checks.database ?? false} />
                </div>
              </CardContent>
            </Card>
            <Card className="app-surface">
              <CardContent className="p-4">
                <p className="text-[11px] text-muted-foreground">{t("settingsHealthMemory")}</p>
                <div className="mt-2">
                  <StatusBadge ok={health?.checks.memory ?? false} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-base">{t("settingsHealthCheckTitle")}</CardTitle>
              <CardDescription>{t("settingsHealthCheckDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="rounded-md border px-3 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">{t("settingsHealthMemory")}</p>
                  <p className="text-xs font-medium">{health?.server.memory.usagePercent ?? 0}%</p>
                </div>
                <Progress value={health?.server.memory.usagePercent ?? 0} />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-md border px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{t("statTotalAssets")}</p>
                  <p className="text-lg font-semibold">{health?.stats.totalAssets ?? "—"}</p>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{t("statActiveUsers")}</p>
                  <p className="text-lg font-semibold">{health?.stats.activeUsers ?? "—"}</p>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{t("statLocations")}</p>
                  <p className="text-lg font-semibold">{health?.stats.locations ?? "—"}</p>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{t("statMaintenance")}</p>
                  <p className="text-lg font-semibold">{health?.stats.maintenance ?? "—"}</p>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{t("statInventoryValue")}</p>
                  <p className="text-sm font-semibold">{health ? formatCurrency(health.stats.inventoryValue) : "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-md border px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{t("settingsHealthServer")}</p>
                  <p className="text-xs">{health ? `${health.server.platform}/${health.server.arch}` : "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {health ? `${health.server.nodeVersion} • ${health.server.cpuCount} CPU` : ""}
                  </p>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{t("settingsHealthTls")}</p>
                  <p className="text-xs">{health?.tls.protocol ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{health?.tls.forwardedProto ?? "—"}</p>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{t("settingsHealthForwarded")}</p>
                  <p className="text-xs line-clamp-1">{health?.proxy.forwardedFor || "—"}</p>
                  <p className="text-xs text-muted-foreground">{health?.proxy.host || "—"}</p>
                </div>
              </div>

              {healthError ? <p className="text-xs text-destructive">{healthError}</p> : null}

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => void healthQuery.refetch()} disabled={loadingHealth}>
                  {loadingHealth ? t("settingsLoadingHealth") : t("settingsRunHealthCheck")}
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                {health?.checkedAt
                  ? `${t("settingsHealthLastChecked")}: ${new Date(health.checkedAt).toLocaleString()}`
                  : ""}
              </p>
            </CardContent>
          </Card>

          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-base">{t("healthIssuesTitle")}</CardTitle>
              <CardDescription>
                {health?.issues.length ? `${health.issues.length} issue(s)` : t("healthNoIssues")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!health || health.issues.length === 0 ? (
                <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  {t("healthNoIssues")}
                </div>
              ) : (
                health.issues.map((issue) => (
                  <div key={issue.id} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">{issue.title}</p>
                      <Badge
                        variant="outline"
                        className={
                          issue.severity === "critical"
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-warning/10 text-warning border-warning/20"
                        }
                      >
                        {issue.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{issue.details}</p>
                    <p className="mt-2 text-xs">
                      <span className="font-medium">{t("healthHowToFix")}: </span>
                      {issue.fix}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-base">{t("healthSecuritySettingsTitle")}</CardTitle>
              <CardDescription>{t("healthSecuritySettingsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="trusted-domains" className="text-xs">
                    {t("settingsTrustedDomains")}
                  </Label>
                  <Textarea
                    id="trusted-domains"
                    value={trustedDomainsDraft}
                    onChange={(event) => setTrustedDomainsDraft(event.target.value)}
                    placeholder={t("settingsTrustedDomainsPlaceholder")}
                    className="min-h-28"
                    disabled={loadingSecurity || savingSecurity}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="trusted-proxies" className="text-xs">
                    {t("settingsTrustedProxies")}
                  </Label>
                  <Textarea
                    id="trusted-proxies"
                    value={trustedProxiesDraft}
                    onChange={(event) => setTrustedProxiesDraft(event.target.value)}
                    placeholder={t("settingsTrustedProxiesPlaceholder")}
                    className="min-h-28"
                    disabled={loadingSecurity || savingSecurity}
                  />
                </div>
              </div>

              <div className="rounded-md border px-3 py-2">
                <p className="text-[11px] text-muted-foreground">{t("healthEffectiveConfigTitle")}</p>
                <p className="text-xs">
                  {t("settingsTrustedDomains")}: {effectiveConfig?.trustedDomains.length ?? 0}{" "}
                  <span className="text-muted-foreground">
                    (
                    {effectiveConfig?.trustedDomainsSource === "env"
                      ? t("healthConfigSourceEnv")
                      : t("healthConfigSourceDb")}
                    )
                  </span>
                </p>
                <p className="text-xs">
                  {t("settingsTrustedProxies")}: {effectiveConfig?.trustedProxies.length ?? 0}{" "}
                  <span className="text-muted-foreground">
                    (
                    {effectiveConfig?.trustedProxiesSource === "env"
                      ? t("healthConfigSourceEnv")
                      : t("healthConfigSourceDb")}
                    )
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{t("healthEnvHint")}</p>
              </div>

              {securityError ? <p className="text-xs text-destructive">{securityError}</p> : null}
              {securityMessage ? <p className="text-xs text-muted-foreground">{securityMessage}</p> : null}

              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={saveSecurity} disabled={loadingSecurity || savingSecurity}>
                  {savingSecurity ? t("settingsSaving") : t("settingsSaveChanges")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </IsAdmin>
    </AppShell>
  )
}
