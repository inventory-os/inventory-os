import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("setup api acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("ensures schema and persists workspace settings", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const unique = Date.now()

    await client.setup.ensureSchema.mutate()

    const before = await client.setup.status.query()
    expect(before.setupComplete).toBe(true)

    const appName = `Inventory OS Setup ${unique}`
    await client.setup.saveWorkspaceSettings.mutate({
      appName,
      organizationName: before.organizationName,
      locale: before.locale,
      currency: before.currency,
    })

    const after = await client.setup.status.query()
    expect(after.appName).toBe(appName)
  })
})
