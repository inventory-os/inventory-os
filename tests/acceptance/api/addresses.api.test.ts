import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("addresses api acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("creates, updates, lists, and removes an address", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const unique = Date.now()

    const created = await client.addresses.create.mutate({
      label: `Acceptance Address ${unique}`,
      addressLine1: "Acceptance Street 1",
      addressLine2: null,
      postalCode: "12345",
      city: "Acceptance City",
      country: "DE",
    })

    expect(created.id).toBeTruthy()
    expect(created.fullAddress).toContain("Acceptance Street 1")

    const updated = await client.addresses.update.mutate({
      id: created.id,
      input: {
        label: `Acceptance Address Updated ${unique}`,
        addressLine1: "Acceptance Street 2",
        addressLine2: "2nd Floor",
        postalCode: "12346",
        city: "Acceptance City",
        country: "DE",
      },
    })

    expect(updated?.id).toBe(created.id)
    expect(updated?.label).toContain("Updated")

    const listed = await client.addresses.list.query()
    const persisted = listed.find((entry) => entry.id === created.id)
    expect(persisted?.addressLine1).toBe("Acceptance Street 2")

    const removed = await client.addresses.remove.mutate({ id: created.id })
    expect(removed).toBe(true)
  })
})
