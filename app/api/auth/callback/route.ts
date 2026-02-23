import { NextRequest, NextResponse } from "next/server"
import { bindOrCreateAuthUserFromOidc, notifyAuthIntegrationFailed, upsertMemberByEmail } from "@/lib/core-repository"
import { createSessionToken } from "@/lib/auth-session"
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants"
import { decodeOidcIdTokenClaims, discoverOidcMetadata, exchangeCodeForTokens, fetchUserInfo, getOidcConfig, resolveOidcAppRole } from "@/lib/oidc"
import { toPublicErrorMessage } from "@/lib/api-error"
import { ensureTrustedNetwork } from "@/lib/request-security"

function normalizeReturnTo(value: string): string {
  if (!value.startsWith("/")) {
    return "/"
  }
  return value
}

export async function GET(request: NextRequest) {
  const blocked = await ensureTrustedNetwork(request)
  if (blocked) {
    return blocked
  }

  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  const cookieState = request.cookies.get("oidc_state")?.value
  const verifier = request.cookies.get("oidc_verifier")?.value
  const returnTo = normalizeReturnTo(request.cookies.get("oidc_return_to")?.value || "/")

  if (!code || !state || !cookieState || state !== cookieState || !verifier) {
    return NextResponse.json({ error: "Invalid OIDC callback state" }, { status: 400 })
  }

  try {
    const config = getOidcConfig()
    const metadata = await discoverOidcMetadata(config.issuer)

    const tokens = await exchangeCodeForTokens({
      tokenEndpoint: metadata.token_endpoint,
      code,
      codeVerifier: verifier,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    })

    const idTokenClaims = decodeOidcIdTokenClaims(tokens.id_token)
    let profile: Record<string, unknown> = {}
    try {
      profile = await fetchUserInfo(metadata.userinfo_endpoint, tokens.access_token)
    } catch {
      profile = {}
    }

    const sub = (typeof profile.sub === "string" ? profile.sub : undefined) ?? idTokenClaims.sub
    const email =
      (typeof profile.email === "string" ? profile.email : undefined) ??
      (typeof profile.preferred_username === "string" ? profile.preferred_username : undefined) ??
      idTokenClaims.email ??
      idTokenClaims.preferred_username
    const displayName =
      (typeof profile.name === "string" ? profile.name : undefined) ??
      idTokenClaims.name ??
      email
    const appRole = resolveOidcAppRole(profile, idTokenClaims)

    if (!sub) {
      return NextResponse.json({ error: "OIDC profile has no sub" }, { status: 400 })
    }

    if (!email) {
      return NextResponse.json({ error: "OIDC profile has no email" }, { status: 400 })
    }

    const user = await bindOrCreateAuthUserFromOidc({
      issuer: config.issuer,
      sub,
      email,
      displayName: displayName ?? email,
      roles: [appRole],
      jitCreate: config.jitCreate,
    })

    if (!user) {
      return NextResponse.json({ error: "User not provisioned. Ask admin to create or sync the user account." }, { status: 403 })
    }

    if (!user.active) {
      return NextResponse.json({ error: "User account is inactive" }, { status: 403 })
    }

    await upsertMemberByEmail({
      name: user.displayName,
      email: user.email,
      role: appRole,
    })

    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
    })

    const response = NextResponse.redirect(new URL(returnTo, request.url))
    const secure = process.env.NODE_ENV === "production"

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 60 * 8,
    })

    response.cookies.delete("oidc_state")
    response.cookies.delete("oidc_verifier")
    response.cookies.delete("oidc_return_to")

    return response
  } catch (error) {
    const publicMessage = toPublicErrorMessage(error, "OIDC callback failed")
    await notifyAuthIntegrationFailed(publicMessage)
    return NextResponse.json(
      { error: publicMessage },
      { status: 500 },
    )
  }
}
