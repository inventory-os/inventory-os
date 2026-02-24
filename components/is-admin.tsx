"use client"

import type { ReactNode } from "react"
import { useCurrentUser } from "@/hooks/use-current-user"

type IsAdminProps = {
  children: ReactNode
  fallback?: ReactNode
  loadingFallback?: ReactNode
  isAdmin?: boolean
  loading?: boolean
}

export function IsAdmin({ children, fallback = null, loadingFallback = null, isAdmin, loading }: IsAdminProps) {
  const currentUser = useCurrentUser()
  const resolvedLoading = loading ?? currentUser.loading
  const resolvedIsAdmin = isAdmin ?? currentUser.isAdmin

  if (resolvedLoading) {
    return <>{loadingFallback}</>
  }

  if (!resolvedIsAdmin) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
