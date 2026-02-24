import { randomUUID } from "node:crypto"
import { hash } from "bcryptjs"
import { queryFirst, queryRows, runQuery, sql } from "@/lib/db"
import {
  ASSET_CATEGORIES,
  CATEGORY_COLORS,
  type Asset,
  type AssetCategory,
  type AssetCategorySummary,
  type AssetFile,
  type AssetFileKind,
  type AuthUser,
  type AssetStatus,
  type ActivityRecord,
  type AddressRecord,
  type EuropeanLocale,
  type IncidentRecord,
  type IncidentFile,
  type IncidentFileKind,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentType,
  type LdapIntegrationSettings,
  type LoanRecord,
  type LocationData,
  type LocationKind,
  type ManagedCategory,
  type NotificationDelivery,
  type NotificationLevel,
  type NotificationPreferences,
  type NotificationRecord,
  type Producer,
  type QrPublicSettings,
  type SecuritySettings,
  type SetupStatus,
  type TeamMember,
  type TeamRole,
} from "@/lib/data"
import { buildAssetQrPayload } from "@/lib/qr-payload"
import { normalizeTrustEntries, parseTrustEnvValue } from "@/lib/security-utils"

type DbAsset = {
  id: string
  name: string
  parent_asset_id: string | null
  parent_asset_name: string | null
  category: AssetCategory
  status: AssetStatus
  location_id: string | null
  producer_id: string | null
  producer_name: string | null
  model: string | null
  serial_number: string | null
  sku: string | null
  supplier: string | null
  warranty_until: string | null
  asset_condition: "new" | "good" | "fair" | "damaged"
  quantity: number | string
  minimum_quantity: number | string
  notes: string | null
  location_name: string | null
  assigned_member_name: string | null
  qr_code: string
  value: number | string
  purchase_date: string
  last_scanned: string
  tags: string
  thumbnail_file_id: string | null
}

type DbAssetFileRow = {
  id: string
  asset_id: string
  kind: AssetFileKind
  original_name: string
  mime_type: string
  size_bytes: number | string
  created_at: string
}

type CountRow = { count: number | string }

type DbLocationRow = {
  id: string
  name: string
  address: string
  address_id: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  floor_number: string | null
  room_number: string | null
  kind: LocationKind | null
  parent_id: string | null
  direct_asset_count: number | string
}

type DbProducerRow = {
  id: string
  name: string
  website_url: string
  domain: string
  description: string | null
  logo_url: string | null
  source_url: string
  created_at: string
}

type DbCategoryRow = {
  id: string
  name: string
  asset_count: number | string
}

type DbAddressRow = {
  id: string
  label: string
  address_line1: string
  address_line2: string | null
  postal_code: string
  city: string
  country: string
  location_count: number | string
}

type DbAuthUserRow = {
  id: string
  oidc_issuer: string
  oidc_sub: string
  email: string
  display_name: string
  roles_json: string
  active: number | string
  source: "jit" | "ldap"
  created_at: string
  updated_at: string
}

type DbLdapSettingsRow = {
  enabled: number | string
  url: string
  bind_dn: string
  bind_password: string | null
  base_dn: string
  user_filter: string
  username_attribute: string
  email_attribute: string
  name_attribute: string
  default_role: string
  sync_issuer: string
  updated_at: string | null
}

type DbQrPublicSettingsRow = {
  enabled: number | string
  owner_label: string
  public_message: string
  show_login_button: number | string
  login_button_text: string
  selected_address_id: string | null
  logo_url: string
  contact_phone: string
  contact_email: string
  website_url: string
  extra_links_json: string
  updated_at: string | null
}

type DbNotificationRow = {
  id: string
  recipient_member_id: string
  type: string
  title: string
  message: string
  level: NotificationLevel
  delivery: NotificationDelivery
  link_url: string | null
  event_key: string | null
  read_at: string | null
  created_at: string
}

type DbNotificationPreferencesRow = {
  checkout_alerts: number | string
  maintenance_alerts: number | string
  booking_alerts: number | string
  digest_enabled: number | string
  low_inventory_alerts: number | string
  updated_at: string | null
}

type DbSecuritySettingsRow = {
  trusted_proxies_json: string
  trusted_domains_json: string
  updated_at: string | null
}

type DbActivityRow = {
  id: string
  type: string
  actor_member_id: string | null
  actor_name: string
  subject_type: "asset" | "location" | "booking" | "auth" | "settings" | "system" | "other"
  subject_id: string | null
  subject_name: string | null
  message: string
  created_at: string
}

type DbIncidentRow = {
  id: string
  asset_id: string
  asset_name: string
  incident_type: IncidentType
  title: string
  description: string
  severity: IncidentSeverity
  status: IncidentStatus
  reported_by: string
  occurred_at: string | null
  estimated_repair_cost: number | string | null
  reported_at: string
  resolved_at: string | null
  resolution_notes: string | null
  attachment_count: number | string
  updated_at: string
}

type DbIncidentFileRow = {
  id: string
  incident_id: string
  kind: IncidentFileKind
  original_name: string
  mime_type: string
  size_bytes: number | string
  created_at: string
}

let schemaReady: Promise<void> | null = null
let lastActivityPruneAt = 0

function toInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("")
}

function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []
  } catch {
    return []
  }
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const raw of tags) {
    const value = raw.trim().replace(/\s+/g, " ")
    if (!value) {
      continue
    }

    const key = value.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    normalized.push(value.slice(0, 40))

    if (normalized.length >= 20) {
      break
    }
  }

  return normalized
}

function startOfDayIso(value: Date): string {
  const copy = new Date(value)
  copy.setUTCHours(0, 0, 0, 0)
  return copy.toISOString()
}

