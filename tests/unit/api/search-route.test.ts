import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  listAssets,
  listLocations,
  listManagedCategories,
  listMembers,
  listProducers,
} = vi.hoisted(() => ({
  listAssets: vi.fn(),
  listLocations: vi.fn(),
  listManagedCategories: vi.fn(),
  listMembers: vi.fn(),
  listProducers: vi.fn(),
}))

vi.mock("@/lib/core-repository", () => ({
  listAssets,
  listLocations,
  listManagedCategories,
  listMembers,
  listProducers,
}))

import { GET } from "@/app/api/search/route"

describe("api/search route logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns empty payload for blank query without repository calls", async () => {
    const response = await GET(new Request("http://localhost/api/search?q=   "))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      query: "",
      assets: [],
      producers: [],
      members: [],
      locations: [],
      categories: [],
    })

    expect(listAssets).not.toHaveBeenCalled()
  })

  it("trims and truncates overly long queries", async () => {
    listAssets.mockResolvedValue([])
    listProducers.mockResolvedValue([])
    listMembers.mockResolvedValue([])
    listLocations.mockResolvedValue([])
    listManagedCategories.mockResolvedValue([])

    const long = "a".repeat(200)
    const response = await GET(new Request(`http://localhost/api/search?q=${long}`))
    const payload = await response.json()

    expect(payload.query.length).toBe(120)
  })

  it("classifies direct and related-member asset matches", async () => {
    listAssets.mockResolvedValue([
      {
        id: "AST-1",
        name: "MacBook Pro",
        category: "Laptops",
        status: "available",
        location: "HQ",
        assignedTo: null,
        producerName: "Apple",
        model: "M3",
        serialNumber: "S1",
        sku: "SKU1",
        tags: ["portable"],
      },
      {
        id: "AST-2",
        name: "Dell Monitor",
        category: "Displays",
        status: "in-use",
        location: "HQ",
        assignedTo: "Alex Johnson",
        producerName: "Dell",
        model: "U2720",
        serialNumber: "S2",
        sku: "SKU2",
        tags: ["desk"],
      },
    ])

    listProducers.mockResolvedValue([])
    listMembers.mockResolvedValue([{ id: "MEM-1", name: "Alex Johnson", email: "alex@example.com", role: "member" }])
    listLocations.mockResolvedValue([])
    listManagedCategories.mockResolvedValue([])

    const response = await GET(new Request("http://localhost/api/search?q=example.com"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.members).toHaveLength(1)
    expect(payload.assets.some((entry: { matchType: string }) => entry.matchType === "related-member")).toBe(true)
  })

  it("returns direct asset matches when query hits asset fields", async () => {
    listAssets.mockResolvedValue([
      {
        id: "AST-1",
        name: "MacBook Pro",
        category: "Laptops",
        status: "available",
        location: "HQ",
        assignedTo: null,
        producerName: "Apple",
        model: "M3",
        serialNumber: "S1",
        sku: "SKU1",
        tags: ["portable"],
      },
    ])

    listProducers.mockResolvedValue([])
    listMembers.mockResolvedValue([])
    listLocations.mockResolvedValue([])
    listManagedCategories.mockResolvedValue([])

    const response = await GET(new Request("http://localhost/api/search?q=portable"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.assets).toHaveLength(1)
    expect(payload.assets[0].matchType).toBe("direct")
    expect(payload.assets[0].asset.id).toBe("AST-1")
  })

  it("classifies related producer/location/category asset matches", async () => {
    listAssets.mockResolvedValue([
      {
        id: "AST-P",
        name: "Workstation",
        category: "Compute",
        status: "available",
        location: "Zone A",
        assignedTo: null,
        producerName: "Acme",
        model: "W1",
        serialNumber: "SP",
        sku: "SKUP",
        tags: [],
      },
      {
        id: "AST-L",
        name: "Phone",
        category: "Mobile",
        status: "available",
        location: "HQ Room 1",
        assignedTo: null,
        producerName: "Contoso",
        model: "L1",
        serialNumber: "SL",
        sku: "SKUL",
        tags: [],
      },
      {
        id: "AST-C",
        name: "Display",
        category: "Displays",
        status: "available",
        location: "Warehouse",
        assignedTo: null,
        producerName: "Northwind",
        model: "C1",
        serialNumber: "SC",
        sku: "SKUC",
        tags: [],
      },
    ])

    listProducers.mockResolvedValue([
      {
        id: "PR-1",
        name: "Acme",
        websiteUrl: "https://acme.example",
        domain: "acme.example",
        description: null,
        logoUrl: null,
        sourceUrl: "https://acme.example",
        createdAt: "2024-01-01",
      },
    ])

    listMembers.mockResolvedValue([])

    listLocations.mockResolvedValue([
      {
        id: "LOC-1",
        name: "HQ",
        path: "Campus / HQ Room 1",
        address: "Main Street",
        locationCode: null,
        kind: "room",
      },
    ])

    listManagedCategories.mockResolvedValue([
      { id: "CAT-1", name: "Displays", assetCount: 1 },
    ])

    const producerResponse = await GET(new Request("http://localhost/api/search?q=acme.example"))
    const producerPayload = await producerResponse.json()
    expect(producerPayload.assets.some((entry: { asset: { id: string }; matchType: string }) => entry.asset.id === "AST-P" && entry.matchType === "related-producer")).toBe(true)

    const locationResponse = await GET(new Request("http://localhost/api/search?q=LOC-1"))
    const locationPayload = await locationResponse.json()
    expect(locationPayload.assets.some((entry: { asset: { id: string }; matchType: string }) => entry.asset.id === "AST-L" && entry.matchType === "related-location")).toBe(true)

    const categoryResponse = await GET(new Request("http://localhost/api/search?q=CAT-1"))
    const categoryPayload = await categoryResponse.json()
    expect(categoryPayload.assets.some((entry: { asset: { id: string }; matchType: string }) => entry.asset.id === "AST-C" && entry.matchType === "related-category")).toBe(true)
  })
})
