import { describe, expect, it, beforeEach } from "vitest"
import { createSessionToken, getSessionFromRequest, verifySessionToken } from "@/lib/auth-session"

describe("auth-session logic", () => {
  beforeEach(() => {
    process.env.AUTH_SESSION_SECRET = "x".repeat(40)
  })

  it("creates and verifies a valid session token", () => {
    const token = createSessionToken({
      userId: "USR-1",
      email: "alex@example.com",
      displayName: "Alex",
      roles: ["admin"],
    })

    const payload = verifySessionToken(token)
    expect(payload).toMatchObject({
      uid: "USR-1",
      email: "alex@example.com",
      name: "Alex",
      roles: ["admin"],
    })
  })

  it("returns null for malformed or tampered tokens", () => {
    expect(verifySessionToken("bad-token")).toBeNull()

    const token = createSessionToken({
      userId: "USR-1",
      email: "alex@example.com",
      displayName: "Alex",
      roles: ["admin"],
    })

    const [payload, signature] = token.split(".")
    const tampered = `${payload}.x${signature?.slice(1) ?? ""}`
    expect(verifySessionToken(tampered)).toBeNull()
  })

  it("returns null for expired sessions", () => {
    const token = createSessionToken({
      userId: "USR-1",
      email: "alex@example.com",
      displayName: "Alex",
      roles: ["member"],
      maxAgeSeconds: -1,
    })

    expect(verifySessionToken(token)).toBeNull()
  })

  it("extracts session from request cookies", () => {
    const token = createSessionToken({
      userId: "USR-1",
      email: "alex@example.com",
      displayName: "Alex",
      roles: ["member"],
    })

    const request = {
      cookies: {
        get: (name: string) => (name === "inventory_os_session" ? { value: token } : undefined),
      },
    }

    const payload = getSessionFromRequest(request as never)
    expect(payload?.uid).toBe("USR-1")
  })
})
