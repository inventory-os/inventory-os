import { beforeAll, describe, expect, it } from "vitest"
import { apiJson, ensureBaseData } from "../support/http"

describe("access-control.api acceptance", () => {
  let assetId = ""

  beforeAll(async () => {
    const seed = await ensureBaseData()
    assetId = seed.assetId
  })

  it("enforces unauthenticated access restrictions", async () => {
    const unauthGetAssets = await apiJson<{ error: string }>("/api/assets", { role: "none" })
    expect(unauthGetAssets.status).toBe(401)

    const unauthPostAssets = await apiJson<{ error: string }>("/api/assets", {
      method: "POST",
      role: "none",
      body: JSON.stringify({}),
    })
    expect(unauthPostAssets.status).toBe(401)
  })

  it("enforces member vs admin endpoint access", async () => {
    const memberReadAssets = await apiJson<{ assets: unknown[] }>("/api/assets", { role: "member" })
    expect(memberReadAssets.status).toBe(200)

    const memberReadLocations = await apiJson<{ locations: unknown[] }>("/api/locations", { role: "member" })
    expect(memberReadLocations.status).toBe(200)

    const memberReadCategories = await apiJson<{ categories: unknown[] }>("/api/categories", { role: "member" })
    expect(memberReadCategories.status).toBe(200)

    const memberBlockedMembers = await apiJson<{ error: string }>("/api/members", { role: "member" })
    expect(memberBlockedMembers.status).toBe(403)

    const memberBlockedSettings = await apiJson<{ error: string }>("/api/settings/general", { role: "member" })
    expect(memberBlockedSettings.status).toBe(403)

    const memberBlockedLdap = await apiJson<{ error: string }>("/api/integrations/ldap", { role: "member" })
    expect(memberBlockedLdap.status).toBe(403)

    const memberBlockedIncidents = await apiJson<{ error: string }>("/api/incidents", { role: "member" })
    expect(memberBlockedIncidents.status).toBe(403)

    const memberBlockedAssetMutation = await apiJson<{ error: string }>(`/api/assets/${assetId}`, {
      role: "member",
      method: "DELETE",
    })
    expect(memberBlockedAssetMutation.status).toBe(403)

    const adminMembers = await apiJson<{ members: unknown[] }>("/api/members")
    expect(adminMembers.status).toBe(200)

    const adminSettings = await apiJson<{ settings: unknown }>("/api/settings/general")
    expect(adminSettings.status).toBe(200)

    const adminLdap = await apiJson<{ settings: unknown }>("/api/integrations/ldap")
    expect(adminLdap.status).toBe(200)

    const adminIncidents = await apiJson<{ incidents: unknown[] }>("/api/incidents")
    expect(adminIncidents.status).toBe(200)
  })

  it("supports configured methods for management APIs and persists changes", async () => {
    const suffix = Date.now()

    const invalidAdminPostCategories = await apiJson<{ error: unknown }>("/api/categories", {
      method: "POST",
      body: JSON.stringify({}),
    })
    expect(invalidAdminPostCategories.status).toBe(400)

    const createMember = await apiJson<{ member: { id: string; email: string } }>("/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: `Acceptance Member ${suffix}`,
        email: `acceptance-${suffix}@example.com`,
        role: "member",
      }),
    })
    expect(createMember.status).toBe(201)

    const memberProfile = await apiJson<{ member: { id: string; email: string } }>(`/api/members/${createMember.data.member.id}`)
    expect(memberProfile.status).toBe(200)
    expect(memberProfile.data.member.email).toBe(`acceptance-${suffix}@example.com`)

    const putGeneral = await apiJson<{ settings: { appName: string; organizationName: string; locale: string; currency: string } }>("/api/settings/general", {
      method: "PUT",
      body: JSON.stringify({
        appName: `Inventory OS ${suffix}`,
        organizationName: `Acceptance Org ${suffix}`,
        locale: "en",
        currency: "EUR",
      }),
    })
    expect(putGeneral.status).toBe(200)

    const getGeneral = await apiJson<{ settings: { appName: string; organizationName: string } }>("/api/settings/general")
    expect(getGeneral.status).toBe(200)
    expect(getGeneral.data.settings.appName).toBe(`Inventory OS ${suffix}`)

    const putSecurity = await apiJson<{ settings: { trustedProxies: string[]; trustedDomains: string[] } }>("/api/settings/security", {
      method: "PUT",
      body: JSON.stringify({
        trustedProxies: ["10.0.0.1"],
        trustedDomains: ["example.org"],
      }),
    })
    expect(putSecurity.status).toBe(200)

    const getSecurity = await apiJson<{ settings: { trustedProxies: string[]; trustedDomains: string[] } }>("/api/settings/security")
    expect(getSecurity.status).toBe(200)
    expect(getSecurity.data.settings.trustedProxies).toContain("10.0.0.1")
    expect(getSecurity.data.settings.trustedDomains).toContain("example.org")
  })
})
