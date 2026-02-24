// @vitest-environment jsdom

import { renderHook, waitFor, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useCurrentUser } from "@/hooks/use-current-user"

describe("useCurrentUser hook", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("loads current user and exposes role helpers", async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authenticated: true,
            user: {
              id: "1",
              memberId: "M-1",
              email: "alex@example.com",
              displayName: "Alex",
              roles: ["admin", "member"],
            },
          }),
          { status: 200 },
        ),
      )

    const { result } = renderHook(() => useCurrentUser())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user?.email).toBe("alex@example.com")
    expect(result.current.isAdmin).toBe(true)
    expect(result.current.isMember).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/refresh", expect.any(Object))
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.any(Object))
  })

  it("handles unauthenticated fetch and refreshes on focus", async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: false }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: false }), { status: 200 }))

    const { result } = renderHook(() => useCurrentUser())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBeNull()

    act(() => {
      window.dispatchEvent(new Event("focus"))
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })
  })
})
