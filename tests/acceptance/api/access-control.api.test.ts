import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("access control api acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("allows read-only trpc query for member role", async () => {
    const memberClient = createAcceptanceTrpcClient("member")
    const list = await memberClient.assets.list.query()

    expect(Array.isArray(list)).toBe(true)
  })

  it("blocks mutations for member role", async () => {
    const memberClient = createAcceptanceTrpcClient("member")

    await expect(
      memberClient.assets.create.mutate({
        name: `Member Mutation ${Date.now()}`,
        category: "Test",
        status: "available",
        locationId: null,
        value: 1,
        purchaseDate: "2026-01-01",
        tags: [],
      }),
    ).rejects.toThrow()
  })

  it("blocks mutations for anonymous callers", async () => {
    const anonymousClient = createAcceptanceTrpcClient("none")

    await expect(
      anonymousClient.assets.create.mutate({
        name: `Anonymous Mutation ${Date.now()}`,
        category: "Test",
        status: "available",
        locationId: null,
        value: 1,
        purchaseDate: "2026-01-01",
        tags: [],
      }),
    ).rejects.toThrow()
  })
})
