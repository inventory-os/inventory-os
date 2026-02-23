import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-session"
import { findAuthUserById, findMemberIdByEmail } from "@/lib/core-repository"
import { ensureTrustedNetwork } from "@/lib/request-security"

export async function GET(request: NextRequest) {
  const blocked = await ensureTrustedNetwork(request)
  if (blocked) {
    return blocked
  }

  const session = getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const authUser = await findAuthUserById(session.uid)
  if (!authUser || !authUser.active) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const memberId = await findMemberIdByEmail(authUser.email)

  return NextResponse.json({
    authenticated: true,
    user: {
      id: authUser.id,
      memberId,
      email: authUser.email,
      displayName: authUser.displayName,
      roles: authUser.roles,
    },
  })
}
