import { beforeAll, describe, expect, it } from "vitest"
import { ensureBaseData, pageHtml } from "./support/http"

describe("app pages acceptance (real runtime)", () => {
  beforeAll(async () => {
    await ensureBaseData()
  })

  it("renders dashboard and assets pages with live UI", async () => {
    const dashboard = await pageHtml("/")
    expect(dashboard.status).toBe(200)
    expect(dashboard.html).toContain("Inventory OS")

    const assets = await pageHtml("/assets")
    expect(assets.status).toBe(200)
    expect(assets.html).toContain("<html")
  })
})