function addDaysIso(value: Date, days: number): string {
  const copy = new Date(value)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy.toISOString()
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function toNotificationRecord(row: DbNotificationRow): NotificationRecord {
  return {
    id: row.id,
    recipientMemberId: row.recipient_member_id,
    type: row.type,
    title: row.title,
    message: row.message,
    level: row.level,
    delivery: row.delivery,
    linkUrl: row.link_url,
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

function toActivityRecord(row: DbActivityRow): ActivityRecord {
  return {
    id: row.id,
    type: row.type,
    actorMemberId: row.actor_member_id,
    actorName: row.actor_name,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    message: row.message,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

function toIncidentRecord(row: DbIncidentRow): IncidentRecord {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetName: row.asset_name,
    incidentType: row.incident_type,
    title: row.title,
    description: row.description,
    severity: row.severity,
    status: row.status,
    reportedBy: row.reported_by,
    occurredAt: row.occurred_at ? new Date(row.occurred_at).toISOString() : null,
    estimatedRepairCost: row.estimated_repair_cost === null ? null : Number(row.estimated_repair_cost),
    reportedAt: new Date(row.reported_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    resolutionNotes: row.resolution_notes,
    attachmentCount: Number(row.attachment_count ?? 0),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

function toIncidentFile(row: DbIncidentFileRow): IncidentFile {
  return {
    id: row.id,
    incidentId: row.incident_id,
    kind: row.kind,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: new Date(row.created_at).toISOString(),
  }
}

async function pruneOldActivitiesIfNeeded(force = false): Promise<void> {
  const now = Date.now()
  if (!force && now - lastActivityPruneAt < 10 * 60 * 1000) {
    return
  }

  lastActivityPruneAt = now
  const cutoff = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()
  await runQuery(sql`
    DELETE FROM activity_events
    WHERE created_at < ${cutoff}
  `)
}

function formatLocationAddress(input: {
  line1?: string | null
  line2?: string | null
  city?: string | null
  postalCode?: string | null
  country?: string | null
  fallback?: string | null
}): string {
  const parts: string[] = []
  const line1 = input.line1?.trim()
  const line2 = input.line2?.trim()
  const city = input.city?.trim()
  const postalCode = input.postalCode?.trim()
  const country = input.country?.trim()

  if (line1) {
    parts.push(line1)
  }
  if (line2) {
    parts.push(line2)
  }

  const postalCity = [postalCode, city].filter(Boolean).join(" ")
  if (postalCity) {
    parts.push(postalCity)
  }

  if (country) {
    parts.push(country)
  }

  if (parts.length > 0) {
    return parts.join(", ")
  }

  return input.fallback?.trim() || ""
}

function buildLocationCode(floorNumber?: string | null, roomNumber?: string | null): string | null {
  const floor = floorNumber?.trim() || ""
  const room = roomNumber?.trim() || ""
  if (floor && room) {
    return `${floor}.${room}`
  }
  if (room) {
    return room
  }
  if (floor) {
    return floor
  }
  return null
}

function locationPathLabel(input: { name: string; floorNumber?: string | null; roomNumber?: string | null }): string {
  const code = buildLocationCode(input.floorNumber, input.roomNumber)
  return code ? `${code} ${input.name}` : input.name
}

export async function listAddresses(): Promise<AddressRecord[]> {
  await ensureCoreSchema()

  const rows = await queryRows<DbAddressRow>(sql`
    SELECT
      a.id,
      a.label,
      a.address_line1,
      a.address_line2,
      a.postal_code,
      a.city,
      a.country,
      CAST(COUNT(l.id) AS INTEGER) AS location_count
    FROM addresses a
    LEFT JOIN locations l ON l.address_id = a.id
    GROUP BY a.id, a.label, a.address_line1, a.address_line2, a.postal_code, a.city, a.country
    ORDER BY a.label ASC
  `)

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    postalCode: row.postal_code,
    city: row.city,
    country: row.country,
    fullAddress: formatLocationAddress({
      line1: row.address_line1,
      line2: row.address_line2,
      postalCode: row.postal_code,
      city: row.city,
      country: row.country,
    }),
    locationCount: Number(row.location_count ?? 0),
  }))
}

export async function createAddress(input: {
  label: string
  addressLine1: string
  addressLine2?: string | null
  postalCode: string
  city: string
  country: string
}): Promise<AddressRecord> {
  await ensureCoreSchema()

  const id = makeId("ADR")
  await runQuery(sql`
    INSERT INTO addresses (id, label, address_line1, address_line2, postal_code, city, country)
    VALUES (
      ${id},
      ${input.label.trim()},
      ${input.addressLine1.trim()},
      ${input.addressLine2?.trim() || null},
      ${input.postalCode.trim()},
      ${input.city.trim()},
      ${input.country.trim()}
    )
  `)

  const created = (await listAddresses()).find((entry) => entry.id === id)
  if (!created) {
    throw new Error("Failed to create address")
  }
  return created
}

export async function updateAddress(
  id: string,
  input: {
    label: string
    addressLine1: string
    addressLine2?: string | null
    postalCode: string
    city: string
    country: string
  },
): Promise<AddressRecord | null> {
  await ensureCoreSchema()

  const exists = await queryFirst<{ id: string }>(sql`SELECT id FROM addresses WHERE id = ${id} LIMIT 1`)
  if (!exists) {
    return null
  }

  await runQuery(sql`
    UPDATE addresses
    SET
      label = ${input.label.trim()},
      address_line1 = ${input.addressLine1.trim()},
      address_line2 = ${input.addressLine2?.trim() || null},
      postal_code = ${input.postalCode.trim()},
      city = ${input.city.trim()},
      country = ${input.country.trim()}
    WHERE id = ${id}
  `)

  await runQuery(sql`
    UPDATE locations
    SET
      address = ${formatLocationAddress({
        line1: input.addressLine1,
        line2: input.addressLine2,
        postalCode: input.postalCode,
        city: input.city,
        country: input.country,
      })},
      address_line1 = ${input.addressLine1.trim()},
      address_line2 = ${input.addressLine2?.trim() || null},
      postal_code = ${input.postalCode.trim()},
      city = ${input.city.trim()},
      country = ${input.country.trim()}
    WHERE address_id = ${id}
  `)

  return (await listAddresses()).find((entry) => entry.id === id) ?? null
}

export async function deleteAddress(id: string): Promise<boolean> {
  await ensureCoreSchema()

  const inUse = await queryFirst<{ count: number | string }>(sql`
    SELECT CAST(COUNT(*) AS INTEGER) AS count
    FROM locations
    WHERE address_id = ${id}
  `)

  if (Number(inUse?.count ?? 0) > 0) {
    throw new Error("Address is linked to one or more locations")
  }

  const exists = await queryFirst<{ id: string }>(sql`SELECT id FROM addresses WHERE id = ${id} LIMIT 1`)
  if (!exists) {
    return false
  }

  await runQuery(sql`DELETE FROM addresses WHERE id = ${id}`)
  return true
}

function toAsset(row: DbAsset): Asset {
  return {
    id: row.id,
    name: row.name,
    parentAssetId: row.parent_asset_id,
    parentAssetName: row.parent_asset_name,
    category: row.category,
    status: row.status,
    producerId: row.producer_id,
    producerName: row.producer_name,
    model: row.model,
    serialNumber: row.serial_number,
    sku: row.sku,
    supplier: row.supplier,
    warrantyUntil: row.warranty_until,
    condition: row.asset_condition,
    quantity: Number(row.quantity ?? 1),
    minimumQuantity: Number(row.minimum_quantity ?? 0),
    notes: row.notes,
    locationId: row.location_id,
    location: row.location_name ?? "Unassigned",
    assignedTo: row.assigned_member_name,
    qrCode: buildAssetQrPayload(row.id),
    value: Number(row.value),
    purchaseDate: row.purchase_date,
    lastScanned: row.last_scanned,
    tags: parseTags(row.tags),
    thumbnailFileId: row.thumbnail_file_id,
  }
}

async function getAssetParentAndLocation(id: string): Promise<{ id: string; parentAssetId: string | null; locationId: string | null } | null> {
  const row = await queryFirst<{ id: string; parent_asset_id: string | null; location_id: string | null }>(sql`
    SELECT id, parent_asset_id, location_id
    FROM assets
    WHERE id = ${id}
    LIMIT 1
  `)

  if (!row) {
    return null
  }

  return {
    id: row.id,
    parentAssetId: row.parent_asset_id,
    locationId: row.location_id,
  }
}

async function resolveRootAsset(inputAssetId: string): Promise<{ rootAssetId: string; rootLocationId: string | null }> {
  let cursorId = inputAssetId
  const visited = new Set<string>()

  while (true) {
    if (visited.has(cursorId)) {
      throw new Error("Invalid nested asset graph")
    }
    visited.add(cursorId)

    const node = await getAssetParentAndLocation(cursorId)
    if (!node) {
      throw new Error("Parent asset not found")
    }

    if (!node.parentAssetId) {
      return {
        rootAssetId: node.id,
        rootLocationId: node.locationId,
      }
    }

    cursorId = node.parentAssetId
  }
}

async function isDescendantOf(assetId: string, possibleAncestorId: string): Promise<boolean> {
  let cursorId: string | null = assetId
  const visited = new Set<string>()

  while (cursorId) {
    if (visited.has(cursorId)) {
      break
    }
    visited.add(cursorId)

    const node = await getAssetParentAndLocation(cursorId)
    if (!node?.parentAssetId) {
      return false
    }

    if (node.parentAssetId === possibleAncestorId) {
      return true
    }

    cursorId = node.parentAssetId
  }

  return false
}

async function cascadeDescendantLocation(rootAssetId: string, locationId: string | null): Promise<void> {
  const timestamp = todayIso()
  await runQuery(sql`
    WITH RECURSIVE descendants(id) AS (
      SELECT id FROM assets WHERE parent_asset_id = ${rootAssetId}
      UNION ALL
      SELECT a.id
      FROM assets a
      JOIN descendants d ON a.parent_asset_id = d.id
    )
    UPDATE assets
    SET location_id = ${locationId},
        last_scanned = ${timestamp}
    WHERE id IN (SELECT id FROM descendants)
  `)
}

function toAssetFile(row: DbAssetFileRow): AssetFile {
  return {
    id: row.id,
    assetId: row.asset_id,
    kind: row.kind,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at,
  }
}

function toProducer(row: DbProducerRow): Producer {
  return {
    id: row.id,
    name: row.name,
    websiteUrl: row.website_url,
    domain: row.domain,
    description: row.description,
    logoUrl: row.logo_url,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
  }
}

function toAuthUser(row: DbAuthUserRow): AuthUser {
  let roles: string[] = ["member"]
  try {
    const parsed = JSON.parse(row.roles_json)
    if (Array.isArray(parsed)) {
      roles = parsed.filter((value): value is string => typeof value === "string")
    }
  } catch {
  }

  return {
    id: row.id,
    oidcIssuer: row.oidc_issuer,
    oidcSub: row.oidc_sub,
    email: row.email,
    displayName: row.display_name,
    roles,
    active: Number(row.active) === 1,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toLdapSettings(row: DbLdapSettingsRow | null): LdapIntegrationSettings {
  if (!row) {
    return {
      enabled: false,
      url: "",
      bindDn: "",
      baseDn: "",
      userFilter: "(objectClass=person)",
      usernameAttribute: "uid",
      emailAttribute: "mail",
      nameAttribute: "cn",
      defaultRole: "member",
      syncIssuer: process.env.OIDC_ISSUER_URL ?? "",
      hasBindPassword: false,
      updatedAt: null,
    }
  }

  return {
    enabled: Number(row.enabled) === 1,
    url: row.url,
    bindDn: row.bind_dn,
    baseDn: row.base_dn,
    userFilter: row.user_filter,
    usernameAttribute: row.username_attribute,
    emailAttribute: row.email_attribute,
    nameAttribute: row.name_attribute,
    defaultRole: row.default_role,
    syncIssuer: row.sync_issuer,
    hasBindPassword: Boolean(row.bind_password),
    updatedAt: row.updated_at,
  }
}

function toQrPublicSettings(row: DbQrPublicSettingsRow | null): QrPublicSettings {
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
    const parsed = JSON.parse(row.extra_links_json)
    if (Array.isArray(parsed)) {
      extraLinks = parsed
        .filter((entry): entry is { label: string; url: string } => {
          return Boolean(entry) && typeof entry.label === "string" && typeof entry.url === "string"
        })
        .map((entry) => ({
          label: entry.label.trim(),
          url: entry.url.trim(),
        }))
        .filter((entry) => entry.label.length > 0 && entry.url.length > 0)
    }
  } catch {
  }

  return {
    enabled: Number(row.enabled) === 1,
    ownerLabel: row.owner_label,
    publicMessage: row.public_message,
    showLoginButton: Number(row.show_login_button) === 1,
    loginButtonText: row.login_button_text,
    selectedAddressId: row.selected_address_id,
    logoUrl: row.logo_url,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    websiteUrl: row.website_url,
    extraLinks,
    updatedAt: row.updated_at,
  }
}

function toNotificationPreferences(row: DbNotificationPreferencesRow | null): NotificationPreferences {
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
    checkoutAlerts: Number(row.checkout_alerts) === 1,
    maintenanceAlerts: Number(row.maintenance_alerts) === 1,
    bookingAlerts: Number(row.booking_alerts) === 1,
    digestEnabled: Number(row.digest_enabled) === 1,
    lowInventoryAlerts: Number(row.low_inventory_alerts) === 1,
    updatedAt: row.updated_at,
  }
}

function toSecuritySettings(row: DbSecuritySettingsRow | null): SecuritySettings {
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
    const parsed = JSON.parse(row.trusted_proxies_json)
    if (Array.isArray(parsed)) {
      trustedProxies = normalizeTrustEntries(parsed.filter((entry): entry is string => typeof entry === "string"))
    }
  } catch {
  }

  try {
    const parsed = JSON.parse(row.trusted_domains_json)
    if (Array.isArray(parsed)) {
      trustedDomains = normalizeTrustEntries(parsed.filter((entry): entry is string => typeof entry === "string"))
    }
  } catch {
  }

  return {
    trustedProxies,
    trustedDomains,
    updatedAt: row.updated_at,
  }
}

async function tableCount(tableName: "assets" | "members" | "locations"): Promise<number> {
  const result = await queryFirst<CountRow>(sql.raw(`SELECT CAST(COUNT(*) AS INTEGER) AS count FROM ${tableName}`))
  return Number(result?.count ?? 0)
}

async function ensureLocationHierarchyColumns() {
  try {
    await runQuery(sql`ALTER TABLE locations ADD COLUMN parent_id TEXT REFERENCES locations(id) ON DELETE SET NULL`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE locations ADD COLUMN kind TEXT NOT NULL DEFAULT 'building'`)
  } catch {
  }
}

async function ensureLocationAddressColumns() {
  try {
    await runQuery(sql`ALTER TABLE locations ADD COLUMN address_id TEXT REFERENCES addresses(id) ON DELETE SET NULL`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE locations ADD COLUMN address_line1 TEXT`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE locations ADD COLUMN address_line2 TEXT`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE locations ADD COLUMN city TEXT`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE locations ADD COLUMN postal_code TEXT`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE locations ADD COLUMN country TEXT`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE locations ADD COLUMN floor_number TEXT`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE locations ADD COLUMN room_number TEXT`)
  } catch {
  }

  try {
    await runQuery(sql`
      UPDATE locations
      SET address_line1 = COALESCE(address_line1, address)
      WHERE (address_line1 IS NULL OR TRIM(address_line1) = '')
        AND address IS NOT NULL
        AND TRIM(address) <> ''
    `)
  } catch {
  }
}

async function ensureAddressSchema() {
  await runQuery(sql`
    CREATE TABLE IF NOT EXISTS addresses (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT,
      postal_code TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

async function ensureAssetManagementColumns() {
  try {
    await runQuery(sql`ALTER TABLE assets ADD COLUMN producer_id TEXT REFERENCES producers(id) ON DELETE SET NULL`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE assets ADD COLUMN model TEXT`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE assets ADD COLUMN serial_number TEXT`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE assets ADD COLUMN sku TEXT`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE assets ADD COLUMN supplier TEXT`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE assets ADD COLUMN warranty_until TEXT`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE assets ADD COLUMN asset_condition TEXT NOT NULL DEFAULT 'good'`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE assets ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE assets ADD COLUMN minimum_quantity INTEGER NOT NULL DEFAULT 0`)
  } catch {
  }

  try {
    await runQuery(sql`ALTER TABLE assets ADD COLUMN notes TEXT`)
  } catch {
  }
}

async function ensureAssetHierarchyColumns() {
  try {
    await runQuery(sql`ALTER TABLE assets ADD COLUMN parent_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL`)
  } catch {
  }

  try {
    await runQuery(sql`CREATE INDEX IF NOT EXISTS idx_assets_parent_asset_id ON assets(parent_asset_id)`)
  } catch {
  }
}

async function ensureAppSetupColumns() {
  try {
    await runQuery(sql`ALTER TABLE app_setup ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR'`)
  } catch {
  }
}

async function ensureCategorySchema() {
  await runQuery(sql`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  for (const defaultCategory of ASSET_CATEGORIES) {
    await runQuery(sql`
      INSERT INTO categories (id, name)
      VALUES (${makeId("CAT")}, ${defaultCategory})
      ON CONFLICT(name) DO NOTHING
    `)
  }

  await runQuery(sql`
    INSERT INTO categories (id, name)
    VALUES (${makeId("CAT")}, ${"Uncategorized"})
    ON CONFLICT(name) DO NOTHING
  `)

  const existingAssetCategories = await queryRows<{ category: string }>(sql`
    SELECT DISTINCT category
    FROM assets
    WHERE category IS NOT NULL AND TRIM(category) <> ''
  `)

  for (const row of existingAssetCategories) {
    await runQuery(sql`
      INSERT INTO categories (id, name)
      VALUES (${makeId("CAT")}, ${row.category})
      ON CONFLICT(name) DO NOTHING
    `)
  }
}

export async function ensureCoreSchema(): Promise<void> {
  if (schemaReady) {
    return schemaReady
  }

  schemaReady = (async () => {
    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS addresses (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        address_line1 TEXT NOT NULL,
        address_line2 TEXT,
        postal_code TEXT NOT NULL,
        city TEXT NOT NULL,
        country TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await ensureAddressSchema()

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        address TEXT NOT NULL,
        address_id TEXT REFERENCES addresses(id) ON DELETE SET NULL,
        address_line1 TEXT,
        address_line2 TEXT,
        city TEXT,
        postal_code TEXT,
        country TEXT,
        floor_number TEXT,
        room_number TEXT,
        parent_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        kind TEXT NOT NULL DEFAULT 'building',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await ensureLocationHierarchyColumns()
    await ensureLocationAddressColumns()

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS producers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        website_url TEXT NOT NULL UNIQUE,
        domain TEXT NOT NULL,
        description TEXT,
        logo_url TEXT,
        source_url TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_asset_id TEXT,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        producer_id TEXT,
        model TEXT,
        serial_number TEXT,
        sku TEXT,
        supplier TEXT,
        warranty_until TEXT,
        asset_condition TEXT NOT NULL DEFAULT 'good',
        quantity INTEGER NOT NULL DEFAULT 1,
        minimum_quantity INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        location_id TEXT,
        assigned_member_id TEXT,
        qr_code TEXT NOT NULL UNIQUE,
        value REAL NOT NULL DEFAULT 0,
        purchase_date TEXT NOT NULL,
        last_scanned TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(producer_id) REFERENCES producers(id) ON DELETE SET NULL,
        FOREIGN KEY(location_id) REFERENCES locations(id) ON DELETE SET NULL,
        FOREIGN KEY(parent_asset_id) REFERENCES assets(id) ON DELETE SET NULL,
        FOREIGN KEY(assigned_member_id) REFERENCES members(id) ON DELETE SET NULL
      )
    `)

    await ensureAssetManagementColumns()
    await ensureAssetHierarchyColumns()

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS loans (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        borrowed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        due_at TEXT,
        returned_at TEXT,
        notes TEXT,
        FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE,
        FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
      )
    `)

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        incident_type TEXT NOT NULL DEFAULT 'other',
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        reported_by TEXT NOT NULL,
        occurred_at TEXT,
        estimated_repair_cost REAL,
        reported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TEXT,
        resolution_notes TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
      )
    `)
    try {
      await runQuery(sql`ALTER TABLE incidents ADD COLUMN incident_type TEXT NOT NULL DEFAULT 'other'`)
    } catch {
    }
    try {
      await runQuery(sql`ALTER TABLE incidents ADD COLUMN occurred_at TEXT`)
    } catch {
    }
    try {
      await runQuery(sql`ALTER TABLE incidents ADD COLUMN estimated_repair_cost REAL`)
    } catch {
    }
    await runQuery(sql`CREATE INDEX IF NOT EXISTS idx_incidents_asset_reported ON incidents(asset_id, reported_at DESC)`)
    await runQuery(sql`CREATE INDEX IF NOT EXISTS idx_incidents_status_reported ON incidents(status, reported_at DESC)`)

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS incident_files (
        id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        storage_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(incident_id) REFERENCES incidents(id) ON DELETE CASCADE
      )
    `)
    await runQuery(sql`CREATE INDEX IF NOT EXISTS idx_incident_files_incident_created ON incident_files(incident_id, created_at DESC)`)

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS asset_files (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        storage_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
      )
    `)

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS app_setup (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        app_name TEXT NOT NULL,
        organization_name TEXT NOT NULL,
        default_locale TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'EUR',
        setup_completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await ensureAppSetupColumns()

    await ensureCategorySchema()

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS producers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        website_url TEXT NOT NULL UNIQUE,
        domain TEXT NOT NULL,
        description TEXT,
        logo_url TEXT,
        source_url TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await ensureAssetManagementColumns()

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY,
        oidc_issuer TEXT NOT NULL,
        oidc_sub TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        roles_json TEXT NOT NULL DEFAULT '["member"]',
        active INTEGER NOT NULL DEFAULT 1,
        source TEXT NOT NULL DEFAULT 'jit',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(oidc_issuer, oidc_sub)
      )
    `)

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS ldap_integrations (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        enabled INTEGER NOT NULL DEFAULT 0,
        url TEXT NOT NULL DEFAULT '',
        bind_dn TEXT NOT NULL DEFAULT '',
        bind_password TEXT,
        base_dn TEXT NOT NULL DEFAULT '',
        user_filter TEXT NOT NULL DEFAULT '(objectClass=person)',
        username_attribute TEXT NOT NULL DEFAULT 'uid',
        email_attribute TEXT NOT NULL DEFAULT 'mail',
        name_attribute TEXT NOT NULL DEFAULT 'cn',
        default_role TEXT NOT NULL DEFAULT 'member',
        sync_issuer TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await runQuery(sql`
      INSERT INTO ldap_integrations (id)
      VALUES (1)
      ON CONFLICT(id) DO NOTHING
    `)

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS qr_public_settings (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        enabled INTEGER NOT NULL DEFAULT 1,
        owner_label TEXT NOT NULL DEFAULT '',
        public_message TEXT NOT NULL DEFAULT '',
        show_login_button INTEGER NOT NULL DEFAULT 1,
        login_button_text TEXT NOT NULL DEFAULT 'Login for more details',
        selected_address_id TEXT REFERENCES addresses(id) ON DELETE SET NULL,
        logo_url TEXT NOT NULL DEFAULT '',
        contact_phone TEXT NOT NULL DEFAULT '',
        contact_email TEXT NOT NULL DEFAULT '',
        website_url TEXT NOT NULL DEFAULT '',
        extra_links_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    try {
      await runQuery(sql`ALTER TABLE qr_public_settings ADD COLUMN selected_address_id TEXT REFERENCES addresses(id) ON DELETE SET NULL`)
    } catch {
    }

    try {
      await runQuery(sql`ALTER TABLE qr_public_settings ADD COLUMN logo_url TEXT NOT NULL DEFAULT ''`)
    } catch {
    }

    try {
      await runQuery(sql`ALTER TABLE qr_public_settings ADD COLUMN contact_phone TEXT NOT NULL DEFAULT ''`)
    } catch {
    }

    try {
      await runQuery(sql`ALTER TABLE qr_public_settings ADD COLUMN contact_email TEXT NOT NULL DEFAULT ''`)
    } catch {
    }

    try {
      await runQuery(sql`ALTER TABLE qr_public_settings ADD COLUMN website_url TEXT NOT NULL DEFAULT ''`)
    } catch {
    }

    try {
      await runQuery(sql`ALTER TABLE qr_public_settings ADD COLUMN extra_links_json TEXT NOT NULL DEFAULT '[]'`)
    } catch {
    }

    await runQuery(sql`
      INSERT INTO qr_public_settings (id)
      VALUES (1)
      ON CONFLICT(id) DO NOTHING
    `)

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        recipient_member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        delivery TEXT NOT NULL DEFAULT 'immediate',
        link_url TEXT,
        event_key TEXT UNIQUE,
        read_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await runQuery(sql`CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_member_id, created_at DESC)`)
    await runQuery(sql`CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_member_id, read_at, created_at DESC)`)

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        checkout_alerts INTEGER NOT NULL DEFAULT 1,
        maintenance_alerts INTEGER NOT NULL DEFAULT 1,
        booking_alerts INTEGER NOT NULL DEFAULT 1,
        digest_enabled INTEGER NOT NULL DEFAULT 0,
        low_inventory_alerts INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await runQuery(sql`
      INSERT INTO notification_preferences (id)
      VALUES (1)
      ON CONFLICT(id) DO NOTHING
    `)

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS security_settings (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        trusted_proxies_json TEXT NOT NULL DEFAULT '[]',
        trusted_domains_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await runQuery(sql`
      INSERT INTO security_settings (id)
      VALUES (1)
      ON CONFLICT(id) DO NOTHING
    `)

    await runQuery(sql`
      CREATE TABLE IF NOT EXISTS activity_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        actor_member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
        actor_name TEXT NOT NULL,
        subject_type TEXT NOT NULL,
        subject_id TEXT,
        subject_name TEXT,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await runQuery(sql`CREATE INDEX IF NOT EXISTS idx_activity_events_created ON activity_events(created_at DESC)`)
    await runQuery(sql`CREATE INDEX IF NOT EXISTS idx_activity_events_type_created ON activity_events(type, created_at DESC)`)
    await runQuery(sql`CREATE INDEX IF NOT EXISTS idx_activity_events_actor_created ON activity_events(actor_member_id, created_at DESC)`)

    await pruneOldActivitiesIfNeeded(true)
  })()

  return schemaReady
}

