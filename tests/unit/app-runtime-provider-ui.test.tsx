// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AppRuntimeProvider, useAppRuntime } from "@/components/app-runtime-provider"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function RuntimeProbe() {
  const { locale, setLocale, t } = useAppRuntime()

  return (
    <div>
      <p data-testid="locale">{locale}</p>
      <p data-testid="welcome">{t("welcomeTitle")}</p>
      <button onClick={() => setLocale("de")}>set-de</button>
    </div>
  )
}

describe("AppRuntimeProvider UI behavior", () => {
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        setup: {
          setupComplete: true,
          appName: "Inventory OS",
          organizationName: "Org",
          locale: "en",
          currency: "EUR",
        },
      }),
    }))
  })

  it("auto-detects browser locale when no saved preference exists", async () => {
    Object.defineProperty(window.navigator, "languages", {
      configurable: true,
      value: ["de-DE", "en-US"],
    })

    render(
      <AppRuntimeProvider>
        <RuntimeProbe />
      </AppRuntimeProvider>,
    )

    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("de"))
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
})
