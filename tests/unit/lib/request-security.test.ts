import { beforeEach, describe, expect, it, vi } from "vitest"

const { getEffectiveSecuritySettings } = vi.hoisted(() => ({
  getEffectiveSecuritySettings: vi.fn(),
}))

vi.mock("@/lib/core-repository", () => ({
  getEffectiveSecuritySettings,
}))

import { ensureTrustedNetwork } from "@/lib/request-security"

describe("request-security logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("allows trusted domain and proxy", async () => {
    getEffectiveSecuritySettings.mockResolvedValue({
      trustedDomains: ["*.example.com"],
      trustedProxies: ["10.0.0.1"],
    })

    const request = {
      headers: new Headers({
        host: "api.example.com",
        "x-forwarded-for": "1.1.1.1, 10.0.0.1",
      }),
      nextUrl: { host: "api.example.com" },
    }

    const response = await ensureTrustedNetwork(request as never)
    expect(response).toBeNull()
  })

  it("blocks untrusted domain", async () => {
    getEffectiveSecuritySettings.mockResolvedValue({
      trustedDomains: ["example.com"],
      trustedProxies: [],
    })

    const request = {
      headers: new Headers({ host: "evil.com" }),
      nextUrl: { host: "evil.com" },
    }

    const response = await ensureTrustedNetwork(request as never)
    expect(response?.status).toBe(403)
    expect(await response?.json()).toEqual({ error: "Untrusted domain" })
  })

  it("blocks untrusted proxy chain", async () => {
    getEffectiveSecuritySettings.mockResolvedValue({
      trustedDomains: ["example.com"],
      trustedProxies: ["10.0.0.1"],
    })

    const request = {
      headers: new Headers({
        host: "example.com",
        "x-forwarded-for": "1.1.1.1, 9.9.9.9",
      }),
      nextUrl: { host: "example.com" },
    }

    const response = await ensureTrustedNetwork(request as never)
    expect(response?.status).toBe(403)
    expect(await response?.json()).toEqual({ error: "Untrusted proxy" })
  })
})
