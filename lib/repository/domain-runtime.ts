import { databaseClient, db } from "@/lib/db"
import * as pgSchema from "@/lib/db/schema/schema.pg"
import * as sqliteSchema from "@/lib/db/schema/schema.sqlite"

export function getDomainRuntime() {
  if (databaseClient === "pg") {
    return {
      orm: db as any,
      tables: pgSchema,
    }
  }

  return {
    orm: db as any,
    tables: sqliteSchema,
  }
}
