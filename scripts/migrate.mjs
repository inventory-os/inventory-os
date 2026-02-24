import path from "node:path"
import Database from "better-sqlite3"
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3"
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator"
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres"
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

const DEFAULT_PG_STARTUP_WAIT_MS = 40_000
const DEFAULT_PG_RETRY_INTERVAL_MS = 2_000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getErrorCode(error) {
  if (error && typeof error === "object") {
    if ("code" in error && typeof error.code === "string") {
      return error.code
    }

    if ("cause" in error && error.cause && typeof error.cause === "object") {
      if ("code" in error.cause && typeof error.cause.code === "string") {
        return error.cause.code
      }
    }
  }

  return undefined
}

function shouldRetryPgStartupError(error) {
  const code = getErrorCode(error)

  return [
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENETUNREACH",
    "57P03",
  ].includes(code)
}

async function migratePostgresWithRetry(databaseUrl) {
  const maxWaitMs = Number(process.env.PG_STARTUP_MAX_WAIT_MS ?? DEFAULT_PG_STARTUP_WAIT_MS)
  const retryIntervalMs = Number(process.env.PG_STARTUP_RETRY_INTERVAL_MS ?? DEFAULT_PG_RETRY_INTERVAL_MS)
  const maxWaitMsSafe = Number.isFinite(maxWaitMs) && maxWaitMs >= 0 ? maxWaitMs : DEFAULT_PG_STARTUP_WAIT_MS
  const retryIntervalMsSafe =
    Number.isFinite(retryIntervalMs) && retryIntervalMs > 0 ? retryIntervalMs : DEFAULT_PG_RETRY_INTERVAL_MS
  const deadline = Date.now() + maxWaitMsSafe
  let attempt = 1

  while (true) {
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
    })

    try {
      const db = drizzlePg(pool)
      await migratePg(db, {
        migrationsFolder: path.join(process.cwd(), "drizzle/pg"),
      })
      return
    } catch (error) {
      const shouldRetry = shouldRetryPgStartupError(error)
      const now = Date.now()
      const shouldWaitAgain = shouldRetry && now < deadline

      if (!shouldWaitAgain) {
        throw error
      }

      const timeLeftMs = Math.max(0, deadline - now)
      console.warn(
        `Postgres not ready yet (attempt ${attempt}). Retrying in ${retryIntervalMsSafe}ms (up to ${timeLeftMs}ms remaining)...`,
      )
      attempt += 1
      await sleep(retryIntervalMsSafe)
    } finally {
      await pool.end()
    }
  }
}

async function migrateDatabase() {
  const dbClient = process.env.DB_CLIENT ?? (process.env.DATABASE_URL?.startsWith("postgres") ? "pg" : "sqlite3")

  if (dbClient === "pg") {
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      throw new Error("DATABASE_URL must be set when DB_CLIENT=pg")
    }

    await migratePostgresWithRetry(databaseUrl)

    return
  }

  const sqliteFilename = process.env.SQLITE_FILENAME ?? path.join(process.cwd(), "inventory-os.sqlite")
  const sqlite = new Database(sqliteFilename)

  try {
    const db = drizzleSqlite(sqlite)
    migrateSqlite(db, {
      migrationsFolder: path.join(process.cwd(), "drizzle/sqlite"),
    })
  } finally {
    sqlite.close()
  }
}

migrateDatabase()
  .then(() => {
    console.log("Database migrations completed")
  })
  .catch((error) => {
    console.error("Database migrations failed")
    console.error(error)
    process.exit(1)
  })
