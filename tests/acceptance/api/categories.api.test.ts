import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("categories api acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("creates, updates, summarizes, and removes a category", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const unique = Date.now()
    const initialName = `Acceptance Category ${unique}`
    const updatedName = `Acceptance Category Updated ${unique}`

    const created = await client.categories.create.mutate({ name: initialName })
    expect(created.id).toBeTruthy()
    expect(created.name).toBe(initialName)

    const updated = await client.categories.update.mutate({
      id: created.id,
      name: updatedName,
    })
    expect(updated?.id).toBe(created.id)
    expect(updated?.name).toBe(updatedName)

    const summary = await client.categories.summary.query()
    expect(summary.some((entry) => entry.name === updatedName)).toBe(true)

    const removed = await client.categories.remove.mutate({ id: created.id })
    expect(removed).toBe(true)
  })
})
