import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { borrowAsset, findAuthUserById, findMemberIdByEmail, getOpenLoanForAsset, notifyAssetBorrowed, notifyAssetReturned, recordActivityEvent, returnAsset } from "@/lib/core-repository"
import { getSessionFromRequest } from "@/lib/auth-session"

const borrowSchema = z.object({
  action: z.enum(["borrow", "return"]),
  memberId: z.string().optional(),
  dueAt: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = borrowSchema.safeParse(body)
  const session = getSessionFromRequest(request)
  const authUser = session ? await findAuthUserById(session.uid) : null
  const actorName = authUser?.displayName ?? "System"
  const actorMemberId = authUser ? await findMemberIdByEmail(authUser.email) : null

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (parsed.data.action === "return") {
    const openLoan = await getOpenLoanForAsset(id)
    const asset = await returnAsset(id)
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    }

    if (openLoan) {
      await notifyAssetReturned({
        assetId: asset.id,
        assetName: asset.name,
        memberId: openLoan.memberId,
      })

      await recordActivityEvent({
        type: "asset.return",
        actorMemberId,
        actorName,
        subjectType: "asset",
        subjectId: asset.id,
        subjectName: asset.name,
        message: `${actorName} marked ${asset.name} as returned by ${openLoan.memberName}.`,
      })
    }

    return NextResponse.json({ asset })
  }

  if (!parsed.data.memberId) {
    return NextResponse.json({ error: "memberId is required for borrowing" }, { status: 400 })
  }

  const asset = await borrowAsset({
    assetId: id,
    memberId: parsed.data.memberId,
    dueAt: parsed.data.dueAt,
    notes: parsed.data.notes,
  })

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 })
  }

  await notifyAssetBorrowed({
    assetId: asset.id,
    assetName: asset.name,
    memberId: parsed.data.memberId,
    memberName: asset.assignedTo ?? "Member",
  })

  await recordActivityEvent({
    type: "asset.borrow",
    actorMemberId,
    actorName,
    subjectType: "asset",
    subjectId: asset.id,
    subjectName: asset.name,
    message: `${actorName} borrowed ${asset.name} to ${asset.assignedTo ?? "member"}.`,
  })

  return NextResponse.json({ asset })
}
