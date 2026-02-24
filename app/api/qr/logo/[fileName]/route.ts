import path from "node:path"
import { NextResponse } from "next/server"
import { readStoredQrLogoFile } from "@/lib/services/asset-storage.service"

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
}

function resolveMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase()
  return MIME_BY_EXT[ext] ?? "application/octet-stream"
}

function isSafeFileName(value: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(value)
}

export async function GET(_: Request, { params }: { params: Promise<{ fileName: string }> }) {
  const { fileName } = await params

  if (!fileName || !isSafeFileName(fileName)) {
    return NextResponse.json({ error: "Invalid logo file" }, { status: 400 })
  }

  try {
    const content = await readStoredQrLogoFile(fileName)
    const mimeType = resolveMimeType(fileName)

    return new NextResponse(new Uint8Array(content), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="${fileName.replace(/[\r\n"]/g, "_")}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: "Logo not found" }, { status: 404 })
  }
}
