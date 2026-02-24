import { beforeAll, describe, expect, it } from "vitest"
import { getAcceptanceBaseUrl } from "../support/acceptance-env"
import { apiJson, ensureBaseData, getSessionCookie } from "../support/http"

describe("incidents.api acceptance", () => {
  let assetId = ""

  beforeAll(async () => {
    const seed = await ensureBaseData()
    assetId = seed.assetId
  })

  it("covers list filtering and pagination logic", async () => {
    const suffix = Date.now()
    const title = `Incident Coverage ${suffix}`

    const created = await apiJson<{ incident: { id: string; assetId: string } }>("/api/incidents", {
      method: "POST",
      body: JSON.stringify({
        assetId,
        incidentType: "damage",
        title,
        description: "Screen is cracked after a drop.",
        severity: "high",
      }),
    })
    expect(created.status).toBe(201)
    const incidentId = created.data.incident.id

    const filtered = await apiJson<{
      incidents: Array<{ id: string; title: string; severity: string }>
      counts: { open: number; investigating: number; resolved: number; critical: number }
      pagination: { page: number; pageSize: number; total: number; totalPages: number }
    }>(`/api/incidents?page=1&pageSize=20&assetId=${assetId}&severity=high&status=all&search=${encodeURIComponent("Incident Coverage")}`)

    expect(filtered.status).toBe(200)
    expect(filtered.data.incidents.some((entry) => entry.id === incidentId && entry.title === title)).toBe(true)
    expect(filtered.data.pagination.total).toBeGreaterThan(0)
    expect(filtered.data.counts.open).toBeGreaterThan(0)
  })

  it("covers create validation plus get/patch/delete branches", async () => {
    const invalidCreate = await apiJson<{ error: unknown }>("/api/incidents", {
      method: "POST",
      body: JSON.stringify({
        assetId,
        incidentType: "damage",
        title: "x",
      }),
    })
    expect(invalidCreate.status).toBe(400)

    const suffix = Date.now()
    const created = await apiJson<{ incident: { id: string; status: string; severity: string } }>("/api/incidents", {
      method: "POST",
      body: JSON.stringify({
        assetId,
        incidentType: "other",
        title: `Incident CRUD ${suffix}`,
        description: "Needs triage and root-cause analysis.",
        severity: "medium",
        occurredAt: "2026-02-20T08:00:00.000Z",
        estimatedRepairCost: 120,
      }),
    })
    expect(created.status).toBe(201)
    const incidentId = created.data.incident.id

    const getById = await apiJson<{ incident: { id: string; status: string; severity: string } }>(`/api/incidents/${incidentId}`)
    expect(getById.status).toBe(200)
    expect(getById.data.incident.id).toBe(incidentId)
    expect(getById.data.incident.status).toBe("open")

    const invalidPatch = await apiJson<{ error: unknown }>(`/api/incidents/${incidentId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "x" }),
    })
    expect(invalidPatch.status).toBe(400)

    const patched = await apiJson<{ incident: { id: string; status: string; resolutionNotes: string | null; severity: string } }>(`/api/incidents/${incidentId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "resolved",
        resolutionNotes: "Replaced panel and verified operation.",
        severity: "low",
      }),
    })
    expect(patched.status).toBe(200)
    expect(patched.data.incident.status).toBe("resolved")
    expect(patched.data.incident.resolutionNotes).toContain("Replaced panel")
    expect(patched.data.incident.severity).toBe("low")

    const deleted = await apiJson<{ success: boolean }>(`/api/incidents/${incidentId}`, { method: "DELETE" })
    expect(deleted.status).toBe(200)

    const missingGet = await apiJson<{ error: string }>(`/api/incidents/${incidentId}`)
    expect(missingGet.status).toBe(404)

    const missingDelete = await apiJson<{ error: string }>(`/api/incidents/${incidentId}`, { method: "DELETE" })
    expect(missingDelete.status).toBe(404)
  })

  it("covers incident file sub-routes including upload, download and delete", async () => {
    const createdIncident = await apiJson<{ incident: { id: string } }>("/api/incidents", {
      method: "POST",
      body: JSON.stringify({
        assetId,
        incidentType: "malfunction",
        title: `Incident File ${Date.now()}`,
        description: "Requires log and screenshot attachments.",
        severity: "medium",
      }),
    })
    expect(createdIncident.status).toBe(201)
    const incidentId = createdIncident.data.incident.id

    const initialList = await apiJson<{ files: unknown[] }>(`/api/incidents/${incidentId}/files`)
    expect(initialList.status).toBe(200)
    expect(initialList.data.files).toHaveLength(0)

    const missingFileForm = new FormData()
    missingFileForm.append("kind", "document")
    const missingFileUpload = await fetch(`${getAcceptanceBaseUrl()}/api/incidents/${incidentId}/files`, {
      method: "POST",
      headers: { cookie: getSessionCookie("admin") },
      body: missingFileForm,
      redirect: "manual",
    })
    expect(missingFileUpload.status).toBe(400)

    const uploadForm = new FormData()
    uploadForm.append("kind", "document")
    uploadForm.append("file", new File([new Blob(["incident details"])], "incident-note.txt", { type: "text/plain" }))

    const uploadResponse = await fetch(`${getAcceptanceBaseUrl()}/api/incidents/${incidentId}/files`, {
      method: "POST",
      headers: { cookie: getSessionCookie("admin") },
      body: uploadForm,
      redirect: "manual",
    })
    expect(uploadResponse.status).toBe(201)
    const uploaded = await uploadResponse.json() as { file: { id: string } }
    const fileId = uploaded.file.id

    const listed = await apiJson<{ files: Array<{ id: string }> }>(`/api/incidents/${incidentId}/files`)
    expect(listed.status).toBe(200)
    expect(listed.data.files.some((file) => file.id === fileId)).toBe(true)

    const getFile = await fetch(`${getAcceptanceBaseUrl()}/api/incidents/${incidentId}/files/${fileId}`, {
      headers: { cookie: getSessionCookie("admin") },
      redirect: "manual",
    })
    expect(getFile.status).toBe(200)
    expect(getFile.headers.get("content-type")).toContain("text/plain")

    const downloadFile = await fetch(`${getAcceptanceBaseUrl()}/api/incidents/${incidentId}/files/${fileId}?download=1`, {
      headers: { cookie: getSessionCookie("admin") },
      redirect: "manual",
    })
    expect(downloadFile.status).toBe(200)
    expect(downloadFile.headers.get("content-disposition")).toContain("attachment")

    const deletedFile = await apiJson<{ success: boolean }>(`/api/incidents/${incidentId}/files/${fileId}`, { method: "DELETE" })
    expect(deletedFile.status).toBe(200)

    const missingFile = await apiJson<{ error: string }>(`/api/incidents/${incidentId}/files/${fileId}`)
    expect(missingFile.status).toBe(404)

    const deletedIncident = await apiJson<{ success: boolean }>(`/api/incidents/${incidentId}`, { method: "DELETE" })
    expect(deletedIncident.status).toBe(200)
  })

  it("covers role-based access rules for incidents endpoints", async () => {
    const memberList = await apiJson<{ error: string }>("/api/incidents", { role: "member" })
    expect(memberList.status).toBe(403)

    const memberCreate = await apiJson<{ error: string }>("/api/incidents", {
      role: "member",
      method: "POST",
      body: JSON.stringify({}),
    })
    expect(memberCreate.status).toBe(403)

    const memberGetById = await apiJson<{ error: string }>("/api/incidents/does-not-exist", { role: "member" })
    expect(memberGetById.status).toBe(403)

    const memberFiles = await apiJson<{ error: string }>("/api/incidents/does-not-exist/files", { role: "member" })
    expect(memberFiles.status).toBe(403)
  })
})
