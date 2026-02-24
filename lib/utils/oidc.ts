import { createHash, randomBytes } from "node:crypto"

type OidcMetadata = {
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
}

type OidcTokenResponse = {
  access_token: string
  id_token?: string
  token_type?: string
}

type OidcUserInfo = {
  sub: string
  email?: string
  preferred_username?: string
  name?: string
} & Record<string, unknown>

export type AppRole = "admin" | "member"

let metadataCache: { issuer: string; metadata: OidcMetadata } | null = null

function discoveryCandidates(issuer: string): string[] {
  const trimmed = issuer.trim()
  if (!trimmed) {
    return []
  }

  if (trimmed.includes("/.well-known/openid-configuration")) {
    return [trimmed]
  }

  const base = trimmed.endsWith("/") ? trimmed : `${trimmed}/`
  const candidates = new Set<string>([
    `${trimmed.replace(/\/$/, "")}/.well-known/openid-configuration`,
    new URL(".well-known/openid-configuration", base).toString(),
    new URL("/.well-known/openid-configuration", base).toString(),
  ])

  return [...candidates]
}

export function getOidcConfig() {
  const issuer = process.env.OIDC_ISSUER_URL
  const clientId = process.env.OIDC_CLIENT_ID
  const clientSecret = process.env.OIDC_CLIENT_SECRET
  const redirectUri = process.env.OIDC_REDIRECT_URI

  if (!issuer || !clientId || !clientSecret || !redirectUri) {
    throw new Error("OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET and OIDC_REDIRECT_URI must be set")
  }

  return {
    issuer,
    clientId,
    clientSecret,
    redirectUri,
    scope: process.env.OIDC_SCOPE ?? "openid profile email",
    jitCreate: process.env.OIDC_JIT_CREATE === "true",
  }
}

export async function discoverOidcMetadata(issuer: string): Promise<OidcMetadata> {
  if (metadataCache?.issuer === issuer) {
    return metadataCache.metadata
  }

  const urls = discoveryCandidates(issuer)
  if (urls.length === 0) {
    throw new Error("OIDC issuer URL is empty")
  }

  let lastError: string | null = null

  for (const candidate of urls) {
    const response = await fetch(candidate, { cache: "no-store" })
    if (!response.ok) {
      lastError = `Unable to discover OIDC metadata from ${candidate}`
      continue
    }

    const metadata = (await response.json()) as OidcMetadata
    if (!metadata.authorization_endpoint || !metadata.token_endpoint || !metadata.userinfo_endpoint) {
      lastError = `OIDC discovery response is missing required endpoints at ${candidate}`
      continue
    }

    metadataCache = { issuer, metadata }
    return metadata
  }

  throw new Error(lastError ?? "Unable to discover OIDC metadata")
}

export function createPkceVerifier(): string {
  return randomBytes(32).toString("base64url")
}

export function createState(): string {
  return randomBytes(24).toString("base64url")
}

export function createCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}

export async function exchangeCodeForTokens(input: {
  tokenEndpoint: string
  code: string
  codeVerifier: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<OidcTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    code_verifier: input.codeVerifier,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
  })

  const response = await fetch(input.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OIDC token exchange failed: ${response.status} ${errorBody}`)
  }

  return (await response.json()) as OidcTokenResponse
}

export async function fetchUserInfo(userInfoEndpoint: string, accessToken: string): Promise<OidcUserInfo> {
  const response = await fetch(userInfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("OIDC userinfo request failed")
  }

  const profile = (await response.json()) as OidcUserInfo
  if (!profile.sub) {
    throw new Error("OIDC userinfo response is missing sub")
  }

  return profile
}

export function decodeOidcIdTokenClaims(idToken: string | undefined): Partial<OidcUserInfo> {
  if (!idToken) {
    return {}
  }

  const parts = idToken.split(".")
  if (parts.length < 2 || !parts[1]) {
    return {}
  }

  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Partial<OidcUserInfo>
  } catch {
    return {}
  }
}

function readClaimValues(profile: Partial<OidcUserInfo>, claimName: string): string[] {
  const raw = profile[claimName]
  if (typeof raw === "string") {
    return [raw]
  }
  if (Array.isArray(raw)) {
    return raw.filter((value): value is string => typeof value === "string")
  }
  return []
}

function normalizeRoleValue(value: string): string {
  return value.trim().toLowerCase()
}

function matchesRoleValue(candidate: string, expected: string): boolean {
  const normalizedCandidate = normalizeRoleValue(candidate)
  const normalizedExpected = normalizeRoleValue(expected)

  if (normalizedCandidate === normalizedExpected) {
    return true
  }

  return normalizedCandidate.endsWith(`/${normalizedExpected}`)
}

export function resolveOidcAppRole(...profiles: Array<Partial<OidcUserInfo> | null | undefined>): AppRole {
  const claimName = process.env.OIDC_ROLE_CLAIM ?? "roles"
  const adminValue = process.env.OIDC_ADMIN_ROLE_VALUE ?? "admin"
  const memberValue = process.env.OIDC_MEMBER_ROLE_VALUE ?? "member"

  const values = profiles.flatMap((profile) => {
    if (!profile) {
      return []
    }

    const primary = readClaimValues(profile, claimName)
    const fallbackRoles = readClaimValues(profile, "roles")
    const fallbackGroups = readClaimValues(profile, "groups")
    const fallbackGroup = readClaimValues(profile, "group")

    return [...primary, ...fallbackRoles, ...fallbackGroups, ...fallbackGroup]
  })

  if (values.some((value) => matchesRoleValue(value, adminValue) || normalizeRoleValue(value).includes("admin"))) {
    return "admin"
  }
  if (values.some((value) => matchesRoleValue(value, memberValue) || normalizeRoleValue(value).includes("member"))) {
    return "member"
  }

  return "member"
}
