import { NextResponse } from "next/server"
import { deleteIncidentFileRecord, getIncidentFileById } from "@/lib/services"
import { readStoredIncidentFile, removeStoredIncidentFile } from "@/lib/services/asset-storage.service"

function sanitizeDownloadName(value: string): string {
  return value.replace(/[\r\n]/g, "_")
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params
  const fileRecord = await getIncidentFileById(id, fileId)

  if (!fileRecord) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  try {
    const content = await readStoredIncidentFile(fileRecord.storageKey)
    const { searchParams } = new URL(request.url)
    const forceDownload = searchParams.get("download") === "1"
    const isImage = fileRecord.mimeType.startsWith("image/")

    return new NextResponse(new Uint8Array(content), {
      status: 200,
      headers: {
        "Content-Type": fileRecord.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `${forceDownload || !isImage ? "attachment" : "inline"}; filename="${sanitizeDownloadName(fileRecord.originalName)}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: "File content missing" }, { status: 404 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params
  const deleted = await deleteIncidentFileRecord(id, fileId)

  if (!deleted) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  await removeStoredIncidentFile(deleted.storageKey)
  return NextResponse.json({ success: true })
}
