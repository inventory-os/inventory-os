import { NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants"
import { ensureTrustedNetwork } from "@/lib/request-security"

export async function POST(request: NextRequest) {
  const blocked = await ensureTrustedNetwork(request)
  if (blocked) {
    return blocked
  }

  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/"
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE_NAME)
  response.headers.set("x-inventory-os-logout-redirect", returnTo)
  return response
}

export async function GET(request: NextRequest) {
  const blocked = await ensureTrustedNetwork(request)
  if (blocked) {
    return blocked
  }

  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/"
  const response = NextResponse.redirect(new URL(returnTo, request.url))
  response.cookies.delete(SESSION_COOKIE_NAME)
  return response
}
