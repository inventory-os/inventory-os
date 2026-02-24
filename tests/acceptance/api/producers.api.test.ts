import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("producers api acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("creates, updates, lists, and removes a producer", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const unique = Date.now()
    const websiteUrl = `https://acceptance-${unique}.example.com`

    const created = await client.producers.create.mutate({
      name: `Acceptance Producer ${unique}`,
      websiteUrl,
      domain: `acceptance-${unique}.example.com`,
      description: "Acceptance producer",
      logoUrl: null,
      sourceUrl: websiteUrl,
    })

    expect(created.id).toBeTruthy()

    const updated = await client.producers.update.mutate({
      id: created.id,
      input: {
        name: `Acceptance Producer Updated ${unique}`,
        websiteUrl,
        domain: `acceptance-${unique}.example.com`,
        description: "Updated acceptance producer",
        logoUrl: null,
        sourceUrl: websiteUrl,
      },
    })

    expect(updated?.id).toBe(created.id)
    expect(updated?.name).toContain("Updated")

    const list = await client.producers.list.query()
    const persisted = list.find((entry) => entry.id === created.id)
    expect(persisted?.name).toContain("Updated")

    const removed = await client.producers.remove.mutate({ id: created.id })
    expect(removed).toBe(true)
  })
})
