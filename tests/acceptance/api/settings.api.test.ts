import { describe, expect, it } from "vitest"
import { getAcceptanceBaseUrl } from "../support/acceptance-env"
import { apiJson, getSessionCookie } from "../support/http"

describe("settings.api acceptance", () => {
  it("covers /api/settings/general GET+PUT validation and persistence", async () => {
    const invalidPut = await apiJson<{ error: unknown }>("/api/settings/general", {
      method: "PUT",
      body: JSON.stringify({
        appName: "x",
        organizationName: "x",
        locale: "invalid",
        currency: "EU",
      }),
    })
    expect(invalidPut.status).toBe(400)

    const suffix = Date.now()
    const updated = await apiJson<{ settings: { appName: string; organizationName: string; locale: string; currency: string } }>("/api/settings/general", {
      method: "PUT",
      body: JSON.stringify({
        appName: `Inventory ${suffix}`,
        organizationName: `Org ${suffix}`,
        locale: "en",
        currency: "EUR",
      }),
    })
    expect(updated.status).toBe(200)
    expect(updated.data.settings.appName).toBe(`Inventory ${suffix}`)

    const fetched = await apiJson<{ settings: { appName: string; organizationName: string } }>("/api/settings/general")
    expect(fetched.status).toBe(200)
    expect(fetched.data.settings.appName).toBe(`Inventory ${suffix}`)
  })

  it("covers /api/settings/security GET+PUT validation and persistence", async () => {
    const invalidPut = await apiJson<{ error: unknown }>("/api/settings/security", {
      method: "PUT",
      body: JSON.stringify({
        trustedDomains: [""],
        trustedProxies: ["127.0.0.1"],
      }),
    })
    expect(invalidPut.status).toBe(400)

    const updated = await apiJson<{ settings: { trustedDomains: string[]; trustedProxies: string[] } }>("/api/settings/security", {
      method: "PUT",
      body: JSON.stringify({
        trustedDomains: ["localhost", "127.0.0.1"],
        trustedProxies: ["127.0.0.1"],
      }),
    })
    expect(updated.status).toBe(200)
    expect(updated.data.settings.trustedDomains).toContain("localhost")

    const fetched = await apiJson<{
      settings: { trustedDomains: string[]; trustedProxies: string[] }
      effective: { trustedDomains: string[]; trustedProxies: string[] }
    }>("/api/settings/security")
    expect(fetched.status).toBe(200)
    expect(fetched.data.settings.trustedProxies).toContain("127.0.0.1")
    expect(Array.isArray(fetched.data.effective.trustedDomains)).toBe(true)
  })

  it("covers /api/settings/notifications GET+PUT validation and persistence", async () => {
    const invalidPut = await apiJson<{ error: unknown }>("/api/settings/notifications", {
      method: "PUT",
      body: JSON.stringify({ checkoutAlerts: true }),
    })
    expect(invalidPut.status).toBe(400)

    const updated = await apiJson<{
      settings: {
        checkoutAlerts: boolean
        maintenanceAlerts: boolean
        bookingAlerts: boolean
        digestEnabled: boolean
        lowInventoryAlerts: boolean
      }
    }>("/api/settings/notifications", {
      method: "PUT",
      body: JSON.stringify({
        checkoutAlerts: true,
        maintenanceAlerts: false,
        bookingAlerts: true,
        digestEnabled: false,
        lowInventoryAlerts: true,
      }),
    })
    expect(updated.status).toBe(200)
    expect(updated.data.settings.checkoutAlerts).toBe(true)

    const fetched = await apiJson<{ settings: { checkoutAlerts: boolean; maintenanceAlerts: boolean } }>("/api/settings/notifications")
    expect(fetched.status).toBe(200)
    expect(fetched.data.settings.maintenanceAlerts).toBe(false)
  })

  it("covers /api/settings/qr GET+PUT validation and persistence", async () => {
    const invalidPut = await apiJson<{ error: unknown }>("/api/settings/qr", {
      method: "PUT",
      body: JSON.stringify({
        enabled: true,
        ownerLabel: "Owner",
        publicMessage: "Public",
        showLoginButton: true,
        loginButtonText: "",
        selectedAddressId: null,
        logoUrl: "",
        contactPhone: "",
        contactEmail: "",
        websiteUrl: "",
        extraLinks: [],
      }),
    })
    expect(invalidPut.status).toBe(400)

    const suffix = Date.now()
    const updated = await apiJson<{
      settings: {
        enabled: boolean
        ownerLabel: string
        showLoginButton: boolean
        loginButtonText: string
        extraLinks: Array<{ label: string; url: string }>
      }
    }>("/api/settings/qr", {
      method: "PUT",
      body: JSON.stringify({
        enabled: true,
        ownerLabel: `Owner ${suffix}`,
        publicMessage: "Public QR message",
        showLoginButton: true,
        loginButtonText: "Login now",
        selectedAddressId: null,
        logoUrl: "",
        contactPhone: "+49 123 456",
        contactEmail: "owner@example.com",
        websiteUrl: "https://example.com",
        extraLinks: [{ label: "Help", url: "https://example.com/help" }],
      }),
    })
    expect(updated.status).toBe(200)
    expect(updated.data.settings.ownerLabel).toBe(`Owner ${suffix}`)
    expect(updated.data.settings.extraLinks).toHaveLength(1)

    const fetched = await apiJson<{ settings: { ownerLabel: string; showLoginButton: boolean } }>("/api/settings/qr")
    expect(fetched.status).toBe(200)
    expect(fetched.data.settings.ownerLabel).toBe(`Owner ${suffix}`)
  })

  it("covers /api/settings/qr/logo upload branches", async () => {
    const missingFileForm = new FormData()
    const missingFile = await fetch(`${getAcceptanceBaseUrl()}/api/settings/qr/logo`, {
      method: "POST",
      headers: { cookie: getSessionCookie("admin") },
      body: missingFileForm,
      redirect: "manual",
    })
    expect(missingFile.status).toBe(400)

    const wrongTypeForm = new FormData()
    wrongTypeForm.append("file", new File([new Blob(["not-image"])], "bad.txt", { type: "text/plain" }))
    const wrongType = await fetch(`${getAcceptanceBaseUrl()}/api/settings/qr/logo`, {
      method: "POST",
      headers: { cookie: getSessionCookie("admin") },
      body: wrongTypeForm,
      redirect: "manual",
    })
    expect(wrongType.status).toBe(415)

    const validForm = new FormData()
    validForm.append("file", new File([new Blob(["<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"])], "logo.svg", { type: "image/svg+xml" }))
    const uploaded = await fetch(`${getAcceptanceBaseUrl()}/api/settings/qr/logo`, {
      method: "POST",
      headers: { cookie: getSessionCookie("admin") },
      body: validForm,
      redirect: "manual",
    })
    expect(uploaded.status).toBe(200)
    const body = await uploaded.json() as { url: string }
    expect(body.url.startsWith("/uploads/qr/qr-logo-")).toBe(true)
  })

  it("covers /api/settings/health response shape", async () => {
    const health = await apiJson<{
      checkedAt: string
      overallOk: boolean
      checks: { proxy: boolean; tls: boolean; database: boolean; memory: boolean }
      issues: unknown[]
      server: { nodeVersion: string }
      stats: { totalAssets: number }
    }>("/api/settings/health")
    expect(health.status).toBe(200)
    expect(typeof health.data.checkedAt).toBe("string")
    expect(typeof health.data.overallOk).toBe("boolean")
    expect(typeof health.data.checks.database).toBe("boolean")
    expect(Array.isArray(health.data.issues)).toBe(true)
    expect(typeof health.data.server.nodeVersion).toBe("string")
  })

  it("covers member and unauth access behavior", async () => {
    const memberGeneral = await apiJson<{ error: string }>("/api/settings/general", { role: "member" })
    expect(memberGeneral.status).toBe(403)

    const memberSecurity = await apiJson<{ error: string }>("/api/settings/security", { role: "member" })
    expect(memberSecurity.status).toBe(403)

    const memberNotifications = await apiJson<{ error: string }>("/api/settings/notifications", { role: "member" })
    expect(memberNotifications.status).toBe(403)

    const memberQr = await apiJson<{ error: string }>("/api/settings/qr", { role: "member" })
    expect(memberQr.status).toBe(403)

    const memberHealth = await apiJson<{ error: string }>("/api/settings/health", { role: "member" })
    expect(memberHealth.status).toBe(403)

    const unauthGeneral = await apiJson<{ error: string }>("/api/settings/general", { role: "none" })
    expect(unauthGeneral.status).toBe(401)
  })
})
