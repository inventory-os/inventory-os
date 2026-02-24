import { describe, expect, it } from "vitest"
import { apiJson } from "../support/http"

describe("addresses.api acceptance", () => {
  it("covers get and create with validation", async () => {
    const invalidCreate = await apiJson<{ error: unknown }>("/api/addresses", {
      method: "POST",
      body: JSON.stringify({ label: "x" }),
    })
    expect(invalidCreate.status).toBe(400)

    const suffix = Date.now()
    const create = await apiJson<{ address: { id: string; label: string; city: string } }>("/api/addresses", {
      method: "POST",
      body: JSON.stringify({
        label: `Address API ${suffix}`,
        addressLine1: "Main Street 1",
        addressLine2: "Floor 2",
        postalCode: "12345",
        city: "Berlin",
        country: "Germany",
      }),
    })
    expect(create.status).toBe(201)
    const addressId = create.data.address.id

    const listed = await apiJson<{ addresses: Array<{ id: string; label: string }> }>("/api/addresses")
    expect(listed.status).toBe(200)
    expect(listed.data.addresses.some((entry) => entry.id === addressId)).toBe(true)
  })

  it("covers patch/delete branches including validation and not-found", async () => {
    const suffix = Date.now()
    const created = await apiJson<{ address: { id: string } }>("/api/addresses", {
      method: "POST",
      body: JSON.stringify({
        label: `Patch Address ${suffix}`,
        addressLine1: "Old Street 1",
        postalCode: "54321",
        city: "Munich",
        country: "Germany",
      }),
    })
    expect(created.status).toBe(201)
    const addressId = created.data.address.id

    const invalidPatch = await apiJson<{ error: unknown }>(`/api/addresses/${addressId}`, {
      method: "PATCH",
      body: JSON.stringify({ label: "x" }),
    })
    expect(invalidPatch.status).toBe(400)

    const patched = await apiJson<{ address: { id: string; label: string; addressLine1: string } }>(`/api/addresses/${addressId}`, {
      method: "PATCH",
      body: JSON.stringify({
        label: `Patch Address ${suffix} Updated`,
        addressLine1: "New Street 99",
        addressLine2: "Suite 7",
        postalCode: "10115",
        city: "Berlin",
        country: "Germany",
      }),
    })
    expect(patched.status).toBe(200)
    expect(patched.data.address.label).toContain("Updated")
    expect(patched.data.address.addressLine1).toBe("New Street 99")

    const patchMissing = await apiJson<{ error: string }>("/api/addresses/does-not-exist", {
      method: "PATCH",
      body: JSON.stringify({
        label: "Missing",
        addressLine1: "Missing Street",
        postalCode: "00000",
        city: "Nowhere",
        country: "None",
      }),
    })
    expect(patchMissing.status).toBe(404)

    const deleted = await apiJson<{ success: boolean }>(`/api/addresses/${addressId}`, { method: "DELETE" })
    expect(deleted.status).toBe(200)

    const deleteMissing = await apiJson<{ error: string }>(`/api/addresses/${addressId}`, { method: "DELETE" })
    expect(deleteMissing.status).toBe(404)
  })

  it("covers member and unauth access behavior", async () => {
    const memberGet = await apiJson<{ addresses: unknown[] }>("/api/addresses", { role: "member" })
    expect(memberGet.status).toBe(200)

    const memberPost = await apiJson<{ error: string }>("/api/addresses", {
      role: "member",
      method: "POST",
      body: JSON.stringify({
        label: "Denied Address",
        addressLine1: "Denied Street",
        postalCode: "99999",
        city: "Denied City",
        country: "Denied Country",
      }),
    })
    expect(memberPost.status).toBe(403)

    const memberPatch = await apiJson<{ error: string }>("/api/addresses/does-not-exist", {
      role: "member",
      method: "PATCH",
      body: JSON.stringify({
        label: "Denied Address",
        addressLine1: "Denied Street",
        postalCode: "99999",
        city: "Denied City",
        country: "Denied Country",
      }),
    })
    expect(memberPatch.status).toBe(403)

    const memberDelete = await apiJson<{ error: string }>("/api/addresses/does-not-exist", {
      role: "member",
      method: "DELETE",
    })
    expect(memberDelete.status).toBe(403)

    const unauthGet = await apiJson<{ error: string }>("/api/addresses", { role: "none" })
    expect(unauthGet.status).toBe(401)
  })
})
