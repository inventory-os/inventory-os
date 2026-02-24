import * as repository from "@/lib/repository/domains/loans.repository"

export const listLoans = (...args: Parameters<typeof repository.listLoans>): ReturnType<typeof repository.listLoans> =>
  repository.listLoans(...args)