export async function getSetupStatus(): Promise<SetupStatus> {
  await ensureCoreSchema()

  const row = await queryFirst<{
    app_name: string
    organization_name: string
    default_locale: EuropeanLocale
    currency: string | null
    setup_completed_at: string | null
  }>(sql`
    SELECT app_name, organization_name, default_locale, currency, setup_completed_at
    FROM app_setup
    WHERE id = 1
    LIMIT 1
  `)

  if (!row) {
    return {
      setupComplete: false,
      appName: "Inventory OS",
      organizationName: "",
      locale: "en",
      currency: "EUR",
    }
  }

  return {
    setupComplete: Boolean(row.setup_completed_at),
    appName: row.app_name,
    organizationName: row.organization_name,
    locale: row.default_locale,
    currency: row.currency ?? "EUR",
  }
}

export async function completeInitialSetup(input: {
  appName: string
  organizationName: string
  adminUsername: string
  adminPassword: string
  firstLocationName: string
  firstLocationAddress: string
  locale: EuropeanLocale
}): Promise<SetupStatus> {
  await ensureCoreSchema()

  const existing = await getSetupStatus()
  if (existing.setupComplete) {
    return existing
  }

  const passwordHash = await hash(input.adminPassword, 12)

  await runQuery(sql`
    INSERT INTO app_setup (id, app_name, organization_name, default_locale, currency, setup_completed_at)
    VALUES (1, ${input.appName}, ${input.organizationName}, ${input.locale}, ${"EUR"}, ${new Date().toISOString()})
    ON CONFLICT(id) DO UPDATE SET
      app_name = ${input.appName},
      organization_name = ${input.organizationName},
      default_locale = ${input.locale},
      currency = ${"EUR"},
      setup_completed_at = ${new Date().toISOString()}
  `)

  await runQuery(sql`
    INSERT INTO admin_users (id, username, password_hash)
    VALUES (${makeId("ADM")}, ${input.adminUsername}, ${passwordHash})
  `)

  const locationCount = await tableCount("locations")
  if (locationCount === 0) {
    await runQuery(sql`
      INSERT INTO locations (id, name, address, parent_id, kind)
      VALUES (${makeId("LOC")}, ${input.firstLocationName}, ${input.firstLocationAddress}, ${null}, ${"building"})
    `)
  }

  return getSetupStatus()
}

export async function saveWorkspaceSettings(input: {
  appName: string
  organizationName: string
  locale: EuropeanLocale
  currency: string
}): Promise<SetupStatus> {
  await ensureCoreSchema()

  const existing = await getSetupStatus()
  const setupCompletedAt = existing.setupComplete ? new Date().toISOString() : new Date().toISOString()

  await runQuery(sql`
    INSERT INTO app_setup (id, app_name, organization_name, default_locale, currency, setup_completed_at)
    VALUES (1, ${input.appName}, ${input.organizationName}, ${input.locale}, ${input.currency.toUpperCase()}, ${setupCompletedAt})
    ON CONFLICT(id) DO UPDATE SET
      app_name = ${input.appName},
      organization_name = ${input.organizationName},
      default_locale = ${input.locale},
      currency = ${input.currency.toUpperCase()},
      setup_completed_at = ${setupCompletedAt}
  `)

  return getSetupStatus()
}

export async function getQrPublicSettings(): Promise<QrPublicSettings> {
  await ensureCoreSchema()

  const row = await queryFirst<DbQrPublicSettingsRow>(sql`
    SELECT enabled, owner_label, public_message, show_login_button, login_button_text, selected_address_id, logo_url, contact_phone, contact_email, website_url, extra_links_json, updated_at
    FROM qr_public_settings
    WHERE id = 1
    LIMIT 1
  `)

  return toQrPublicSettings(row ?? null)
}

export async function saveQrPublicSettings(input: {
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
}): Promise<QrPublicSettings> {
  await ensureCoreSchema()

  const normalizedLinks = input.extraLinks
    .map((entry) => ({
      label: entry.label.trim(),
      url: entry.url.trim(),
    }))
    .filter((entry) => entry.label.length > 0 && entry.url.length > 0)

  await runQuery(sql`
    INSERT INTO qr_public_settings (id, enabled, owner_label, public_message, show_login_button, login_button_text, selected_address_id, logo_url, contact_phone, contact_email, website_url, extra_links_json, updated_at)
    VALUES (1, ${input.enabled ? 1 : 0}, ${input.ownerLabel.trim()}, ${input.publicMessage.trim()}, ${input.showLoginButton ? 1 : 0}, ${input.loginButtonText.trim()}, ${input.selectedAddressId}, ${input.logoUrl.trim()}, ${input.contactPhone.trim()}, ${input.contactEmail.trim()}, ${input.websiteUrl.trim()}, ${JSON.stringify(normalizedLinks)}, ${new Date().toISOString()})
    ON CONFLICT(id) DO UPDATE SET
      enabled = ${input.enabled ? 1 : 0},
      owner_label = ${input.ownerLabel.trim()},
      public_message = ${input.publicMessage.trim()},
      show_login_button = ${input.showLoginButton ? 1 : 0},
      login_button_text = ${input.loginButtonText.trim()},
      selected_address_id = ${input.selectedAddressId},
      logo_url = ${input.logoUrl.trim()},
      contact_phone = ${input.contactPhone.trim()},
      contact_email = ${input.contactEmail.trim()},
      website_url = ${input.websiteUrl.trim()},
      extra_links_json = ${JSON.stringify(normalizedLinks)},
      updated_at = ${new Date().toISOString()}
  `)

  return getQrPublicSettings()
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  await ensureCoreSchema()

  const row = await queryFirst<DbNotificationPreferencesRow>(sql`
    SELECT checkout_alerts, maintenance_alerts, booking_alerts, digest_enabled, low_inventory_alerts, updated_at
    FROM notification_preferences
    WHERE id = 1
    LIMIT 1
  `)

  return toNotificationPreferences(row ?? null)
}

export async function saveNotificationPreferences(input: {
  checkoutAlerts: boolean
  maintenanceAlerts: boolean
  bookingAlerts: boolean
  digestEnabled: boolean
  lowInventoryAlerts: boolean
}): Promise<NotificationPreferences> {
  await ensureCoreSchema()

  await runQuery(sql`
    INSERT INTO notification_preferences (id, checkout_alerts, maintenance_alerts, booking_alerts, digest_enabled, low_inventory_alerts, updated_at)
    VALUES (1, ${input.checkoutAlerts ? 1 : 0}, ${input.maintenanceAlerts ? 1 : 0}, ${input.bookingAlerts ? 1 : 0}, ${input.digestEnabled ? 1 : 0}, ${input.lowInventoryAlerts ? 1 : 0}, ${new Date().toISOString()})
    ON CONFLICT(id) DO UPDATE SET
      checkout_alerts = ${input.checkoutAlerts ? 1 : 0},
      maintenance_alerts = ${input.maintenanceAlerts ? 1 : 0},
      booking_alerts = ${input.bookingAlerts ? 1 : 0},
      digest_enabled = ${input.digestEnabled ? 1 : 0},
      low_inventory_alerts = ${input.lowInventoryAlerts ? 1 : 0},
      updated_at = ${new Date().toISOString()}
  `)

  return getNotificationPreferences()
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  await ensureCoreSchema()

  const row = await queryFirst<DbSecuritySettingsRow>(sql`
    SELECT trusted_proxies_json, trusted_domains_json, updated_at
    FROM security_settings
    WHERE id = 1
    LIMIT 1
  `)

  return toSecuritySettings(row ?? null)
}

