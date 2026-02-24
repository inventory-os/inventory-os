import type { NotificationPreferences, QrPublicSettings, SecuritySettings } from "@/lib/types"
import { eq } from "drizzle-orm"
import { ensureCoreSchema } from "@/lib/repository/domains/setup.repository"
import { getDomainRuntime } from "@/lib/repository/domain-runtime"
import { normalizeTrustEntries, parseTrustEnvValue } from "@/lib/utils/security-utils"

type SaveQrPublicSettingsInput = {
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

type SaveNotificationPreferencesInput = {
  checkoutAlerts: boolean
  maintenanceAlerts: boolean
  bookingAlerts: boolean
  digestEnabled: boolean
  lowInventoryAlerts: boolean
}

type SaveSecuritySettingsInput = {
  trustedProxies: string[]
  trustedDomains: string[]
}

type QrPublicSettingsRow = {
  enabled: number
  ownerLabel: string
  publicMessage: string
  showLoginButton: number
  loginButtonText: string
  selectedAddressId: string | null
  logoUrl: string
  contactPhone: string
  contactEmail: string
  websiteUrl: string
  extraLinksJson: string
  updatedAt: string
}

type NotificationPreferencesRow = {
  checkoutAlerts: number
  maintenanceAlerts: number
  bookingAlerts: number
  digestEnabled: number
  lowInventoryAlerts: number
  updatedAt: string
}

type SecuritySettingsRow = {
  trustedProxiesJson: string
  trustedDomainsJson: string
  updatedAt: string
}

function toQrPublicSettings(row: QrPublicSettingsRow | null): QrPublicSettings {
  if (!row) {
    return {
      enabled: true,
      ownerLabel: "",
      publicMessage: "",
      showLoginButton: true,
      loginButtonText: "Login for more details",
      selectedAddressId: null,
      logoUrl: "",
      contactPhone: "",
      contactEmail: "",
      websiteUrl: "",
      extraLinks: [],
      updatedAt: null,
    }
  }

  let extraLinks: Array<{ label: string; url: string }> = []
  try {
    const parsed = JSON.parse(row.extraLinksJson)
    if (Array.isArray(parsed)) {
      extraLinks = parsed
        .filter(
          (entry): entry is { label: string; url: string } =>
            Boolean(entry) && typeof entry.label === "string" && typeof entry.url === "string",
        )
        .map((entry) => ({ label: entry.label.trim(), url: entry.url.trim() }))
        .filter((entry) => entry.label.length > 0 && entry.url.length > 0)
    }
  } catch {}

  return {
    enabled: Number(row.enabled) === 1,
    ownerLabel: row.ownerLabel,
    publicMessage: row.publicMessage,
    showLoginButton: Number(row.showLoginButton) === 1,
    loginButtonText: row.loginButtonText,
    selectedAddressId: row.selectedAddressId,
    logoUrl: row.logoUrl,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    websiteUrl: row.websiteUrl,
    extraLinks,
    updatedAt: row.updatedAt,
  }
}

function toNotificationPreferences(row: NotificationPreferencesRow | null): NotificationPreferences {
  if (!row) {
    return {
      checkoutAlerts: true,
      maintenanceAlerts: true,
      bookingAlerts: true,
      digestEnabled: false,
      lowInventoryAlerts: false,
      updatedAt: null,
    }
  }

  return {
    checkoutAlerts: Number(row.checkoutAlerts) === 1,
    maintenanceAlerts: Number(row.maintenanceAlerts) === 1,
    bookingAlerts: Number(row.bookingAlerts) === 1,
    digestEnabled: Number(row.digestEnabled) === 1,
    lowInventoryAlerts: Number(row.lowInventoryAlerts) === 1,
    updatedAt: row.updatedAt,
  }
}

function toSecuritySettings(row: SecuritySettingsRow | null): SecuritySettings {
  if (!row) {
    return {
      trustedProxies: [],
      trustedDomains: [],
      updatedAt: null,
    }
  }

  let trustedProxies: string[] = []
  let trustedDomains: string[] = []

  try {
    const parsed = JSON.parse(row.trustedProxiesJson)
    if (Array.isArray(parsed)) {
      trustedProxies = normalizeTrustEntries(parsed.filter((entry): entry is string => typeof entry === "string"))
    }
  } catch {}

  try {
    const parsed = JSON.parse(row.trustedDomainsJson)
    if (Array.isArray(parsed)) {
      trustedDomains = normalizeTrustEntries(parsed.filter((entry): entry is string => typeof entry === "string"))
    }
  } catch {}

  return {
    trustedProxies,
    trustedDomains,
    updatedAt: row.updatedAt,
  }
}

export async function getQrPublicSettings(): Promise<QrPublicSettings> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const rows = await orm
    .select({
      enabled: tables.qrPublicSettingsTable.enabled,
      ownerLabel: tables.qrPublicSettingsTable.ownerLabel,
      publicMessage: tables.qrPublicSettingsTable.publicMessage,
      showLoginButton: tables.qrPublicSettingsTable.showLoginButton,
      loginButtonText: tables.qrPublicSettingsTable.loginButtonText,
      selectedAddressId: tables.qrPublicSettingsTable.selectedAddressId,
      logoUrl: tables.qrPublicSettingsTable.logoUrl,
      contactPhone: tables.qrPublicSettingsTable.contactPhone,
      contactEmail: tables.qrPublicSettingsTable.contactEmail,
      websiteUrl: tables.qrPublicSettingsTable.websiteUrl,
      extraLinksJson: tables.qrPublicSettingsTable.extraLinksJson,
      updatedAt: tables.qrPublicSettingsTable.updatedAt,
    })
    .from(tables.qrPublicSettingsTable)
    .where(eq(tables.qrPublicSettingsTable.id, 1))
    .limit(1)

  return toQrPublicSettings((rows[0] as QrPublicSettingsRow | undefined) ?? null)
}

