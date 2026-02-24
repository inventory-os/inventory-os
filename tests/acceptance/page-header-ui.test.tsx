import { beforeAll, describe, expect, it } from "vitest"
import { getAcceptanceBaseUrl } from "./support/acceptance-env"
import { ensureBaseData, pageHtml, readCookie } from "./support/http"

describe("auth + header-path acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("executes real OIDC login start and redirects to configured provider", async () => {
    const baseUrl = getAcceptanceBaseUrl()
    const issuer = process.env.ACCEPTANCE_OIDC_ISSUER as string

    const loginResponse = await fetch(`${baseUrl}/api/auth/login?returnTo=/assets`, {
      redirect: "manual",
    })

    expect([302, 307, 403]).toContain(loginResponse.status)

    if (loginResponse.status !== 403) {
      const authorizeLocation = loginResponse.headers.get("location")
      expect(authorizeLocation?.startsWith(`${issuer}/authorize`)).toBe(true)

      const setCookie = loginResponse.headers.get("set-cookie")
      const state = readCookie(setCookie, "oidc_state")
      const verifier = readCookie(setCookie, "oidc_verifier")

      expect(state).toBeTruthy()
      expect(verifier).toBeTruthy()
    }

    const discoveryResponse = await fetch(`${issuer}/.well-known/openid-configuration`)
    expect(discoveryResponse.status).toBe(200)
    const discovery = await discoveryResponse.json() as { authorization_endpoint: string; token_endpoint: string }
    expect(typeof discovery.authorization_endpoint).toBe("string")
    expect(typeof discovery.token_endpoint).toBe("string")
  })

  it("serves the search page UI route used by global header", async () => {
    const page = await pageHtml("/search?q=acceptance")
    expect(page.status).toBe(200)
    expect(/Search|search/i.test(page.html)).toBe(true)
  })
})
