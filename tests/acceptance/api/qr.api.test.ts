import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("qr api acceptance (real runtime)", () => {
  let assetId = ""

  beforeAll(async () => {
    const base = await ensureBaseData()
    assetId = base.assetId
  })

  it("resolves qr to public payload for unsigned users", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const payload = await client.qr.resolve.query({ id: assetId })

    expect(payload.found).toBe(true)
    expect(payload.authenticated).toBe(false)
    expect(payload.redirectTo).toBeNull()
  })

  it("returns not-found payload for unknown qr id", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const payload = await client.qr.resolve.query({ id: "NOT-FOUND-QR-ID" })

    expect(payload.found).toBe(false)
  })
})
