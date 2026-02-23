import { NextRequest, NextResponse } from "next/server"
import { duplicateAsset, findAuthUserById, findMemberIdByEmail, recordActivityEvent } from "@/lib/core-repository"
import { getSessionFromRequest } from "@/lib/auth-session"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = getSessionFromRequest(request)
  const authUser = session ? await findAuthUserById(session.uid) : null
  const actorName = authUser?.displayName ?? "System"
  const actorMemberId = authUser ? await findMemberIdByEmail(authUser.email) : null

  const asset = await duplicateAsset(id)
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 })
  }

  await recordActivityEvent({
    type: "asset.duplicate",
    actorMemberId,
    actorName,
    subjectType: "asset",
    subjectId: asset.id,
    subjectName: asset.name,
    message: `${actorName} duplicated asset ${asset.name}.`,
  })

  return NextResponse.json({ asset }, { status: 201 })
}
