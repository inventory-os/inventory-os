import { describe, expect, it } from "vitest"
import { apiJson } from "../support/http"

describe("categories.api acceptance", () => {
  it("covers get list/search/pagination and create validation", async () => {
    const invalidCreate = await apiJson<{ error: unknown }>("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "x" }),
    })
    expect(invalidCreate.status).toBe(400)

    const suffix = Date.now()
    const name = `Category Api ${suffix}`

    const created = await apiJson<{ category: { id: string; name: string } }>("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name }),
    })
    expect(created.status).toBe(201)
    const categoryId = created.data.category.id

    const listed = await apiJson<{
      categories: Array<{ name: string; count: number }>
      managedCategories: Array<{ id: string; name: string }>
      pagination: { page: number; pageSize: number; total: number; totalPages: number }
    }>(`/api/categories?page=1&pageSize=10&search=${encodeURIComponent(name)}`)

    expect(listed.status).toBe(200)
    expect(listed.data.managedCategories.some((category) => category.id === categoryId)).toBe(true)
    expect(listed.data.pagination.total).toBeGreaterThan(0)
    expect(Array.isArray(listed.data.categories)).toBe(true)
  })

  it("covers patch and delete branches including validation and not-found", async () => {
    const suffix = Date.now()
    const created = await apiJson<{ category: { id: string; name: string } }>("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: `Patch Category ${suffix}` }),
    })
    expect(created.status).toBe(201)
    const categoryId = created.data.category.id

    const invalidPatch = await apiJson<{ error: unknown }>(`/api/categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "x" }),
    })
    expect(invalidPatch.status).toBe(400)

    const patched = await apiJson<{ category: { id: string; name: string } }>(`/api/categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: `Patch Category ${suffix} Updated` }),
    })
    expect(patched.status).toBe(200)
    expect(patched.data.category.name).toContain("Updated")

    const patchMissing = await apiJson<{ error: string }>("/api/categories/does-not-exist", {
      method: "PATCH",
      body: JSON.stringify({ name: "Missing Category" }),
    })
    expect(patchMissing.status).toBe(404)

    const deleted = await apiJson<{ success: boolean }>(`/api/categories/${categoryId}`, { method: "DELETE" })
    expect(deleted.status).toBe(200)

    const deleteMissing = await apiJson<{ error: string }>(`/api/categories/${categoryId}`, { method: "DELETE" })
    expect(deleteMissing.status).toBe(404)
  })

  it("covers member and unauth access behavior", async () => {
    const memberGet = await apiJson<{ managedCategories: unknown[] }>("/api/categories", { role: "member" })
    expect(memberGet.status).toBe(200)

    const memberPost = await apiJson<{ error: string }>("/api/categories", {
      role: "member",
      method: "POST",
      body: JSON.stringify({ name: "Denied Category" }),
    })
    expect(memberPost.status).toBe(403)

    const memberPatch = await apiJson<{ error: string }>("/api/categories/does-not-exist", {
      role: "member",
      method: "PATCH",
      body: JSON.stringify({ name: "Denied Category" }),
    })
    expect(memberPatch.status).toBe(403)

    const memberDelete = await apiJson<{ error: string }>("/api/categories/does-not-exist", {
      role: "member",
      method: "DELETE",
    })
    expect(memberDelete.status).toBe(403)

    const unauthGet = await apiJson<{ error: string }>("/api/categories", { role: "none" })
    expect(unauthGet.status).toBe(401)
  })
})
