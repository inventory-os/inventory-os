"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import type { AddressRecord, EuropeanLocale, NotificationPreferences, SecuritySettings } from "@/lib/types"
import { useAppRuntime } from "@/components/app-runtime-provider"
import { trpc } from "@/lib/trpc/react"

type LdapSettingsForm = {
  enabled: boolean
  url: string
  bindDn: string
  bindPassword: string
  baseDn: string
  userFilter: string
  usernameAttribute: string
  emailAttribute: string
  nameAttribute: string
  defaultRole: string
  syncIssuer: string
  hasBindPassword: boolean
}

type QrSettingsForm = {
  enabled: boolean
  ownerLabel: string
  publicMessage: string
  showLoginButton: boolean
  loginButtonText: string
  selectedAddressId: string | null
  logoUrl: string
  contactPhone: string
  contactEmail: string
  websiteUrl: string
  extraLinks: Array<{ label: string; url: string }>
}

type ManagementHealth = {
  checkedAt: string
  overallOk: boolean
  checks: {
    proxy: boolean
    tls: boolean
    database: boolean
    memory: boolean
  }
  proxy: {
    ok: boolean
    proxyHeadersDetected: boolean
    host: string
    forwardedFor: string | null
    forwardedProto: string | null
    forwardedHost: string | null
    domainTrusted: boolean
    proxyChainTrusted: boolean
    trustedDomainsConfigured: number
    trustedProxiesConfigured: number
  }
  tls: {
    ok: boolean
    protocol: string
    forwardedProto: string | null
    secureDetectedFromRequestUrl: boolean
    secureDetectedFromForwardedProto: boolean
  }
  server: {
    nodeVersion: string
    platform: string
    arch: string
    uptimeSeconds: number
    cpuCount: number
    loadAverage: number[]
    memory: {
      usedBytes: number
      totalBytes: number
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

const DEFAULT_LDAP_SETTINGS: LdapSettingsForm = {
  enabled: false,
  url: "",
  bindDn: "",
  bindPassword: "",
  baseDn: "",
  userFilter: "(objectClass=person)",
  usernameAttribute: "uid",
  emailAttribute: "mail",
  nameAttribute: "cn",
  defaultRole: "member",
  syncIssuer: "",
  hasBindPassword: false,
}

export default function SettingsPage() {
  const { refresh, t } = useAppRuntime()
  const trpcUtils = trpc.useUtils()

  const saveGeneralMutation = trpc.settings.saveGeneral.useMutation()
  const saveLdapMutation = trpc.integrations.saveLdapSettings.useMutation()
  const runLdapSyncMutation = trpc.integrations.runLdapSync.useMutation()
  const saveQrMutation = trpc.settings.saveQrPublic.useMutation()
  const saveNotificationsMutation = trpc.settings.saveNotificationPreferences.useMutation()
  const saveSecurityMutation = trpc.settings.saveSecuritySettings.useMutation()
  const [general, setGeneral] = useState<{
    appName: string
    organizationName: string
    locale: EuropeanLocale
    currency: string
  }>({
    appName: "",
    organizationName: "",
    locale: "en",
    currency: "EUR",
  })
  const [loadingGeneral, setLoadingGeneral] = useState(true)
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [generalMessage, setGeneralMessage] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)

  const [ldap, setLdap] = useState<LdapSettingsForm>(DEFAULT_LDAP_SETTINGS)
  const [loadingLdap, setLoadingLdap] = useState(true)
  const [savingLdap, setSavingLdap] = useState(false)
  const [syncingLdap, setSyncingLdap] = useState(false)
  const [ldapMessage, setLdapMessage] = useState<string | null>(null)
  const [ldapError, setLdapError] = useState<string | null>(null)

  const [qr, setQr] = useState<QrSettingsForm>({
    enabled: true,
    ownerLabel: "",
    publicMessage: "",
    showLoginButton: true,
    loginButtonText: "",
    selectedAddressId: null,
    logoUrl: "",
    contactPhone: "",
    contactEmail: "",
    websiteUrl: "",
    extraLinks: [],
  })
  const [qrLinksDraft, setQrLinksDraft] = useState("")
  const [addressOptions, setAddressOptions] = useState<AddressRecord[]>([])
  const [loadingQr, setLoadingQr] = useState(true)
  const [savingQr, setSavingQr] = useState(false)
  const [uploadingQrLogo, setUploadingQrLogo] = useState(false)
  const [qrMessage, setQrMessage] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)

  const [notifications, setNotifications] = useState<NotificationPreferences>({
    checkoutAlerts: true,
    maintenanceAlerts: true,
    bookingAlerts: true,
    digestEnabled: false,
    lowInventoryAlerts: false,
    updatedAt: null,
  })
  const [loadingNotifications, setLoadingNotifications] = useState(true)
  const [savingNotifications, setSavingNotifications] = useState(false)
  const [notificationsMessage, setNotificationsMessage] = useState<string | null>(null)
  const [notificationsError, setNotificationsError] = useState<string | null>(null)

  const [security, setSecurity] = useState<SecuritySettings>({
    trustedProxies: [],
    trustedDomains: [],
    updatedAt: null,
  })
  const [trustedProxiesDraft, setTrustedProxiesDraft] = useState("")
  const [trustedDomainsDraft, setTrustedDomainsDraft] = useState("")
  const [loadingSecurity, setLoadingSecurity] = useState(true)
  const [savingSecurity, setSavingSecurity] = useState(false)
  const [securityMessage, setSecurityMessage] = useState<string | null>(null)
  const [securityError, setSecurityError] = useState<string | null>(null)

  const [managementHealth, setManagementHealth] = useState<ManagementHealth | null>(null)
  const [loadingManagementHealth, setLoadingManagementHealth] = useState(true)
  const [managementHealthError, setManagementHealthError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadGeneralSettings() {
      setLoadingGeneral(true)
      setGeneralError(null)
      try {
        const payload = await trpcUtils.settings.general.fetch()
        if (!cancelled) {
          setGeneral({
            appName: payload.appName,
            organizationName: payload.organizationName,
            locale: payload.locale,
            currency: payload.currency,
          })
        }
      } catch (error) {
        if (!cancelled) {
          setGeneralError(error instanceof Error ? error.message : "Failed to load general settings")
        }
      } finally {
        if (!cancelled) {
          setLoadingGeneral(false)
        }
      }
    }

    async function loadLdapSettings() {
      setLoadingLdap(true)
      setLdapError(null)
      try {
        const payload = await trpcUtils.integrations.ldapSettings.fetch()
        if (!cancelled) {
          setLdap({
            ...payload,
            bindPassword: "",
          })
        }
      } catch (error) {
        if (!cancelled) {
          setLdapError(error instanceof Error ? error.message : "Failed to load LDAP settings")
        }
      } finally {
        if (!cancelled) {
          setLoadingLdap(false)
        }
      }
    }

    async function loadQrSettings() {
      setLoadingQr(true)
      setQrError(null)
      try {
        const payload = await trpcUtils.settings.qrPublic.fetch()
        if (!cancelled) {
          setQr(payload as QrSettingsForm)
          setQrLinksDraft(
            ((payload as QrSettingsForm).extraLinks ?? []).map((entry) => `${entry.label} | ${entry.url}`).join("\n"),
          )
        }
      } catch (error) {
        if (!cancelled) {
          setQrError(error instanceof Error ? error.message : "Failed to load QR settings")
        }
      } finally {
        if (!cancelled) {
          setLoadingQr(false)
        }
      }
    }

    async function loadAddressOptions() {
      try {
        const payload = await trpcUtils.addresses.list.fetch()
        if (!cancelled) {
          setAddressOptions((payload ?? []) as AddressRecord[])
        }
      } catch {}
    }

    async function loadNotificationSettings() {
      setLoadingNotifications(true)
      setNotificationsError(null)

      try {
        const payload = await trpcUtils.settings.notificationPreferences.fetch()
        if (!cancelled) {
          setNotifications(payload as NotificationPreferences)
        }
      } catch (error) {
        if (!cancelled) {
          setNotificationsError(error instanceof Error ? error.message : "Failed to load notification settings")
        }
      } finally {
        if (!cancelled) {
          setLoadingNotifications(false)
        }
      }
    }

    async function loadSecuritySettings() {
      setLoadingSecurity(true)
      setSecurityError(null)
      try {
        const payload = await trpcUtils.settings.securityBundle.fetch()
        if (!cancelled) {
          setSecurity(payload.settings as SecuritySettings)
          setTrustedProxiesDraft(payload.settings.trustedProxies.join("\n"))
          setTrustedDomainsDraft(payload.settings.trustedDomains.join("\n"))
        }
      } catch (error) {
        if (!cancelled) {
          setSecurityError(error instanceof Error ? error.message : "Failed to load security settings")
        }
      } finally {
        if (!cancelled) {
          setLoadingSecurity(false)
        }
      }
    }

    async function loadManagementHealth() {
      setLoadingManagementHealth(true)
      setManagementHealthError(null)
      try {
        const payload = await trpcUtils.settings.healthStatus.fetch()
        if (!cancelled) {
          setManagementHealth(payload as ManagementHealth)
        }
      } catch (error) {
        if (!cancelled) {
          setManagementHealthError(error instanceof Error ? error.message : "Failed to load management health")
        }
      } finally {
        if (!cancelled) {
          setLoadingManagementHealth(false)
        }
      }
    }

    loadGeneralSettings()
    loadLdapSettings()
    loadQrSettings()
    loadAddressOptions()
    loadNotificationSettings()
    loadSecuritySettings()
    loadManagementHealth()

    return () => {
      cancelled = true
    }
  }, [])

  async function saveGeneralSettings() {
    setSavingGeneral(true)
    setGeneralError(null)
    setGeneralMessage(null)

    try {
      const settings = await saveGeneralMutation.mutateAsync(general)

      setGeneral({
        appName: settings.appName,
        organizationName: settings.organizationName,
        locale: settings.locale,
        currency: settings.currency,
      })
      setGeneralMessage(t("settingsSaved"))
      await refresh()
    } catch (error) {
      setGeneralError(error instanceof Error ? error.message : "Failed to save settings")
    } finally {
      setSavingGeneral(false)
    }
  }

  async function saveLdapSettings() {
    setSavingLdap(true)
    setLdapError(null)
    setLdapMessage(null)

    try {
      const settings = await saveLdapMutation.mutateAsync({
        enabled: ldap.enabled,
        url: ldap.url,
        bindDn: ldap.bindDn,
        bindPassword: ldap.bindPassword,
        baseDn: ldap.baseDn,
        userFilter: ldap.userFilter,
        usernameAttribute: ldap.usernameAttribute,
        emailAttribute: ldap.emailAttribute,
        nameAttribute: ldap.nameAttribute,
        defaultRole: ldap.defaultRole as "admin" | "member",
        syncIssuer: ldap.syncIssuer,
      })

      setLdap({ ...(settings as Omit<LdapSettingsForm, "bindPassword">), bindPassword: "" })
      setLdapMessage("LDAP settings saved")
    } catch (error) {
      setLdapError(error instanceof Error ? error.message : "Failed to save LDAP settings")
    } finally {
      setSavingLdap(false)
    }
  }

  async function syncLdapUsers() {
    setSyncingLdap(true)
    setLdapError(null)
    setLdapMessage(null)
    try {
      const payload = await runLdapSyncMutation.mutateAsync()
      setLdapMessage(`LDAP sync complete: ${payload.synced ?? 0}/${payload.found ?? 0} users synced`)
    } catch (error) {
      setLdapError(error instanceof Error ? error.message : "LDAP sync failed")
    } finally {
      setSyncingLdap(false)
    }
  }

  async function saveQrSettings() {
    setSavingQr(true)
    setQrError(null)
    setQrMessage(null)

    try {
      const parsedLinks = qrLinksDraft
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [labelPart, ...urlParts] = line.split("|")
          const label = (labelPart ?? "").trim()
          const url = urlParts.join("|").trim()
          return { label, url }
        })
        .filter((entry) => entry.label.length > 0 && entry.url.length > 0)

      const payload = await saveQrMutation.mutateAsync({
        ...qr,
        extraLinks: parsedLinks,
      })

      setQr(payload as QrSettingsForm)
      setQrLinksDraft(
        ((payload as QrSettingsForm).extraLinks ?? []).map((entry) => `${entry.label} | ${entry.url}`).join("\n"),
      )
      setQrMessage(t("settingsSaved"))
    } catch (error) {
      setQrError(error instanceof Error ? error.message : "Failed to save QR settings")
    } finally {
      setSavingQr(false)
    }
  }

  async function uploadQrLogo(file: File | null) {
    if (!file) {
      return
    }

    setUploadingQrLogo(true)
    setQrError(null)

    try {
      const formData = new FormData()
      formData.set("file", file)

      const response = await fetch("/api/settings/qr/logo", {
        method: "POST",
        body: formData,
      })

      const payload = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Failed to upload logo")
      }

      setQr((current) => ({
        ...current,
        logoUrl: payload.url!,
      }))
    } catch (error) {
      setQrError(error instanceof Error ? error.message : "Failed to upload logo")
    } finally {
      setUploadingQrLogo(false)
    }
  }

  async function saveNotificationSettings() {
    setSavingNotifications(true)
    setNotificationsError(null)
    setNotificationsMessage(null)

    try {
      const payload = await saveNotificationsMutation.mutateAsync({
        checkoutAlerts: notifications.checkoutAlerts,
        maintenanceAlerts: notifications.maintenanceAlerts,
        bookingAlerts: notifications.bookingAlerts,
        digestEnabled: notifications.digestEnabled,
        lowInventoryAlerts: notifications.lowInventoryAlerts,
      })

      setNotifications(payload as NotificationPreferences)
      setNotificationsMessage(t("settingsSaved"))
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : "Failed to save notification settings")
    } finally {
      setSavingNotifications(false)
    }
  }

  async function saveSecuritySettings() {
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

      const payload = await saveSecurityMutation.mutateAsync({
        trustedProxies,
        trustedDomains,
      })

      setSecurity(payload as SecuritySettings)
      setTrustedProxiesDraft((payload as SecuritySettings).trustedProxies.join("\n"))
      setTrustedDomainsDraft((payload as SecuritySettings).trustedDomains.join("\n"))
      setSecurityMessage(t("settingsSaved"))
    } catch (error) {
      setSecurityError(error instanceof Error ? error.message : "Failed to save security settings")
    } finally {
      setSavingSecurity(false)
    }
  }

  async function refreshManagementHealth() {
    setLoadingManagementHealth(true)
    setManagementHealthError(null)

    try {
      const payload = await trpcUtils.settings.healthStatus.fetch()
      setManagementHealth(payload as ManagementHealth)
    } catch (error) {
      setManagementHealthError(error instanceof Error ? error.message : "Failed to load management health")
    } finally {
      setLoadingManagementHealth(false)
    }
  }

  return (
    <AppShell>
      <PageHeader title={t("navSettings")} breadcrumbs={[{ label: t("navSettings") }]} />
      <div className="app-page">
        <div className="app-hero">
          <h1 className="text-2xl font-semibold tracking-tight">{t("navSettings")}</h1>
          <p className="text-sm text-muted-foreground">{t("settingsSubtitle")}</p>
        </div>

        <Tabs defaultValue="general" className="gap-6">
          <TabsList className="rounded-xl border border-border/70 bg-card/80">
            <TabsTrigger value="general">{t("settingsGeneral")}</TabsTrigger>
            <TabsTrigger value="notifications">{t("settingsNotifications")}</TabsTrigger>
            <TabsTrigger value="integrations">{t("settingsIntegrations")}</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="flex flex-col gap-6">
            <Card className="app-surface">
              <CardHeader>
                <CardTitle className="text-base">{t("settingsWorkspaceInfoTitle")}</CardTitle>
                <CardDescription>{t("settingsWorkspaceInfoDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="workspace-name" className="text-xs">
                      {t("settingsWorkspaceName")}
                    </Label>
                    <Input
                      id="workspace-name"
                      value={general.appName}
                      onChange={(event) => setGeneral((current) => ({ ...current, appName: event.target.value }))}
                      className="h-9"
                      disabled={loadingGeneral}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="workspace-org" className="text-xs">
                      {t("settingsOrganization")}
                    </Label>
                    <Input
                      id="workspace-org"
                      value={general.organizationName}
                      onChange={(event) =>
                        setGeneral((current) => ({ ...current, organizationName: event.target.value }))
                      }
                      className="h-9"
                      disabled={loadingGeneral}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 sm:col-span-1">
                    <Label htmlFor="workspace-currency" className="text-xs">
                      {t("settingsCurrencyIso")}
                    </Label>
                    <Input
                      id="workspace-currency"
                      value={general.currency}
                      onChange={(event) =>
                        setGeneral((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
                      }
                      className="h-9 uppercase"
                      maxLength={3}
                      disabled={loadingGeneral}
                    />
                  </div>
                </div>
                {generalError && <p className="text-xs text-destructive">{generalError}</p>}
                {generalMessage && <p className="text-xs text-muted-foreground">{generalMessage}</p>}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={saveGeneralSettings}
                    disabled={
                      loadingGeneral ||
                      savingGeneral ||
                      general.appName.trim().length < 2 ||
                      general.organizationName.trim().length < 2 ||
                      general.currency.trim().length !== 3
                    }
                  >
                    {savingGeneral ? t("settingsSaving") : t("settingsSaveChanges")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="app-surface">
              <CardHeader>
                <CardTitle className="text-base">{t("settingsQrTitle")}</CardTitle>
                <CardDescription>{t("settingsQrDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="flex items-center justify-between rounded-md border px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{t("settingsQrPublicEnabled")}</span>
                    <span className="text-xs text-muted-foreground">{t("settingsQrPublicEnabledHint")}</span>
                  </div>
                  <Switch
                    checked={qr.enabled}
                    onCheckedChange={(value) => setQr((current) => ({ ...current, enabled: value }))}
                    disabled={loadingQr}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="qr-selected-address" className="text-xs">
                      {t("settingsQrAddress")}
                    </Label>
                    <SearchableSelect
                      value={qr.selectedAddressId ?? "none"}
                      onValueChange={(value) =>
                        setQr((current) => ({ ...current, selectedAddressId: value === "none" ? null : value }))
                      }
                      items={[
                        { value: "none", label: t("settingsQrAddressNone") },
                        ...addressOptions.map((address) => ({
                          value: address.id,
                          label: address.label,
                          description: address.fullAddress,
                        })),
                      ]}
                      placeholder={t("settingsQrAddressPlaceholder")}
                      searchPlaceholder={t("locationsSearch")}
                      emptyLabel={t("locationsNoMatches")}
                      disabled={loadingQr}
                      className="h-9"
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="qr-logo-url" className="text-xs">
                      {t("settingsQrLogo")}
                    </Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        id="qr-logo-url"
                        value={qr.logoUrl}
                        onChange={(event) => setQr((current) => ({ ...current, logoUrl: event.target.value }))}
                        placeholder={t("settingsQrLogoPlaceholder")}
                        className="h-9"
                        disabled={loadingQr || uploadingQrLogo}
                      />
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        disabled={loadingQr || uploadingQrLogo}
                        onChange={(event) => {
                          const selected = event.target.files?.[0] ?? null
                          void uploadQrLogo(selected)
                          event.currentTarget.value = ""
                        }}
                        className="h-9 sm:max-w-[260px]"
                      />
                    </div>
                    {qr.logoUrl ? (
                      <div className="mt-1 rounded-md border bg-muted/20 p-2">
                        <img src={qr.logoUrl} alt="QR public logo preview" className="h-14 w-auto object-contain" />
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="qr-owner-label" className="text-xs">
                      {t("settingsQrOwnerLabel")}
                    </Label>
                    <Input
                      id="qr-owner-label"
                      value={qr.ownerLabel}
                      onChange={(event) => setQr((current) => ({ ...current, ownerLabel: event.target.value }))}
                      placeholder={t("settingsQrOwnerPlaceholder")}
                      className="h-9"
                      disabled={loadingQr}
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="qr-public-message" className="text-xs">
                      {t("settingsQrPublicMessage")}
                    </Label>
                    <Textarea
                      id="qr-public-message"
                      value={qr.publicMessage}
                      onChange={(event) => setQr((current) => ({ ...current, publicMessage: event.target.value }))}
                      placeholder={t("settingsQrPublicMessagePlaceholder")}
                      className="min-h-24"
                      disabled={loadingQr}
                    />
                    <p className="text-[11px] text-muted-foreground">{t("settingsQrPublicMessageHint")}</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="qr-contact-phone" className="text-xs">
                      {t("settingsQrContactPhone")}
                    </Label>
                    <Input
                      id="qr-contact-phone"
                      value={qr.contactPhone}
                      onChange={(event) => setQr((current) => ({ ...current, contactPhone: event.target.value }))}
                      placeholder={t("settingsQrContactPhonePlaceholder")}
                      className="h-9"
                      disabled={loadingQr}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="qr-contact-email" className="text-xs">
                      {t("settingsQrContactEmail")}
                    </Label>
                    <Input
                      id="qr-contact-email"
                      value={qr.contactEmail}
                      onChange={(event) => setQr((current) => ({ ...current, contactEmail: event.target.value }))}
                      placeholder={t("settingsQrContactEmailPlaceholder")}
                      className="h-9"
                      disabled={loadingQr}
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="qr-website-url" className="text-xs">
                      {t("settingsQrWebsite")}
                    </Label>
                    <Input
                      id="qr-website-url"
                      value={qr.websiteUrl}
                      onChange={(event) => setQr((current) => ({ ...current, websiteUrl: event.target.value }))}
                      placeholder={t("settingsQrWebsitePlaceholder")}
                      className="h-9"
                      disabled={loadingQr}
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="qr-extra-links" className="text-xs">
                      {t("settingsQrExtraLinks")}
                    </Label>
                    <Textarea
                      id="qr-extra-links"
                      value={qrLinksDraft}
                      onChange={(event) => setQrLinksDraft(event.target.value)}
                      placeholder={t("settingsQrExtraLinksPlaceholder")}
                      className="min-h-20"
                      disabled={loadingQr}
                    />
                    <p className="text-[11px] text-muted-foreground">{t("settingsQrExtraLinksHint")}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{t("settingsQrShowLoginButton")}</span>
                    <span className="text-xs text-muted-foreground">{t("settingsQrShowLoginButtonHint")}</span>
                  </div>
                  <Switch
                    checked={qr.showLoginButton}
                    onCheckedChange={(value) => setQr((current) => ({ ...current, showLoginButton: value }))}
                    disabled={loadingQr}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="qr-login-label" className="text-xs">
                    {t("settingsQrLoginButtonText")}
                  </Label>
                  <Input
                    id="qr-login-label"
                    value={qr.loginButtonText}
                    onChange={(event) => setQr((current) => ({ ...current, loginButtonText: event.target.value }))}
                    placeholder={t("settingsQrLoginButtonPlaceholder")}
                    className="h-9"
                    disabled={loadingQr}
                  />
                </div>

                {qrError && <p className="text-xs text-destructive">{qrError}</p>}
                {qrMessage && <p className="text-xs text-muted-foreground">{qrMessage}</p>}

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={saveQrSettings}
                    disabled={loadingQr || savingQr || (qr.showLoginButton && qr.loginButtonText.trim().length < 2)}
                  >
                    {savingQr ? t("settingsSaving") : t("settingsSaveChanges")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="flex flex-col gap-6">
            <Card className="app-surface">
              <CardHeader>
                <CardTitle className="text-base">{t("settingsNotificationsTitle")}</CardTitle>
                <CardDescription>{t("settingsNotificationsDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {[
                  {
                    title: t("settingsNotifCheckoutTitle"),
                    description: t("settingsNotifCheckoutDescription"),
                    checked: notifications.checkoutAlerts,
                    onChange: (value: boolean) =>
                      setNotifications((current) => ({ ...current, checkoutAlerts: value })),
                  },
                  {
                    title: t("settingsNotifMaintenanceTitle"),
                    description: t("settingsNotifMaintenanceDescription"),
                    checked: notifications.maintenanceAlerts,
                    onChange: (value: boolean) =>
                      setNotifications((current) => ({ ...current, maintenanceAlerts: value })),
                  },
                  {
                    title: t("settingsNotifBookingsTitle"),
                    description: t("settingsNotifBookingsDescription"),
                    checked: notifications.bookingAlerts,
                    onChange: (value: boolean) => setNotifications((current) => ({ ...current, bookingAlerts: value })),
                  },
                  {
                    title: t("settingsNotifDigestTitle"),
                    description: t("settingsNotifDigestDescription"),
                    checked: notifications.digestEnabled,
                    onChange: (value: boolean) => setNotifications((current) => ({ ...current, digestEnabled: value })),
                  },
                  {
                    title: t("settingsNotifLowInventoryTitle"),
                    description: t("settingsNotifLowInventoryDescription"),
                    checked: notifications.lowInventoryAlerts,
                    onChange: (value: boolean) =>
                      setNotifications((current) => ({ ...current, lowInventoryAlerts: value })),
                  },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{item.title}</span>
                        <span className="text-xs text-muted-foreground">{item.description}</span>
                      </div>
                      <Switch
                        checked={item.checked}
                        onCheckedChange={item.onChange}
                        disabled={loadingNotifications || savingNotifications}
                      />
                    </div>
                    {i < 4 && <Separator />}
                  </div>
                ))}

                {notificationsError ? <p className="pt-2 text-xs text-destructive">{notificationsError}</p> : null}
                {notificationsMessage ? (
                  <p className="pt-2 text-xs text-muted-foreground">{notificationsMessage}</p>
                ) : null}

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={saveNotificationSettings}
                    disabled={loadingNotifications || savingNotifications}
                  >
                    {savingNotifications ? t("settingsSaving") : t("settingsSaveChanges")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="flex flex-col gap-6">
            <Card className="app-surface">
              <CardHeader>
                <CardTitle className="text-base">{t("settingsLdapTitle")}</CardTitle>
                <CardDescription>{t("settingsLdapDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="flex items-center justify-between rounded-md border px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{t("settingsLdapEnable")}</span>
                    <span className="text-xs text-muted-foreground">{t("settingsLdapEnableHint")}</span>
                  </div>
                  <Switch
                    checked={ldap.enabled}
                    onCheckedChange={(value) => setLdap((current) => ({ ...current, enabled: value }))}
                    disabled={loadingLdap}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="ldap-url" className="text-xs">
                      {t("settingsLdapUrl")}
                    </Label>
                    <Input
                      id="ldap-url"
                      value={ldap.url}
                      onChange={(event) => setLdap((current) => ({ ...current, url: event.target.value }))}
                      placeholder={t("settingsLdapUrlPlaceholder")}
                      className="h-9"
                      disabled={loadingLdap}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ldap-bind-dn" className="text-xs">
                      {t("settingsLdapBindDn")}
                    </Label>
                    <Input
                      id="ldap-bind-dn"
                      value={ldap.bindDn}
                      onChange={(event) => setLdap((current) => ({ ...current, bindDn: event.target.value }))}
                      placeholder={t("settingsLdapBindDnPlaceholder")}
                      className="h-9"
                      disabled={loadingLdap}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ldap-bind-password" className="text-xs">
                      {t("settingsLdapBindPassword")}
                    </Label>
                    <Input
                      id="ldap-bind-password"
                      type="password"
                      value={ldap.bindPassword}
                      onChange={(event) => setLdap((current) => ({ ...current, bindPassword: event.target.value }))}
                      placeholder={
                        ldap.hasBindPassword ? t("settingsLdapPasswordSaved") : t("settingsLdapPasswordEnter")
                      }
                      className="h-9"
                      disabled={loadingLdap}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ldap-base-dn" className="text-xs">
                      {t("settingsLdapBaseDn")}
                    </Label>
                    <Input
                      id="ldap-base-dn"
                      value={ldap.baseDn}
                      onChange={(event) => setLdap((current) => ({ ...current, baseDn: event.target.value }))}
                      placeholder={t("settingsLdapBaseDnPlaceholder")}
                      className="h-9"
                      disabled={loadingLdap}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ldap-filter" className="text-xs">
                      {t("settingsLdapUserFilter")}
                    </Label>
                    <Input
                      id="ldap-filter"
                      value={ldap.userFilter}
                      onChange={(event) => setLdap((current) => ({ ...current, userFilter: event.target.value }))}
                      className="h-9"
                      disabled={loadingLdap}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ldap-username-attr" className="text-xs">
                      {t("settingsLdapUsernameAttr")}
                    </Label>
                    <Input
                      id="ldap-username-attr"
                      value={ldap.usernameAttribute}
                      onChange={(event) =>
                        setLdap((current) => ({ ...current, usernameAttribute: event.target.value }))
                      }
                      className="h-9"
                      disabled={loadingLdap}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ldap-email-attr" className="text-xs">
                      {t("settingsLdapEmailAttr")}
                    </Label>
                    <Input
                      id="ldap-email-attr"
                      value={ldap.emailAttribute}
                      onChange={(event) => setLdap((current) => ({ ...current, emailAttribute: event.target.value }))}
                      className="h-9"
                      disabled={loadingLdap}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ldap-name-attr" className="text-xs">
                      {t("settingsLdapNameAttr")}
                    </Label>
                    <Input
                      id="ldap-name-attr"
                      value={ldap.nameAttribute}
                      onChange={(event) => setLdap((current) => ({ ...current, nameAttribute: event.target.value }))}
                      className="h-9"
                      disabled={loadingLdap}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ldap-default-role" className="text-xs">
                      {t("settingsLdapDefaultRole")}
                    </Label>
                    <Input
                      id="ldap-default-role"
                      value={ldap.defaultRole}
                      onChange={(event) => setLdap((current) => ({ ...current, defaultRole: event.target.value }))}
                      placeholder={t("settingsLdapDefaultRolePlaceholder")}
                      className="h-9"
                      disabled={loadingLdap}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ldap-sync-issuer" className="text-xs">
                      {t("settingsLdapIssuer")}
                    </Label>
                    <Input
                      id="ldap-sync-issuer"
                      value={ldap.syncIssuer}
                      onChange={(event) => setLdap((current) => ({ ...current, syncIssuer: event.target.value }))}
                      placeholder={t("settingsLdapIssuerPlaceholder")}
                      className="h-9"
                      disabled={loadingLdap}
                    />
                  </div>
                </div>

                {ldapError && <p className="text-xs text-destructive">{ldapError}</p>}
                {ldapMessage && <p className="text-xs text-muted-foreground">{ldapMessage}</p>}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={syncLdapUsers}
                    disabled={loadingLdap || syncingLdap || savingLdap}
                  >
                    {syncingLdap ? t("settingsLdapSyncing") : t("settingsLdapSync")}
                  </Button>
                  <Button size="sm" onClick={saveLdapSettings} disabled={loadingLdap || savingLdap || syncingLdap}>
                    {savingLdap ? t("settingsSaving") : t("settingsLdapSave")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="management" className="flex flex-col gap-6">
            <Tabs defaultValue="security" className="gap-4">
              <TabsList className="rounded-xl border border-border/70 bg-card/80">
                <TabsTrigger value="security">{t("settingsManagementSecurityTab")}</TabsTrigger>
                <TabsTrigger value="health">{t("settingsManagementHealthTab")}</TabsTrigger>
              </TabsList>

              <TabsContent value="security" className="flex flex-col gap-6">
                <Card className="app-surface">
                  <CardHeader>
                    <CardTitle className="text-base">{t("settingsTrustedNetworkTitle")}</CardTitle>
                    <CardDescription>{t("settingsTrustedNetworkDescription")}</CardDescription>
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

                    <p className="text-[11px] text-muted-foreground">{t("settingsTrustedNetworkHint")}</p>

                    {securityError ? <p className="text-xs text-destructive">{securityError}</p> : null}
                    {securityMessage ? <p className="text-xs text-muted-foreground">{securityMessage}</p> : null}

                    <div className="flex justify-end">
                      <Button size="sm" onClick={saveSecuritySettings} disabled={loadingSecurity || savingSecurity}>
                        {savingSecurity ? t("settingsSaving") : t("settingsSaveChanges")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="health" className="flex flex-col gap-6">
                <Card className="app-surface">
                  <CardHeader>
                    <CardTitle className="text-base">{t("settingsHealthCheckTitle")}</CardTitle>
                    <CardDescription>{t("settingsHealthCheckDescription")}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">{t("settingsHealthOverall")}</p>
                        <p className="mt-1">
                          <Badge
                            variant="outline"
                            className={
                              managementHealth?.overallOk
                                ? "bg-success/10 text-success border-success/20"
                                : "bg-destructive/10 text-destructive border-destructive/20"
                            }
                          >
                            {managementHealth?.overallOk ? t("settingsHealthOk") : t("settingsHealthFail")}
                          </Badge>
                        </p>
                      </div>
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">{t("settingsHealthProxy")}</p>
                        <p className="mt-1">
                          <Badge
                            variant="outline"
                            className={
                              managementHealth?.checks.proxy
                                ? "bg-success/10 text-success border-success/20"
                                : "bg-destructive/10 text-destructive border-destructive/20"
                            }
                          >
                            {managementHealth?.checks.proxy ? t("settingsHealthOk") : t("settingsHealthFail")}
                          </Badge>
                        </p>
                      </div>
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">{t("settingsHealthTls")}</p>
                        <p className="mt-1">
                          <Badge
                            variant="outline"
                            className={
                              managementHealth?.checks.tls
                                ? "bg-success/10 text-success border-success/20"
                                : "bg-destructive/10 text-destructive border-destructive/20"
                            }
                          >
                            {managementHealth?.checks.tls ? t("settingsHealthOk") : t("settingsHealthFail")}
                          </Badge>
                        </p>
                      </div>
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">{t("settingsHealthDatabase")}</p>
                        <p className="mt-1">
                          <Badge
                            variant="outline"
                            className={
                              managementHealth?.checks.database
                                ? "bg-success/10 text-success border-success/20"
                                : "bg-destructive/10 text-destructive border-destructive/20"
                            }
                          >
                            {managementHealth?.checks.database ? t("settingsHealthOk") : t("settingsHealthFail")}
                          </Badge>
                        </p>
                      </div>
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">{t("settingsHealthMemory")}</p>
                        <p className="mt-1">
                          <Badge
                            variant="outline"
                            className={
                              managementHealth?.checks.memory
                                ? "bg-success/10 text-success border-success/20"
                                : "bg-destructive/10 text-destructive border-destructive/20"
                            }
                          >
                            {managementHealth?.checks.memory ? t("settingsHealthOk") : t("settingsHealthFail")}
                          </Badge>
                        </p>
                      </div>
                    </div>

                    <div className="rounded-md border px-3 py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] text-muted-foreground">{t("settingsHealthMemory")}</p>
                        <p className="text-xs font-medium">{managementHealth?.server.memory.usagePercent ?? 0}%</p>
                      </div>
                      <Progress value={managementHealth?.server.memory.usagePercent ?? 0} />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">{t("statTotalAssets")}</p>
                        <p className="text-lg font-semibold">{managementHealth?.stats.totalAssets ?? "—"}</p>
                      </div>
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">{t("statActiveUsers")}</p>
                        <p className="text-lg font-semibold">{managementHealth?.stats.activeUsers ?? "—"}</p>
                      </div>
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">{t("statLocations")}</p>
                        <p className="text-lg font-semibold">{managementHealth?.stats.locations ?? "—"}</p>
                      </div>
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">{t("statMaintenance")}</p>
                        <p className="text-lg font-semibold">{managementHealth?.stats.maintenance ?? "—"}</p>
                      </div>
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">{t("statInventoryValue")}</p>
                        <p className="text-sm font-semibold">{managementHealth?.stats.inventoryValue ?? "—"}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">{t("settingsHealthServer")}</p>
                        <p className="text-xs">
                          {managementHealth
                            ? `${managementHealth.server.platform}/${managementHealth.server.arch}`
                            : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {managementHealth
                            ? `${managementHealth.server.nodeVersion} • ${managementHealth.server.cpuCount} CPU`
                            : ""}
                        </p>
                      </div>
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">{t("settingsHealthTls")}</p>
                        <p className="text-xs">{managementHealth?.tls.protocol ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{managementHealth?.tls.forwardedProto ?? "—"}</p>
                      </div>
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">{t("settingsHealthForwarded")}</p>
                        <p className="text-xs line-clamp-1">{managementHealth?.proxy.forwardedFor || "—"}</p>
                        <p className="text-xs text-muted-foreground">{managementHealth?.proxy.host || "—"}</p>
                      </div>
                    </div>

                    {managementHealthError ? <p className="text-xs text-destructive">{managementHealthError}</p> : null}

                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshManagementHealth}
                        disabled={loadingManagementHealth}
                      >
                        {loadingManagementHealth ? t("settingsLoadingHealth") : t("settingsRunHealthCheck")}
                      </Button>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      {managementHealth?.checkedAt
                        ? `${t("settingsHealthLastChecked")}: ${new Date(managementHealth.checkedAt).toLocaleString()}`
                        : ""}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
