import { NextRequest, NextResponse } from "next/server"
import { createSessionToken, getSessionFromRequest } from "@/lib/auth-session"
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants"
import { findAuthUserById, findMemberIdByEmail } from "@/lib/core-repository"
import { ensureTrustedNetwork } from "@/lib/request-security"

export async function POST(request: NextRequest) {
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
    const response = NextResponse.json({ authenticated: false }, { status: 401 })
    response.cookies.delete(SESSION_COOKIE_NAME)
    return response
  }

  const token = createSessionToken({
    userId: authUser.id,
    email: authUser.email,
    displayName: authUser.displayName,
    roles: authUser.roles,
  })

  const memberId = await findMemberIdByEmail(authUser.email)

  const response = NextResponse.json({
    authenticated: true,
    user: {
      id: authUser.id,
      memberId,
      email: authUser.email,
      displayName: authUser.displayName,
      roles: authUser.roles,
    },
  })

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  })

  return response
}