export async function saveSecuritySettings(input: {
  trustedProxies: string[]
  trustedDomains: string[]
}): Promise<SecuritySettings> {
  await ensureCoreSchema()

  const trustedProxies = normalizeTrustEntries(input.trustedProxies)
  const trustedDomains = normalizeTrustEntries(input.trustedDomains)

  await runQuery(sql`
    INSERT INTO security_settings (id, trusted_proxies_json, trusted_domains_json, updated_at)
    VALUES (1, ${JSON.stringify(trustedProxies)}, ${JSON.stringify(trustedDomains)}, ${new Date().toISOString()})
    ON CONFLICT(id) DO UPDATE SET
      trusted_proxies_json = ${JSON.stringify(trustedProxies)},
      trusted_domains_json = ${JSON.stringify(trustedDomains)},
      updated_at = ${new Date().toISOString()}
  `)

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

export async function recordActivityEvent(input: {
  type: string
  actorMemberId?: string | null
  actorName: string
  subjectType: "asset" | "location" | "booking" | "auth" | "settings" | "system" | "other"
  subjectId?: string | null
  subjectName?: string | null
  message: string
}): Promise<void> {
  await ensureCoreSchema()

  await runQuery(sql`
    INSERT INTO activity_events (id, type, actor_member_id, actor_name, subject_type, subject_id, subject_name, message, created_at)
    VALUES (
      ${makeId("ACT")},
      ${input.type},
      ${input.actorMemberId ?? null},
      ${input.actorName.trim() || "System"},
      ${input.subjectType},
      ${input.subjectId ?? null},
      ${input.subjectName ?? null},
      ${input.message},
      ${new Date().toISOString()}
    )
  `)

  await pruneOldActivitiesIfNeeded(false)
}

export async function listActivityEvents(input: {
  page: number
  pageSize: number
  search?: string
  type?: string | null
}): Promise<{
  events: ActivityRecord[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}> {
  await ensureCoreSchema()
  await pruneOldActivitiesIfNeeded(false)

  const page = Math.max(1, Number(input.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(input.pageSize) || 20))
  const offset = (page - 1) * pageSize
  const search = (input.search ?? "").trim().toLowerCase()
  const type = (input.type ?? "all").trim().toLowerCase()

  const typeFilter = type === "all" ? null : type
  const searchLike = search.length > 0 ? `%${search}%` : null

  const totalRow = await queryFirst<{ count: number | string }>(sql`
    SELECT COUNT(*) AS count
    FROM activity_events
    WHERE
      (${typeFilter} IS NULL OR lower(type) = ${typeFilter} OR lower(subject_type) = ${typeFilter})
      AND (
        ${searchLike} IS NULL
        OR lower(type || ' ' || actor_name || ' ' || subject_type || ' ' || coalesce(subject_id, '') || ' ' || coalesce(subject_name, '') || ' ' || message) LIKE ${searchLike}
      )
  `)

  const rows = await queryRows<DbActivityRow>(sql`
    SELECT id, type, actor_member_id, actor_name, subject_type, subject_id, subject_name, message, created_at
    FROM activity_events
    WHERE
      (${typeFilter} IS NULL OR lower(type) = ${typeFilter} OR lower(subject_type) = ${typeFilter})
      AND (
        ${searchLike} IS NULL
        OR lower(type || ' ' || actor_name || ' ' || subject_type || ' ' || coalesce(subject_id, '') || ' ' || coalesce(subject_name, '') || ' ' || message) LIKE ${searchLike}
      )
    ORDER BY created_at DESC
    LIMIT ${pageSize}
    OFFSET ${offset}
  `)

  const total = Number(totalRow?.count ?? 0)

  return {
    events: rows.map(toActivityRecord),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

async function getAdminMemberIds(): Promise<string[]> {
  await ensureCoreSchema()

  const rows = await queryRows<{ id: string }>(sql`
    SELECT id
    FROM members
    WHERE role = ${"admin"}
  `)

  return rows.map((row) => row.id)
}

async function createNotification(input: {
  recipientMemberId: string
  type: string
  title: string
  message: string
  level?: NotificationLevel
  delivery?: NotificationDelivery
  linkUrl?: string | null
  eventKey?: string | null
}): Promise<void> {
  await ensureCoreSchema()

  const level = input.level ?? "info"
  const delivery = input.delivery ?? "immediate"
  const eventKey = input.eventKey ?? null

  if (eventKey) {
    await runQuery(sql`
      INSERT INTO notifications (id, recipient_member_id, type, title, message, level, delivery, link_url, event_key)
      VALUES (${makeId("NTF")}, ${input.recipientMemberId}, ${input.type}, ${input.title}, ${input.message}, ${level}, ${delivery}, ${input.linkUrl ?? null}, ${eventKey})
      ON CONFLICT(event_key) DO NOTHING
    `)
    return
  }

  await runQuery(sql`
    INSERT INTO notifications (id, recipient_member_id, type, title, message, level, delivery, link_url)
    VALUES (${makeId("NTF")}, ${input.recipientMemberId}, ${input.type}, ${input.title}, ${input.message}, ${level}, ${delivery}, ${input.linkUrl ?? null})
  `)
}

async function createNotificationsForMembers(input: {
  recipientMemberIds: string[]
  type: string
  title: string
  message: string
  level?: NotificationLevel
  delivery?: NotificationDelivery
  linkUrl?: string | null
  eventKey?: string | null
}): Promise<void> {
  const uniqueRecipientIds = [...new Set(input.recipientMemberIds.filter(Boolean))]
  for (const recipientMemberId of uniqueRecipientIds) {
    await createNotification({
      recipientMemberId,
      type: input.type,
      title: input.title,
      message: input.message,
      level: input.level,
      delivery: input.delivery,
      linkUrl: input.linkUrl,
      eventKey: input.eventKey ? `${input.eventKey}:${recipientMemberId}` : null,
    })
  }
}

export async function listNotificationsForMember(memberId: string, limit = 50): Promise<NotificationRecord[]> {
  await ensureCoreSchema()

  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))
  const rows = await queryRows<DbNotificationRow>(sql`
    SELECT id, recipient_member_id, type, title, message, level, delivery, link_url, event_key, read_at, created_at
    FROM notifications
    WHERE recipient_member_id = ${memberId}
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `)

  return rows.map(toNotificationRecord)
}

export async function markNotificationRead(id: string, memberId: string): Promise<boolean> {
  await ensureCoreSchema()

  const existing = await queryFirst<{ id: string }>(sql`
    SELECT id
    FROM notifications
    WHERE id = ${id} AND recipient_member_id = ${memberId}
    LIMIT 1
  `)

  if (!existing) {
    return false
  }

  await runQuery(sql`
    UPDATE notifications
    SET read_at = COALESCE(read_at, ${new Date().toISOString()})
    WHERE id = ${id} AND recipient_member_id = ${memberId}
  `)

  return true
}

export async function markAllNotificationsRead(memberId: string): Promise<void> {
  await ensureCoreSchema()

  await runQuery(sql`
    UPDATE notifications
    SET read_at = COALESCE(read_at, ${new Date().toISOString()})
    WHERE recipient_member_id = ${memberId}
  `)
}

export async function deleteNotification(id: string, memberId: string): Promise<boolean> {
  await ensureCoreSchema()

  const existing = await queryFirst<{ id: string }>(sql`
    SELECT id
    FROM notifications
    WHERE id = ${id} AND recipient_member_id = ${memberId}
    LIMIT 1
  `)

  if (!existing) {
    return false
  }

  await runQuery(sql`
    DELETE FROM notifications
    WHERE id = ${id} AND recipient_member_id = ${memberId}
  `)

  return true
}

export async function deleteAllNotifications(memberId: string): Promise<void> {
  await ensureCoreSchema()

  await runQuery(sql`
    DELETE FROM notifications
    WHERE recipient_member_id = ${memberId}
  `)
}

export async function notifyAssetBorrowed(input: {
  assetId: string
  assetName: string
  memberId: string
  memberName: string
}): Promise<void> {
  const preferences = await getNotificationPreferences()
  if (!preferences.checkoutAlerts) {
    return
  }

  const adminMemberIds = await getAdminMemberIds()

  await createNotification({
    recipientMemberId: input.memberId,
    type: "asset.borrowed",
    title: "Asset assigned to you",
    message: `${input.assetName} has been assigned to you.`,
    level: "info",
    delivery: "immediate",
    linkUrl: `/assets/${input.assetId}`,
  })

  if (preferences.digestEnabled) {
    await createNotificationsForMembers({
      recipientMemberIds: adminMemberIds,
      type: "asset.borrowed",
      title: "Asset borrowed",
      message: `${input.assetName} was borrowed by ${input.memberName}.`,
      level: "info",
      delivery: "digest",
      linkUrl: `/assets/${input.assetId}`,
      eventKey: `asset-borrowed:${input.assetId}:${dayKey(new Date())}`,
    })
  }
}

export async function notifyAssetReturned(input: {
  assetId: string
  assetName: string
  memberId: string
}): Promise<void> {
  const preferences = await getNotificationPreferences()
  if (!preferences.checkoutAlerts) {
    return
  }

  await createNotification({
    recipientMemberId: input.memberId,
    type: "asset.returned",
    title: "Asset return confirmed",
    message: `${input.assetName} was marked as returned.`,
    level: "info",
    delivery: "immediate",
    linkUrl: `/assets/${input.assetId}`,
  })
}

export async function notifyAssetStatusChanged(input: {
  assetId: string
  assetName: string
  fromStatus: AssetStatus
  toStatus: AssetStatus
  assignedMemberId: string | null
}): Promise<void> {
  const preferences = await getNotificationPreferences()
  if (!preferences.maintenanceAlerts) {
    return
  }

  if (input.toStatus !== "maintenance" && input.toStatus !== "retired") {
    return
  }

  const adminMemberIds = await getAdminMemberIds()
  const affectedRecipients = [
    ...adminMemberIds,
    ...(input.assignedMemberId ? [input.assignedMemberId] : []),
  ]

  await createNotificationsForMembers({
    recipientMemberIds: affectedRecipients,
    type: "asset.status.changed",
    title: `Asset moved to ${input.toStatus}`,
    message: `${input.assetName} changed from ${input.fromStatus} to ${input.toStatus}.`,
    level: input.toStatus === "retired" ? "warning" : "info",
    delivery: "immediate",
    linkUrl: `/assets/${input.assetId}`,
    eventKey: `asset-status:${input.assetId}:${input.toStatus}:${dayKey(new Date())}`,
  })
}

export async function notifyLowInventoryForAsset(input: {
  assetId: string
  assetName: string
  quantity: number
  minimumQuantity: number
}): Promise<void> {
  const preferences = await getNotificationPreferences()
  if (!preferences.lowInventoryAlerts) {
    return
  }

  if (input.minimumQuantity <= 0 || input.quantity > input.minimumQuantity) {
    return
  }

  const adminMemberIds = await getAdminMemberIds()
  await createNotificationsForMembers({
    recipientMemberIds: adminMemberIds,
    type: "inventory.low",
    title: "Low inventory",
    message: `${input.assetName} is low on stock (${input.quantity}/${input.minimumQuantity}).`,
    level: "warning",
    delivery: "immediate",
    linkUrl: `/assets/${input.assetId}`,
    eventKey: `low-inventory:${input.assetId}:${dayKey(new Date())}`,
  })
}

export async function notifyMemberRoleChanged(input: {
  memberId: string
  memberName: string
  fromRole: TeamRole
  toRole: TeamRole
}): Promise<void> {
  if (input.fromRole === input.toRole) {
    return
  }

  const adminMemberIds = await getAdminMemberIds()
  await createNotificationsForMembers({
    recipientMemberIds: adminMemberIds,
    type: "security.member-role-changed",
    title: "Member role changed",
    message: `${input.memberName} role changed from ${input.fromRole} to ${input.toRole}.`,
    level: "critical",
    delivery: "immediate",
    linkUrl: `/team/${input.memberId}`,
    eventKey: `member-role:${input.memberId}:${input.fromRole}:${input.toRole}:${dayKey(new Date())}`,
  })
}

export async function notifyLdapSyncFailed(message: string): Promise<void> {
  const adminMemberIds = await getAdminMemberIds()
  await createNotificationsForMembers({
    recipientMemberIds: adminMemberIds,
    type: "security.ldap-sync-failed",
    title: "LDAP sync failed",
    message,
    level: "critical",
    delivery: "immediate",
    linkUrl: "/settings",
    eventKey: `ldap-sync-failed:${dayKey(new Date())}:${message.slice(0, 80)}`,
  })
}

export async function notifyAuthIntegrationFailed(message: string): Promise<void> {
  const adminMemberIds = await getAdminMemberIds()
  await createNotificationsForMembers({
    recipientMemberIds: adminMemberIds,
    type: "security.auth-integration-failed",
    title: "Authentication integration failure",
    message,
    level: "critical",
    delivery: "immediate",
    linkUrl: "/settings",
    eventKey: `auth-failure:${dayKey(new Date())}:${message.slice(0, 80)}`,
  })
}

export async function notifyQrSettingsChanged(changedFields: string[]): Promise<void> {
  if (changedFields.length === 0) {
    return
  }

  const adminMemberIds = await getAdminMemberIds()
  await createNotificationsForMembers({
    recipientMemberIds: adminMemberIds,
    type: "security.qr-settings-changed",
    title: "Public QR settings changed",
    message: `Updated fields: ${changedFields.join(", ")}`,
    level: "critical",
    delivery: "immediate",
    linkUrl: "/settings",
    eventKey: `qr-settings:${dayKey(new Date())}:${changedFields.join("|")}`,
  })
}

export async function runDueAndOverdueNotifications(referenceDate = new Date()): Promise<{ created: number }> {
  await ensureCoreSchema()

  const preferences = await getNotificationPreferences()
  if (!preferences.bookingAlerts) {
    return { created: 0 }
  }

  const nowIso = referenceDate.toISOString()
  const oneDayLaterIso = addDaysIso(referenceDate, 1)
  const sevenDaysLaterIso = addDaysIso(referenceDate, 7)
  const twoDaysAgoIso = addDaysIso(referenceDate, -2)
  const today = dayKey(referenceDate)
  let created = 0

  const openLoans = await queryRows<{
    id: string
    asset_id: string
    asset_name: string
    member_id: string
    member_name: string
    due_at: string | null
  }>(sql`
    SELECT
      l.id,
      l.asset_id,
      a.name AS asset_name,
      l.member_id,
      m.name AS member_name,
      l.due_at
    FROM loans l
    JOIN assets a ON a.id = l.asset_id
    JOIN members m ON m.id = l.member_id
    WHERE l.returned_at IS NULL AND l.due_at IS NOT NULL
  `)

  const adminMemberIds = await getAdminMemberIds()

  for (const loan of openLoans) {
    if (!loan.due_at) {
      continue
    }

    const dueAtIso = new Date(loan.due_at).toISOString()
    const isDueSoon24h = dueAtIso >= nowIso && dueAtIso <= oneDayLaterIso
    const isDueSoon7d = dueAtIso >= nowIso && dueAtIso <= sevenDaysLaterIso
    const isOverdue = dueAtIso < nowIso
    const isOverdue48h = dueAtIso < twoDaysAgoIso

    if (isDueSoon7d) {
      await createNotification({
        recipientMemberId: loan.member_id,
        type: "loan.due-soon",
        title: "Asset due soon",
        message: `${loan.asset_name} is due on ${new Date(loan.due_at).toLocaleDateString()}.`,
        level: isDueSoon24h ? "warning" : "info",
        delivery: "immediate",
        linkUrl: `/assets/${loan.asset_id}`,
        eventKey: `due-soon:${loan.id}:${isDueSoon24h ? "24h" : "7d"}`,
      })
      created += 1

      if (preferences.digestEnabled) {
        await createNotificationsForMembers({
          recipientMemberIds: adminMemberIds,
          type: "loan.due-soon",
          title: "Assets due soon",
          message: `${loan.asset_name} borrowed by ${loan.member_name} is due on ${new Date(loan.due_at).toLocaleDateString()}.`,
          level: "info",
          delivery: "digest",
          linkUrl: `/assets/${loan.asset_id}`,
          eventKey: `due-soon-admin:${loan.id}:${today}`,
        })
        created += adminMemberIds.length
      }
    }

    if (isOverdue) {
      await createNotificationsForMembers({
        recipientMemberIds: [loan.member_id, ...adminMemberIds],
        type: "loan.overdue",
        title: "Asset overdue",
        message: `${loan.asset_name} is overdue since ${new Date(loan.due_at).toLocaleDateString()}.`,
        level: "critical",
        delivery: "immediate",
        linkUrl: `/assets/${loan.asset_id}`,
        eventKey: `overdue-first:${loan.id}`,
      })

      await createNotificationsForMembers({
        recipientMemberIds: [loan.member_id, ...adminMemberIds],
        type: "loan.overdue-reminder",
        title: "Overdue reminder",
        message: `${loan.asset_name} is still overdue. Please resolve this booking.`,
        level: "critical",
        delivery: "immediate",
        linkUrl: `/assets/${loan.asset_id}`,
        eventKey: `overdue-daily:${loan.id}:${today}`,
      })

      if (isOverdue48h && preferences.digestEnabled) {
        await createNotificationsForMembers({
          recipientMemberIds: adminMemberIds,
          type: "loan.overdue-escalated",
          title: "Overdue escalation (>48h)",
          message: `${loan.asset_name} borrowed by ${loan.member_name} is overdue for more than 48h.`,
          level: "critical",
          delivery: "digest",
          linkUrl: `/assets/${loan.asset_id}`,
          eventKey: `overdue-48h:${loan.id}:${today}`,
        })
      }

      created += 1
    }
  }

  return { created }
}

export async function listAssets(): Promise<Asset[]> {
  await ensureCoreSchema()

  const rows = await queryRows<DbAsset>(sql`
    SELECT
      a.id,
      a.name,
      a.parent_asset_id,
      parent.name AS parent_asset_name,
      a.category,
      a.status,
      a.location_id,
      a.producer_id,
      p.name AS producer_name,
      a.model,
      a.serial_number,
      a.sku,
      a.supplier,
      a.warranty_until,
      a.asset_condition,
      a.quantity,
      a.minimum_quantity,
      a.notes,
      CASE
        WHEN l.floor_number IS NOT NULL AND TRIM(l.floor_number) <> '' AND l.room_number IS NOT NULL AND TRIM(l.room_number) <> ''
          THEN l.floor_number || '.' || l.room_number || ' ' || l.name
        WHEN l.room_number IS NOT NULL AND TRIM(l.room_number) <> ''
          THEN l.room_number || ' ' || l.name
        WHEN l.floor_number IS NOT NULL AND TRIM(l.floor_number) <> ''
          THEN l.floor_number || ' ' || l.name
        ELSE l.name
      END AS location_name,
      m.name AS assigned_member_name,
      a.qr_code,
      a.value,
      a.purchase_date,
      a.last_scanned,
      a.tags,
      (
        SELECT af.id
        FROM asset_files af
        WHERE af.asset_id = a.id AND (af.kind = 'image' OR af.mime_type LIKE 'image/%')
        ORDER BY af.created_at ASC
        LIMIT 1
      ) AS thumbnail_file_id
    FROM assets a
    LEFT JOIN assets parent ON parent.id = a.parent_asset_id
    LEFT JOIN producers p ON a.producer_id = p.id
    LEFT JOIN locations l ON a.location_id = l.id
    LEFT JOIN members m ON a.assigned_member_id = m.id
    ORDER BY a.created_at DESC
  `)

  return rows.map(toAsset)
}

export async function getAssetById(id: string): Promise<Asset | null> {
  await ensureCoreSchema()

  const row = await queryFirst<DbAsset>(sql`
    SELECT
      a.id,
      a.name,
      a.parent_asset_id,
      parent.name AS parent_asset_name,
      a.category,
      a.status,
      a.location_id,
      a.producer_id,
      p.name AS producer_name,
      a.model,
      a.serial_number,
      a.sku,
      a.supplier,
      a.warranty_until,
      a.asset_condition,
      a.quantity,
      a.minimum_quantity,
      a.notes,
      CASE
        WHEN l.floor_number IS NOT NULL AND TRIM(l.floor_number) <> '' AND l.room_number IS NOT NULL AND TRIM(l.room_number) <> ''
          THEN l.floor_number || '.' || l.room_number || ' ' || l.name
        WHEN l.room_number IS NOT NULL AND TRIM(l.room_number) <> ''
          THEN l.room_number || ' ' || l.name
        WHEN l.floor_number IS NOT NULL AND TRIM(l.floor_number) <> ''
          THEN l.floor_number || ' ' || l.name
        ELSE l.name
      END AS location_name,
      m.name AS assigned_member_name,
      a.qr_code,
      a.value,
      a.purchase_date,
      a.last_scanned,
      a.tags,
      (
        SELECT af.id
        FROM asset_files af
        WHERE af.asset_id = a.id AND (af.kind = 'image' OR af.mime_type LIKE 'image/%')
        ORDER BY af.created_at ASC
        LIMIT 1
      ) AS thumbnail_file_id
    FROM assets a
    LEFT JOIN assets parent ON parent.id = a.parent_asset_id
    LEFT JOIN producers p ON a.producer_id = p.id
    LEFT JOIN locations l ON a.location_id = l.id
    LEFT JOIN members m ON a.assigned_member_id = m.id
    WHERE a.id = ${id}
    LIMIT 1
  `)

  return row ? toAsset(row) : null
}

export async function createAsset(input: {
  name: string
  parentAssetId?: string | null
  category: AssetCategory
  status: AssetStatus
  producerId?: string | null
  model?: string | null
  serialNumber?: string | null
  sku?: string | null
  supplier?: string | null
  warrantyUntil?: string | null
  condition?: "new" | "good" | "fair" | "damaged"
  quantity?: number
  minimumQuantity?: number
  notes?: string | null
  locationId: string | null
  value: number
  purchaseDate: string
  tags: string[]
}): Promise<Asset> {
  await ensureCoreSchema()
  const tags = normalizeTags(input.tags)

  let resolvedLocationId = input.locationId
  if (input.parentAssetId) {
    const parent = await getAssetParentAndLocation(input.parentAssetId)
    if (!parent) {
      throw new Error("Parent asset not found")
    }

    const root = await resolveRootAsset(input.parentAssetId)
    resolvedLocationId = root.rootLocationId
  }

  const id = makeId("AST")
  await runQuery(sql`
    INSERT INTO assets (
      id, name, parent_asset_id, category, status, producer_id, model, serial_number, sku, supplier, warranty_until, asset_condition, quantity, minimum_quantity, notes, location_id, assigned_member_id, qr_code, value, purchase_date, last_scanned, tags
    )
    VALUES (
      ${id}, ${input.name}, ${input.parentAssetId ?? null}, ${input.category}, ${input.status}, ${input.producerId ?? null}, ${input.model ?? null}, ${input.serialNumber ?? null}, ${input.sku ?? null}, ${input.supplier ?? null}, ${input.warrantyUntil ?? null}, ${input.condition ?? "good"}, ${input.quantity ?? 1}, ${input.minimumQuantity ?? 0}, ${input.notes ?? null}, ${resolvedLocationId}, ${null}, ${buildAssetQrPayload(id)}, ${input.value}, ${input.purchaseDate}, ${todayIso()}, ${JSON.stringify(tags)}
    )
  `)

  const asset = await getAssetById(id)
  if (!asset) {
    throw new Error("Failed to create asset")
  }

  return asset
}

export async function duplicateAsset(sourceAssetId: string): Promise<Asset | null> {
  await ensureCoreSchema()

  const source = await getAssetById(sourceAssetId)
  if (!source) {
    return null
  }

  const duplicated = await createAsset({
    name: `${source.name} (Copy)`,
    parentAssetId: source.parentAssetId ?? null,
    category: source.category,
    status: source.status,
    producerId: source.producerId ?? null,
    model: source.model ?? null,
    serialNumber: source.serialNumber ?? null,
    sku: source.sku ?? null,
    supplier: source.supplier ?? null,
    warrantyUntil: source.warrantyUntil ?? null,
    condition: source.condition ?? "good",
    quantity: source.quantity ?? 1,
    minimumQuantity: source.minimumQuantity ?? 0,
    notes: source.notes ?? null,
    locationId: source.locationId ?? null,
    value: source.value,
    purchaseDate: source.purchaseDate,
    tags: source.tags,
  })

  return duplicated
}

export async function updateAsset(
  id: string,
  input: {
    name: string
    parentAssetId?: string | null
    category: AssetCategory
    status: AssetStatus
    producerId?: string | null
    model?: string | null
    serialNumber?: string | null
    sku?: string | null
    supplier?: string | null
    warrantyUntil?: string | null
    condition?: "new" | "good" | "fair" | "damaged"
    quantity?: number
    minimumQuantity?: number
    notes?: string | null
    locationId: string | null
    value: number
    purchaseDate: string
    tags: string[]
  },
): Promise<Asset | null> {
  await ensureCoreSchema()
  const tags = normalizeTags(input.tags)

  const existing = await getAssetById(id)
  if (!existing) {
    return null
  }

  if (input.parentAssetId && input.parentAssetId === id) {
    throw new Error("Asset cannot be its own parent")
  }

  if (input.parentAssetId && await isDescendantOf(input.parentAssetId, id)) {
    throw new Error("Cannot assign a descendant as parent")
  }

  let resolvedLocationId = input.locationId
  if (input.parentAssetId) {
    const parent = await getAssetParentAndLocation(input.parentAssetId)
    if (!parent) {
      throw new Error("Parent asset not found")
    }

    const root = await resolveRootAsset(input.parentAssetId)
    resolvedLocationId = root.rootLocationId
  }

  await runQuery(sql`
    UPDATE assets
    SET
      name = ${input.name},
      parent_asset_id = ${input.parentAssetId ?? null},
      category = ${input.category},
      status = ${input.status},
      producer_id = ${input.producerId ?? null},
      model = ${input.model ?? null},
      serial_number = ${input.serialNumber ?? null},
      sku = ${input.sku ?? null},
      supplier = ${input.supplier ?? null},
      warranty_until = ${input.warrantyUntil ?? null},
      asset_condition = ${input.condition ?? "good"},
      quantity = ${input.quantity ?? 1},
      minimum_quantity = ${input.minimumQuantity ?? 0},
      notes = ${input.notes ?? null},
      location_id = ${resolvedLocationId},
      value = ${input.value},
      purchase_date = ${input.purchaseDate},
      tags = ${JSON.stringify(tags)},
      last_scanned = ${todayIso()}
    WHERE id = ${id}
  `)

  if (!input.parentAssetId && existing.locationId !== resolvedLocationId) {
    await cascadeDescendantLocation(id, resolvedLocationId)
  } else if (existing.parentAssetId !== (input.parentAssetId ?? null)) {
    await cascadeDescendantLocation(id, resolvedLocationId)
  }

  return getAssetById(id)
}

export async function deleteAsset(id: string): Promise<boolean> {
  await ensureCoreSchema()

  const existing = await getAssetById(id)
  if (!existing) {
    return false
  }

  await runQuery(sql`DELETE FROM assets WHERE id = ${id}`)
  return true
}

export async function listAssetChildren(parentAssetId: string): Promise<Asset[]> {
  await ensureCoreSchema()

  const rows = await queryRows<DbAsset>(sql`
    SELECT
      a.id,
      a.name,
      a.parent_asset_id,
      parent.name AS parent_asset_name,
      a.category,
      a.status,
      a.location_id,
      a.producer_id,
      p.name AS producer_name,
      a.model,
      a.serial_number,
      a.sku,
      a.supplier,
      a.warranty_until,
      a.asset_condition,
      a.quantity,
      a.minimum_quantity,
      a.notes,
      CASE
        WHEN l.floor_number IS NOT NULL AND TRIM(l.floor_number) <> '' AND l.room_number IS NOT NULL AND TRIM(l.room_number) <> ''
          THEN l.floor_number || '.' || l.room_number || ' ' || l.name
        WHEN l.room_number IS NOT NULL AND TRIM(l.room_number) <> ''
          THEN l.room_number || ' ' || l.name
        WHEN l.floor_number IS NOT NULL AND TRIM(l.floor_number) <> ''
          THEN l.floor_number || ' ' || l.name
        ELSE l.name
      END AS location_name,
      m.name AS assigned_member_name,
      a.qr_code,
      a.value,
      a.purchase_date,
      a.last_scanned,
      a.tags,
      (
        SELECT af.id
        FROM asset_files af
        WHERE af.asset_id = a.id AND (af.kind = 'image' OR af.mime_type LIKE 'image/%')
        ORDER BY af.created_at ASC
        LIMIT 1
      ) AS thumbnail_file_id
    FROM assets a
    LEFT JOIN assets parent ON parent.id = a.parent_asset_id
    LEFT JOIN producers p ON a.producer_id = p.id
    LEFT JOIN locations l ON a.location_id = l.id
    LEFT JOIN members m ON a.assigned_member_id = m.id
    WHERE a.parent_asset_id = ${parentAssetId}
    ORDER BY a.created_at ASC
  `)

  return rows.map(toAsset)
}

export async function listAssetTags(): Promise<Array<{ name: string; count: number }>> {
  const assets = await listAssets()
  const counts = new Map<string, { name: string; count: number }>()

  for (const asset of assets) {
    for (const raw of asset.tags) {
      const name = raw.trim()
      if (!name) {
        continue
      }

      const key = name.toLowerCase()
      const existing = counts.get(key)
      if (existing) {
        existing.count += 1
      } else {
        counts.set(key, { name, count: 1 })
      }
    }
  }

  return [...counts.values()].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count
    }

    return left.name.localeCompare(right.name)
  })
}

