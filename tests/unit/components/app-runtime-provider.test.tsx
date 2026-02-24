// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AppRuntimeProvider, useAppRuntime } from "@/components/app-runtime-provider"

const mockUseSetupStatusQuery = vi.fn()

vi.mock("@/lib/trpc/react", () => ({
  trpc: {
    setup: {
      status: {
        useQuery: (...args: unknown[]) => mockUseSetupStatusQuery(...args),
      },
    },
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function RuntimeProbe() {
  const { locale, loading, setLocale, t, formatCurrency, formatDate } = useAppRuntime()

  return (
    <div>
      <p data-testid="locale">{locale}</p>
      <p data-testid="loading">{loading ? "loading" : "ready"}</p>
      <p data-testid="welcome">{t("welcomeTitle")}</p>
      <p data-testid="currency">{formatCurrency(1200.5, { maximumFractionDigits: 2 })}</p>
      <p data-testid="date">{formatDate("2024-01-01T00:00:00.000Z", { year: "numeric" })}</p>
      <button onClick={() => setLocale("de")}>set-de</button>
    </div>
  )
}

describe("AppRuntimeProvider", () => {
  beforeEach(() => {
    const store = new Map<string, string>()

    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => {
        store.clear()
      },
    })

    localStorage.clear()
    mockUseSetupStatusQuery.mockReset()
    mockUseSetupStatusQuery.mockReturnValue({
      data: {
        setupComplete: true,
        appName: "Inventory OS",
        organizationName: "Org",
        locale: "en",
        currency: "EUR",
      },
      isLoading: false,
      refetch: vi.fn().mockResolvedValue({
        data: {
          setupComplete: true,
          appName: "Inventory OS",
          organizationName: "Org",
          locale: "en",
          currency: "EUR",
        },
      }),
    })
  })

  it("auto-detects browser locale and updates loading state", async () => {
    Object.defineProperty(window.navigator, "languages", {
      configurable: true,
      value: ["de-DE", "en-US"],
    })

    render(
      <AppRuntimeProvider>
        <RuntimeProbe />
      </AppRuntimeProvider>,
    )

    expect(mockUseSetupStatusQuery).toHaveBeenCalledWith(undefined, { staleTime: 60_000 })

    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("de"))
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("ready"))
    expect(screen.getByTestId("currency").textContent).toContain("€")
    expect(screen.getByTestId("date").textContent).toContain("2024")
  })

  it("uses saved locale preference and persists manual changes", async () => {
    localStorage.setItem("inventory-os.locale", "fr")

    render(
      <AppRuntimeProvider>
        <RuntimeProbe />
      </AppRuntimeProvider>,
    )

    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("fr"))

    fireEvent.click(screen.getByRole("button", { name: "set-de" }))

    expect(localStorage.getItem("inventory-os.locale")).toBe("de")
  })

  it("throws when hook is used outside provider", () => {
    function InvalidConsumer() {
      useAppRuntime()
      return null
    }

    expect(() => render(<InvalidConsumer />)).toThrow("useAppRuntime must be used within AppRuntimeProvider")
  })
})
