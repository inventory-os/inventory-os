import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("members api acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("creates and updates a member with persistent readback", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const unique = Date.now()
    const email = `acceptance.member.${unique}@example.com`
    const initialName = `Acceptance Member ${unique}`
    const updatedName = `Acceptance Member Updated ${unique}`

    const created = await client.members.create.mutate({
      name: initialName,
      email,
      role: "member",
    })

    expect(created.id).toBeTruthy()

    const byEmail = await client.members.findIdByEmail.query({ email })
    expect(byEmail).toBe(created.id)

    const profile = await client.members.profileById.query({ id: created.id })
    expect(profile?.member.id).toBe(created.id)
    expect(profile?.member.name).toBe(initialName)

    const upserted = await client.members.upsertByEmail.mutate({
      name: updatedName,
      email,
      role: "admin",
    })

    expect(upserted.id).toBe(created.id)
    expect(upserted.name).toBe(updatedName)
    expect(upserted.role).toBe("admin")

    const persisted = await client.members.profileById.query({ id: created.id })
    expect(persisted?.member.name).toBe(updatedName)
    expect(persisted?.member.role).toBe("admin")
  })
})
