import { NextResponse } from "next/server"
import { z } from "zod"
import { createAssetFileRecord, getAssetById, listAssetFiles } from "@/lib/services"
import type { AssetFileKind } from "@/lib/types"
import { storeAssetFile } from "@/lib/services/asset-storage.service"

const uploadKindSchema = z.custom<AssetFileKind>((value) => {
  return value === undefined || value === "image" || value === "document"
}, "Invalid file kind")

function inferKind(mimeType: string): AssetFileKind {
  return mimeType.startsWith("image/") ? "image" : "document"
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const asset = await getAssetById(id)
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 })
  }

  const files = await listAssetFiles(id)
  return NextResponse.json({ files })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const asset = await getAssetById(id)
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 })
  }

  const formData = await request.formData()
  const fileValue = formData.get("file")
  const kindValue = formData.get("kind")
  const parsedKind = uploadKindSchema.safeParse(kindValue ?? undefined)

  if (!parsedKind.success) {
    return NextResponse.json({ error: parsedKind.error.flatten() }, { status: 400 })
  }

  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  if (fileValue.size <= 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 })
  }

  if (fileValue.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 413 })
  }

  const mimeType = fileValue.type || "application/octet-stream"
  const inferredKind = inferKind(mimeType)
  const resolvedKind = inferredKind === "image" ? "image" : (parsedKind.data ?? inferredKind)
  const bytes = Buffer.from(await fileValue.arrayBuffer())
  const stored = await storeAssetFile({
    assetId: id,
    originalName: fileValue.name || "upload.bin",
    content: bytes,
  })

  const created = await createAssetFileRecord({
    assetId: id,
    kind: resolvedKind,
    originalName: fileValue.name || "upload.bin",
    mimeType,
    sizeBytes: stored.sizeBytes,
    storageKey: stored.storageKey,
  })

  return NextResponse.json({ file: created }, { status: 201 })
}
