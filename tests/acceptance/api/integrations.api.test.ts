import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("integrations api acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("persists ldap settings and exposes bind password presence", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const unique = Date.now()
    const syncIssuer = `ldap-acceptance-${unique}`

    const saved = await client.integrations.saveLdapSettings.mutate({
      enabled: false,
      url: "ldaps://ldap.acceptance.local",
      bindDn: "cn=admin,dc=acceptance,dc=local",
      bindPassword: `secret-${unique}`,
      baseDn: "dc=acceptance,dc=local",
      userFilter: "(objectClass=person)",
      usernameAttribute: "uid",
      emailAttribute: "mail",
      nameAttribute: "cn",
      defaultRole: "member",
      syncIssuer,
    })

    expect(saved.syncIssuer).toBe(syncIssuer)
    expect(saved.hasBindPassword).toBe(true)

    const listed = await client.integrations.ldapSettings.query()
    expect(listed.syncIssuer).toBe(syncIssuer)
    expect(listed.hasBindPassword).toBe(true)

    const password = await client.integrations.ldapBindPassword.query()
    expect(password).toBeTruthy()
  })
})
