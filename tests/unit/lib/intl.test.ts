import { describe, expect, it } from "vitest"
import { formatCurrencyValue, formatDateValue, localeTag, normalizeCurrency } from "@/lib/utils/intl"

describe("intl helpers", () => {
  it("normalizes valid and invalid currency codes", () => {
    expect(normalizeCurrency("usd")).toBe("USD")
    expect(normalizeCurrency("  eur ")).toBe("EUR")
    expect(normalizeCurrency("bad-code")).toBe("EUR")
    expect(normalizeCurrency(null)).toBe("EUR")
  })

  it("resolves locale tags with fallback", () => {
    expect(localeTag("de")).toBe("de")
    expect(localeTag(" de-DE ")).toBe("de-DE")
    expect(localeTag("   ")).toBe("en")
    expect(localeTag(undefined)).toBe("en")
  })

  it("formats currency values", () => {
    const value = formatCurrencyValue({
      value: 1234.56,
      locale: "de",
      currency: "eur",
      maximumFractionDigits: 2,
    })

    expect(value).toContain("1")
    expect(value).toContain("€")
  })

  it("formats date values", () => {
    const date = formatDateValue({
      value: "2024-01-01T00:00:00.000Z",
      locale: "en",
      options: { year: "numeric", month: "short", day: "numeric" },
    })

    expect(typeof date).toBe("string")
    expect(date.length).toBeGreaterThan(0)
  })
})
