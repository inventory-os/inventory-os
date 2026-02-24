import { NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE_NAME } from "@/lib/utils/auth-constants"

const PUBLIC_PATH_PREFIXES = ["/api/auth/login", "/api/auth/callback", "/api/qr/", "/qr/", "/_next/", "/favicon.ico"]

const MEMBER_BLOCKED_PAGE_PREFIXES = ["/team", "/settings", "/health", "/incidents"]
const MEMBER_BLOCKED_PAGE_PATTERNS = [/^\/assets\/[^/]+\/edit$/]
const MEMBER_API_MANAGEMENT_PREFIXES: string[] = []

type SessionPayload = {
  uid: string
  email: string
  name: string
  roles: string[]
  iat: number
  exp: number
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function toBase64(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = (4 - (normalized.length % 4)) % 4
  return normalized + "=".repeat(padding)
}

function base64ToBytes(value: string): Uint8Array {
  const decoded = atob(toBase64(value))
  const bytes = new Uint8Array(decoded.length)
  for (let i = 0; i < decoded.length; i += 1) {
    bytes[i] = decoded.charCodeAt(i)
  }
  return bytes
}

function base64ToText(value: string): string {
  return new TextDecoder().decode(base64ToBytes(value))
}

async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const parts = token.split(".")
  if (parts.length !== 2) {
    return null
  }

  const [encodedPayload, encodedSignature] = parts
  if (!encodedPayload || !encodedSignature) {
    return null
  }

  const secret = process.env.AUTH_SESSION_SECRET
  if (!secret || secret.length < 32) {
    return null
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload))
  const expected = new Uint8Array(signature)
  const provided = base64ToBytes(encodedSignature)
  if (expected.length !== provided.length) {
    return null
  }

  let mismatches = 0
  for (let i = 0; i < expected.length; i += 1) {
    mismatches |= expected[i]! ^ provided[i]!
  }
  if (mismatches !== 0) {
    return null
  }

  try {
    const payload = JSON.parse(base64ToText(encodedPayload)) as SessionPayload
    const now = Math.floor(Date.now() / 1000)
    if (!payload?.uid || !Array.isArray(payload.roles) || typeof payload.exp !== "number" || payload.exp < now) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

function isReadOnlyMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS"
}

function isMemberBlockedPage(pathname: string): boolean {
  if (MEMBER_BLOCKED_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true
  }
  return MEMBER_BLOCKED_PAGE_PATTERNS.some((pattern) => pattern.test(pathname))
}

function isMemberBlockedApi(pathname: string): boolean {
  return MEMBER_API_MANAGEMENT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const session = sessionToken ? await verifySessionToken(sessionToken) : null
  if (session) {
    const isMember = session.roles.includes("member") && !session.roles.includes("admin")

    if (isMember) {
      if (pathname.startsWith("/api/")) {
        if (isMemberBlockedApi(pathname)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
        if (!isReadOnlyMethod(request.method) && pathname !== "/api/auth/logout") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      } else if (isMemberBlockedPage(pathname)) {
        return NextResponse.redirect(new URL("/", request.url))
      }
    }

    return NextResponse.next()
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const loginUrl = new URL("/api/auth/login", request.url)
  loginUrl.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
}
