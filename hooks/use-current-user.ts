"use client"

import { useEffect, useState } from "react"

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
  const [user, setUser] = useState<Extract<AuthMeResponse, { authenticated: true }>["user"] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load(shouldRefresh: boolean) {
      setLoading(true)
      try {
        if (shouldRefresh) {
          await fetch("/api/auth/refresh", {
            method: "POST",
            cache: "no-store",
          })
        }

        const response = await fetch("/api/auth/me", { cache: "no-store" })
        if (!response.ok) {
          if (!cancelled) {
            setUser(null)
          }
          return
        }

        const payload = (await response.json()) as AuthMeResponse
        if (!cancelled) {
          setUser(payload.authenticated ? payload.user : null)
        }
      } catch {
        if (!cancelled) {
          setUser(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load(true)

    const onFocus = () => {
      void load(true)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void load(true)
      }
    }

    const timer = window.setInterval(() => {
      void load(true)
    }, 60_000)

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      cancelled = true
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.clearInterval(timer)
    }
  }, [])

  const isAdmin = user?.roles.includes("admin") ?? false
  const isMember = user?.roles.includes("member") ?? false

  return { user, isAdmin, isMember, loading }
}
