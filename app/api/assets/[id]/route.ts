import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { deleteAsset, findAuthUserById, findMemberIdByEmail, getAssetById, getAssetHistory, getOpenLoanForAsset, listAssetChildren, listAssetIncidents, notifyAssetStatusChanged, notifyLowInventoryForAsset, recordActivityEvent, updateAsset } from "@/lib/core-repository"
import { buildAssetQrPayload } from "@/lib/qr-payload"
import { getSessionFromRequest } from "@/lib/auth-session"

const assetCategorySchema = z.string().trim().min(2).max(80)

const updateAssetSchema = z.object({
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

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [asset, children, incidents] = await Promise.all([
    getAssetById(id),
    listAssetChildren(id),
    listAssetIncidents(id),
  ])

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 })
  }

  const history = await getAssetHistory(id)
  return NextResponse.json({
    asset: {
      ...asset,
      qrCode: buildAssetQrPayload(asset.id),
    },
    history,
    children,
    incidents,
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = updateAssetSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const previousAsset = await getAssetById(id)
  const openLoan = previousAsset ? await getOpenLoanForAsset(id) : null
  const session = getSessionFromRequest(request)
  const authUser = session ? await findAuthUserById(session.uid) : null
  const actorName = authUser?.displayName ?? "System"
  const actorMemberId = authUser ? await findMemberIdByEmail(authUser.email) : null

  let asset
  try {
    asset = await updateAsset(id, parsed.data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update asset" },
      { status: 400 },
    )
  }
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 })
  }

  if (previousAsset && previousAsset.status !== asset.status) {
    await notifyAssetStatusChanged({
      assetId: asset.id,
      assetName: asset.name,
      fromStatus: previousAsset.status,
      toStatus: asset.status,
      assignedMemberId: openLoan?.memberId ?? null,
    })
    await recordActivityEvent({
      type: "asset.status",
      actorMemberId,
      actorName,
      subjectType: "asset",
      subjectId: asset.id,
      subjectName: asset.name,
      message: `${actorName} changed ${asset.name} status from ${previousAsset.status} to ${asset.status}.`,
    })
  }

  await notifyLowInventoryForAsset({
    assetId: asset.id,
    assetName: asset.name,
    quantity: asset.quantity ?? 0,
    minimumQuantity: asset.minimumQuantity ?? 0,
  })

  return NextResponse.json({
    asset: {
      ...asset,
      qrCode: buildAssetQrPayload(asset.id),
    },
  })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const success = await deleteAsset(id)

  if (!success) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
