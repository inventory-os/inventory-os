import path from "node:path"
import Database from "better-sqlite3"
import { drizzle as drizzleSqlite, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { sql, type SQL } from "drizzle-orm"
import { Pool } from "pg"

type DbClient = "pg" | "sqlite3"

const dbClient = (process.env.DB_CLIENT ?? (process.env.DATABASE_URL?.startsWith("postgres") ? "pg" : "sqlite3")) as DbClient

type PgRuntime = {
  client: "pg"
  db: NodePgDatabase<Record<string, never>>
  pool: Pool
}

type SqliteRuntime = {
  client: "sqlite3"
  db: BetterSQLite3Database<Record<string, never>>
  sqlite: Database.Database
}

type Runtime = PgRuntime | SqliteRuntime

declare global {
  var __inventoryOsRuntime: Runtime | undefined
}

function createRuntime(): Runtime {
  if (dbClient === "pg") {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    })

    return {
      client: "pg",
      pool,
      db: drizzlePg(pool),
    }
  }

  const sqliteFilename = process.env.SQLITE_FILENAME ?? path.join(process.cwd(), "inventory-os.sqlite")
  const sqlite = new Database(sqliteFilename)

  return {
    client: "sqlite3",
    sqlite,
    db: drizzleSqlite(sqlite),
  }
}

const runtime = globalThis.__inventoryOsRuntime ?? createRuntime()

if (process.env.NODE_ENV !== "production") {
  globalThis.__inventoryOsRuntime = runtime
}

export const databaseClient = runtime.client
export const db = runtime.db

function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }

  if (result && typeof result === "object" && "rows" in result) {
    return ((result as { rows?: unknown[] }).rows ?? []) as T[]
  }

  return []
}

export async function queryRows<T extends Record<string, unknown>>(query: SQL): Promise<T[]> {
  if (runtime.client === "pg") {
    const result = await runtime.db.execute(query)
    return extractRows<T>(result)
  }

  const result = runtime.db.all(query)
  return extractRows<T>(result)
}

export async function queryFirst<T extends Record<string, unknown>>(query: SQL): Promise<T | null> {
  const rows = await queryRows<T>(query)
  return rows[0] ?? null
}

export async function runQuery(query: SQL): Promise<void> {
  if (runtime.client === "pg") {
    await runtime.db.execute(query)
    return
  }

  runtime.db.run(query)
}

export { sql }