export async function listAssetFiles(assetId: string): Promise<AssetFile[]> {
  await ensureCoreSchema()

  const rows = await queryRows<DbAssetFileRow>(sql`
    SELECT id, asset_id, kind, original_name, mime_type, size_bytes, created_at
    FROM asset_files
    WHERE asset_id = ${assetId}
    ORDER BY created_at DESC
  `)

  return rows.map(toAssetFile)
}

export async function createAssetFileRecord(input: {
  assetId: string
  kind: AssetFileKind
  originalName: string
  mimeType: string
  sizeBytes: number
  storageKey: string
}): Promise<AssetFile> {
  await ensureCoreSchema()

  const fileId = makeId("FILE")
  await runQuery(sql`
    INSERT INTO asset_files (id, asset_id, kind, original_name, mime_type, size_bytes, storage_key)
    VALUES (${fileId}, ${input.assetId}, ${input.kind}, ${input.originalName}, ${input.mimeType}, ${input.sizeBytes}, ${input.storageKey})
  `)

  const created = await queryFirst<DbAssetFileRow>(sql`
    SELECT id, asset_id, kind, original_name, mime_type, size_bytes, created_at
    FROM asset_files
    WHERE id = ${fileId}
    LIMIT 1
  `)

  if (!created) {
    throw new Error("Failed to create asset file record")
  }

  return toAssetFile(created)
}

export async function getAssetFileById(assetId: string, fileId: string): Promise<(AssetFile & { storageKey: string }) | null> {
  await ensureCoreSchema()

  const row = await queryFirst<DbAssetFileRow & { storage_key: string }>(sql`
    SELECT id, asset_id, kind, original_name, mime_type, size_bytes, created_at, storage_key
    FROM asset_files
    WHERE asset_id = ${assetId} AND id = ${fileId}
    LIMIT 1
  `)

  if (!row) {
    return null
  }

  return {
    ...toAssetFile(row),
    storageKey: row.storage_key,
  }
}

export async function deleteAssetFileRecord(assetId: string, fileId: string): Promise<{ storageKey: string } | null> {
  await ensureCoreSchema()

  const row = await queryFirst<{ storage_key: string }>(sql`
    SELECT storage_key
    FROM asset_files
    WHERE asset_id = ${assetId} AND id = ${fileId}
    LIMIT 1
  `)

  if (!row) {
    return null
  }

  await runQuery(sql`
    DELETE FROM asset_files
    WHERE asset_id = ${assetId} AND id = ${fileId}
  `)

  return { storageKey: row.storage_key }
}

export async function listMembers(): Promise<TeamMember[]> {
  await ensureCoreSchema()

  const rows = await queryRows<{
    id: string
    name: string
    email: string
    role: TeamRole
    assets_assigned: number | string
  }>(sql`
    SELECT
      m.id,
      m.name,
      m.email,
      m.role,
      CAST(COUNT(a.id) AS INTEGER) AS assets_assigned
    FROM members m
    LEFT JOIN assets a ON m.id = a.assigned_member_id
    GROUP BY m.id, m.name, m.email, m.role
    ORDER BY m.name ASC
  `)

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatar: toInitials(row.name),
    assetsAssigned: Number(row.assets_assigned ?? 0),
  }))
}

export async function findMemberIdByEmail(email: string): Promise<string | null> {
  await ensureCoreSchema()

  const row = await queryFirst<{ id: string }>(sql`
    SELECT id
    FROM members
    WHERE lower(email) = ${email.toLowerCase()}
    LIMIT 1
  `)

  return row?.id ?? null
}

export async function createMember(input: { name: string; email: string; role: TeamRole }): Promise<TeamMember> {
  await ensureCoreSchema()

  const id = makeId("MEM")

  await runQuery(sql`
    INSERT INTO members (id, name, email, role)
    VALUES (${id}, ${input.name}, ${input.email}, ${input.role})
  `)

  return {
    id,
    name: input.name,
    email: input.email,
    role: input.role,
    avatar: toInitials(input.name),
    assetsAssigned: 0,
  }
}

export async function getMemberProfile(memberId: string): Promise<{
  member: TeamMember
  assignedAssets: Array<{
    id: string
    name: string
    category: AssetCategory
    status: AssetStatus
    location: string
    borrowedAt: string | null
    dueAt: string | null
  }>
  loanHistory: LoanRecord[]
} | null> {
  await ensureCoreSchema()

  const member = await queryFirst<{
    id: string
    name: string
    email: string
    role: TeamRole
    assets_assigned: number | string
  }>(sql`
    SELECT
      m.id,
      m.name,
      m.email,
      m.role,
      CAST(COUNT(a.id) AS INTEGER) AS assets_assigned
    FROM members m
    LEFT JOIN assets a ON m.id = a.assigned_member_id
    WHERE m.id = ${memberId}
    GROUP BY m.id, m.name, m.email, m.role
    LIMIT 1
  `)

  if (!member) {
    return null
  }

  const assignedAssets = await queryRows<{
    id: string
    name: string
    category: AssetCategory
    status: AssetStatus
    location_name: string | null
    borrowed_at: string | null
    due_at: string | null
  }>(sql`
    SELECT
      a.id,
      a.name,
      a.category,
      a.status,
      CASE
        WHEN l.floor_number IS NOT NULL AND TRIM(l.floor_number) <> '' AND l.room_number IS NOT NULL AND TRIM(l.room_number) <> ''
          THEN l.floor_number || '.' || l.room_number || ' ' || l.name
        WHEN l.room_number IS NOT NULL AND TRIM(l.room_number) <> ''
          THEN l.room_number || ' ' || l.name
        WHEN l.floor_number IS NOT NULL AND TRIM(l.floor_number) <> ''
          THEN l.floor_number || ' ' || l.name
        ELSE l.name
      END AS location_name,
      open_loan.borrowed_at,
      open_loan.due_at
    FROM assets a
    LEFT JOIN locations l ON a.location_id = l.id
    LEFT JOIN loans open_loan ON open_loan.asset_id = a.id
      AND open_loan.member_id = ${memberId}
      AND open_loan.returned_at IS NULL
    WHERE a.assigned_member_id = ${memberId}
    ORDER BY a.name ASC
  `)

  const loanRows = await queryRows<{
    id: string
    asset_id: string
    member_id: string
    asset_name: string
    member_name: string
    borrowed_at: string
    due_at: string | null
    returned_at: string | null
  }>(sql`
    SELECT
      l.id,
      l.asset_id,
      l.member_id,
      a.name AS asset_name,
      m.name AS member_name,
      l.borrowed_at,
      l.due_at,
      l.returned_at
    FROM loans l
    JOIN assets a ON l.asset_id = a.id
    JOIN members m ON l.member_id = m.id
    WHERE l.member_id = ${memberId}
    ORDER BY l.borrowed_at DESC
  `)

  return {
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      avatar: toInitials(member.name),
      assetsAssigned: Number(member.assets_assigned ?? 0),
    },
    assignedAssets: assignedAssets.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      status: row.status,
      location: row.location_name ?? "Unassigned",
      borrowedAt: row.borrowed_at ? new Date(row.borrowed_at).toISOString() : null,
      dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
    })),
    loanHistory: loanRows.map((row) => ({
      id: row.id,
      assetId: row.asset_id,
      memberId: row.member_id,
      assetName: row.asset_name,
      memberName: row.member_name,
      borrowedAt: new Date(row.borrowed_at).toISOString(),
      dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
      returnedAt: row.returned_at ? new Date(row.returned_at).toISOString() : null,
    })),
  }
}

