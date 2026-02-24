import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("assets api acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("lists and creates assets through trpc", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const listBefore = await client.assets.list.query()

    expect(Array.isArray(listBefore)).toBe(true)
    expect(listBefore.some((asset) => asset.name === "Acceptance Laptop")).toBe(true)

    const sourceLocationId = listBefore.find((asset) => asset.name === "Acceptance Laptop")?.locationId ?? null
    expect(sourceLocationId).toBeTruthy()

    const created = await client.assets.create.mutate({
      name: `Acceptance Mouse ${Date.now()}`,
      category: "Peripherals",
      status: "available",
      locationId: sourceLocationId,
      value: 39.99,
      purchaseDate: "2026-01-01",
      tags: ["acceptance", "trpc"],
    })

    expect(created.id).toBeTruthy()
    expect(created.name).toContain("Acceptance Mouse")

    const fetched = await client.assets.byId.query({ id: created.id })
    expect(fetched?.id).toBe(created.id)

    const removed = await client.assets.remove.mutate({ id: created.id })
    expect(removed).toBe(true)
  })
})
