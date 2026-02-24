import { randomUUID } from "node:crypto"
import { hash } from "bcryptjs"
import { runDatabaseMigrations } from "@/lib/db/migrations"
import { ASSET_CATEGORIES, type EuropeanLocale, type SetupStatus } from "@/lib/types"
import { queryFirst, queryRows, runQuery, sql } from "@/lib/db"

type CountRow = { count: number | string }

let schemaReady: Promise<void> | null = null

function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

async function tableCount(tableName: "assets" | "members" | "locations"): Promise<number> {
  const result = await queryFirst<CountRow>(sql.raw(`SELECT CAST(COUNT(*) AS INTEGER) AS count FROM ${tableName}`))
  return Number(result?.count ?? 0)
}

async function ensureSeedData() {
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
  await runQuery(sql`
		INSERT INTO ldap_integrations (id)
		VALUES (1)
		ON CONFLICT(id) DO NOTHING
	`)

  await runQuery(sql`
		INSERT INTO qr_public_settings (id)
		VALUES (1)
		ON CONFLICT(id) DO NOTHING
	`)

  await runQuery(sql`
		INSERT INTO notification_preferences (id)
		VALUES (1)
		ON CONFLICT(id) DO NOTHING
	`)

  await runQuery(sql`
		INSERT INTO security_settings (id)
		VALUES (1)
		ON CONFLICT(id) DO NOTHING
	`)
}

export async function ensureCoreSchema(): Promise<void> {
  if (schemaReady) {
    return schemaReady
  }

  schemaReady = (async () => {
    await runDatabaseMigrations()
    await ensureSeedData()
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
  const setupCompletedAt = new Date().toISOString()

  await runQuery(sql`
		INSERT INTO app_setup (id, app_name, organization_name, default_locale, currency, setup_completed_at)
		VALUES (1, ${input.appName}, ${input.organizationName}, ${input.locale}, ${"EUR"}, ${setupCompletedAt})
		ON CONFLICT(id) DO UPDATE SET
			app_name = ${input.appName},
			organization_name = ${input.organizationName},
			default_locale = ${input.locale},
			currency = ${"EUR"},
			setup_completed_at = ${setupCompletedAt}
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

  const setupCompletedAt = new Date().toISOString()

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
