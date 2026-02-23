export type AssetStatus = "available" | "in-use" | "maintenance" | "retired"
export type AssetCategory = string
export type TeamRole = "admin" | "member"

export type NotificationLevel = "info" | "warning" | "critical"
export type NotificationDelivery = "immediate" | "digest"

export interface NotificationRecord {
  id: string
  recipientMemberId: string
  type: string
  title: string
  message: string
  level: NotificationLevel
  delivery: NotificationDelivery
  linkUrl: string | null
  readAt: string | null
  createdAt: string
}

export interface ActivityRecord {
  id: string
  type: string
  actorMemberId: string | null
  actorName: string
  subjectType: "asset" | "location" | "booking" | "auth" | "settings" | "system" | "other"
  subjectId: string | null
  subjectName: string | null
  message: string
  createdAt: string
}

export interface Asset {
  id: string
  name: string
  parentAssetId?: string | null
  parentAssetName?: string | null
  category: AssetCategory
  status: AssetStatus
  producerId?: string | null
  producerName?: string | null
  model?: string | null
  serialNumber?: string | null
  sku?: string | null
  supplier?: string | null
  warrantyUntil?: string | null
  condition?: "new" | "good" | "fair" | "damaged"
  quantity?: number
  minimumQuantity?: number
  notes?: string | null
  locationId?: string | null
  location: string
  assignedTo: string | null
  qrCode: string
  value: number
  purchaseDate: string
  lastScanned: string
  tags: string[]
  thumbnailFileId?: string | null
}

export type AssetFileKind = "image" | "document"

export interface AssetFile {
  id: string
  assetId: string
  kind: AssetFileKind
  originalName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export interface Producer {
  id: string
  name: string
  websiteUrl: string
  domain: string
  description: string | null
  logoUrl: string | null
  sourceUrl: string
  createdAt: string
}

export interface AuthUser {
  id: string
  oidcIssuer: string
  oidcSub: string
  email: string
  displayName: string
  roles: string[]
  active: boolean
  source: "jit" | "ldap"
  createdAt: string
  updatedAt: string
}

export interface LdapIntegrationSettings {
  enabled: boolean
  url: string
  bindDn: string
  baseDn: string
  userFilter: string
  usernameAttribute: string
  emailAttribute: string
  nameAttribute: string
  defaultRole: string
  syncIssuer: string
  hasBindPassword: boolean
  updatedAt: string | null
}

export interface QrPublicSettings {
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
  updatedAt: string | null
}

export interface NotificationPreferences {
  checkoutAlerts: boolean
  maintenanceAlerts: boolean
  bookingAlerts: boolean
  digestEnabled: boolean
  lowInventoryAlerts: boolean
  updatedAt: string | null
}

export interface SecuritySettings {
  trustedProxies: string[]
  trustedDomains: string[]
  updatedAt: string | null
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: TeamRole
  avatar: string
  assetsAssigned: number
}

export interface LocationData {
  id: string
  name: string
  address: string
  addressId: string | null
  addressLine1: string
  addressLine2: string | null
  city: string
  postalCode: string
  country: string
  floorNumber: string | null
  roomNumber: string | null
  locationCode: string | null
  kind: LocationKind
  parentId: string | null
  level: number
  path: string
  directAssetCount: number
  assetCount: number
}

export interface AddressRecord {
  id: string
  label: string
  addressLine1: string
  addressLine2: string | null
  postalCode: string
  city: string
  country: string
  fullAddress: string
  locationCount: number
}

export type LocationKind = "building" | "floor" | "room" | "storage" | "area"

export interface LoanRecord {
  id: string
  assetId: string
  memberId: string
  assetName: string
  memberName: string
  borrowedAt: string
  dueAt: string | null
  returnedAt: string | null
}

export type IncidentSeverity = "low" | "medium" | "high" | "critical"
export type IncidentStatus = "open" | "investigating" | "resolved"
export type IncidentType = "damage" | "malfunction" | "loss" | "theft" | "safety" | "other"
export type IncidentFileKind = "image" | "document"

export interface IncidentFile {
  id: string
  incidentId: string
  kind: IncidentFileKind
  originalName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export interface IncidentRecord {
  id: string
  assetId: string
  assetName: string
  incidentType: IncidentType
  title: string
  description: string
  severity: IncidentSeverity
  status: IncidentStatus
  reportedBy: string
  occurredAt: string | null
  estimatedRepairCost: number | null
  reportedAt: string
  resolvedAt: string | null
  resolutionNotes: string | null
  attachmentCount: number
  updatedAt: string
}

export interface AssetCategorySummary {
  name: AssetCategory
  count: number
  color: string
}

export interface ManagedCategory {
  id: string
  name: string
  assetCount: number
}

export type EuropeanLocale =
  | "bg"
  | "cs"
  | "da"
  | "de"
  | "el"
  | "en"
  | "es"
  | "et"
  | "fi"
  | "fr"
  | "ga"
  | "hr"
  | "hu"
  | "it"
  | "lt"
  | "lv"
  | "mt"
  | "nl"
  | "pl"
  | "pt"
  | "ro"
  | "sk"
  | "sl"
  | "sv"

export interface SetupStatus {
  setupComplete: boolean
  appName: string
  organizationName: string
  locale: EuropeanLocale
  currency: string
}

export const ASSET_CATEGORIES = [
  "IT Equipment",
  "Electronics",
  "Furniture",
  "Audio/Video",
  "Tools",
  "Vehicles",
] as const

export const DEFAULT_UNCATEGORIZED_CATEGORY = "Uncategorized"

export const CATEGORY_COLORS: Record<string, string> = {
  "IT Equipment": "bg-chart-1",
  Electronics: "bg-chart-2",
  Furniture: "bg-chart-3",
  "Audio/Video": "bg-chart-4",
  Tools: "bg-chart-5",
  Vehicles: "bg-primary",
}
