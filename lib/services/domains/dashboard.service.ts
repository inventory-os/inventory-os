import * as repository from "@/lib/repository/domains/dashboard.repository"

export const getDashboardStats = (
  ...args: Parameters<typeof repository.getDashboardStats>
): ReturnType<typeof repository.getDashboardStats> => repository.getDashboardStats(...args)
