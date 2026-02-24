"use client"

import { trpc } from "@/lib/trpc/react"

type AuthMeResponse =
  | {
      authenticated: true
      user: {
        id: string
        memberId: string | null
        email: string
        displayName: string
        roles: string[]
      }
    }
  | { authenticated: false }

export function useCurrentUser() {
  const authQuery = trpc.auth.me.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const payload = authQuery.data as AuthMeResponse | undefined
  const user = payload?.authenticated ? payload.user : null
  const loading = authQuery.isLoading

  const isAdmin = user?.roles.includes("admin") ?? false
  const isMember = user?.roles.includes("member") ?? false

  return { user, isAdmin, isMember, loading }
}
