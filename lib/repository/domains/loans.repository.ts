import { desc, eq } from "drizzle-orm"
import type { LoanRecord } from "@/lib/types"
import { ensureCoreSchema } from "@/lib/repository/domains/setup.repository"
import { getDomainRuntime } from "@/lib/repository/domain-runtime"

export async function listLoans(): Promise<LoanRecord[]> {
  await ensureCoreSchema()
  const { orm, tables } = getDomainRuntime()

  const rows = await orm
    .select({
      id: tables.loansTable.id,
      assetId: tables.loansTable.assetId,
      memberId: tables.loansTable.memberId,
      assetName: tables.assetsTable.name,
      memberName: tables.membersTable.name,
      borrowedAt: tables.loansTable.borrowedAt,
      dueAt: tables.loansTable.dueAt,
      returnedAt: tables.loansTable.returnedAt,
    })
    .from(tables.loansTable)
    .leftJoin(tables.assetsTable, eq(tables.assetsTable.id, tables.loansTable.assetId))
    .leftJoin(tables.membersTable, eq(tables.membersTable.id, tables.loansTable.memberId))
    .orderBy(desc(tables.loansTable.borrowedAt))

  return (
    rows as Array<{
      id: string
      assetId: string
      memberId: string
      assetName: string | null
      memberName: string | null
      borrowedAt: string
      dueAt: string | null
      returnedAt: string | null
    }>
  ).map((row) => ({
    id: row.id,
    assetId: row.assetId,
    memberId: row.memberId,
    assetName: row.assetName ?? "Unknown asset",
    memberName: row.memberName ?? "Unknown member",
    borrowedAt: row.borrowedAt,
    dueAt: row.dueAt,
    returnedAt: row.returnedAt,
  }))
}
