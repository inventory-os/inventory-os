import { createHmac, timingSafeEqual } from "node:crypto"
import type { NextRequest } from "next/server"
import { SESSION_COOKIE_NAME } from "@/lib/utils/auth-constants"

type SessionPayload = {
  uid: string
  email: string
  name: string
  roles: string[]
  iat: number
  exp: number
}

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SESSION_SECRET must be set and at least 32 characters")
  }
  return secret
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8")
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url")
}

export function createSessionToken(input: {
  userId: string
  email: string
  displayName: string
  roles: string[]
  maxAgeSeconds?: number
}): string {
  const now = Math.floor(Date.now() / 1000)
  const maxAge = input.maxAgeSeconds ?? 60 * 60 * 8
  const payload: SessionPayload = {
    uid: input.userId,
    email: input.email,
    name: input.displayName,
    roles: input.roles,
    iat: now,
    exp: now + maxAge,
  }

  const encoded = base64UrlEncode(JSON.stringify(payload))
  const signature = signPayload(encoded)
  return `${encoded}.${signature}`
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) {
    return null
  }

  const parts = token.split(".")
  if (parts.length !== 2) {
    return null
  }

  const [encodedPayload, signature] = parts
  if (!encodedPayload || !signature) {
    return null
  }

  const expectedSignature = signPayload(encodedPayload)
  const provided = Buffer.from(signature)
  const expected = Buffer.from(expectedSignature)
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload
    const now = Math.floor(Date.now() / 1000)
    if (!payload?.uid || !payload.email || !payload.name || !Array.isArray(payload.roles)) {
      return null
    }
    if (typeof payload.exp !== "number" || payload.exp < now) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export function getSessionFromRequest(request: NextRequest): SessionPayload | null {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)
}
