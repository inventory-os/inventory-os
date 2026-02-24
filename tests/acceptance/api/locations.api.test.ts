import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("locations api acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("returns location details including canonical qr payload", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const locations = await client.locations.list.query()
    const hq = locations.find((location) => location.name === "HQ")

    expect(hq?.id).toBeTruthy()

    const details = await client.locations.details.query({
      id: hq!.id,
      page: 1,
      pageSize: 10,
      search: "",
      status: "all",
      category: "all",
    })

    expect(details?.location.id).toBe(hq!.id)
    expect(details?.qrPayload).toContain(`/qr/${hq!.id}`)
    expect(details?.qrPayload.includes("inventory-os:")).toBe(false)
  })

  it("creates and deletes a temporary location", async () => {
    const client = createAcceptanceTrpcClient("admin")

    const created = await client.locations.create.mutate({
      name: `Acceptance Temp Location ${Date.now()}`,
      address: "Acceptance Street 1",
      kind: "room",
    })

    expect(created.id).toBeTruthy()

    const removed = await client.locations.remove.mutate({ id: created.id })
    expect(removed).toBe(true)
  })
})