export async function upsertMemberByEmail(input: { name: string; email: string; role: TeamRole }): Promise<TeamMember> {
  await ensureCoreSchema()

  const normalizedEmail = input.email.toLowerCase()
  const existing = await queryFirst<{ id: string; role: string; name: string }>(sql`
    SELECT id, role, name
    FROM members
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `)

  if (existing) {
    const previousRole: TeamRole = existing.role === "admin" ? "admin" : "member"

    await runQuery(sql`
      UPDATE members
      SET
        name = ${input.name},
        role = ${input.role}
      WHERE id = ${existing.id}
    `)

    if (previousRole !== input.role) {
      await notifyMemberRoleChanged({
        memberId: existing.id,
        memberName: input.name,
        fromRole: previousRole,
        toRole: input.role,
      })
    }

    const updated = await queryFirst<{
      id: string
      name: string
      email: string
      role: TeamRole
      assets_assigned: number | string
    }>(sql`
      SELECT
        m.id,
        m.name,
        m.email,
        m.role,
        CAST(COUNT(a.id) AS INTEGER) AS assets_assigned
      FROM members m
      LEFT JOIN assets a ON m.id = a.assigned_member_id
      WHERE m.id = ${existing.id}
      GROUP BY m.id, m.name, m.email, m.role
      LIMIT 1
    `)

    if (updated) {
      return {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        avatar: toInitials(updated.name),
        assetsAssigned: Number(updated.assets_assigned ?? 0),
      }
    }
  }

  return createMember({
    name: input.name,
    email: normalizedEmail,
    role: input.role,
  })
}

export async function listLocations(): Promise<LocationData[]> {
  await ensureCoreSchema()

  const rows = await queryRows<DbLocationRow>(sql`
    SELECT
      l.id,
      l.name,
      l.address,
      l.address_id,
      COALESCE(ad.address_line1, l.address_line1) AS address_line1,
      COALESCE(ad.address_line2, l.address_line2) AS address_line2,
      COALESCE(ad.city, l.city) AS city,
      COALESCE(ad.postal_code, l.postal_code) AS postal_code,
      COALESCE(ad.country, l.country) AS country,
      l.floor_number,
      l.room_number,
      l.kind,
      l.parent_id,
      CAST(COUNT(a.id) AS INTEGER) AS direct_asset_count
    FROM locations l
    LEFT JOIN addresses ad ON ad.id = l.address_id
    LEFT JOIN assets a ON l.id = a.location_id
    GROUP BY l.id, l.name, l.address, l.address_id, COALESCE(ad.address_line1, l.address_line1), COALESCE(ad.address_line2, l.address_line2), COALESCE(ad.city, l.city), COALESCE(ad.postal_code, l.postal_code), COALESCE(ad.country, l.country), l.floor_number, l.room_number, l.kind, l.parent_id
    ORDER BY l.name ASC
  `)

  const base = rows.map((row) => ({
    id: row.id,
    name: row.name,
    address: formatLocationAddress({
      line1: row.address_line1,
      line2: row.address_line2,
      city: row.city,
      postalCode: row.postal_code,
      country: row.country,
      fallback: row.address,
    }),
    addressId: row.address_id,
    addressLine1: row.address_line1 ?? "",
    addressLine2: row.address_line2,
    city: row.city ?? "",
    postalCode: row.postal_code ?? "",
    country: row.country ?? "",
    floorNumber: row.floor_number,
    roomNumber: row.room_number,
    locationCode: buildLocationCode(row.floor_number, row.room_number),
    kind: (row.kind ?? "building") as LocationKind,
    parentId: row.parent_id,
    directAssetCount: Number(row.direct_asset_count ?? 0),
  }))

  const byId = new Map(base.map((entry) => [entry.id, entry]))
  const children = new Map<string, string[]>()
  for (const entry of base) {
    if (!entry.parentId) {
      continue
    }
    const existing = children.get(entry.parentId) ?? []
    existing.push(entry.id)
    children.set(entry.parentId, existing)
  }

  const metaCache = new Map<string, { level: number; path: string }>()

  const getMeta = (id: string): { level: number; path: string } => {
    const cached = metaCache.get(id)
    if (cached) {
      return cached
    }

    const node = byId.get(id)
    if (!node) {
      return { level: 0, path: "" }
    }

    if (!node.parentId || !byId.has(node.parentId)) {
      const rootMeta = {
        level: 0,
        path: locationPathLabel({ name: node.name, floorNumber: node.floorNumber, roomNumber: node.roomNumber }),
      }
      metaCache.set(id, rootMeta)
      return rootMeta
    }

    const parentMeta = getMeta(node.parentId)
    const meta = {
      level: parentMeta.level + 1,
      path: `${parentMeta.path} / ${locationPathLabel({ name: node.name, floorNumber: node.floorNumber, roomNumber: node.roomNumber })}`,
    }
    metaCache.set(id, meta)
    return meta
  }

  const totalCache = new Map<string, number>()
  const getTotalAssets = (id: string): number => {
    const cached = totalCache.get(id)
    if (cached !== undefined) {
      return cached
    }
    const node = byId.get(id)
    if (!node) {
      return 0
    }
    const childIds = children.get(id) ?? []
    const total = node.directAssetCount + childIds.reduce((sum, childId) => sum + getTotalAssets(childId), 0)
    totalCache.set(id, total)
    return total
  }

  const roots = base
    .filter((entry) => !entry.parentId || !byId.has(entry.parentId))
    .sort((left, right) => left.name.localeCompare(right.name))

  const ordered: LocationData[] = []

  const walk = (id: string) => {
    const node = byId.get(id)
    if (!node) {
      return
    }

    const meta = getMeta(id)
    ordered.push({
      id: node.id,
      name: node.name,
      address: node.address,
      addressId: node.addressId,
      addressLine1: node.addressLine1,
      addressLine2: node.addressLine2,
      city: node.city,
      postalCode: node.postalCode,
      country: node.country,
      floorNumber: node.floorNumber,
      roomNumber: node.roomNumber,
      locationCode: node.locationCode,
      kind: node.kind,
      parentId: node.parentId,
      level: meta.level,
      path: meta.path,
      directAssetCount: node.directAssetCount,
      assetCount: getTotalAssets(id),
    })

    const childIds = (children.get(id) ?? [])
      .slice()
      .sort((left, right) => {
        const leftNode = byId.get(left)
        const rightNode = byId.get(right)
        return (leftNode?.name ?? "").localeCompare(rightNode?.name ?? "")
      })

    for (const childId of childIds) {
      walk(childId)
    }
  }

  for (const root of roots) {
    walk(root.id)
  }

  return ordered
}

export async function getLocationById(id: string): Promise<LocationData | null> {
  const locations = await listLocations()
  return locations.find((location) => location.id === id) ?? null
}

export async function listAssetsByLocationTree(locationId: string): Promise<Asset[]> {
  await ensureCoreSchema()

  const rows = await queryRows<DbAsset>(sql`
    WITH RECURSIVE location_tree(id) AS (
      SELECT id FROM locations WHERE id = ${locationId}
      UNION ALL
      SELECT l.id
      FROM locations l
      INNER JOIN location_tree t ON l.parent_id = t.id
    )
    SELECT
      a.id,
      a.name,
      a.category,
      a.status,
      a.location_id,
      a.producer_id,
      p.name AS producer_name,
      a.model,
      a.serial_number,
      a.sku,
      a.supplier,
      a.warranty_until,
      a.asset_condition,
      a.quantity,
      a.minimum_quantity,
      a.notes,
      CASE
        WHEN l.floor_number IS NOT NULL AND TRIM(l.floor_number) <> '' AND l.room_number IS NOT NULL AND TRIM(l.room_number) <> ''
          THEN l.floor_number || '.' || l.room_number || ' ' || l.name
        WHEN l.room_number IS NOT NULL AND TRIM(l.room_number) <> ''
          THEN l.room_number || ' ' || l.name
        WHEN l.floor_number IS NOT NULL AND TRIM(l.floor_number) <> ''
          THEN l.floor_number || ' ' || l.name
        ELSE l.name
      END AS location_name,
      m.name AS assigned_member_name,
      a.qr_code,
      a.value,
      a.purchase_date,
      a.last_scanned,
      a.tags,
      (
        SELECT af.id
        FROM asset_files af
        WHERE af.asset_id = a.id AND (af.kind = 'image' OR af.mime_type LIKE 'image/%')
        ORDER BY af.created_at ASC
        LIMIT 1
      ) AS thumbnail_file_id
    FROM assets a
    LEFT JOIN producers p ON a.producer_id = p.id
    LEFT JOIN locations l ON a.location_id = l.id
    LEFT JOIN members m ON a.assigned_member_id = m.id
    WHERE a.location_id IN (SELECT id FROM location_tree)
    ORDER BY a.created_at DESC
  `)

  return rows.map(toAsset)
}

export async function createLocation(input: {
  name: string
  addressId?: string | null
  address?: string
  addressLine1?: string
  addressLine2?: string | null
  city?: string
  postalCode?: string
  country?: string
  floorNumber?: string | null
  roomNumber?: string | null
  parentId?: string | null
  kind?: LocationKind
}): Promise<LocationData> {
  await ensureCoreSchema()

  let linkedAddress: AddressRecord | null = null
  if (input.addressId) {
    linkedAddress = (await listAddresses()).find((entry) => entry.id === input.addressId) ?? null
    if (!linkedAddress) {
      throw new Error("Address not found")
    }
  }

  const addressLine1 = linkedAddress?.addressLine1 || input.addressLine1?.trim() || input.address?.trim() || ""
  const addressLine2 = linkedAddress?.addressLine2 || input.addressLine2?.trim() || null
  const city = linkedAddress?.city || input.city?.trim() || ""
  const postalCode = linkedAddress?.postalCode || input.postalCode?.trim() || ""
  const country = linkedAddress?.country || input.country?.trim() || ""
  const floorNumber = input.floorNumber?.trim() || null
  const roomNumber = input.roomNumber?.trim() || null
  const displayAddress = formatLocationAddress({ line1: addressLine1, line2: addressLine2, city, postalCode, country })

  const id = makeId("LOC")
  await runQuery(sql`
    INSERT INTO locations (id, name, address, address_id, address_line1, address_line2, city, postal_code, country, floor_number, room_number, parent_id, kind)
    VALUES (
      ${id},
      ${input.name},
      ${displayAddress},
      ${input.addressId ?? null},
      ${addressLine1 || null},
      ${addressLine2},
      ${city || null},
      ${postalCode || null},
      ${country || null},
      ${floorNumber},
      ${roomNumber},
      ${input.parentId ?? null},
      ${input.kind ?? "building"}
    )
  `)

  const all = await listLocations()
  const created = all.find((location) => location.id === id)
  if (!created) {
    throw new Error("Failed to create location")
  }
  return created
}

export async function updateLocation(
  id: string,
  input: {
    name: string
    addressId?: string | null
    address?: string
    addressLine1?: string
    addressLine2?: string | null
    city?: string
    postalCode?: string
    country?: string
    floorNumber?: string | null
    roomNumber?: string | null
    parentId?: string | null
    kind?: LocationKind
  },
): Promise<LocationData | null> {
  await ensureCoreSchema()

  let linkedAddress: AddressRecord | null = null
  if (input.addressId) {
    linkedAddress = (await listAddresses()).find((entry) => entry.id === input.addressId) ?? null
    if (!linkedAddress) {
      throw new Error("Address not found")
    }
  }

  const addressLine1 = linkedAddress?.addressLine1 || input.addressLine1?.trim() || input.address?.trim() || ""
  const addressLine2 = linkedAddress?.addressLine2 || input.addressLine2?.trim() || null
  const city = linkedAddress?.city || input.city?.trim() || ""
  const postalCode = linkedAddress?.postalCode || input.postalCode?.trim() || ""
  const country = linkedAddress?.country || input.country?.trim() || ""
  const floorNumber = input.floorNumber?.trim() || null
  const roomNumber = input.roomNumber?.trim() || null
  const displayAddress = formatLocationAddress({ line1: addressLine1, line2: addressLine2, city, postalCode, country })

  const existing = await queryFirst<{ id: string }>(sql`
    SELECT id
    FROM locations
    WHERE id = ${id}
    LIMIT 1
  `)

  if (!existing) {
    return null
  }

  if (input.parentId === id) {
    throw new Error("Location cannot be its own parent")
  }

  await runQuery(sql`
    UPDATE locations
    SET
      name = ${input.name},
      address = ${displayAddress},
      address_id = ${input.addressId ?? null},
      address_line1 = ${addressLine1 || null},
      address_line2 = ${addressLine2},
      city = ${city || null},
      postal_code = ${postalCode || null},
      country = ${country || null},
      floor_number = ${floorNumber},
      room_number = ${roomNumber},
      parent_id = ${input.parentId ?? null},
      kind = ${input.kind ?? "building"}
    WHERE id = ${id}
  `)

  const all = await listLocations()
  return all.find((location) => location.id === id) ?? null
}

export async function deleteLocation(id: string): Promise<boolean> {
  await ensureCoreSchema()

  const existing = await queryFirst<{ id: string }>(sql`
    SELECT id
    FROM locations
    WHERE id = ${id}
    LIMIT 1
  `)

  if (!existing) {
    return false
  }

  await runQuery(sql`
    UPDATE assets
    SET location_id = ${null}
    WHERE location_id = ${id}
  `)

  await runQuery(sql`
    DELETE FROM locations
    WHERE id = ${id}
  `)

  return true
}

export async function borrowAsset(input: {
  assetId: string
  memberId: string
  dueAt?: string
  notes?: string
}): Promise<Asset | null> {
  await ensureCoreSchema()

  const currentAsset = await queryFirst<{ status: AssetStatus }>(sql`
    SELECT status
    FROM assets
    WHERE id = ${input.assetId}
    LIMIT 1
  `)

  if (!currentAsset) {
    return null
  }

  if (currentAsset.status === "retired") {
    throw new Error("Retired assets cannot be borrowed")
  }

  await runQuery(sql`
    UPDATE loans
    SET returned_at = ${new Date().toISOString()}
    WHERE asset_id = ${input.assetId} AND returned_at IS NULL
  `)

  await runQuery(sql`
    INSERT INTO loans (id, asset_id, member_id, borrowed_at, due_at, notes)
    VALUES (
      ${makeId("LOAN")},
      ${input.assetId},
      ${input.memberId},
      ${new Date().toISOString()},
      ${input.dueAt ? new Date(input.dueAt).toISOString() : null},
      ${input.notes ?? null}
    )
  `)

  await runQuery(sql`
    UPDATE assets
    SET
      assigned_member_id = ${input.memberId},
      status = ${"in-use"},
      last_scanned = ${todayIso()}
    WHERE id = ${input.assetId}
  `)

  return getAssetById(input.assetId)
}

export async function returnAsset(assetId: string): Promise<Asset | null> {
  await ensureCoreSchema()

  const exists = await queryFirst<{ id: string }>(sql`SELECT id FROM assets WHERE id = ${assetId} LIMIT 1`)
  if (!exists) {
    return null
  }

  await runQuery(sql`
    UPDATE loans
    SET returned_at = ${new Date().toISOString()}
    WHERE asset_id = ${assetId} AND returned_at IS NULL
  `)

  await runQuery(sql`
    UPDATE assets
    SET
      assigned_member_id = ${null},
      status = ${"available"},
      last_scanned = ${todayIso()}
    WHERE id = ${assetId}
  `)

  return getAssetById(assetId)
}

