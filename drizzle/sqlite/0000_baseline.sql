CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

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
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS producers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website_url TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  source_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

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
  FOREIGN KEY (producer_id) REFERENCES producers(id) ON DELETE SET NULL,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_asset_id) REFERENCES assets(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_member_id) REFERENCES members(id) ON DELETE SET NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_assets_parent_asset_id ON assets(parent_asset_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  borrowed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at TEXT,
  returned_at TEXT,
  notes TEXT,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);
--> statement-breakpoint

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
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_incidents_asset_reported ON incidents(asset_id, reported_at DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_incidents_status_reported ON incidents(status, reported_at DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS incident_files (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_incident_files_incident_created ON incident_files(incident_id, created_at DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS asset_files (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS app_setup (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  app_name TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  default_locale TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  setup_completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

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
);
--> statement-breakpoint

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
);
--> statement-breakpoint

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
);
--> statement-breakpoint

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
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_member_id, created_at DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_member_id, read_at, created_at DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS notification_preferences (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  checkout_alerts INTEGER NOT NULL DEFAULT 1,
  maintenance_alerts INTEGER NOT NULL DEFAULT 1,
  booking_alerts INTEGER NOT NULL DEFAULT 1,
  digest_enabled INTEGER NOT NULL DEFAULT 0,
  low_inventory_alerts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS security_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  trusted_proxies_json TEXT NOT NULL DEFAULT '[]',
  trusted_domains_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

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
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_activity_events_created ON activity_events(created_at DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_activity_events_type_created ON activity_events(type, created_at DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_activity_events_actor_created ON activity_events(actor_member_id, created_at DESC);
