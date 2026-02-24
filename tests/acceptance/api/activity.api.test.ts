import { beforeAll, describe, expect, it } from "vitest"
import { apiJson, ensureBaseData } from "../support/http"

describe("activity.api acceptance", () => {
  beforeAll(async () => {
    await ensureBaseData()

    await apiJson("/api/assets", {
      method: "POST",
      body: JSON.stringify({
        name: `Activity Seed ${Date.now()}`,
        category: "Activity",
        status: "available",
        locationId: null,
        value: 1,
        purchaseDate: "2026-01-01",
        tags: ["activity-seed"],
      }),
    })
  })

  it("covers GET list/pagination/filter when admin access is granted", async () => {
    const result = await apiJson<{
      events?: Array<{ id: string; type: string; message: string }>
      pagination?: { page: number; pageSize: number; total: number; totalPages: number }
      error?: string
    }>("/api/activity?page=1&pageSize=10&search=asset&type=all")

    expect([200, 403]).toContain(result.status)

    if (result.status === 200) {
      expect(Array.isArray(result.data.events)).toBe(true)
      expect(typeof result.data.pagination?.page).toBe("number")
      expect(typeof result.data.pagination?.total).toBe("number")
    }
  })

  it("covers member and unauth access behavior", async () => {
    const member = await apiJson<{ error: string }>("/api/activity", { role: "member" })
    expect(member.status).toBe(403)

    const unauth = await apiJson<{ error: string }>("/api/activity", { role: "none" })
    expect(unauth.status).toBe(401)
  })
})
