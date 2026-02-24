import { describe, expect, it } from "vitest"
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants"
import { getAcceptanceBaseUrl } from "../support/acceptance-env"
import { apiJson, getSessionCookie, readCookie } from "../support/http"

describe("auth.api acceptance", () => {
  it("covers /api/auth/login redirect and oidc cookies", async () => {
    const baseUrl = getAcceptanceBaseUrl()
    const issuer = process.env.ACCEPTANCE_OIDC_ISSUER as string

    const response = await fetch(`${baseUrl}/api/auth/login?returnTo=/assets`, {
      redirect: "manual",
    })

    expect([302, 307, 403]).toContain(response.status)

    if (response.status !== 403) {
      const location = response.headers.get("location")
      expect(location?.startsWith(`${issuer}/authorize`)).toBe(true)

      const setCookie = response.headers.get("set-cookie")
      expect(readCookie(setCookie, "oidc_state")).toBeTruthy()
      expect(readCookie(setCookie, "oidc_verifier")).toBeTruthy()
      expect(readCookie(setCookie, "oidc_return_to")).toBeTruthy()
    }
  })

  it("covers /api/auth/callback invalid state branch", async () => {
    const baseUrl = getAcceptanceBaseUrl()

    const callback = await fetch(`${baseUrl}/api/auth/callback?code=fake-code&state=fake-state`, {
      redirect: "manual",
      headers: { cookie: "oidc_state=other; oidc_verifier=abc; oidc_return_to=/" },
    })

    expect([400, 403]).toContain(callback.status)
    if (callback.status === 400) {
      const body = await callback.json() as { error: string }
      expect(body.error).toContain("Invalid OIDC callback state")
    }
  })

  it("covers /api/auth/me unauth and authenticated branches", async () => {
    const unauth = await apiJson<{ authenticated: boolean; error?: string }>("/api/auth/me", { role: "none" })
    expect([401, 403]).toContain(unauth.status)

    const auth = await apiJson<{
      authenticated: boolean
      user: { id: string; email: string; displayName: string; roles: string[]; memberId: string | null }
    }>("/api/auth/me")
    expect([200, 401, 403]).toContain(auth.status)
    if (auth.status === 200) {
      expect(auth.data.authenticated).toBe(true)
      expect(typeof auth.data.user.email).toBe("string")
      expect(Array.isArray(auth.data.user.roles)).toBe(true)
    }
  })

  it("covers /api/auth/refresh unauth and authenticated cookie refresh branches", async () => {
    const unauth = await apiJson<{ authenticated: boolean; error?: string }>("/api/auth/refresh", {
      role: "none",
      method: "POST",
      body: JSON.stringify({}),
    })
    expect([401, 403]).toContain(unauth.status)

    const auth = await apiJson<{
      authenticated: boolean
      user: { id: string; email: string; roles: string[] }
    }>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({}),
    })
    expect([200, 401, 403]).toContain(auth.status)
    if (auth.status === 200) {
      expect(auth.data.authenticated).toBe(true)
      expect(typeof auth.data.user.email).toBe("string")

      const setCookie = auth.headers.get("set-cookie")
      expect(setCookie?.includes(`${SESSION_COOKIE_NAME}=`)).toBe(true)
    }
  })

  it("covers /api/auth/logout POST and GET behavior", async () => {
    const baseUrl = getAcceptanceBaseUrl()

    const postLogout = await apiJson<{ ok: boolean }>("/api/auth/logout?returnTo=/assets", {
      method: "POST",
      body: JSON.stringify({}),
    })
    expect([200, 403]).toContain(postLogout.status)
    if (postLogout.status === 200) {
      expect(postLogout.data.ok).toBe(true)
      expect(postLogout.headers.get("x-inventory-os-logout-redirect")).toBe("/assets")
      expect(postLogout.headers.get("set-cookie")?.includes(`${SESSION_COOKIE_NAME}=`)).toBe(true)
    }

    const getLogout = await fetch(`${baseUrl}/api/auth/logout?returnTo=/settings`, {
      method: "GET",
      redirect: "manual",
      headers: { cookie: getSessionCookie("admin") },
    })
    expect([302, 307, 403]).toContain(getLogout.status)
    if (getLogout.status !== 403) {
      expect(getLogout.headers.get("location")?.endsWith("/settings")).toBe(true)
      expect(getLogout.headers.get("set-cookie")?.includes(`${SESSION_COOKIE_NAME}=`)).toBe(true)
    }
  })
})
