import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("notifications api acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("creates, reads, marks, and removes member notifications", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const unique = Date.now()
    const adminMember = await client.members.create.mutate({
      name: `Acceptance Admin ${unique}`,
      email: `acceptance.admin.${unique}@example.com`,
      role: "admin",
    })

    expect(adminMember.id).toBeTruthy()

    const message = `Acceptance notification ${unique}`
    await client.notifications.notifyAuthIntegrationFailed.mutate({
      message,
    })

    const beforeRead = await client.notifications.listForMember.query({
      memberId: adminMember.id,
      limit: 20,
    })

    const notification = beforeRead.find((entry) => entry.message.includes(message))
    expect(notification?.id).toBeTruthy()
    expect(notification?.readAt).toBeNull()

    const marked = await client.notifications.markRead.mutate({
      id: notification!.id,
      memberId: adminMember.id,
    })
    expect(marked).toBe(true)

    const afterRead = await client.notifications.listForMember.query({
      memberId: adminMember.id,
      limit: 20,
    })
    const persistedRead = afterRead.find((entry) => entry.id === notification!.id)
    expect(persistedRead?.readAt).toBeTruthy()

    const removed = await client.notifications.remove.mutate({
      id: notification!.id,
      memberId: adminMember.id,
    })
    expect(removed).toBe(true)

    const afterRemove = await client.notifications.listForMember.query({
      memberId: adminMember.id,
      limit: 20,
    })
    expect(afterRemove.some((entry) => entry.id === notification!.id)).toBe(false)
  })
})
