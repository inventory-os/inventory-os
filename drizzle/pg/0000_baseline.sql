CREATE TABLE IF NOT EXISTS members (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS addresses (
  id text PRIMARY KEY,
  label text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  postal_code text NOT NULL,
  city text NOT NULL,
  country text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS locations (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  address text NOT NULL,
  address_id text REFERENCES addresses(id) ON DELETE SET NULL,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  country text,
  floor_number text,
  room_number text,
  parent_id text REFERENCES locations(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'building',
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS producers (
  id text PRIMARY KEY,
  name text NOT NULL,
  website_url text NOT NULL UNIQUE,
  domain text NOT NULL,
  description text,
  logo_url text,
  source_url text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS assets (
  id text PRIMARY KEY,
  name text NOT NULL,
  parent_asset_id text,
  category text NOT NULL,
  status text NOT NULL,
  producer_id text,
  model text,
  serial_number text,
  sku text,
  supplier text,
  warranty_until text,
  asset_condition text NOT NULL DEFAULT 'good',
  quantity integer NOT NULL DEFAULT 1,
  minimum_quantity integer NOT NULL DEFAULT 0,
  notes text,
  location_id text,
  assigned_member_id text,
  qr_code text NOT NULL UNIQUE,
  value real NOT NULL DEFAULT 0,
  purchase_date text NOT NULL,
  last_scanned text NOT NULL,
  tags text NOT NULL DEFAULT '[]',
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assets_producer FOREIGN KEY (producer_id) REFERENCES producers(id) ON DELETE SET NULL,
  CONSTRAINT fk_assets_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
  CONSTRAINT fk_assets_parent FOREIGN KEY (parent_asset_id) REFERENCES assets(id) ON DELETE SET NULL,
  CONSTRAINT fk_assets_member FOREIGN KEY (assigned_member_id) REFERENCES members(id) ON DELETE SET NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_assets_parent_asset_id ON assets(parent_asset_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS loans (
  id text PRIMARY KEY,
  asset_id text NOT NULL,
  member_id text NOT NULL,
  borrowed_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at text,
  returned_at text,
  notes text,
  CONSTRAINT fk_loans_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_loans_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS incidents (
  id text PRIMARY KEY,
  asset_id text NOT NULL,
  incident_type text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  reported_by text NOT NULL,
  occurred_at text,
  estimated_repair_cost real,
  reported_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at text,
  resolution_notes text,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_incidents_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_incidents_asset_reported ON incidents(asset_id, reported_at DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_incidents_status_reported ON incidents(status, reported_at DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS incident_files (
  id text PRIMARY KEY,
  incident_id text NOT NULL,
  kind text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  storage_key text NOT NULL UNIQUE,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_incident_files_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_incident_files_incident_created ON incident_files(incident_id, created_at DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS asset_files (
  id text PRIMARY KEY,
  asset_id text NOT NULL,
  kind text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  storage_key text NOT NULL UNIQUE,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_asset_files_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS app_setup (
  id integer PRIMARY KEY CHECK(id = 1),
  app_name text NOT NULL,
  organization_name text NOT NULL,
  default_locale text NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  setup_completed_at text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS admin_users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS auth_users (
  id text PRIMARY KEY,
  oidc_issuer text NOT NULL,
  oidc_sub text NOT NULL,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  roles_json text NOT NULL DEFAULT '["member"]',
  active integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'jit',
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(oidc_issuer, oidc_sub)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ldap_integrations (
  id integer PRIMARY KEY CHECK(id = 1),
  enabled integer NOT NULL DEFAULT 0,
  url text NOT NULL DEFAULT '',
  bind_dn text NOT NULL DEFAULT '',
  bind_password text,
  base_dn text NOT NULL DEFAULT '',
  user_filter text NOT NULL DEFAULT '(objectClass=person)',
  username_attribute text NOT NULL DEFAULT 'uid',
  email_attribute text NOT NULL DEFAULT 'mail',
  name_attribute text NOT NULL DEFAULT 'cn',
  default_role text NOT NULL DEFAULT 'member',
  sync_issuer text NOT NULL DEFAULT '',
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS qr_public_settings (
  id integer PRIMARY KEY CHECK(id = 1),
  enabled integer NOT NULL DEFAULT 1,
  owner_label text NOT NULL DEFAULT '',
  public_message text NOT NULL DEFAULT '',
  show_login_button integer NOT NULL DEFAULT 1,
  login_button_text text NOT NULL DEFAULT 'Login for more details',
  selected_address_id text REFERENCES addresses(id) ON DELETE SET NULL,
  logo_url text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  website_url text NOT NULL DEFAULT '',
  extra_links_json text NOT NULL DEFAULT '[]',
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  recipient_member_id text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  level text NOT NULL DEFAULT 'info',
  delivery text NOT NULL DEFAULT 'immediate',
  link_url text,
  event_key text UNIQUE,
  read_at text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_member_id, created_at DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_member_id, read_at, created_at DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS notification_preferences (
  id integer PRIMARY KEY CHECK(id = 1),
  checkout_alerts integer NOT NULL DEFAULT 1,
  maintenance_alerts integer NOT NULL DEFAULT 1,
  booking_alerts integer NOT NULL DEFAULT 1,
  digest_enabled integer NOT NULL DEFAULT 0,
  low_inventory_alerts integer NOT NULL DEFAULT 0,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS security_settings (
  id integer PRIMARY KEY CHECK(id = 1),
  trusted_proxies_json text NOT NULL DEFAULT '[]',
  trusted_domains_json text NOT NULL DEFAULT '[]',
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS activity_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  actor_member_id text REFERENCES members(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  subject_type text NOT NULL,
  subject_id text,
  subject_name text,
  message text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_activity_events_created ON activity_events(created_at DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_activity_events_type_created ON activity_events(type, created_at DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_activity_events_actor_created ON activity_events(actor_member_id, created_at DESC);
