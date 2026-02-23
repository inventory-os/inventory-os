import { beforeEach, describe, expect, it, vi } from "vitest"

function resetRuntimeCache() {
  delete (globalThis as { __inventoryOsRuntime?: unknown }).__inventoryOsRuntime
}

describe("db runtime", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unmock("pg")
    vi.unmock("drizzle-orm/node-postgres")
    resetRuntimeCache()
  })

  it("uses sqlite runtime and can execute queries", async () => {
    process.env.DB_CLIENT = "sqlite3"
    process.env.SQLITE_FILENAME = ":memory:"

    const { databaseClient, runQuery, queryRows, sql } = await import("@/lib/db")

    expect(databaseClient).toBe("sqlite3")

    await runQuery(sql`CREATE TABLE test_items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)`)
    await runQuery(sql`INSERT INTO test_items (name) VALUES ('alpha')`)

    const rows = await queryRows<{ name: string }>(sql`SELECT name FROM test_items`)
    expect(rows).toEqual([{ name: "alpha" }])
  })

  it("uses postgres runtime when configured", async () => {
    process.env.DB_CLIENT = "pg"
    process.env.DATABASE_URL = "postgres://unit-test"

    const execute = vi.fn().mockResolvedValue({ rows: [{ ok: 1 }] })
    const drizzle = vi.fn().mockReturnValue({ execute })
    const poolCtor = vi.fn()

    class MockPool {
      end = vi.fn()

      constructor(config: unknown) {
        poolCtor(config)
      }
    }

    vi.doMock("drizzle-orm/node-postgres", () => ({ drizzle }))
    vi.doMock("pg", () => ({ Pool: MockPool }))

    const { databaseClient, queryRows, runQuery, sql } = await import("@/lib/db")

    expect(databaseClient).toBe("pg")
    expect(poolCtor).toHaveBeenCalledWith(expect.objectContaining({ connectionString: "postgres://unit-test" }))

    const rows = await queryRows<{ ok: number }>(sql`SELECT 1 AS ok`)
    expect(rows).toEqual([{ ok: 1 }])

    await runQuery(sql`SELECT 1`)
    expect(execute).toHaveBeenCalledTimes(2)
  })
})
