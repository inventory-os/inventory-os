import { describe, expect, it } from "vitest"
import { LOCALE_LABELS, EUROPEAN_LOCALES, translate } from "@/lib/utils/i18n"

describe("i18n", () => {
  it("contains labels for all supported locales", () => {
    for (const locale of EUROPEAN_LOCALES) {
      expect(LOCALE_LABELS[locale]).toBeTruthy()
    }
  })

  it("interpolates placeholders", () => {
    expect(translate("en", "statAddedThisMonth", { count: 12 })).toBe("+12 this month")
  })

  it("falls back to key for unknown translation key", () => {
    expect(translate("en", "__does_not_exist__")).toBe("__does_not_exist__")
  })
})
