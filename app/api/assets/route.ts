import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAsset, findAuthUserById, findMemberIdByEmail, listAssets, notifyLowInventoryForAsset, recordActivityEvent } from "@/lib/core-repository"
import { buildAssetQrPayload } from "@/lib/qr-payload"
import { getSessionFromRequest } from "@/lib/auth-session"

const assetCategorySchema = z.string().trim().min(2).max(80)

const createAssetSchema = z.object({
  name: z.string().min(2),
  parentAssetId: z.string().nullable().optional(),
  category: assetCategorySchema,
  status: z.enum(["available", "in-use", "maintenance", "retired"]),
  producerId: z.string().nullable().optional(),
  model: z.string().trim().max(120).optional().nullable(),
  serialNumber: z.string().trim().max(160).optional().nullable(),
  sku: z.string().trim().max(80).optional().nullable(),
  supplier: z.string().trim().max(160).optional().nullable(),
  warrantyUntil: z.string().trim().optional().nullable(),
  condition: z.enum(["new", "good", "fair", "damaged"]).optional(),
  quantity: z.number().int().positive().optional(),
  minimumQuantity: z.number().int().nonnegative().optional(),
  notes: z.string().max(4000).optional().nullable(),
  locationId: z.string().nullable(),
  value: z.number().nonnegative(),
  purchaseDate: z.string().min(10),
  tags: z.array(z.string()).default([]),
})

export async function GET(request: Request) {
  const assets = await listAssets()

  const searchParams = new URL(request.url).searchParams

  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1)
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? 10) || 10
  const pageSize = Math.min(100, Math.max(1, pageSizeRaw))
  const search = (searchParams.get("search") ?? "").trim().toLowerCase()
  const status = (searchParams.get("status") ?? "all").trim().toLowerCase()
  const category = (searchParams.get("category") ?? "all").trim().toLowerCase()
  const tag = (searchParams.get("tag") ?? "all").trim().toLowerCase()

  const searchTerms = search
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  const filtered = assets.filter((asset) => {
    const searchable = [
      asset.id,
      asset.name,
      asset.category,
      asset.status,
      asset.location,
      asset.assignedTo ?? "",
      asset.producerName ?? "",
      asset.model ?? "",
      asset.serialNumber ?? "",
      asset.sku ?? "",
      asset.supplier ?? "",
      asset.notes ?? "",
      ...asset.tags,
    ]
      .join(" ")
      .toLowerCase()

    const matchesSearch = searchTerms.length === 0 || searchTerms.every((term) => searchable.includes(term))
    const matchesStatus = status === "all" || asset.status === status
    const matchesCategory = category === "all" || asset.category.toLowerCase() === category
    const matchesTag = tag === "all" || asset.tags.some((entry) => entry.toLowerCase() === tag)

    return matchesSearch && matchesStatus && matchesCategory && matchesTag
  })

  const total = filtered.length
  const start = (page - 1) * pageSize
  const paged = filtered.slice(start, start + pageSize)

  return NextResponse.json({
    assets: paged.map((asset) => ({
      ...asset,
      qrCode: buildAssetQrPayload(asset.id),
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = createAssetSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  let asset
  try {
    asset = await createAsset(parsed.data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create asset" },
      { status: 400 },
    )
  }

  const session = getSessionFromRequest(request)
  const authUser = session ? await findAuthUserById(session.uid) : null
  const actorName = authUser?.displayName ?? "System"
  const actorMemberId = authUser ? await findMemberIdByEmail(authUser.email) : null

  await recordActivityEvent({
    type: "asset.create",
    actorMemberId,
    actorName,
    subjectType: "asset",
    subjectId: asset.id,
    subjectName: asset.name,
    message: `${actorName} created asset ${asset.name}.`,
  })

  await notifyLowInventoryForAsset({
    assetId: asset.id,
    assetName: asset.name,
    quantity: asset.quantity ?? 0,
    minimumQuantity: asset.minimumQuantity ?? 0,
  })
  return NextResponse.json({ asset }, { status: 201 })
}
