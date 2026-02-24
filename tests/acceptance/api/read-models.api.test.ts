import { beforeAll, describe, expect, it } from "vitest"
import { apiJson, ensureBaseData } from "../support/http"

describe("read-models.api acceptance", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("covers /api/stats response shape", async () => {
    const stats = await apiJson<{ stats: Record<string, unknown> }>("/api/stats")
    expect(stats.status).toBe(200)
    expect(typeof stats.data.stats).toBe("object")
  })

  it("covers /api/search empty and query branches", async () => {
    const emptyQuery = await apiJson<{
      query: string
      assets: unknown[]
      producers: unknown[]
      members: unknown[]
      locations: unknown[]
      categories: unknown[]
    }>("/api/search")

    expect(emptyQuery.status).toBe(200)
    expect(emptyQuery.data.query).toBe("")
    expect(Array.isArray(emptyQuery.data.assets)).toBe(true)

    const seeded = await apiJson<{ query: string; assets: unknown[] }>("/api/search?q=Acceptance")
    expect(seeded.status).toBe(200)
    expect(seeded.data.query).toBe("Acceptance")
  })

  it("covers /api/tags and /api/loans response shape", async () => {
    const tags = await apiJson<{ tags: string[] }>("/api/tags")
    expect(tags.status).toBe(200)
    expect(Array.isArray(tags.data.tags)).toBe(true)

    const loans = await apiJson<{ loans: unknown[] }>("/api/loans")
    expect(loans.status).toBe(200)
    expect(Array.isArray(loans.data.loans)).toBe(true)
  })

  it("covers member and unauth access behavior", async () => {
    const memberStats = await apiJson<{ stats: unknown }>("/api/stats", { role: "member" })
    expect(memberStats.status).toBe(200)

    const memberSearch = await apiJson<{ query: string }>("/api/search?q=Acceptance", { role: "member" })
    expect(memberSearch.status).toBe(200)

    const memberTags = await apiJson<{ tags: unknown[] }>("/api/tags", { role: "member" })
    expect(memberTags.status).toBe(200)

    const memberLoans = await apiJson<{ loans: unknown[] }>("/api/loans", { role: "member" })
    expect(memberLoans.status).toBe(200)

    const unauthStats = await apiJson<{ error: string }>("/api/stats", { role: "none" })
    expect(unauthStats.status).toBe(401)
  })
})
