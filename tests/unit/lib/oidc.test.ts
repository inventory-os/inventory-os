import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createCodeChallenge,
  createPkceVerifier,
  createState,
  decodeOidcIdTokenClaims,
  discoverOidcMetadata,
  exchangeCodeForTokens,
  fetchUserInfo,
  getOidcConfig,
  resolveOidcAppRole,
} from "@/lib/oidc"

describe("oidc logic", () => {
  const envSnapshot = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env = { ...envSnapshot }
  })

  afterEach(() => {
    process.env = { ...envSnapshot }
  })

  it("reads OIDC config and validates required env", () => {
    process.env.OIDC_ISSUER_URL = "https://issuer.example.com"
    process.env.OIDC_CLIENT_ID = "client"
    process.env.OIDC_CLIENT_SECRET = "secret"
    process.env.OIDC_REDIRECT_URI = "http://localhost/callback"

    const config = getOidcConfig()
    expect(config.clientId).toBe("client")

    delete process.env.OIDC_CLIENT_SECRET
    expect(() => getOidcConfig()).toThrow(/OIDC_ISSUER_URL/)
  })

  it("creates PKCE verifier/state and deterministic code challenge", () => {
    const verifier = createPkceVerifier()
    const state = createState()

    expect(verifier.length).toBeGreaterThan(20)
    expect(state.length).toBeGreaterThan(20)
    expect(createCodeChallenge("abc")).toBe(createCodeChallenge("abc"))
  })

  it("discovers metadata and uses cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        authorization_endpoint: "https://issuer.example.com/auth",
        token_endpoint: "https://issuer.example.com/token",
        userinfo_endpoint: "https://issuer.example.com/userinfo",
      }),
    })

    vi.stubGlobal("fetch", fetchMock)

    const first = await discoverOidcMetadata("https://issuer.example.com")
    const second = await discoverOidcMetadata("https://issuer.example.com")

    expect(first.token_endpoint).toContain("/token")
    expect(second.userinfo_endpoint).toContain("/userinfo")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("exchanges token code and fetches user info", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: "sub-1", email: "alex@example.com" }) })

    vi.stubGlobal("fetch", fetchMock)

    const token = await exchangeCodeForTokens({
      tokenEndpoint: "https://issuer.example.com/token",
      code: "code",
      codeVerifier: "verifier",
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "http://localhost/callback",
    })

    expect(token.access_token).toBe("token")

    const userInfo = await fetchUserInfo("https://issuer.example.com/userinfo", "token")
    expect(userInfo.sub).toBe("sub-1")
  })

  it("decodes id-token claims and resolves app role", () => {
    const payload = Buffer.from(JSON.stringify({ roles: ["member", "admin"] })).toString("base64url")
    const claims = decodeOidcIdTokenClaims(`a.${payload}.c`)

    expect(claims.roles).toEqual(["member", "admin"])
    expect(resolveOidcAppRole(claims)).toBe("admin")

    process.env.OIDC_ROLE_CLAIM = "groups"
    process.env.OIDC_ADMIN_ROLE_VALUE = "admins"
    process.env.OIDC_MEMBER_ROLE_VALUE = "users"

    expect(resolveOidcAppRole({ groups: ["users"] })).toBe("member")
    expect(resolveOidcAppRole({ groups: ["admins"] })).toBe("admin")
  })
})
