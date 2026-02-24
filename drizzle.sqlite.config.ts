import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./lib/db/schema/schema.sqlite.ts",
  out: "./drizzle/sqlite",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.SQLITE_FILENAME ?? "./inventory-os.sqlite",
  },
})
