import { randomUUID } from "node:crypto"
import path from "node:path"
import { mkdir, writeFile } from "node:fs/promises"
import { NextResponse } from "next/server"

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"])

function extensionFor(mimeType: string, fileName: string): string {
  if (mimeType === "image/png") return ".png"
  if (mimeType === "image/jpeg") return ".jpg"
  if (mimeType === "image/webp") return ".webp"
  if (mimeType === "image/svg+xml") return ".svg"

  const ext = path.extname(fileName || "").toLowerCase()
  return ext || ".bin"
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const fileValue = formData.get("file")

  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: "Missing logo file" }, { status: 400 })
  }

  if (fileValue.size <= 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 })
  }

  if (fileValue.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Logo too large (max 5MB)" }, { status: 413 })
  }

  const mimeType = fileValue.type || "application/octet-stream"
  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "Unsupported logo type" }, { status: 415 })
  }

  const ext = extensionFor(mimeType, fileValue.name)
  const fileName = `qr-logo-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`

  const publicDir = path.resolve(process.cwd(), "public", "uploads", "qr")
  await mkdir(publicDir, { recursive: true })

  const bytes = Buffer.from(await fileValue.arrayBuffer())
  const absolutePath = path.join(publicDir, fileName)
  await writeFile(absolutePath, bytes)

  return NextResponse.json({
    url: `/uploads/qr/${fileName}`,
  })
}
