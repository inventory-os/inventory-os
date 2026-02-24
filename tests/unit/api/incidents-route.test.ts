import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  createIncident,
  findAuthUserById,
  findMemberIdByEmail,
  listIncidents,
  recordActivityEvent,
  getSessionFromRequest,
} = vi.hoisted(() => ({
  createIncident: vi.fn(),
  findAuthUserById: vi.fn(),
  findMemberIdByEmail: vi.fn(),
  listIncidents: vi.fn(),
  recordActivityEvent: vi.fn(),
  getSessionFromRequest: vi.fn(),
}))

vi.mock("@/lib/core-repository", () => ({
  createIncident,
  findAuthUserById,
  findMemberIdByEmail,
  listIncidents,
  recordActivityEvent,
}))

vi.mock("@/lib/auth-session", () => ({
  getSessionFromRequest,
}))

import { GET, POST } from "@/app/api/incidents/route"

describe("api/incidents route logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("GET applies severity filter and pagination", async () => {
    listIncidents.mockResolvedValue([
      { id: "INC-1", status: "open", severity: "high" },
      { id: "INC-2", status: "resolved", severity: "high" },
      { id: "INC-3", status: "investigating", severity: "low" },
    ])

    const response = await GET(new Request("http://localhost/api/incidents?page=2&pageSize=1&severity=high"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(listIncidents).toHaveBeenCalledWith({
      assetId: undefined,
      status: "all",
      search: undefined,
    })
    expect(payload.incidents).toEqual([{ id: "INC-2", status: "resolved", severity: "high" }])
    expect(payload.counts).toEqual({ open: 1, investigating: 0, resolved: 1, critical: 0 })
    expect(payload.pagination).toEqual({ page: 2, pageSize: 1, total: 2, totalPages: 2 })
  })

  it("POST rejects invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/incidents", {
        method: "POST",
        body: JSON.stringify({ title: "x" }),
      }) as never,
    )

    expect(response.status).toBe(400)
    expect(createIncident).not.toHaveBeenCalled()
  })

  it("POST creates incident and records activity", async () => {
    getSessionFromRequest.mockReturnValue({ uid: "USR-1" })
    findAuthUserById.mockResolvedValue({ displayName: "Alex", email: "alex@example.com" })
    findMemberIdByEmail.mockResolvedValue("MEM-1")
    createIncident.mockResolvedValue({
      id: "INC-9",
      assetId: "AST-1",
      assetName: "MacBook",
      title: "Screen damage",
    })

    const response = await POST(
      new Request("http://localhost/api/incidents", {
        method: "POST",
        body: JSON.stringify({
          assetId: "AST-1",
          incidentType: "damage",
          title: "Screen damage",
          description: "Display cracked badly",
          severity: "high",
          occurredAt: null,
          estimatedRepairCost: 250,
        }),
      }) as never,
    )

    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.incident.id).toBe("INC-9")
    expect(createIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: "AST-1",
        title: "Screen damage",
        reportedBy: "Alex",
      }),
    )
    expect(recordActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "asset.incident.create",
        actorMemberId: "MEM-1",
        actorName: "Alex",
        subjectId: "AST-1",
      }),
    )
  })

  it("POST returns 400 on repository errors", async () => {
    getSessionFromRequest.mockReturnValue(null)
    createIncident.mockRejectedValue(new Error("boom"))

    const response = await POST(
      new Request("http://localhost/api/incidents", {
        method: "POST",
        body: JSON.stringify({
          assetId: "AST-1",
          incidentType: "damage",
          title: "Screen damage",
          description: "Display cracked badly",
          severity: "high",
        }),
      }) as never,
    )

    const payload = await response.json()
    expect(response.status).toBe(400)
    expect(payload.error).toBe("boom")
  })
})
