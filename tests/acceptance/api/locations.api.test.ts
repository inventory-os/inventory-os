import { beforeAll, describe, expect, it } from "vitest"
import { getAcceptanceBaseUrl } from "../support/acceptance-env"
import { apiJson, ensureBaseData, getSessionCookie } from "../support/http"

describe("locations.api acceptance", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("covers list/create/patch/delete and validation branches", async () => {
    const invalidCreate = await apiJson<{ error: unknown }>("/api/locations", {
      method: "POST",
      body: JSON.stringify({ name: "x", kind: "invalid-kind" }),
    })
    expect(invalidCreate.status).toBe(400)

    const suffix = Date.now()
    const create = await apiJson<{ location: { id: string; name: string; kind: string } }>("/api/locations", {
      method: "POST",
      body: JSON.stringify({
        name: `Location API ${suffix}`,
        address: "Main Street 1",
        kind: "building",
      }),
    })
    expect(create.status).toBe(201)
    const locationId = create.data.location.id

    const listed = await apiJson<{ locations: Array<{ id: string; name: string }> }>("/api/locations")
    expect(listed.status).toBe(200)
    expect(listed.data.locations.some((entry) => entry.id === locationId)).toBe(true)

    const invalidPatch = await apiJson<{ error: unknown }>("/api/locations", {
      method: "PATCH",
      body: JSON.stringify({ id: locationId, name: "x", kind: "building" }),
    })
    expect(invalidPatch.status).toBe(400)

    const patch = await apiJson<{ location: { id: string; name: string; kind: string } }>("/api/locations", {
      method: "PATCH",
      body: JSON.stringify({
        id: locationId,
        name: `Location API ${suffix} Updated`,
        address: "Updated Street 2",
        kind: "storage",
      }),
    })
    expect(patch.status).toBe(200)
    expect(patch.data.location.name).toContain("Updated")
    expect(patch.data.location.kind).toBe("storage")

    const deleted = await apiJson<{ success: boolean }>(`/api/locations/${locationId}`, { method: "DELETE" })
    expect(deleted.status).toBe(200)

    const missingDelete = await apiJson<{ error: string }>(`/api/locations/${locationId}`, { method: "DELETE" })
    expect(missingDelete.status).toBe(404)
  })

  it("covers detail GET tree/filtering and qr payload fields", async () => {
    const suffix = Date.now()

    const createParent = await apiJson<{ location: { id: string } }>("/api/locations", {
      method: "POST",
      body: JSON.stringify({ name: `Parent Location ${suffix}`, kind: "building" }),
    })
    expect(createParent.status).toBe(201)
    const parentId = createParent.data.location.id

    const createChild = await apiJson<{ location: { id: string } }>("/api/locations", {
      method: "POST",
      body: JSON.stringify({
        name: `Child Room ${suffix}`,
        parentId,
        kind: "room",
        roomNumber: "12",
      }),
    })
    expect(createChild.status).toBe(201)
    const childId = createChild.data.location.id

    const createAsset = await apiJson<{ asset: { id: string } }>("/api/assets", {
      method: "POST",
      body: JSON.stringify({
        name: `Location Scoped Asset ${suffix}`,
        category: "Laptops",
        status: "available",
        locationId: childId,
        value: 500,
        purchaseDate: "2026-02-10",
        tags: ["loc-scope"],
      }),
    })
    expect(createAsset.status).toBe(201)
    const assetId = createAsset.data.asset.id

    const details = await apiJson<{
      location: { id: string }
      parent: { id: string } | null
      children: Array<{ id: string }>
      assets: Array<{ id: string; name: string; status: string; category: string }>
      assetCategories: string[]
      pagination: { total: number; totalPages: number }
      qrPayload: string
    }>(`/api/locations/${parentId}?page=1&pageSize=10&search=${encodeURIComponent("Location Scoped Asset")}&status=available&category=laptops`)

    expect(details.status).toBe(200)
    expect(details.data.location.id).toBe(parentId)
    expect(details.data.children.some((entry) => entry.id === childId)).toBe(true)
    expect(details.data.assets.some((entry) => entry.id === assetId)).toBe(true)
    expect(details.data.assetCategories.map((entry) => entry.toLowerCase())).toContain("laptops")
    expect(details.data.pagination.total).toBeGreaterThan(0)
    expect(typeof details.data.qrPayload).toBe("string")
    expect(details.data.qrPayload.length).toBeGreaterThan(0)

    const missingDetails = await apiJson<{ error: string }>("/api/locations/does-not-exist")
    expect(missingDetails.status).toBe(404)

    const deleteAsset = await apiJson<{ success: boolean }>(`/api/assets/${assetId}`, { method: "DELETE" })
    expect(deleteAsset.status).toBe(200)
    await apiJson<{ success: boolean }>(`/api/locations/${childId}`, { method: "DELETE" })
    await apiJson<{ success: boolean }>(`/api/locations/${parentId}`, { method: "DELETE" })
  })

  it("covers styled qr endpoint branches", async () => {
    const create = await apiJson<{ location: { id: string } }>("/api/locations", {
      method: "POST",
      body: JSON.stringify({ name: `QR Location ${Date.now()}`, kind: "area" }),
    })
    expect(create.status).toBe(201)
    const locationId = create.data.location.id

    const qr = await fetch(`${getAcceptanceBaseUrl()}/api/locations/${locationId}/qr/styled?size=9999`, {
      headers: { cookie: getSessionCookie("admin") },
      redirect: "manual",
    })
    expect(qr.status).toBe(200)
    expect(qr.headers.get("content-type")).toContain("image/svg+xml")
    expect((await qr.text()).includes("<svg")).toBe(true)

    const missingQr = await apiJson<{ error: string }>("/api/locations/does-not-exist/qr/styled")
    expect(missingQr.status).toBe(404)

    await apiJson<{ success: boolean }>(`/api/locations/${locationId}`, { method: "DELETE" })
  })

  it("covers member and unauth access behavior", async () => {
    const memberGetList = await apiJson<{ locations: unknown[] }>("/api/locations", { role: "member" })
    expect(memberGetList.status).toBe(200)

    const memberGetById = await apiJson<{ error?: string }>("/api/locations/does-not-exist", { role: "member" })
    expect(memberGetById.status).toBe(404)

    const memberPost = await apiJson<{ error: string }>("/api/locations", {
      role: "member",
      method: "POST",
      body: JSON.stringify({ name: "Denied", kind: "building" }),
    })
    expect(memberPost.status).toBe(403)

    const memberPatch = await apiJson<{ error: string }>("/api/locations", {
      role: "member",
      method: "PATCH",
      body: JSON.stringify({ id: "x", name: "Denied", kind: "building" }),
    })
    expect(memberPatch.status).toBe(403)

    const memberDelete = await apiJson<{ error: string }>("/api/locations/does-not-exist", {
      role: "member",
      method: "DELETE",
    })
    expect(memberDelete.status).toBe(403)

    const unauthGet = await apiJson<{ error: string }>("/api/locations", { role: "none" })
    expect(unauthGet.status).toBe(401)
  })
})
