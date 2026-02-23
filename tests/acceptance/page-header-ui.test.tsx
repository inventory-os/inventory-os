// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SidebarProvider } from "@/components/ui/sidebar"

const push = vi.fn()
const setLocale = vi.fn()
const searchParams = { get: () => null }

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}))

vi.mock("@/components/app-runtime-provider", () => ({
  useAppRuntime: () => ({
    t: (key: string) => key,
    locale: "en",
    setLocale,
  }),
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => null,
}))

describe("PageHeader UI acceptance", () => {
  beforeEach(() => {
    push.mockReset()
    setLocale.mockReset()
  })

  it("submits search query on Enter", async () => {
    const { PageHeader } = await import("@/components/page-header")

    render(
      <SidebarProvider>
        <PageHeader title="Assets" breadcrumbs={[{ label: "Assets" }]} />
      </SidebarProvider>,
    )

    const input = screen.getByPlaceholderText("globalSearchPlaceholder")
    fireEvent.change(input, { target: { value: "camera" } })
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("camera"))
    fireEvent.keyDown(input, { key: "Enter" })

    expect(push).toHaveBeenCalledWith("/search?q=camera")
  })

  it("navigates to search page for empty query", async () => {
    const { PageHeader } = await import("@/components/page-header")

    render(
      <SidebarProvider>
        <PageHeader title="Assets" />
      </SidebarProvider>,
    )

    const input = screen.getByPlaceholderText("globalSearchPlaceholder")
    fireEvent.change(input, { target: { value: "   " } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(push).toHaveBeenCalledWith("/search")
  })
})
