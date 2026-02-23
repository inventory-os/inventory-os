import { beforeEach, describe, expect, it, vi } from "vitest"

const listIncidents = vi.fn()
const createIncident = vi.fn()
const recordActivityEvent = vi.fn()
const findAuthUserById = vi.fn()
const findMemberIdByEmail = vi.fn()
const getSessionFromRequest = vi.fn()

vi.mock("@/lib/core-repository", () => ({
  listIncidents,
  createIncident,
  recordActivityEvent,
  findAuthUserById,
  findMemberIdByEmail,
}))

vi.mock("@/lib/auth-session", () => ({
  getSessionFromRequest,
}))

describe("incidents API (/api/incidents)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns paginated incidents with counts", async () => {
    const items = [
      {
        id: "INC-1",
        assetId: "AST-1",
        assetName: "Laptop A",
        incidentType: "damage",
        title: "High severity",
        description: "Broken",
        severity: "high",
        status: "open",
        reportedBy: "Alice",
        reportedAt: new Date().toISOString(),
        resolvedAt: null,
        resolutionNotes: null,
        attachmentCount: 0,
        occurredAt: null,
        estimatedRepairCost: null,
        updatedAt: new Date().toISOString(),
      },
      {
        id: "INC-2",
        assetId: "AST-1",
        assetName: "Laptop A",
        incidentType: "other",
        title: "Low severity",
        description: "Scratch",
        severity: "low",
        status: "resolved",
        reportedBy: "Bob",
        reportedAt: new Date().toISOString(),
        resolvedAt: new Date().toISOString(),
        resolutionNotes: null,
        attachmentCount: 1,
        occurredAt: null,
        estimatedRepairCost: 10,
        updatedAt: new Date().toISOString(),
      },
    ]
    listIncidents.mockResolvedValue(items)

    const { GET } = await import("@/app/api/incidents/route")
    const response = await GET(new Request("http://localhost/api/incidents?page=1&pageSize=1&severity=high&status=all&assetId=AST-1&search=laptop"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(listIncidents).toHaveBeenCalledWith({
      assetId: "AST-1",
      status: "all",
      search: "laptop",
    })

    expect(payload.incidents).toHaveLength(1)
    expect(payload.incidents[0].id).toBe("INC-1")
    expect(payload.pagination).toMatchObject({ page: 1, pageSize: 1, total: 1, totalPages: 1 })
    expect(payload.counts).toMatchObject({ open: 1, investigating: 0, resolved: 0, critical: 0 })
  })

  it("validates create payload", async () => {
    const { POST } = await import("@/app/api/incidents/route")

    const response = await POST(new Request("http://localhost/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    }) as never)

    expect(response.status).toBe(400)
    expect(createIncident).not.toHaveBeenCalled()
  })

  it("creates incident and records activity", async () => {
    getSessionFromRequest.mockReturnValue(null)
    createIncident.mockResolvedValue({
      id: "INC-9",
      assetId: "AST-1",
      assetName: "Laptop",
      incidentType: "damage",
      title: "Screen crack",
      description: "Cracked",
      severity: "high",
      status: "open",
      reportedBy: "System",
      reportedAt: new Date().toISOString(),
      resolvedAt: null,
      resolutionNotes: null,
      attachmentCount: 0,
      occurredAt: null,
      estimatedRepairCost: null,
      updatedAt: new Date().toISOString(),
    })

    const { POST } = await import("@/app/api/incidents/route")
    const response = await POST(new Request("http://localhost/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: "AST-1",
        incidentType: "damage",
        title: "Screen crack",
        description: "Cracked",
        severity: "high",
      }),
    }) as never)

    expect(response.status).toBe(201)
    expect(createIncident).toHaveBeenCalledWith(expect.objectContaining({ reportedBy: "System" }))
    expect(recordActivityEvent).toHaveBeenCalledTimes(1)
  })
})
