import path from "node:path"
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { databaseClient, db } from "@/lib/db"

let migrationsReady: Promise<void> | null = null

export async function runDatabaseMigrations(): Promise<void> {
  if (migrationsReady) {
    return migrationsReady
  }

  migrationsReady = (async () => {
    if (databaseClient === "pg") {
      await migratePg(db as NodePgDatabase<Record<string, never>>, {
        migrationsFolder: path.join(process.cwd(), "drizzle/pg"),
      })
      return
    }

    migrateSqlite(db as BetterSQLite3Database<Record<string, never>>, {
      migrationsFolder: path.join(process.cwd(), "drizzle/sqlite"),
    })
  })()

  return migrationsReady
}
