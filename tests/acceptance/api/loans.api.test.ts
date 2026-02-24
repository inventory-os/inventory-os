import { beforeAll, describe, expect, it } from "vitest"
import { createAcceptanceTrpcClient } from "../support/trpc"
import { ensureBaseData } from "../support/http"

describe("loans api acceptance (real runtime)", () => {
  let assetId = ""

  beforeAll(async () => {
    const base = await ensureBaseData()
    assetId = base.assetId
  })

  it("creates and closes a loan reflected in loan listings", async () => {
    const client = createAcceptanceTrpcClient("admin")
    const unique = Date.now()
    const borrower = await client.members.create.mutate({
      name: `Loan Borrower ${unique}`,
      email: `loan.borrower.${unique}@example.com`,
      role: "member",
    })

    await client.assets.borrow.mutate({
      assetId,
      memberId: borrower.id,
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      notes: "Acceptance loan",
    })

    const openLoan = await client.assets.openLoan.query({ assetId })
    expect(openLoan?.memberId).toBe(borrower.id)

    const listed = await client.loans.list.query()
    const active = listed.find(
      (loan) => loan.assetId === assetId && loan.memberId === borrower.id && loan.returnedAt === null,
    )
    expect(active?.id).toBeTruthy()

    await client.assets.return.mutate({ assetId })

    const afterReturn = await client.loans.list.query()
    const closed = afterReturn.find((loan) => loan.id === active!.id)
    expect(closed?.returnedAt).toBeTruthy()
  })
})