export async function saveQrPublicSettings(input: SaveQrPublicSettingsInput): Promise<QrPublicSettings> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const normalizedLinks = input.extraLinks
    .map((entry) => ({ label: entry.label.trim(), url: entry.url.trim() }))
    .filter((entry) => entry.label.length > 0 && entry.url.length > 0)

  await orm
    .update(tables.qrPublicSettingsTable)
    .set({
      enabled: input.enabled ? 1 : 0,
      ownerLabel: input.ownerLabel.trim(),
      publicMessage: input.publicMessage.trim(),
      showLoginButton: input.showLoginButton ? 1 : 0,
      loginButtonText: input.loginButtonText.trim(),
      selectedAddressId: input.selectedAddressId,
      logoUrl: input.logoUrl.trim(),
      contactPhone: input.contactPhone.trim(),
      contactEmail: input.contactEmail.trim(),
      websiteUrl: input.websiteUrl.trim(),
      extraLinksJson: JSON.stringify(normalizedLinks),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tables.qrPublicSettingsTable.id, 1))

  return getQrPublicSettings()
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const rows = await orm
    .select({
      checkoutAlerts: tables.notificationPreferencesTable.checkoutAlerts,
      maintenanceAlerts: tables.notificationPreferencesTable.maintenanceAlerts,
      bookingAlerts: tables.notificationPreferencesTable.bookingAlerts,
      digestEnabled: tables.notificationPreferencesTable.digestEnabled,
      lowInventoryAlerts: tables.notificationPreferencesTable.lowInventoryAlerts,
      updatedAt: tables.notificationPreferencesTable.updatedAt,
    })
    .from(tables.notificationPreferencesTable)
    .where(eq(tables.notificationPreferencesTable.id, 1))
    .limit(1)

  return toNotificationPreferences((rows[0] as NotificationPreferencesRow | undefined) ?? null)
}

export async function saveNotificationPreferences(
  input: SaveNotificationPreferencesInput,
): Promise<NotificationPreferences> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  await orm
    .update(tables.notificationPreferencesTable)
    .set({
      checkoutAlerts: input.checkoutAlerts ? 1 : 0,
      maintenanceAlerts: input.maintenanceAlerts ? 1 : 0,
      bookingAlerts: input.bookingAlerts ? 1 : 0,
      digestEnabled: input.digestEnabled ? 1 : 0,
      lowInventoryAlerts: input.lowInventoryAlerts ? 1 : 0,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tables.notificationPreferencesTable.id, 1))

  return getNotificationPreferences()
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const rows = await orm
    .select({
      trustedProxiesJson: tables.securitySettingsTable.trustedProxiesJson,
      trustedDomainsJson: tables.securitySettingsTable.trustedDomainsJson,
      updatedAt: tables.securitySettingsTable.updatedAt,
    })
    .from(tables.securitySettingsTable)
    .where(eq(tables.securitySettingsTable.id, 1))
    .limit(1)

  return toSecuritySettings((rows[0] as SecuritySettingsRow | undefined) ?? null)
}

export async function saveSecuritySettings(input: SaveSecuritySettingsInput): Promise<SecuritySettings> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const trustedProxies = normalizeTrustEntries(input.trustedProxies)
  const trustedDomains = normalizeTrustEntries(input.trustedDomains)

  await orm
    .update(tables.securitySettingsTable)
    .set({
      trustedProxiesJson: JSON.stringify(trustedProxies),
      trustedDomainsJson: JSON.stringify(trustedDomains),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tables.securitySettingsTable.id, 1))

  return getSecuritySettings()
}

export async function getEffectiveSecuritySettings(): Promise<{
  trustedProxies: string[]
  trustedDomains: string[]
  trustedProxiesSource: "env" | "db"
  trustedDomainsSource: "env" | "db"
  db: SecuritySettings
}> {
  const dbSettings = await getSecuritySettings()

  const envTrustedProxies = parseTrustEnvValue(process.env.TRUSTED_PROXIES ?? process.env.INVENTORY_OS_TRUSTED_PROXIES)
  const envTrustedDomains = parseTrustEnvValue(process.env.TRUSTED_DOMAINS ?? process.env.INVENTORY_OS_TRUSTED_DOMAINS)

  const trustedProxiesSource: "env" | "db" = envTrustedProxies.length > 0 ? "env" : "db"
  const trustedDomainsSource: "env" | "db" = envTrustedDomains.length > 0 ? "env" : "db"

  return {
    trustedProxies: trustedProxiesSource === "env" ? envTrustedProxies : dbSettings.trustedProxies,
    trustedDomains: trustedDomainsSource === "env" ? envTrustedDomains : dbSettings.trustedDomains,
    trustedProxiesSource,
    trustedDomainsSource,
    db: dbSettings,
  }
}
