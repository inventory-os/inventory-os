import { describe, expect, it } from "vitest"
import { apiJson } from "../support/http"

describe("integrations.api acceptance", () => {
  it("covers /api/integrations/ldap GET and PUT validation/persistence", async () => {
    const initial = await apiJson<{ settings: Record<string, unknown> }>("/api/integrations/ldap")
    expect(initial.status).toBe(200)
    expect(typeof initial.data.settings).toBe("object")

    const invalidPut = await apiJson<{ error: unknown }>("/api/integrations/ldap", {
      method: "PUT",
      body: JSON.stringify({ enabled: true }),
    })
    expect(invalidPut.status).toBe(400)

    const suffix = Date.now()
    const validPut = await apiJson<{
      settings: {
        enabled: boolean
        url: string
        bindDn: string
        baseDn: string
        userFilter: string
        usernameAttribute: string
        emailAttribute: string
        nameAttribute: string
        defaultRole: "admin" | "member"
        syncIssuer: string
      }
    }>("/api/integrations/ldap", {
      method: "PUT",
      body: JSON.stringify({
        enabled: false,
        url: "ldap://127.0.0.1:389",
        bindDn: "cn=admin,dc=example,dc=org",
        bindPassword: `secret-${suffix}`,
        baseDn: "dc=example,dc=org",
        userFilter: "(objectClass=person)",
        usernameAttribute: "uid",
        emailAttribute: "mail",
        nameAttribute: "cn",
        defaultRole: "member",
        syncIssuer: `ldap-issuer-${suffix}`,
      }),
    })
    expect(validPut.status).toBe(200)
    expect(validPut.data.settings.enabled).toBe(false)
    expect(validPut.data.settings.syncIssuer).toBe(`ldap-issuer-${suffix}`)

    const fetched = await apiJson<{ settings: { enabled: boolean; syncIssuer: string; defaultRole: string } }>("/api/integrations/ldap")
    expect(fetched.status).toBe(200)
    expect(fetched.data.settings.enabled).toBe(false)
    expect(fetched.data.settings.syncIssuer).toBe(`ldap-issuer-${suffix}`)
  })

  it("covers /api/integrations/ldap/sync disabled and runtime failure branches", async () => {
    const disabled = await apiJson<{ error: string }>("/api/integrations/ldap/sync", {
      method: "POST",
      body: JSON.stringify({}),
    })
    expect(disabled.status).toBe(400)
    expect(disabled.data.error.toLowerCase()).toContain("disabled")

    const suffix = Date.now()
    const enableLdap = await apiJson<{ settings: { enabled: boolean } }>("/api/integrations/ldap", {
      method: "PUT",
      body: JSON.stringify({
        enabled: true,
        url: "ldap://127.0.0.1:1",
        bindDn: "cn=admin,dc=example,dc=org",
        bindPassword: `secret-${suffix}`,
        baseDn: "dc=example,dc=org",
        userFilter: "(objectClass=person)",
        usernameAttribute: "uid",
        emailAttribute: "mail",
        nameAttribute: "cn",
        defaultRole: "member",
        syncIssuer: `ldap-sync-${suffix}`,
      }),
    })
    expect(enableLdap.status).toBe(200)
    expect(enableLdap.data.settings.enabled).toBe(true)

    const syncFailure = await apiJson<{ error: string }>("/api/integrations/ldap/sync", {
      method: "POST",
      body: JSON.stringify({}),
    })
    expect(syncFailure.status).toBe(400)
    expect(typeof syncFailure.data.error).toBe("string")
    expect(syncFailure.data.error.length).toBeGreaterThan(0)
  })

  it("covers member and unauth access behavior", async () => {
    const memberGet = await apiJson<{ error: string }>("/api/integrations/ldap", { role: "member" })
    expect(memberGet.status).toBe(403)

    const memberPut = await apiJson<{ error: string }>("/api/integrations/ldap", {
      role: "member",
      method: "PUT",
      body: JSON.stringify({}),
    })
    expect(memberPut.status).toBe(403)

    const memberSync = await apiJson<{ error: string }>("/api/integrations/ldap/sync", {
      role: "member",
      method: "POST",
      body: JSON.stringify({}),
    })
    expect(memberSync.status).toBe(403)

    const unauthGet = await apiJson<{ error: string }>("/api/integrations/ldap", { role: "none" })
    expect(unauthGet.status).toBe(401)
  })
})
