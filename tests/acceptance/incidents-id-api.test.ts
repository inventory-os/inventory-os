import { beforeEach, describe, expect, it, vi } from "vitest"

const listIncidents = vi.fn()
const updateIncident = vi.fn()
const deleteIncident = vi.fn()
const recordActivityEvent = vi.fn()
const findAuthUserById = vi.fn()
const findMemberIdByEmail = vi.fn()
const removeStoredIncidentFile = vi.fn()
const getSessionFromRequest = vi.fn()

vi.mock("@/lib/core-repository", () => ({
  listIncidents,
  updateIncident,
  deleteIncident,
  recordActivityEvent,
  findAuthUserById,
  findMemberIdByEmail,
}))

vi.mock("@/lib/asset-storage", () => ({
  removeStoredIncidentFile,
}))

vi.mock("@/lib/auth-session", () => ({
  getSessionFromRequest,
}))

describe("incidents API (/api/incidents/[id])", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 404 for unknown incident in GET", async () => {
    listIncidents.mockResolvedValue([])

    const { GET } = await import("@/app/api/incidents/[id]/route")
    const response = await GET(new Request("http://localhost/api/incidents/INC-404"), { params: Promise.resolve({ id: "INC-404" }) })

    expect(response.status).toBe(404)
  })

  it("validates PATCH payload", async () => {
    const { PATCH } = await import("@/app/api/incidents/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/incidents/INC-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    }) as never, { params: Promise.resolve({ id: "INC-1" }) })

    expect(response.status).toBe(400)
    expect(updateIncident).not.toHaveBeenCalled()
  })

  it("deletes incident and cleans attachment storage keys", async () => {
    getSessionFromRequest.mockReturnValue({ uid: "user-1" })
    findAuthUserById.mockResolvedValue({ email: "admin@example.com", displayName: "Admin" })
    findMemberIdByEmail.mockResolvedValue("MEM-1")
    deleteIncident.mockResolvedValue({
      incident: { assetId: "AST-1", assetName: "Laptop", title: "Broken" },
      storageKeys: ["incident/a.png", "incident/b.pdf"],
    })

    const { DELETE } = await import("@/app/api/incidents/[id]/route")
    const response = await DELETE(new Request("http://localhost/api/incidents/INC-1", { method: "DELETE" }) as never, {
      params: Promise.resolve({ id: "INC-1" }),
    })

    expect(response.status).toBe(200)
    expect(removeStoredIncidentFile).toHaveBeenCalledTimes(2)
    expect(recordActivityEvent).toHaveBeenCalledTimes(1)
  })
})
