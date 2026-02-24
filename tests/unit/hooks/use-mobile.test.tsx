// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useIsMobile } from "@/hooks/use-mobile"

describe("useIsMobile hook", () => {
  const originalMatchMedia = window.matchMedia
  const originalInnerWidth = window.innerWidth

  let changeHandler: ((event: MediaQueryListEvent) => void) | null = null

  beforeEach(() => {
    changeHandler = null

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "(max-width: 767px)",
        onchange: null,
        addEventListener: (_name: string, handler: (event: MediaQueryListEvent) => void) => {
          changeHandler = handler
        },
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: originalMatchMedia,
    })

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: originalInnerWidth,
    })
  })

  it("returns true below breakpoint and updates on media change", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 500 })
    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(true)

    Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 })
    act(() => {
      changeHandler?.({} as MediaQueryListEvent)
    })

    expect(result.current).toBe(false)
  })
})
