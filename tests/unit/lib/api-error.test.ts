import { describe, expect, it } from "vitest"
import { toPublicErrorMessage } from "@/lib/utils/api-error"

describe("toPublicErrorMessage", () => {
  it("returns fallback for non-error inputs", () => {
    expect(toPublicErrorMessage("boom", "fallback")).toBe("fallback")
  })

  it("returns fallback for SQL-like errors", () => {
    expect(toPublicErrorMessage(new Error("select * from users"), "fallback")).toBe("fallback")
  })

  it("returns fallback for multiline errors", () => {
    expect(toPublicErrorMessage(new Error("line1\nline2"), "fallback")).toBe("fallback")
  })

  it("returns safe short message", () => {
    expect(toPublicErrorMessage(new Error("Invalid booking window"), "fallback")).toBe("Invalid booking window")
  })
})
