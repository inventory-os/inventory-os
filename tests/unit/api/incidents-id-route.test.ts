import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  deleteIncident,
  findAuthUserById,
  findMemberIdByEmail,
  listIncidents,
  recordActivityEvent,
  updateIncident,
  getSessionFromRequest,
  removeStoredIncidentFile,
} = vi.hoisted(() => ({
  deleteIncident: vi.fn(),
  findAuthUserById: vi.fn(),
  findMemberIdByEmail: vi.fn(),
  listIncidents: vi.fn(),
  recordActivityEvent: vi.fn(),
  updateIncident: vi.fn(),
  getSessionFromRequest: vi.fn(),
  removeStoredIncidentFile: vi.fn(),
}))

vi.mock("@/lib/core-repository", () => ({
  deleteIncident,
  findAuthUserById,
  findMemberIdByEmail,
  listIncidents,
  recordActivityEvent,
  updateIncident,
}))

vi.mock("@/lib/auth-session", () => ({
  getSessionFromRequest,
}))

vi.mock("@/lib/asset-storage", () => ({
  removeStoredIncidentFile,
}))

import { DELETE, GET, PATCH } from "@/app/api/incidents/[id]/route"

describe("api/incidents/[id] route logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("GET returns 404 when incident does not exist", async () => {
    listIncidents.mockResolvedValue([])

    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "INC-404" }),
    })

    expect(response.status).toBe(404)
  })

  it("PATCH validates payload and returns 400 for invalid input", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ title: "x" }),
      }) as never,
      { params: Promise.resolve({ id: "INC-1" }) },
    )

    expect(response.status).toBe(400)
    expect(updateIncident).not.toHaveBeenCalled()
  })

  it("PATCH returns 404 for unknown incident", async () => {
    updateIncident.mockResolvedValue(null)

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ title: "Valid title", description: "Valid enough description", severity: "low" }),
      }) as never,
      { params: Promise.resolve({ id: "INC-1" }) },
    )

    expect(response.status).toBe(404)
  })

  it("PATCH updates incident and records activity", async () => {
    updateIncident.mockResolvedValue({
      id: "INC-1",
      title: "Updated",
      status: "investigating",
      assetId: "AST-1",
      assetName: "MacBook",
    })
    getSessionFromRequest.mockReturnValue({ uid: "USR-1" })
    findAuthUserById.mockResolvedValue({ displayName: "Alex", email: "alex@example.com" })
    findMemberIdByEmail.mockResolvedValue("MEM-1")

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated", description: "Valid enough description", severity: "high", status: "investigating" }),
      }) as never,
      { params: Promise.resolve({ id: "INC-1" }) },
    )

    expect(response.status).toBe(200)
    expect(recordActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "asset.incident.update",
        actorName: "Alex",
        actorMemberId: "MEM-1",
      }),
    )
  })

  it("DELETE removes incident and storage files", async () => {
    getSessionFromRequest.mockReturnValue({ uid: "USR-1" })
    findAuthUserById.mockResolvedValue({ displayName: "Alex", email: "alex@example.com" })
    findMemberIdByEmail.mockResolvedValue("MEM-1")
    deleteIncident.mockResolvedValue({
      incident: { id: "INC-1", title: "Screen damage", assetId: "AST-1", assetName: "MacBook" },
      storageKeys: ["one", "two"],
    })

    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }) as never, {
      params: Promise.resolve({ id: "INC-1" }),
    })

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(removeStoredIncidentFile).toHaveBeenCalledTimes(2)
    expect(recordActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "asset.incident.delete",
        subjectId: "AST-1",
      }),
    )
  })
})
