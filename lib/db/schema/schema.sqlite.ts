import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const membersTable = sqliteTable("members", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  createdAt: text("created_at").notNull(),
})

export const addressesTable = sqliteTable("addresses", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  postalCode: text("postal_code").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  createdAt: text("created_at").notNull(),
})

export const locationsTable = sqliteTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  addressId: text("address_id"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  postalCode: text("postal_code"),
  country: text("country"),
  floorNumber: text("floor_number"),
  roomNumber: text("room_number"),
  parentId: text("parent_id"),
  kind: text("kind").notNull(),
  createdAt: text("created_at").notNull(),
})

export const producersTable = sqliteTable("producers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  websiteUrl: text("website_url").notNull(),
  domain: text("domain").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  sourceUrl: text("source_url").notNull(),
  createdAt: text("created_at").notNull(),
})

export const assetsTable = sqliteTable("assets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  parentAssetId: text("parent_asset_id"),
  category: text("category").notNull(),
  status: text("status").notNull(),
  producerId: text("producer_id"),
  model: text("model"),
  serialNumber: text("serial_number"),
  sku: text("sku"),
  supplier: text("supplier"),
  warrantyUntil: text("warranty_until"),
  assetCondition: text("asset_condition").notNull(),
  quantity: integer("quantity").notNull(),
  minimumQuantity: integer("minimum_quantity").notNull(),
  notes: text("notes"),
  locationId: text("location_id"),
  assignedMemberId: text("assigned_member_id"),
  qrCode: text("qr_code").notNull(),
  value: real("value").notNull(),
  purchaseDate: text("purchase_date").notNull(),
  lastScanned: text("last_scanned").notNull(),
  tags: text("tags").notNull(),
  createdAt: text("created_at").notNull(),
})

export const loansTable = sqliteTable("loans", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull(),
  memberId: text("member_id").notNull(),
  borrowedAt: text("borrowed_at").notNull(),
  dueAt: text("due_at"),
  returnedAt: text("returned_at"),
  notes: text("notes"),
})

export const incidentsTable = sqliteTable("incidents", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull(),
  incidentType: text("incident_type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  reportedBy: text("reported_by").notNull(),
  occurredAt: text("occurred_at"),
  estimatedRepairCost: real("estimated_repair_cost"),
  reportedAt: text("reported_at").notNull(),
  resolvedAt: text("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  updatedAt: text("updated_at").notNull(),
})

export const incidentFilesTable = sqliteTable("incident_files", {
  id: text("id").primaryKey(),
  incidentId: text("incident_id").notNull(),
  kind: text("kind").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(),
  createdAt: text("created_at").notNull(),
})

export const assetFilesTable = sqliteTable("asset_files", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull(),
  kind: text("kind").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(),
  createdAt: text("created_at").notNull(),
})

export const appSetupTable = sqliteTable("app_setup", {
  id: integer("id").primaryKey(),
  appName: text("app_name").notNull(),
  organizationName: text("organization_name").notNull(),
  defaultLocale: text("default_locale").notNull(),
  currency: text("currency").notNull(),
  setupCompletedAt: text("setup_completed_at"),
  createdAt: text("created_at").notNull(),
})

export const categoriesTable = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
})

export const adminUsersTable = sqliteTable("admin_users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
})

export const authUsersTable = sqliteTable("auth_users", {
  id: text("id").primaryKey(),
  oidcIssuer: text("oidc_issuer").notNull(),
  oidcSub: text("oidc_sub").notNull(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  rolesJson: text("roles_json").notNull(),
  active: integer("active").notNull(),
  source: text("source").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const ldapIntegrationsTable = sqliteTable("ldap_integrations", {
  id: integer("id").primaryKey(),
  enabled: integer("enabled").notNull(),
  url: text("url").notNull(),
  bindDn: text("bind_dn").notNull(),
  bindPassword: text("bind_password"),
  baseDn: text("base_dn").notNull(),
  userFilter: text("user_filter").notNull(),
  usernameAttribute: text("username_attribute").notNull(),
  emailAttribute: text("email_attribute").notNull(),
  nameAttribute: text("name_attribute").notNull(),
  defaultRole: text("default_role").notNull(),
  syncIssuer: text("sync_issuer").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const qrPublicSettingsTable = sqliteTable("qr_public_settings", {
  id: integer("id").primaryKey(),
  enabled: integer("enabled").notNull(),
  ownerLabel: text("owner_label").notNull(),
  publicMessage: text("public_message").notNull(),
  showLoginButton: integer("show_login_button").notNull(),
  loginButtonText: text("login_button_text").notNull(),
  selectedAddressId: text("selected_address_id"),
  logoUrl: text("logo_url").notNull(),
  contactPhone: text("contact_phone").notNull(),
  contactEmail: text("contact_email").notNull(),
  websiteUrl: text("website_url").notNull(),
  extraLinksJson: text("extra_links_json").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const notificationsTable = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  recipientMemberId: text("recipient_member_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  level: text("level").notNull(),
  delivery: text("delivery").notNull(),
  linkUrl: text("link_url"),
  eventKey: text("event_key"),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull(),
})

export const notificationPreferencesTable = sqliteTable("notification_preferences", {
  id: integer("id").primaryKey(),
  checkoutAlerts: integer("checkout_alerts").notNull(),
  maintenanceAlerts: integer("maintenance_alerts").notNull(),
  bookingAlerts: integer("booking_alerts").notNull(),
  digestEnabled: integer("digest_enabled").notNull(),
  lowInventoryAlerts: integer("low_inventory_alerts").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const securitySettingsTable = sqliteTable("security_settings", {
  id: integer("id").primaryKey(),
  trustedProxiesJson: text("trusted_proxies_json").notNull(),
  trustedDomainsJson: text("trusted_domains_json").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const activityEventsTable = sqliteTable("activity_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  actorMemberId: text("actor_member_id"),
  actorName: text("actor_name").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id"),
  subjectName: text("subject_name"),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
})
