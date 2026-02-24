import { NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE_NAME } from "@/lib/utils/auth-constants"
import { ensureTrustedNetwork } from "@/lib/services/request-security.service"

function resolveAppOrigin(request: NextRequest): string {
  const configuredDomain = process.env.APP_DOMAIN?.trim()
  if (configuredDomain) {
    try {
      return new URL(configuredDomain).origin
    } catch {
      // Fall through to request origin.
    }
  }

  return request.nextUrl.origin
}

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
  const response = NextResponse.redirect(new URL(returnTo, resolveAppOrigin(request)))
  response.cookies.delete(SESSION_COOKIE_NAME)
  return response
}
