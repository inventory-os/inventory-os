import { beforeAll, describe, expect, it } from "vitest"
import { ensureBaseData, pageHtml } from "./support/http"

const uiRoutes = ["/", "/assets", "/bookings", "/categories", "/locations", "/team", "/settings", "/search?q=acceptance"]

describe("UI routes smoke acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it.each(uiRoutes)("serves %s", async (route) => {
    const response = await pageHtml(route)
    expect(response.status).toBe(200)
    expect(response.html).toContain("<html")
  })
})
