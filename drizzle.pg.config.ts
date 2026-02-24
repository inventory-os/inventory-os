import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./lib/db/schema/schema.pg.ts",
  out: "./drizzle/pg",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://user:password@localhost:5432/inventory_os",
  },
})
