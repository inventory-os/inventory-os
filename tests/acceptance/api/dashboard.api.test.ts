import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("dashboard api acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("returns dashboard stats from persisted runtime data", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const stats = await client.dashboard.stats.query()

    expect(typeof stats.totalAssets).toBe("number")
    expect(typeof stats.inventoryValue).toBe("number")
    expect(Array.isArray(stats.statusDistribution)).toBe(true)
  })
})
