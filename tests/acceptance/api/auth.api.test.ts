import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("auth api acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("binds, reads, updates, and deactivates auth users", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const unique = Date.now()
    const issuer = "acceptance-auth"
    const sub = `sub-${unique}`
    const email = `acceptance.auth.${unique}@example.com`

    const created = await client.auth.bindOrCreateFromOidc.mutate({
      issuer,
      sub,
      email,
      displayName: `Acceptance Auth ${unique}`,
      roles: ["member"],
      jitCreate: true,
    })

    expect(created?.id).toBeTruthy()

    const bySubject = await client.auth.bySubject.query({ issuer, sub })
    expect(bySubject?.id).toBe(created?.id)

    const byEmail = await client.auth.byEmail.query({ email })
    expect(byEmail?.id).toBe(created?.id)

    const updated = await client.auth.updateById.mutate({
      id: created!.id,
      input: {
        displayName: `Acceptance Auth Updated ${unique}`,
        roles: ["admin"],
      },
    })

    expect(updated?.displayName).toContain("Updated")
    expect(updated?.roles).toContain("admin")

    const deactivated = await client.auth.deactivateById.mutate({ id: created!.id })
    expect(deactivated).toBe(true)

    const byId = await client.auth.byId.query({ id: created!.id })
    expect(byId?.active).toBe(false)
  })

  it("returns unauthenticated me result for anonymous caller", async () => {
    const anonymous = createAcceptanceTrpcClient("none")
    const me = await anonymous.auth.me.query()
    expect(me.authenticated).toBe(false)
  })
})