export async function listLoans(): Promise<LoanRecord[]> {
  await ensureCoreSchema()

  const rows = await queryRows<{
    id: string
    asset_id: string
    member_id: string
    asset_name: string
    member_name: string
    borrowed_at: string
    due_at: string | null
    returned_at: string | null
  }>(sql`
    SELECT
      l.id,
      l.asset_id,
      l.member_id,
      a.name AS asset_name,
      m.name AS member_name,
      l.borrowed_at,
      l.due_at,
      l.returned_at
    FROM loans l
    JOIN assets a ON l.asset_id = a.id
    JOIN members m ON l.member_id = m.id
    ORDER BY l.borrowed_at DESC
  `)

  return rows.map((row) => ({
    id: row.id,
    assetId: row.asset_id,
    memberId: row.member_id,
    assetName: row.asset_name,
    memberName: row.member_name,
    borrowedAt: new Date(row.borrowed_at).toISOString(),
    dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
    returnedAt: row.returned_at ? new Date(row.returned_at).toISOString() : null,
  }))
}

export async function listIncidents(input?: {
  assetId?: string
  status?: IncidentStatus | "all" | null
  search?: string
}): Promise<IncidentRecord[]> {
  await ensureCoreSchema()

  const rows = await queryRows<DbIncidentRow>(sql`
    SELECT
      i.id,
      i.asset_id,
      a.name AS asset_name,
      i.incident_type,
      i.title,
      i.description,
      i.severity,
      i.status,
      i.reported_by,
      i.occurred_at,
      i.estimated_repair_cost,
      i.reported_at,
      i.resolved_at,
      i.resolution_notes,
      (
        SELECT CAST(COUNT(*) AS INTEGER)
        FROM incident_files f
        WHERE f.incident_id = i.id
      ) AS attachment_count,
      i.updated_at
    FROM incidents i
    JOIN assets a ON a.id = i.asset_id
    ORDER BY i.reported_at DESC
  `)

  const normalizedSearch = input?.search?.trim().toLowerCase() ?? ""
  const searchTerms = normalizedSearch
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  const filtered = rows.filter((row) => {
    const matchesAsset = !input?.assetId || row.asset_id === input.assetId
    const matchesStatus = !input?.status || input.status === "all" || row.status === input.status
    const searchable = `${row.id} ${row.asset_name} ${row.title} ${row.description} ${row.severity} ${row.status} ${row.reported_by}`.toLowerCase()
    const matchesSearch = searchTerms.length === 0 || searchTerms.every((term) => searchable.includes(term))

    return matchesAsset && matchesStatus && matchesSearch
  })

  return filtered.map(toIncidentRecord)
}

export async function listAssetIncidents(assetId: string): Promise<IncidentRecord[]> {
  return listIncidents({ assetId })
}

export async function createIncident(input: {
  assetId: string
  incidentType: IncidentType
  title: string
  description: string
  severity: IncidentSeverity
  occurredAt?: string | null
  estimatedRepairCost?: number | null
  reportedBy: string
}): Promise<IncidentRecord> {
  await ensureCoreSchema()

  const asset = await getAssetById(input.assetId)
  if (!asset) {
    throw new Error("Asset not found")
  }

  const id = makeId("INC")
  await runQuery(sql`
    INSERT INTO incidents (
      id,
      asset_id,
      incident_type,
      title,
      description,
      severity,
      status,
      reported_by,
      occurred_at,
      estimated_repair_cost,
      reported_at,
      updated_at
    ) VALUES (
      ${id},
      ${input.assetId},
      ${input.incidentType},
      ${input.title.trim()},
      ${input.description.trim()},
      ${input.severity},
      ${"open"},
      ${input.reportedBy.trim() || "System"},
      ${input.occurredAt?.trim() ? new Date(input.occurredAt).toISOString() : null},
      ${input.estimatedRepairCost ?? null},
      ${new Date().toISOString()},
      ${new Date().toISOString()}
    )
  `)

  const created = (await listIncidents()).find((entry) => entry.id === id)
  if (!created) {
    throw new Error("Failed to create incident")
  }

  return created
}

export async function updateIncident(
  id: string,
  input: {
    assetId?: string
    status?: IncidentStatus
    incidentType?: IncidentType
    severity?: IncidentSeverity
    title?: string
    description?: string
    occurredAt?: string | null
    estimatedRepairCost?: number | null
    resolutionNotes?: string | null
  },
): Promise<IncidentRecord | null> {
  await ensureCoreSchema()

  const existing = await queryFirst<{
    id: string
    asset_id: string
    status: IncidentStatus
    incident_type: IncidentType
    severity: IncidentSeverity
    title: string
    description: string
    occurred_at: string | null
    estimated_repair_cost: number | string | null
    resolution_notes: string | null
  }>(sql`
    SELECT id, asset_id, status, incident_type, severity, title, description, occurred_at, estimated_repair_cost, resolution_notes
    FROM incidents
    WHERE id = ${id}
    LIMIT 1
  `)

  if (!existing) {
    return null
  }

  const nextAssetId = input.assetId?.trim() || existing.asset_id
  const nextStatus = input.status ?? existing.status
  const nextIncidentType = input.incidentType ?? existing.incident_type
  const nextSeverity = input.severity ?? existing.severity
  const nextTitle = input.title?.trim() || existing.title
  const nextDescription = input.description?.trim() || existing.description
  const nextOccurredAt = input.occurredAt === undefined
    ? existing.occurred_at
    : (input.occurredAt?.trim() ? new Date(input.occurredAt).toISOString() : null)
  const nextEstimatedRepairCost = input.estimatedRepairCost === undefined
    ? (existing.estimated_repair_cost === null ? null : Number(existing.estimated_repair_cost))
    : input.estimatedRepairCost
  const resolvedAt = nextStatus === "resolved" ? new Date().toISOString() : null
  const nextResolutionNotes = input.resolutionNotes === undefined
    ? existing.resolution_notes
    : (input.resolutionNotes?.trim() || null)

  if (nextAssetId !== existing.asset_id) {
    const linkedAsset = await getAssetById(nextAssetId)
    if (!linkedAsset) {
      throw new Error("Linked asset not found")
    }
  }

  await runQuery(sql`
    UPDATE incidents
    SET
      asset_id = ${nextAssetId},
      status = ${nextStatus},
      incident_type = ${nextIncidentType},
      severity = ${nextSeverity},
      title = ${nextTitle},
      description = ${nextDescription},
      occurred_at = ${nextOccurredAt},
      estimated_repair_cost = ${nextEstimatedRepairCost},
      resolved_at = ${resolvedAt},
      resolution_notes = ${nextResolutionNotes},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${id}
  `)

  return (await listIncidents()).find((entry) => entry.id === id) ?? null
}

export async function deleteIncident(id: string): Promise<{ incident: IncidentRecord; storageKeys: string[] } | null> {
  await ensureCoreSchema()

  const incident = (await listIncidents()).find((entry) => entry.id === id)
  if (!incident) {
    return null
  }

  const fileRows = await queryRows<{ storage_key: string }>(sql`
    SELECT storage_key
    FROM incident_files
    WHERE incident_id = ${id}
  `)

  await runQuery(sql`
    DELETE FROM incidents
    WHERE id = ${id}
  `)

  return {
    incident,
    storageKeys: fileRows.map((row) => row.storage_key),
  }
}

export async function listIncidentFiles(incidentId: string): Promise<IncidentFile[]> {
  await ensureCoreSchema()

  const rows = await queryRows<DbIncidentFileRow>(sql`
    SELECT id, incident_id, kind, original_name, mime_type, size_bytes, created_at
    FROM incident_files
    WHERE incident_id = ${incidentId}
    ORDER BY created_at DESC
  `)

  return rows.map(toIncidentFile)
}

export async function createIncidentFileRecord(input: {
  incidentId: string
  kind: IncidentFileKind
  originalName: string
  mimeType: string
  sizeBytes: number
  storageKey: string
}): Promise<IncidentFile> {
  await ensureCoreSchema()

  const fileId = makeId("IFILE")
  await runQuery(sql`
    INSERT INTO incident_files (id, incident_id, kind, original_name, mime_type, size_bytes, storage_key)
    VALUES (${fileId}, ${input.incidentId}, ${input.kind}, ${input.originalName}, ${input.mimeType}, ${input.sizeBytes}, ${input.storageKey})
  `)

  const created = await queryFirst<DbIncidentFileRow>(sql`
    SELECT id, incident_id, kind, original_name, mime_type, size_bytes, created_at
    FROM incident_files
    WHERE id = ${fileId}
    LIMIT 1
  `)

  if (!created) {
    throw new Error("Failed to create incident file record")
  }

  return toIncidentFile(created)
}

export async function getIncidentFileById(incidentId: string, fileId: string): Promise<(IncidentFile & { storageKey: string }) | null> {
  await ensureCoreSchema()

  const row = await queryFirst<DbIncidentFileRow & { storage_key: string }>(sql`
    SELECT id, incident_id, kind, original_name, mime_type, size_bytes, created_at, storage_key
    FROM incident_files
    WHERE incident_id = ${incidentId} AND id = ${fileId}
    LIMIT 1
  `)

  if (!row) {
    return null
  }

  return {
    ...toIncidentFile(row),
    storageKey: row.storage_key,
  }
}

export async function deleteIncidentFileRecord(incidentId: string, fileId: string): Promise<{ storageKey: string } | null> {
  await ensureCoreSchema()

  const row = await queryFirst<{ storage_key: string }>(sql`
    SELECT storage_key
    FROM incident_files
    WHERE incident_id = ${incidentId} AND id = ${fileId}
    LIMIT 1
  `)

  if (!row) {
    return null
  }

  await runQuery(sql`
    DELETE FROM incident_files
    WHERE incident_id = ${incidentId} AND id = ${fileId}
  `)

  return { storageKey: row.storage_key }
}

export async function getOpenLoanForAsset(assetId: string): Promise<{ memberId: string; memberName: string } | null> {
  await ensureCoreSchema()

  const row = await queryFirst<{ member_id: string; member_name: string }>(sql`
    SELECT l.member_id, m.name AS member_name
    FROM loans l
    JOIN members m ON m.id = l.member_id
    WHERE l.asset_id = ${assetId} AND l.returned_at IS NULL
    ORDER BY l.borrowed_at DESC
    LIMIT 1
  `)

  if (!row) {
    return null
  }

  return {
    memberId: row.member_id,
    memberName: row.member_name,
  }
}

export async function getAssetHistory(assetId: string): Promise<LoanRecord[]> {
  await ensureCoreSchema()

  const rows = await queryRows<{
    id: string
    asset_id: string
    member_id: string
    asset_name: string
    member_name: string
    borrowed_at: string
    due_at: string | null
    returned_at: string | null
  }>(sql`
    SELECT
      l.id,
      l.asset_id,
      l.member_id,
      a.name AS asset_name,
      m.name AS member_name,
      l.borrowed_at,
      l.due_at,
      l.returned_at
    FROM loans l
    JOIN assets a ON l.asset_id = a.id
    JOIN members m ON l.member_id = m.id
    WHERE l.asset_id = ${assetId}
    ORDER BY l.borrowed_at DESC
  `)

  return rows.map((row) => ({
    id: row.id,
    assetId: row.asset_id,
    memberId: row.member_id,
    assetName: row.asset_name,
    memberName: row.member_name,
    borrowedAt: new Date(row.borrowed_at).toISOString(),
    dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
    returnedAt: row.returned_at ? new Date(row.returned_at).toISOString() : null,
  }))
}

export async function listManagedCategories(): Promise<ManagedCategory[]> {
  await ensureCoreSchema()

  const rows = await queryRows<DbCategoryRow>(sql`
    SELECT
      c.id,
      c.name,
      CAST(COUNT(a.id) AS INTEGER) AS asset_count
    FROM categories c
    LEFT JOIN assets a ON a.category = c.name
    GROUP BY c.id, c.name
    ORDER BY c.name ASC
  `)

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    assetCount: Number(row.asset_count ?? 0),
  }))
}

export async function createCategory(name: string): Promise<ManagedCategory> {
  await ensureCoreSchema()

  const normalizedName = name.trim()
  if (!normalizedName) {
    throw new Error("Category name is required")
  }

  const id = makeId("CAT")
  await runQuery(sql`
    INSERT INTO categories (id, name)
    VALUES (${id}, ${normalizedName})
  `)

  return {
    id,
    name: normalizedName,
    assetCount: 0,
  }
}

export async function updateCategory(categoryId: string, name: string): Promise<ManagedCategory | null> {
  await ensureCoreSchema()

  const normalizedName = name.trim()
  if (!normalizedName) {
    throw new Error("Category name is required")
  }

  const existing = await queryFirst<{ id: string; name: string }>(sql`
    SELECT id, name
    FROM categories
    WHERE id = ${categoryId}
    LIMIT 1
  `)

  if (!existing) {
    return null
  }

  await runQuery(sql`
    UPDATE categories
    SET name = ${normalizedName}
    WHERE id = ${categoryId}
  `)

  if (existing.name !== normalizedName) {
    await runQuery(sql`
      UPDATE assets
      SET category = ${normalizedName}
      WHERE category = ${existing.name}
    `)
  }

  const updated = await queryFirst<DbCategoryRow>(sql`
    SELECT
      c.id,
      c.name,
      CAST(COUNT(a.id) AS INTEGER) AS asset_count
    FROM categories c
    LEFT JOIN assets a ON a.category = c.name
    WHERE c.id = ${categoryId}
    GROUP BY c.id, c.name
    LIMIT 1
  `)

  if (!updated) {
    return null
  }

  return {
    id: updated.id,
    name: updated.name,
    assetCount: Number(updated.asset_count ?? 0),
  }
}

export async function deleteCategory(categoryId: string): Promise<boolean> {
  await ensureCoreSchema()

  const existing = await queryFirst<{ id: string; name: string }>(sql`
    SELECT id, name
    FROM categories
    WHERE id = ${categoryId}
    LIMIT 1
  `)

  if (!existing) {
    return false
  }

  if (existing.name === "Uncategorized") {
    throw new Error("Uncategorized category cannot be deleted")
  }

  const uncategorized = await queryFirst<{ id: string; name: string }>(sql`
    SELECT id, name
    FROM categories
    WHERE name = ${"Uncategorized"}
    LIMIT 1
  `)

  if (!uncategorized) {
    await runQuery(sql`
      INSERT INTO categories (id, name)
      VALUES (${makeId("CAT")}, ${"Uncategorized"})
    `)
  }

  await runQuery(sql`
    UPDATE assets
    SET category = ${"Uncategorized"}
    WHERE category = ${existing.name}
  `)

  await runQuery(sql`
    DELETE FROM categories
    WHERE id = ${categoryId}
  `)

  return true
}

export async function getCategorySummary(): Promise<AssetCategorySummary[]> {
  await ensureCoreSchema()

  const rows = await queryRows<{ category: string; count: number | string }>(sql`
    SELECT
      c.name AS category,
      CAST(COUNT(a.id) AS INTEGER) AS count
    FROM categories c
    LEFT JOIN assets a ON a.category = c.name
    GROUP BY c.id, c.name
    ORDER BY c.name ASC
  `)

  return rows.map((row, index) => ({
    name: row.category,
    count: Number(row.count ?? 0),
    color: CATEGORY_COLORS[row.category] ?? `bg-chart-${(index % 5) + 1}`,
  }))
}

