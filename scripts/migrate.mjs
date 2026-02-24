import path from "node:path"
import Database from "better-sqlite3"
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3"
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator"
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres"
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

async function migrateDatabase() {
  const dbClient = process.env.DB_CLIENT ?? (process.env.DATABASE_URL?.startsWith("postgres") ? "pg" : "sqlite3")

  if (dbClient === "pg") {
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      throw new Error("DATABASE_URL must be set when DB_CLIENT=pg")
    }

    const pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
    })

    try {
      const db = drizzlePg(pool)
      await migratePg(db, {
        migrationsFolder: path.join(process.cwd(), "drizzle/pg"),
      })
    } finally {
      await pool.end()
    }

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
