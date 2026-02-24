import { describe, expect, it } from "vitest"
import {
  isTrustedDomain,
  isTrustedProxyChain,
  normalizeTrustEntries,
  parseForwardedFor,
  parseTrustEnvValue,
} from "@/lib/security-utils"

describe("security-utils logic", () => {
  it("normalizes trust entries and removes duplicates", () => {
    const result = normalizeTrustEntries(["  EXAMPLE.COM ", "example.com", " ", "api.example.com"])
    expect(result).toEqual(["example.com", "api.example.com"])
  })

  it("parses env trust values split by comma, semicolon, and newlines", () => {
    const result = parseTrustEnvValue("example.com, api.example.com;admin.example.com\nportal.example.com")
    expect(result).toEqual(["example.com", "api.example.com", "admin.example.com", "portal.example.com"])
  })

  it("matches trusted domains including wildcard and host with port", () => {
    expect(isTrustedDomain("api.example.com:443", ["*.example.com"])).toBe(true)
    expect(isTrustedDomain("example.com", ["example.com"])).toBe(true)
    expect(isTrustedDomain("evil.com", ["*.example.com"])).toBe(false)
  })

  it("parses forwarded-for and validates trusted proxy chain", () => {
    expect(parseForwardedFor("1.1.1.1, 2.2.2.2")).toEqual(["1.1.1.1", "2.2.2.2"])
    expect(isTrustedProxyChain("1.1.1.1, 10.0.0.1", ["10.0.0.1"])).toBe(true)
    expect(isTrustedProxyChain("1.1.1.1", ["10.0.0.1"])).toBe(false)
    expect(isTrustedProxyChain(null, [])).toBe(true)
  })
})
