import { describe, expect, it } from "vitest"
import { apiJson } from "../support/http"

describe("producers.api acceptance", () => {
  it("covers list and manual create logic", async () => {
    const suffix = Date.now()
    const name = `Producer Api ${suffix}`
    const websiteUrl = `https://producer-${suffix}.example.com/path?x=1#hash`

    const created = await apiJson<{ producer: { id: string; name: string; websiteUrl: string; domain: string } }>("/api/producers", {
      method: "POST",
      body: JSON.stringify({
        name,
        websiteUrl,
        description: "Created by producer acceptance",
      }),
    })

    expect(created.status).toBe(201)
    expect(created.data.producer.name).toBe(name)
    expect(created.data.producer.websiteUrl).toBe(`https://producer-${suffix}.example.com`)
    expect(created.data.producer.domain).toBe(`producer-${suffix}.example.com`)

    const listed = await apiJson<{ producers: Array<{ id: string; name: string }> }>("/api/producers")
    expect(listed.status).toBe(200)
    expect(listed.data.producers.some((producer) => producer.id === created.data.producer.id)).toBe(true)
  })

  it("covers validation and import-url error branch", async () => {
    const invalid = await apiJson<{ error: unknown }>("/api/producers", {
      method: "POST",
      body: JSON.stringify({
        name: "x",
      }),
    })
    expect(invalid.status).toBe(400)

    const importFailure = await apiJson<{ error: string }>("/api/producers", {
      method: "POST",
      body: JSON.stringify({
        url: "http://127.0.0.1:1",
      }),
    })
    expect(importFailure.status).toBe(400)
  })

  it("covers patch and delete branches including not-found", async () => {
    const suffix = Date.now()
    const created = await apiJson<{ producer: { id: string } }>("/api/producers", {
      method: "POST",
      body: JSON.stringify({
        name: `Patch Producer ${suffix}`,
        websiteUrl: `https://patch-${suffix}.example.com`,
      }),
    })
    expect(created.status).toBe(201)
    const producerId = created.data.producer.id

    const invalidPatch = await apiJson<{ error: unknown }>(`/api/producers/${producerId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: "x",
      }),
    })
    expect(invalidPatch.status).toBe(400)

    const patched = await apiJson<{ producer: { id: string; name: string; websiteUrl: string; domain: string } }>(`/api/producers/${producerId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: `Patch Producer ${suffix} Updated`,
        websiteUrl: `https://www.patch-${suffix}-updated.example.com/abc?q=1`,
        description: "Updated description",
        logoUrl: "https://cdn.example.com/logo.png",
        sourceUrl: "https://source.example.com/reference",
      }),
    })

    expect(patched.status).toBe(200)
    expect(patched.data.producer.name).toContain("Updated")
    expect(patched.data.producer.websiteUrl).toBe(`https://www.patch-${suffix}-updated.example.com`)
    expect(patched.data.producer.domain).toBe(`patch-${suffix}-updated.example.com`)

    const deleted = await apiJson<{ success: boolean }>(`/api/producers/${producerId}`, { method: "DELETE" })
    expect(deleted.status).toBe(200)

    const deleteMissing = await apiJson<{ error: string }>(`/api/producers/${producerId}`, { method: "DELETE" })
    expect(deleteMissing.status).toBe(404)

    const patchMissing = await apiJson<{ error: string }>(`/api/producers/does-not-exist`, {
      method: "PATCH",
      body: JSON.stringify({
        name: "Missing Producer",
        websiteUrl: "https://missing.example.com",
      }),
    })
    expect(patchMissing.status).toBe(404)
  })

  it("covers member and unauth access behavior", async () => {
    const memberGet = await apiJson<{ producers: unknown[] }>("/api/producers", { role: "member" })
    expect(memberGet.status).toBe(200)

    const memberPost = await apiJson<{ error: string }>("/api/producers", {
      role: "member",
      method: "POST",
      body: JSON.stringify({
        name: "Denied Producer",
        websiteUrl: "https://denied.example.com",
      }),
    })
    expect(memberPost.status).toBe(403)

    const memberPatch = await apiJson<{ error: string }>("/api/producers/does-not-exist", {
      role: "member",
      method: "PATCH",
      body: JSON.stringify({
        name: "Denied Producer",
        websiteUrl: "https://denied.example.com",
      }),
    })
    expect(memberPatch.status).toBe(403)

    const memberDelete = await apiJson<{ error: string }>("/api/producers/does-not-exist", {
      role: "member",
      method: "DELETE",
    })
    expect(memberDelete.status).toBe(403)

    const unauthGet = await apiJson<{ error: string }>("/api/producers", { role: "none" })
    expect(unauthGet.status).toBe(401)
  })
})
