// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useCurrentUser } from "@/hooks/use-current-user"

const mockUseAuthMeQuery = vi.fn()

vi.mock("@/lib/trpc/react", () => ({
  trpc: {
    auth: {
      me: {
        useQuery: (...args: unknown[]) => mockUseAuthMeQuery(...args),
      },
    },
  },
}))

describe("useCurrentUser hook", () => {
  beforeEach(() => {
    mockUseAuthMeQuery.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("loads current user and exposes role helpers", async () => {
    mockUseAuthMeQuery.mockReturnValue({
      data: {
        authenticated: true,
        user: {
          id: "1",
          memberId: "M-1",
          email: "alex@example.com",
          displayName: "Alex",
          roles: ["admin", "member"],
        },
      },
      isLoading: false,
    })

    const { result } = renderHook(() => useCurrentUser())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user?.email).toBe("alex@example.com")
    expect(result.current.isAdmin).toBe(true)
    expect(result.current.isMember).toBe(true)
    expect(mockUseAuthMeQuery).toHaveBeenCalledWith(undefined, {
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    })
  })

  it("handles unauthenticated responses", async () => {
    mockUseAuthMeQuery.mockReturnValue({
      data: { authenticated: false },
      isLoading: false,
    })

    const { result } = renderHook(() => useCurrentUser())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.isMember).toBe(false)
  })
})
