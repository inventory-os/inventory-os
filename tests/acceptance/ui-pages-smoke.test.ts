import { describe, expect, it } from "vitest"

const pageModules = [
  "@/app/page",
  "@/app/assets/page",
  "@/app/assets/[id]/page",
  "@/app/assets/[id]/edit/page",
  "@/app/bookings/page",
  "@/app/categories/page",
  "@/app/locations/page",
  "@/app/locations/[id]/page",
  "@/app/team/page",
  "@/app/team/[id]/page",
  "@/app/activity/page",
  "@/app/incidents/page",
  "@/app/incidents/[id]/page",
  "@/app/incidents/[id]/edit/page",
  "@/app/health/page",
  "@/app/settings/page",
  "@/app/search/page",
  "@/app/scan/page",
  "@/app/producers/page",
  "@/app/qr/[id]/page",
] as const

describe("UI pages smoke acceptance", () => {
  it.each(pageModules)("has default export: %s", async (modulePath) => {
    const mod = await import(modulePath)
    expect(typeof mod.default).toBe("function")
  })
})
