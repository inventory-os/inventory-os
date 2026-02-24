import { beforeAll, describe, expect, it } from "vitest"
import { apiJson, ensureBaseData } from "../support/http"

async function ensureMemberByEmail(email: string, name: string, role: "admin" | "member"): Promise<string> {
  const listed = await apiJson<{ members: Array<{ id: string; email: string }> }>(
    `/api/members?page=1&pageSize=100&search=${encodeURIComponent(email)}`,
  )

  const existing = listed.data.members.find((member) => member.email.toLowerCase() === email.toLowerCase())
  if (existing) {
    return existing.id
  }

  const created = await apiJson<{ member: { id: string } }>("/api/members", {
    method: "POST",
    body: JSON.stringify({ name, email, role }),
  })

  expect(created.status).toBe(201)
  return created.data.member.id
}

describe("notifications.api acceptance", () => {
  let assetId = ""

  beforeAll(async () => {
    const seed = await ensureBaseData()
    assetId = seed.assetId

    await ensureMemberByEmail("acceptance.admin@example.com", "Acceptance Admin", "admin")
    await ensureMemberByEmail("acceptance.member@example.com", "Acceptance Member", "member")

    await apiJson("/api/settings/notifications", {
      method: "PUT",
      body: JSON.stringify({
        checkoutAlerts: true,
        maintenanceAlerts: true,
        bookingAlerts: true,
        digestEnabled: true,
        lowInventoryAlerts: true,
      }),
    })
  })

  it("covers /api/notifications/run and list notifications", async () => {
    const memberId = await ensureMemberByEmail("acceptance.member@example.com", "Acceptance Member", "member")

    await apiJson(`/api/assets/${assetId}/borrow`, {
      method: "POST",
      body: JSON.stringify({ action: "return" }),
    })

    const borrowed = await apiJson<{ asset: { id: string } }>(`/api/assets/${assetId}/borrow`, {
      method: "POST",
      body: JSON.stringify({
        action: "borrow",
        memberId,
        dueAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        notes: "notification-seed",
      }),
    })
    expect(borrowed.status).toBe(200)

    const run = await apiJson<{ success?: boolean; created?: number; error?: string }>("/api/notifications/run", {
      method: "POST",
      body: JSON.stringify({}),
    })
    expect([200, 401]).toContain(run.status)
    if (run.status === 200) {
      expect(run.data.success).toBe(true)
      expect(typeof run.data.created).toBe("number")
    }

    const list = await apiJson<{ notifications: Array<{ id: string; readAt: string | null }>; unread: number }>("/api/notifications?limit=100")
    expect([200, 401]).toContain(list.status)
    if (list.status === 200) {
      expect(Array.isArray(list.data.notifications)).toBe(true)
      expect(typeof list.data.unread).toBe("number")
    }
  })

  it("covers read/delete endpoints and mark-all / clear-all flows", async () => {
    const list = await apiJson<{ notifications: Array<{ id: string }>; unread: number }>("/api/notifications?limit=100")

    if (list.status !== 200 || list.data.notifications.length === 0) {
      const run = await apiJson<{ success?: boolean }>("/api/notifications/run", {
        method: "POST",
        body: JSON.stringify({}),
      })
      expect([200, 401]).toContain(run.status)
    }

    const refreshed = await apiJson<{ notifications: Array<{ id: string; readAt: string | null }>; unread: number }>("/api/notifications?limit=100")
    if (refreshed.status === 200 && refreshed.data.notifications.length > 0) {
      const notificationId = refreshed.data.notifications[0]!.id

      const markRead = await apiJson<{ success: boolean }>(`/api/notifications/${notificationId}/read`, {
        method: "POST",
        body: JSON.stringify({}),
      })
      expect(markRead.status).toBe(200)
      expect(markRead.data.success).toBe(true)

      const deleteOne = await apiJson<{ success: boolean }>(`/api/notifications/${notificationId}/read`, {
        method: "DELETE",
      })
      expect(deleteOne.status).toBe(200)
      expect(deleteOne.data.success).toBe(true)

      const deleteMissing = await apiJson<{ error: string }>(`/api/notifications/${notificationId}/read`, {
        method: "DELETE",
      })
      expect(deleteMissing.status).toBe(404)
    }

    const markAll = await apiJson<{ success: boolean }>("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({}),
    })
    expect([200, 401]).toContain(markAll.status)
    if (markAll.status === 200) {
      expect(markAll.data.success).toBe(true)
    }

    const clearAll = await apiJson<{ success: boolean }>("/api/notifications", {
      method: "DELETE",
    })
    expect([200, 401]).toContain(clearAll.status)
    if (clearAll.status === 200) {
      expect(clearAll.data.success).toBe(true)
    }
  })

  it("covers member and unauth access behavior", async () => {
    const memberGet = await apiJson<{ notifications?: unknown[]; error?: string }>("/api/notifications", { role: "member" })
    expect([200, 401]).toContain(memberGet.status)

    const memberPatch = await apiJson<{ error: string }>("/api/notifications", {
      role: "member",
      method: "PATCH",
      body: JSON.stringify({}),
    })
    expect(memberPatch.status).toBe(403)

    const memberDelete = await apiJson<{ error: string }>("/api/notifications", {
      role: "member",
      method: "DELETE",
    })
    expect(memberDelete.status).toBe(403)

    const memberReadById = await apiJson<{ error: string }>("/api/notifications/does-not-exist/read", {
      role: "member",
      method: "POST",
      body: JSON.stringify({}),
    })
    expect(memberReadById.status).toBe(403)

    const memberRun = await apiJson<{ error: string }>("/api/notifications/run", {
      role: "member",
      method: "POST",
      body: JSON.stringify({}),
    })
    expect(memberRun.status).toBe(403)

    const unauthGet = await apiJson<{ error: string }>("/api/notifications", { role: "none" })
    expect(unauthGet.status).toBe(401)
  })
})
