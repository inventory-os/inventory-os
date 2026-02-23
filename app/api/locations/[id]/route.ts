import { NextResponse } from "next/server"
import { toPublicErrorMessage } from "@/lib/api-error"
import { deleteLocation, getLocationById, listAssetsByLocationTree, listLocations } from "@/lib/core-repository"
import { buildLocationQrPayload } from "@/lib/qr-payload"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)

  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1)
  const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") ?? "10") || 10, 1), 100)
  const search = (searchParams.get("search") ?? "").trim().toLowerCase()
  const status = (searchParams.get("status") ?? "all").trim().toLowerCase()
  const category = (searchParams.get("category") ?? "all").trim().toLowerCase()

  const [location, allLocations, allAssets] = await Promise.all([
    getLocationById(id),
    listLocations(),
    listAssetsByLocationTree(id),
  ])

  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 })
  }

  const parent = location.parentId ? allLocations.find((entry) => entry.id === location.parentId) ?? null : null
  const children = allLocations.filter((entry) => entry.parentId === location.id)
  const assetCategories = Array.from(new Set(allAssets.map((asset) => asset.category))).sort((left, right) =>
    left.localeCompare(right),
  )

  const searchTerms = search
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  const filteredAssets = allAssets.filter((asset) => {
    const searchable = [asset.id, asset.name, asset.location, asset.category, asset.status, asset.assignedTo ?? ""]
      .join(" ")
      .toLowerCase()

    const matchesSearch = searchTerms.length === 0 || searchTerms.every((term) => searchable.includes(term))
    const matchesStatus = status === "all" || asset.status.toLowerCase() === status
    const matchesCategory = category === "all" || asset.category.toLowerCase() === category

    return matchesSearch && matchesStatus && matchesCategory
  })

  const total = filteredAssets.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const assets = filteredAssets.slice(start, start + pageSize)

  return NextResponse.json({
    location,
    parent,
    children,
    assets,
    assetCategories,
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
    qrPayload: buildLocationQrPayload(location.id),
  })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const deleted = await deleteLocation(id)
    if (!deleted) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: toPublicErrorMessage(error, "Failed to delete location") }, { status: 400 })
  }
}
