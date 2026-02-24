import { beforeAll, describe, expect, it } from "vitest"
import { getAcceptanceBaseUrl } from "../support/acceptance-env"
import { apiJson, ensureBaseData, getSessionCookie } from "../support/http"

type AssetPayload = {
  name: string
  category: string
  status: "available" | "in-use" | "maintenance" | "retired"
  locationId: string | null
  value: number
  purchaseDate: string
  tags: string[]
  quantity?: number
  minimumQuantity?: number
  notes?: string
}

describe("assets.api acceptance", () => {
  let existingAssetId = ""
  let locationId = ""

  beforeAll(async () => {
    const seed = await ensureBaseData()
    existingAssetId = seed.assetId

    const locations = await apiJson<{ locations: Array<{ id: string }> }>("/api/locations")
    expect(locations.status).toBe(200)
    expect(locations.data.locations.length).toBeGreaterThan(0)
    locationId = locations.data.locations[0]!.id
  })

  it("covers list filtering and pagination logic", async () => {
    const suffix = Date.now()

    const payload: AssetPayload = {
      name: `Asset Coverage ${suffix}`,
      category: "Cameras",
      status: "maintenance",
      locationId,
      value: 999,
      purchaseDate: "2026-01-15",
      tags: ["coverage-tag", `coverage-${suffix}`],
      notes: "Asset API coverage",
    }

    const created = await apiJson<{ asset: { id: string; name: string } }>("/api/assets", {
      method: "POST",
      body: JSON.stringify(payload),
    })
    expect(created.status).toBe(201)
    const assetId = created.data.asset.id

    const listBySearch = await apiJson<{ assets: Array<{ id: string; qrCode: string }>; pagination: { total: number } }>(
      `/api/assets?page=1&pageSize=10&search=${encodeURIComponent(payload.name)}`,
    )
    expect(listBySearch.status).toBe(200)
    expect(listBySearch.data.assets.some((asset) => asset.id === assetId)).toBe(true)
    expect(listBySearch.data.assets.every((asset) => typeof asset.qrCode === "string" && asset.qrCode.length > 0)).toBe(true)

    const listByStatus = await apiJson<{ assets: Array<{ id: string }> }>("/api/assets?page=1&pageSize=10&status=maintenance")
    expect(listByStatus.status).toBe(200)
    expect(listByStatus.data.assets.some((asset) => asset.id === assetId)).toBe(true)

    const listByCategory = await apiJson<{ assets: Array<{ id: string }> }>("/api/assets?page=1&pageSize=10&category=cameras")
    expect(listByCategory.status).toBe(200)
    expect(listByCategory.data.assets.some((asset) => asset.id === assetId)).toBe(true)

    const listByTag = await apiJson<{ assets: Array<{ id: string }> }>("/api/assets?page=1&pageSize=10&tag=coverage-tag")
    expect(listByTag.status).toBe(200)
    expect(listByTag.data.assets.some((asset) => asset.id === assetId)).toBe(true)

    const deleted = await apiJson<{ success: boolean }>(`/api/assets/${assetId}`, { method: "DELETE" })
    expect(deleted.status).toBe(200)
  })

  it("covers create validation and detail/get/patch/delete branches", async () => {
    const invalidCreate = await apiJson<{ error: unknown }>("/api/assets", {
      method: "POST",
      body: JSON.stringify({ name: "x" }),
    })
    expect(invalidCreate.status).toBe(400)

    const suffix = Date.now()
    const payload: AssetPayload = {
      name: `Asset CRUD ${suffix}`,
      category: "Laptops",
      status: "available",
      locationId,
      value: 1500,
      purchaseDate: "2026-01-20",
      tags: ["crud-acceptance"],
      quantity: 3,
      minimumQuantity: 1,
    }

    const created = await apiJson<{ asset: { id: string; name: string } }>("/api/assets", {
      method: "POST",
      body: JSON.stringify(payload),
    })
    expect(created.status).toBe(201)
    const assetId = created.data.asset.id

    const getById = await apiJson<{ asset: { id: string; name: string; qrCode: string }; history: unknown[]; children: unknown[]; incidents: unknown[] }>(`/api/assets/${assetId}`)
    expect(getById.status).toBe(200)
    expect(getById.data.asset.id).toBe(assetId)
    expect(getById.data.asset.qrCode.length).toBeGreaterThan(0)
    expect(Array.isArray(getById.data.history)).toBe(true)

    const invalidPatch = await apiJson<{ error: unknown }>(`/api/assets/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "x" }),
    })
    expect(invalidPatch.status).toBe(400)

    const patched = await apiJson<{ asset: { id: string; name: string; status: string; tags: string[] } }>(`/api/assets/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...payload,
        name: `${payload.name} Updated`,
        status: "maintenance",
        tags: ["crud-acceptance", "updated"],
      }),
    })
    expect(patched.status).toBe(200)
    expect(patched.data.asset.name).toContain("Updated")
    expect(patched.data.asset.status).toBe("maintenance")
    expect(patched.data.asset.tags).toContain("updated")

    const deleted = await apiJson<{ success: boolean }>(`/api/assets/${assetId}`, { method: "DELETE" })
    expect(deleted.status).toBe(200)

    const missingAfterDelete = await apiJson<{ error: string }>(`/api/assets/${assetId}`)
    expect(missingAfterDelete.status).toBe(404)

    const deleteMissing = await apiJson<{ error: string }>(`/api/assets/${assetId}`, { method: "DELETE" })
    expect(deleteMissing.status).toBe(404)
  })

  it("covers borrow and return logic with required member checks", async () => {
    const borrowMissingMember = await apiJson<{ error: string }>(`/api/assets/${existingAssetId}/borrow`, {
      method: "POST",
      body: JSON.stringify({ action: "borrow" }),
    })
    expect(borrowMissingMember.status).toBe(400)

    const suffix = Date.now()
    const createMember = await apiJson<{ member: { id: string } }>("/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: `Asset Borrow Member ${suffix}`,
        email: `asset-borrow-${suffix}@example.com`,
        role: "member",
      }),
    })
    expect(createMember.status).toBe(201)
    const memberId = createMember.data.member.id

    const borrowed = await apiJson<{ asset: { id: string; assignedTo: string | null } }>(`/api/assets/${existingAssetId}/borrow`, {
      method: "POST",
      body: JSON.stringify({
        action: "borrow",
        memberId,
        dueAt: "2026-12-31T00:00:00.000Z",
        notes: "borrow coverage",
      }),
    })
    expect(borrowed.status).toBe(200)
    expect(borrowed.data.asset.id).toBe(existingAssetId)
    expect(borrowed.data.asset.assignedTo).toContain("Asset Borrow Member")

    const returned = await apiJson<{ asset: { id: string; assignedTo: string | null } }>(`/api/assets/${existingAssetId}/borrow`, {
      method: "POST",
      body: JSON.stringify({ action: "return" }),
    })
    expect(returned.status).toBe(200)
    expect(returned.data.asset.assignedTo).toBeNull()

    const borrowMissingAsset = await apiJson<{ error: string }>("/api/assets/does-not-exist/borrow", {
      method: "POST",
      body: JSON.stringify({ action: "borrow", memberId }),
    })
    expect(borrowMissingAsset.status).toBe(404)
  })

  it("covers duplicate branch and not-found branch", async () => {
    const duplicate = await apiJson<{ asset: { id: string; name: string } }>(`/api/assets/${existingAssetId}/duplicate`, {
      method: "POST",
    })
    expect(duplicate.status).toBe(201)
    const duplicatedId = duplicate.data.asset.id

    const getDuplicated = await apiJson<{ asset: { id: string } }>(`/api/assets/${duplicatedId}`)
    expect(getDuplicated.status).toBe(200)

    const duplicateMissing = await apiJson<{ error: string }>("/api/assets/does-not-exist/duplicate", {
      method: "POST",
    })
    expect(duplicateMissing.status).toBe(404)

    const deleted = await apiJson<{ success: boolean }>(`/api/assets/${duplicatedId}`, { method: "DELETE" })
    expect(deleted.status).toBe(200)
  })

  it("covers files and styled qr sub-routes", async () => {
    const suffix = Date.now()
    const created = await apiJson<{ asset: { id: string } }>("/api/assets", {
      method: "POST",
      body: JSON.stringify({
        name: `Asset Files ${suffix}`,
        category: "Documents",
        status: "available",
        locationId,
        value: 1,
        purchaseDate: "2026-02-01",
        tags: ["files"],
      }),
    })
    expect(created.status).toBe(201)
    const assetId = created.data.asset.id

    const listFilesInitially = await apiJson<{ files: unknown[] }>(`/api/assets/${assetId}/files`)
    expect(listFilesInitially.status).toBe(200)
    expect(listFilesInitially.data.files).toHaveLength(0)

    const noFileForm = new FormData()
    noFileForm.append("kind", "image")
    const missingUpload = await fetch(`${getAcceptanceBaseUrl()}/api/assets/${assetId}/files`, {
      method: "POST",
      headers: { cookie: getSessionCookie("admin") },
      body: noFileForm,
      redirect: "manual",
    })
    expect(missingUpload.status).toBe(400)

    const uploadForm = new FormData()
    uploadForm.append("kind", "document")
    uploadForm.append("file", new File([new Blob(["asset file content"])], "asset-note.txt", { type: "text/plain" }))

    const uploadResponse = await fetch(`${getAcceptanceBaseUrl()}/api/assets/${assetId}/files`, {
      method: "POST",
      headers: { cookie: getSessionCookie("admin") },
      body: uploadForm,
      redirect: "manual",
    })
    expect(uploadResponse.status).toBe(201)
    const uploaded = await uploadResponse.json() as { file: { id: string } }
    const fileId = uploaded.file.id

    const listFilesAfter = await apiJson<{ files: Array<{ id: string }> }>(`/api/assets/${assetId}/files`)
    expect(listFilesAfter.status).toBe(200)
    expect(listFilesAfter.data.files.some((file) => file.id === fileId)).toBe(true)

    const getFile = await fetch(`${getAcceptanceBaseUrl()}/api/assets/${assetId}/files/${fileId}`, {
      headers: { cookie: getSessionCookie("admin") },
      redirect: "manual",
    })
    expect(getFile.status).toBe(200)
    expect(getFile.headers.get("content-type")).toContain("text/plain")

    const downloadFile = await fetch(`${getAcceptanceBaseUrl()}/api/assets/${assetId}/files/${fileId}?download=1`, {
      headers: { cookie: getSessionCookie("admin") },
      redirect: "manual",
    })
    expect(downloadFile.status).toBe(200)
    expect(downloadFile.headers.get("content-disposition")).toContain("attachment")

    const deleteFile = await apiJson<{ success: boolean }>(`/api/assets/${assetId}/files/${fileId}`, { method: "DELETE" })
    expect(deleteFile.status).toBe(200)

    const getDeletedFile = await apiJson<{ error: string }>(`/api/assets/${assetId}/files/${fileId}`)
    expect(getDeletedFile.status).toBe(404)

    const qr = await fetch(`${getAcceptanceBaseUrl()}/api/assets/${assetId}/qr/styled?size=4096`, {
      headers: { cookie: getSessionCookie("admin") },
      redirect: "manual",
    })
    expect(qr.status).toBe(200)
    expect(qr.headers.get("content-type")).toContain("image/svg+xml")
    const qrBody = await qr.text()
    expect(qrBody.includes("<svg")).toBe(true)

    const missingQr = await apiJson<{ error: string }>("/api/assets/does-not-exist/qr/styled")
    expect(missingQr.status).toBe(404)

    const deletedAsset = await apiJson<{ success: boolean }>(`/api/assets/${assetId}`, { method: "DELETE" })
    expect(deletedAsset.status).toBe(200)
  })

  it("covers member role access rules for assets endpoints", async () => {
    const memberGet = await apiJson<{ assets: unknown[] }>("/api/assets", { role: "member" })
    expect(memberGet.status).toBe(200)

    const memberCreate = await apiJson<{ error: string }>("/api/assets", {
      role: "member",
      method: "POST",
      body: JSON.stringify({}),
    })
    expect(memberCreate.status).toBe(403)

    const memberPatch = await apiJson<{ error: string }>(`/api/assets/${existingAssetId}`, {
      role: "member",
      method: "PATCH",
      body: JSON.stringify({}),
    })
    expect(memberPatch.status).toBe(403)

    const memberDelete = await apiJson<{ error: string }>(`/api/assets/${existingAssetId}`, {
      role: "member",
      method: "DELETE",
    })
    expect(memberDelete.status).toBe(403)

    const memberBorrow = await apiJson<{ error: string }>(`/api/assets/${existingAssetId}/borrow`, {
      role: "member",
      method: "POST",
      body: JSON.stringify({ action: "return" }),
    })
    expect(memberBorrow.status).toBe(403)

    const memberDuplicate = await apiJson<{ error: string }>(`/api/assets/${existingAssetId}/duplicate`, {
      role: "member",
      method: "POST",
      body: JSON.stringify({}),
    })
    expect(memberDuplicate.status).toBe(403)
  })
})
