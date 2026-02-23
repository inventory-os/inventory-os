import { NextRequest, NextResponse } from "next/server"
import { getEffectiveSecuritySettings } from "@/lib/core-repository"
import { isTrustedDomain, isTrustedProxyChain } from "@/lib/security-utils"

export async function ensureTrustedNetwork(request: NextRequest): Promise<NextResponse | null> {
  const settings = await getEffectiveSecuritySettings()

  const host = request.headers.get("host") ?? request.nextUrl.host
  if (!isTrustedDomain(host, settings.trustedDomains)) {
    return NextResponse.json({ error: "Untrusted domain" }, { status: 403 })
  }

  const forwardedFor = request.headers.get("x-forwarded-for")
  if (!isTrustedProxyChain(forwardedFor, settings.trustedProxies)) {
    return NextResponse.json({ error: "Untrusted proxy" }, { status: 403 })
  }

  return null
}
