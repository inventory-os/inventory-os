import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-session"
import { deleteAllNotifications, findMemberIdByEmail, listNotificationsForMember, markAllNotificationsRead } from "@/lib/core-repository"

async function resolveCurrentMemberId(request: NextRequest): Promise<string | null> {
  const session = getSessionFromRequest(request)
  if (!session) {
    return null
  }

  return findMemberIdByEmail(session.email)
}

export async function GET(request: NextRequest) {
  const memberId = await resolveCurrentMemberId(request)
  if (!memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50)
  const notifications = await listNotificationsForMember(memberId, limit)
  const unread = notifications.filter((item) => !item.readAt).length

  return NextResponse.json({ notifications, unread })
}

export async function PATCH(request: NextRequest) {
  const memberId = await resolveCurrentMemberId(request)
  if (!memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await markAllNotificationsRead(memberId)
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const memberId = await resolveCurrentMemberId(request)
  if (!memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await deleteAllNotifications(memberId)
  return NextResponse.json({ success: true })
}
