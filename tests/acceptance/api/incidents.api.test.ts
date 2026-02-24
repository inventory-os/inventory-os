import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("incidents api acceptance (real runtime)", () => {
  let assetId = ""

  beforeAll(async () => {
    const base = await ensureBaseData()
    assetId = base.assetId
  })

  it("creates, updates, and removes incidents over trpc", async () => {
    const client = createAcceptanceTrpcClient("admin")

    const created = await client.incidents.create.mutate({
      assetId,
      incidentType: "damage",
      title: `Acceptance Incident ${Date.now()}`,
      description: "Created by acceptance trpc test",
      severity: "medium",
      occurredAt: null,
      estimatedRepairCost: 120,
      reportedBy: "Acceptance Admin",
    })

    expect(created.id).toBeTruthy()

    const details = await client.incidents.byId.query({ id: created.id })
    expect(details?.id).toBe(created.id)

    const updated = await client.incidents.update.mutate({
      id: created.id,
      input: {
        status: "resolved",
        resolutionNotes: "Resolved in acceptance",
      },
    })

    expect(updated?.status).toBe("resolved")

    const removed = await client.incidents.remove.mutate({ id: created.id })
    expect(removed?.incident?.id).toBe(created.id)
  })
})
