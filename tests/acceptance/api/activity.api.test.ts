import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("activity api acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("records and retrieves activity events", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const unique = Date.now()
    const message = `Acceptance activity event ${unique}`

    await client.activity.record.mutate({
      type: "acceptance.event",
      actorMemberId: null,
      actorName: "Acceptance Admin",
      subjectType: "system",
      subjectId: null,
      subjectName: "Acceptance",
      message,
    })

    const listed = await client.activity.list.query({
      page: 1,
      pageSize: 20,
      search: `${unique}`,
      type: null,
    })

    expect(listed.events.some((event) => event.message === message)).toBe(true)
    expect(listed.pagination.total).toBeGreaterThan(0)
  })
})
