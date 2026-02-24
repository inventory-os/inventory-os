import { beforeAll, describe, expect, it } from "vitest"
import { apiJson, ensureBaseData } from "../support/http"

describe("members.api acceptance", () => {
  let assetId = ""

  beforeAll(async () => {
    const seed = await ensureBaseData()
    assetId = seed.assetId
  })

  it("covers create validation and list filtering/pagination", async () => {
    const invalidCreate = await apiJson<{ error: unknown }>("/api/members", {
      method: "POST",
      body: JSON.stringify({ name: "x" }),
    })
    expect(invalidCreate.status).toBe(400)

    const suffix = Date.now()
    const email = `members-api-${suffix}@example.com`

    const created = await apiJson<{ member: { id: string; email: string; role: string } }>("/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: `Members Api ${suffix}`,
        email,
        role: "member",
      }),
    })
    expect(created.status).toBe(201)
    expect(created.data.member.email).toBe(email)

    const listBySearch = await apiJson<{
      members: Array<{ id: string; email: string }>
      pagination: { page: number; pageSize: number; total: number; totalPages: number }
    }>(`/api/members?page=1&pageSize=10&search=${encodeURIComponent(email)}`)
    expect(listBySearch.status).toBe(200)
    expect(listBySearch.data.members.some((member) => member.id === created.data.member.id)).toBe(true)
    expect(listBySearch.data.pagination.total).toBeGreaterThan(0)

    const listByRole = await apiJson<{ members: Array<{ id: string; role: string }> }>("/api/members?page=1&pageSize=20&role=member")
    expect(listByRole.status).toBe(200)
    expect(listByRole.data.members.some((member) => member.id === created.data.member.id)).toBe(true)
  })

  it("covers member profile reflection with assigned assets and loan history", async () => {
    const suffix = Date.now()
    const created = await apiJson<{ member: { id: string; email: string } }>("/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: `Profile Member ${suffix}`,
        email: `profile-${suffix}@example.com`,
        role: "member",
      }),
    })
    expect(created.status).toBe(201)
    const memberId = created.data.member.id

    const borrowed = await apiJson<{ asset: { id: string; assignedTo: string | null } }>(`/api/assets/${assetId}/borrow`, {
      method: "POST",
      body: JSON.stringify({
        action: "borrow",
        memberId,
        dueAt: "2026-12-31T00:00:00.000Z",
      }),
    })
    expect(borrowed.status).toBe(200)

    const profileWithLoan = await apiJson<{
      member: { id: string; email: string; assetsAssigned: number }
      assignedAssets: Array<{ id: string }>
      loanHistory: Array<{ assetId: string; memberId: string; returnedAt: string | null }>
    }>(`/api/members/${memberId}`)
    expect(profileWithLoan.status).toBe(200)
    expect(profileWithLoan.data.member.id).toBe(memberId)
    expect(profileWithLoan.data.assignedAssets.some((asset) => asset.id === assetId)).toBe(true)
    expect(profileWithLoan.data.loanHistory.some((loan) => loan.assetId === assetId && loan.memberId === memberId)).toBe(true)

    const returned = await apiJson<{ asset: { id: string; assignedTo: string | null } }>(`/api/assets/${assetId}/borrow`, {
      method: "POST",
      body: JSON.stringify({ action: "return" }),
    })
    expect(returned.status).toBe(200)

    const profileAfterReturn = await apiJson<{
      member: { id: string; assetsAssigned: number }
      assignedAssets: Array<{ id: string }>
      loanHistory: Array<{ assetId: string; returnedAt: string | null }>
    }>(`/api/members/${memberId}`)
    expect(profileAfterReturn.status).toBe(200)
    expect(profileAfterReturn.data.assignedAssets.some((asset) => asset.id === assetId)).toBe(false)
    expect(profileAfterReturn.data.loanHistory.some((loan) => loan.assetId === assetId)).toBe(true)
  })

  it("covers not-found branch for member profile", async () => {
    const missing = await apiJson<{ error: string }>("/api/members/does-not-exist")
    expect(missing.status).toBe(404)
  })

  it("covers member and unauth access restrictions", async () => {
    const memberList = await apiJson<{ error: string }>("/api/members", { role: "member" })
    expect(memberList.status).toBe(403)

    const memberProfile = await apiJson<{ error: string }>("/api/members/does-not-exist", { role: "member" })
    expect(memberProfile.status).toBe(403)

    const unauthList = await apiJson<{ error: string }>("/api/members", { role: "none" })
    expect(unauthList.status).toBe(401)

    const unauthProfile = await apiJson<{ error: string }>("/api/members/does-not-exist", { role: "none" })
    expect(unauthProfile.status).toBe(401)
  })
})