export async function getDashboardStats() {
  await ensureCoreSchema()

  const [assetsCount, membersCount, locationsCount, maintenanceCount, inventoryValueRow, statusRows, monthlyRows, categoryValueRows] = await Promise.all([
    tableCount("assets"),
    tableCount("members"),
    tableCount("locations"),
    queryFirst<CountRow>(sql`
      SELECT CAST(COUNT(*) AS INTEGER) AS count
      FROM assets
      WHERE status = ${"maintenance"}
    `),
    queryFirst<{ total_value: number | string }>(sql`
      SELECT COALESCE(SUM(value * COALESCE(quantity, 1)), 0) AS total_value
      FROM assets
    `),
    queryRows<{ status: AssetStatus; count: number | string }>(sql`
      SELECT status, CAST(COUNT(*) AS INTEGER) AS count
      FROM assets
      GROUP BY status
    `),
    queryRows<{ year_month: string; count: number | string }>(sql`
      SELECT SUBSTR(purchase_date, 1, 7) AS year_month, CAST(COUNT(*) AS INTEGER) AS count
      FROM assets
      WHERE purchase_date IS NOT NULL
      GROUP BY SUBSTR(purchase_date, 1, 7)
    `),
    queryRows<{ category: AssetCategory; total_value: number | string }>(sql`
      SELECT category, COALESCE(SUM(value * COALESCE(quantity, 1)), 0) AS total_value
      FROM assets
      GROUP BY category
    `),
  ])

  const statusMap = new Map(statusRows.map((row) => [row.status, Number(row.count ?? 0)]))
  const monthlyMap = new Map(monthlyRows.map((row) => [row.year_month, Number(row.count ?? 0)]))
  const categoryValueMap = new Map(categoryValueRows.map((row) => [row.category, Number(row.total_value ?? 0)]))

  const now = new Date()
  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" })
  const monthlyAssetGrowth = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    return {
      month: monthFormatter.format(date),
      assets: monthlyMap.get(key) ?? 0,
    }
  })

  const statusDistribution = [
    { name: "Available", key: "available" as const, color: "var(--color-success)" },
    { name: "In Use", key: "in-use" as const, color: "var(--color-chart-1)" },
    { name: "Maintenance", key: "maintenance" as const, color: "var(--color-warning)" },
    { name: "Retired", key: "retired" as const, color: "var(--color-muted-foreground)" },
  ].map((entry) => ({
    name: entry.name,
    value: statusMap.get(entry.key) ?? 0,
    color: entry.color,
  }))

  const inventoryValueByCategory = Array.from(categoryValueMap.entries())
    .map(([category, value]) => ({
      category,
      value: Math.round(value * 100) / 100,
    }))
    .sort((left, right) => right.value - left.value)

  return {
    totalAssets: assetsCount,
    activeUsers: membersCount,
    locations: locationsCount,
    maintenance: Number(maintenanceCount?.count ?? 0),
    inventoryValue: Number(inventoryValueRow?.total_value ?? 0),
    monthlyAssetGrowth,
    statusDistribution,
    inventoryValueByCategory,
  }
}

export async function listProducers(): Promise<Producer[]> {
  await ensureCoreSchema()

  const rows = await queryRows<DbProducerRow>(sql`
    SELECT id, name, website_url, domain, description, logo_url, source_url, created_at
    FROM producers
    ORDER BY created_at DESC
  `)

  return rows.map(toProducer)
}

export async function createProducer(input: {
  name: string
  websiteUrl: string
  domain: string
  description?: string | null
  logoUrl?: string | null
  sourceUrl: string
}): Promise<Producer> {
  await ensureCoreSchema()

  const existing = await queryFirst<DbProducerRow>(sql`
    SELECT id, name, website_url, domain, description, logo_url, source_url, created_at
    FROM producers
    WHERE website_url = ${input.websiteUrl}
    LIMIT 1
  `)

  if (existing) {
    await runQuery(sql`
      UPDATE producers
      SET
        name = ${input.name},
        domain = ${input.domain},
        description = ${input.description ?? null},
        logo_url = ${input.logoUrl ?? null},
        source_url = ${input.sourceUrl}
      WHERE id = ${existing.id}
    `)

    const updated = await queryFirst<DbProducerRow>(sql`
      SELECT id, name, website_url, domain, description, logo_url, source_url, created_at
      FROM producers
      WHERE id = ${existing.id}
      LIMIT 1
    `)
    if (!updated) {
      throw new Error("Failed to update producer")
    }
    return toProducer(updated)
  }

  const id = makeId("PROD")
  await runQuery(sql`
    INSERT INTO producers (id, name, website_url, domain, description, logo_url, source_url)
    VALUES (${id}, ${input.name}, ${input.websiteUrl}, ${input.domain}, ${input.description ?? null}, ${input.logoUrl ?? null}, ${input.sourceUrl})
  `)

  const created = await queryFirst<DbProducerRow>(sql`
    SELECT id, name, website_url, domain, description, logo_url, source_url, created_at
    FROM producers
    WHERE id = ${id}
    LIMIT 1
  `)

  if (!created) {
    throw new Error("Failed to create producer")
  }

  return toProducer(created)
}

export async function updateProducer(
  id: string,
  input: {
    name: string
    websiteUrl: string
    domain: string
    description?: string | null
    logoUrl?: string | null
    sourceUrl: string
  },
): Promise<Producer | null> {
  await ensureCoreSchema()

  const existing = await queryFirst<DbProducerRow>(sql`
    SELECT id, name, website_url, domain, description, logo_url, source_url, created_at
    FROM producers
    WHERE id = ${id}
    LIMIT 1
  `)

  if (!existing) {
    return null
  }

  await runQuery(sql`
    UPDATE producers
    SET
      name = ${input.name},
      website_url = ${input.websiteUrl},
      domain = ${input.domain},
      description = ${input.description ?? null},
      logo_url = ${input.logoUrl ?? null},
      source_url = ${input.sourceUrl}
    WHERE id = ${id}
  `)

  const updated = await queryFirst<DbProducerRow>(sql`
    SELECT id, name, website_url, domain, description, logo_url, source_url, created_at
    FROM producers
    WHERE id = ${id}
    LIMIT 1
  `)

  if (!updated) {
    throw new Error("Failed to update producer")
  }

  return toProducer(updated)
}

export async function deleteProducer(id: string): Promise<boolean> {
  await ensureCoreSchema()

  const existing = await queryFirst<{ id: string }>(sql`
    SELECT id
    FROM producers
    WHERE id = ${id}
    LIMIT 1
  `)

  if (!existing) {
    return false
  }

  await runQuery(sql`
    UPDATE assets
    SET producer_id = NULL
    WHERE producer_id = ${id}
  `)

  await runQuery(sql`
    DELETE FROM producers
    WHERE id = ${id}
  `)

  return true
}

export async function listAuthUsers(): Promise<AuthUser[]> {
  await ensureCoreSchema()

  const rows = await queryRows<DbAuthUserRow>(sql`
    SELECT id, oidc_issuer, oidc_sub, email, display_name, roles_json, active, source, created_at, updated_at
    FROM auth_users
    ORDER BY created_at DESC
  `)

  return rows.map(toAuthUser)
}

export async function findAuthUserBySubject(issuer: string, sub: string): Promise<AuthUser | null> {
  await ensureCoreSchema()

  const row = await queryFirst<DbAuthUserRow>(sql`
    SELECT id, oidc_issuer, oidc_sub, email, display_name, roles_json, active, source, created_at, updated_at
    FROM auth_users
    WHERE oidc_issuer = ${issuer} AND oidc_sub = ${sub}
    LIMIT 1
  `)

  return row ? toAuthUser(row) : null
}

export async function findAuthUserByEmail(email: string): Promise<AuthUser | null> {
  await ensureCoreSchema()

  const row = await queryFirst<DbAuthUserRow>(sql`
    SELECT id, oidc_issuer, oidc_sub, email, display_name, roles_json, active, source, created_at, updated_at
    FROM auth_users
    WHERE email = ${email.toLowerCase()}
    LIMIT 1
  `)

  return row ? toAuthUser(row) : null
}

export async function findAuthUserById(id: string): Promise<AuthUser | null> {
  await ensureCoreSchema()

  const row = await queryFirst<DbAuthUserRow>(sql`
    SELECT id, oidc_issuer, oidc_sub, email, display_name, roles_json, active, source, created_at, updated_at
    FROM auth_users
    WHERE id = ${id}
    LIMIT 1
  `)

  return row ? toAuthUser(row) : null
}

export async function updateAuthUserById(
  id: string,
  input: Partial<{ oidcSub: string; email: string; displayName: string; roles: string[]; active: boolean }>,
): Promise<AuthUser | null> {
  await ensureCoreSchema()

  const existing = await queryFirst<DbAuthUserRow>(sql`
    SELECT id, oidc_issuer, oidc_sub, email, display_name, roles_json, active, source, created_at, updated_at
    FROM auth_users
    WHERE id = ${id}
    LIMIT 1
  `)

  if (!existing) {
    return null
  }

  await runQuery(sql`
    UPDATE auth_users
    SET
      oidc_sub = ${input.oidcSub ?? existing.oidc_sub},
      email = ${input.email ? input.email.toLowerCase() : existing.email},
      display_name = ${input.displayName ?? existing.display_name},
      roles_json = ${input.roles ? JSON.stringify(input.roles) : existing.roles_json},
      active = ${typeof input.active === "boolean" ? (input.active ? 1 : 0) : existing.active},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `)

  const updated = await queryFirst<DbAuthUserRow>(sql`
    SELECT id, oidc_issuer, oidc_sub, email, display_name, roles_json, active, source, created_at, updated_at
    FROM auth_users
    WHERE id = ${id}
    LIMIT 1
  `)

  return updated ? toAuthUser(updated) : null
}

export async function deactivateAuthUserById(id: string): Promise<boolean> {
  await ensureCoreSchema()
  const existing = await queryFirst<{ id: string }>(sql`
    SELECT id
    FROM auth_users
    WHERE id = ${id}
    LIMIT 1
  `)

  if (!existing) {
    return false
  }

  await runQuery(sql`
    UPDATE auth_users
    SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `)
  return true
}

export async function bindOrCreateAuthUserFromOidc(input: {
  issuer: string
  sub: string
  email: string
  displayName: string
  roles: string[]
  jitCreate: boolean
}): Promise<AuthUser | null> {
  await ensureCoreSchema()

  const bySubject = await findAuthUserBySubject(input.issuer, input.sub)
  if (bySubject) {
    await updateAuthUserById(bySubject.id, {
      email: input.email,
      displayName: input.displayName,
      roles: input.roles,
      active: bySubject.active,
    })
    return (await findAuthUserBySubject(input.issuer, input.sub)) ?? bySubject
  }

  const byEmail = await findAuthUserByEmail(input.email)
  if (byEmail) {
    return await updateAuthUserById(byEmail.id, {
      oidcSub: input.sub,
      email: input.email,
      displayName: input.displayName,
      roles: input.roles,
    })
  }

  if (!input.jitCreate) {
    return null
  }

  const id = makeId("USR")
  await runQuery(sql`
    INSERT INTO auth_users (id, oidc_issuer, oidc_sub, email, display_name, roles_json, active, source)
    VALUES (${id}, ${input.issuer}, ${input.sub}, ${input.email.toLowerCase()}, ${input.displayName}, ${JSON.stringify(input.roles)}, 1, 'jit')
  `)

  const created = await queryFirst<DbAuthUserRow>(sql`
    SELECT id, oidc_issuer, oidc_sub, email, display_name, roles_json, active, source, created_at, updated_at
    FROM auth_users
    WHERE id = ${id}
    LIMIT 1
  `)

  return created ? toAuthUser(created) : null
}

export async function getLdapIntegrationSettings(): Promise<LdapIntegrationSettings> {
  await ensureCoreSchema()

  const row = await queryFirst<DbLdapSettingsRow>(sql`
    SELECT enabled, url, bind_dn, bind_password, base_dn, user_filter, username_attribute, email_attribute, name_attribute, default_role, sync_issuer, updated_at
    FROM ldap_integrations
    WHERE id = 1
    LIMIT 1
  `)

  return toLdapSettings(row ?? null)
}

export async function saveLdapIntegrationSettings(input: {
  enabled: boolean
  url: string
  bindDn: string
  bindPassword?: string
  baseDn: string
  userFilter: string
  usernameAttribute: string
  emailAttribute: string
  nameAttribute: string
  defaultRole: string
  syncIssuer: string
}): Promise<LdapIntegrationSettings> {
  await ensureCoreSchema()

  const existing = await queryFirst<{ bind_password: string | null }>(sql`
    SELECT bind_password
    FROM ldap_integrations
    WHERE id = 1
    LIMIT 1
  `)

  const bindPassword = input.bindPassword && input.bindPassword.length > 0
    ? input.bindPassword
    : (existing?.bind_password ?? null)

  await runQuery(sql`
    UPDATE ldap_integrations
    SET
      enabled = ${input.enabled ? 1 : 0},
      url = ${input.url.trim()},
      bind_dn = ${input.bindDn.trim()},
      bind_password = ${bindPassword},
      base_dn = ${input.baseDn.trim()},
      user_filter = ${input.userFilter.trim()},
      username_attribute = ${input.usernameAttribute.trim()},
      email_attribute = ${input.emailAttribute.trim()},
      name_attribute = ${input.nameAttribute.trim()},
      default_role = ${input.defaultRole.trim() || "member"},
      sync_issuer = ${input.syncIssuer.trim()},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `)

  return getLdapIntegrationSettings()
}

export async function getLdapIntegrationBindPassword(): Promise<string | null> {
  await ensureCoreSchema()

  const row = await queryFirst<{ bind_password: string | null }>(sql`
    SELECT bind_password
    FROM ldap_integrations
    WHERE id = 1
    LIMIT 1
  `)

  return row?.bind_password ?? null
}

export async function upsertAuthUserFromLdap(input: {
  issuer: string
  sub: string
  email: string
  displayName: string
  role: string
  active?: boolean
}): Promise<AuthUser> {
  await ensureCoreSchema()

  const existingBySubject = await findAuthUserBySubject(input.issuer, input.sub)
  if (existingBySubject) {
    const updated = await updateAuthUserById(existingBySubject.id, {
      email: input.email,
      displayName: input.displayName,
      roles: [input.role],
      active: input.active ?? true,
    })

    if (updated) {
      await runQuery(sql`
        UPDATE auth_users
        SET source = 'ldap', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${updated.id}
      `)
      return (await findAuthUserBySubject(input.issuer, input.sub)) ?? updated
    }
  }

  const existingByEmail = await findAuthUserByEmail(input.email)
  if (existingByEmail) {
    const updated = await updateAuthUserById(existingByEmail.id, {
      oidcSub: input.sub,
      email: input.email,
      displayName: input.displayName,
      roles: [input.role],
      active: input.active ?? true,
    })

    if (updated) {
      await runQuery(sql`
        UPDATE auth_users
        SET source = 'ldap', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${updated.id}
      `)
      return updated
    }
  }

  const id = makeId("USR")
  await runQuery(sql`
    INSERT INTO auth_users (id, oidc_issuer, oidc_sub, email, display_name, roles_json, active, source)
    VALUES (
      ${id},
      ${input.issuer},
      ${input.sub},
      ${input.email.toLowerCase()},
      ${input.displayName},
      ${JSON.stringify([input.role])},
      ${input.active === false ? 0 : 1},
      'ldap'
    )
  `)

  const created = await queryFirst<DbAuthUserRow>(sql`
    SELECT id, oidc_issuer, oidc_sub, email, display_name, roles_json, active, source, created_at, updated_at
    FROM auth_users
    WHERE id = ${id}
    LIMIT 1
  `)

  if (!created) {
    throw new Error("Failed to create LDAP-synced user")
  }

  return toAuthUser(created)
}
