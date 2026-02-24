import { afterEach, describe, expect, it } from "vitest"
import { buildAssetQrPayload, buildLocationQrPayload } from "@/lib/qr-payload"

describe("qr-payload logic", () => {
  const originalDomain = process.env.APP_DOMAIN

  afterEach(() => {
    process.env.APP_DOMAIN = originalDomain
  })

  it("uses localhost fallback for invalid domain", () => {
    process.env.APP_DOMAIN = "not-a-url"
    expect(buildAssetQrPayload("AST-1")).toBe("http://localhost:3000/qr/AST-1")
  })

  it("uses configured APP_DOMAIN origin for asset and location payloads", () => {
    process.env.APP_DOMAIN = "https://inventory.example.com/app"

    expect(buildAssetQrPayload("AST-1")).toBe("https://inventory.example.com/qr/AST-1")
    expect(buildLocationQrPayload("LOC-9")).toBe("https://inventory.example.com/qr/LOC-9")
  })
})
