import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("search api acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("finds newly created asset and member through unified search", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const unique = Date.now()
    const marker = `acceptance-search-${unique}`

    const locations = await client.locations.list.query()
    const hq = locations.find((location) => location.name === "HQ")
    expect(hq?.id).toBeTruthy()

    const createdAsset = await client.assets.create.mutate({
      name: `Asset ${marker}`,
      category: "Search",
      status: "available",
      locationId: hq!.id,
      value: 10,
      purchaseDate: "2026-01-01",
      tags: [marker],
    })

    const createdMember = await client.members.create.mutate({
      name: `Member ${marker}`,
      email: `${marker}@example.com`,
      role: "member",
    })

    const result = await client.search.query.query({ query: marker })

    expect(result.assets.some((entry) => entry.asset.id === createdAsset.id)).toBe(true)
    expect(result.members.some((entry) => entry.id === createdMember.id)).toBe(true)

    await client.assets.remove.mutate({ id: createdAsset.id })
  })
})
