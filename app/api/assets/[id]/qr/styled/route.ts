import { NextResponse } from "next/server"
import { getAssetById } from "@/lib/core-repository"
import { renderStyledQrSvg } from "@/lib/qr-style"
import { buildAssetQrPayload } from "@/lib/qr-payload"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const asset = await getAssetById(id)

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const requestedSize = Number(searchParams.get("size") ?? 256)
  const size = Number.isFinite(requestedSize) ? Math.max(128, Math.min(requestedSize, 2048)) : 256

  const svg = renderStyledQrSvg(buildAssetQrPayload(asset.id), size)

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="asset-${asset.id}-qr-styled.svg"`,
    },
  })
}
