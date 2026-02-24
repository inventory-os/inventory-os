import { NextRequest, NextResponse } from "next/server"
import {
  createCodeChallenge,
  createPkceVerifier,
  createState,
  discoverOidcMetadata,
  getOidcConfig,
} from "@/lib/utils/oidc"
import { toPublicErrorMessage } from "@/lib/utils/api-error"
import { notifyAuthIntegrationFailed } from "@/lib/services"
import { ensureTrustedNetwork } from "@/lib/services/request-security.service"

function normalizeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/")) {
    return "/"
  }
  return value
}

export async function GET(request: NextRequest) {
  const blocked = await ensureTrustedNetwork(request)
  if (blocked) {
    return blocked
  }

  try {
    const config = getOidcConfig()
    const metadata = await discoverOidcMetadata(config.issuer)

    const state = createState()
    const verifier = createPkceVerifier()
    const challenge = createCodeChallenge(verifier)
    const returnTo = normalizeReturnTo(request.nextUrl.searchParams.get("returnTo"))

    const authorize = new URL(metadata.authorization_endpoint)
    authorize.searchParams.set("response_type", "code")
    authorize.searchParams.set("client_id", config.clientId)
    authorize.searchParams.set("redirect_uri", config.redirectUri)
    authorize.searchParams.set("scope", config.scope)
    authorize.searchParams.set("state", state)
    authorize.searchParams.set("code_challenge", challenge)
    authorize.searchParams.set("code_challenge_method", "S256")

    const response = NextResponse.redirect(authorize)
    const secure = process.env.NODE_ENV === "production"

    response.cookies.set("oidc_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 600,
    })
    response.cookies.set("oidc_verifier", verifier, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 600,
    })
    response.cookies.set("oidc_return_to", returnTo, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 600,
    })

    return response
  } catch (error) {
    await notifyAuthIntegrationFailed(toPublicErrorMessage(error, "OIDC login setup failed"))
    return NextResponse.json({ error: toPublicErrorMessage(error, "OIDC login setup failed") }, { status: 500 })
  }
}
