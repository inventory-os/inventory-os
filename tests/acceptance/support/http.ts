import { getAcceptanceBaseUrl } from "./acceptance-env"
import { createSessionToken } from "@/lib/auth-session"
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants"

type TestRole = "admin" | "member"

export function getSessionCookie(role: TestRole): string {
  if (role === "member") {
    const token = createSessionToken({
      userId: "acceptance-member",
      email: "acceptance.member@example.com",
      displayName: "Acceptance Member",
      roles: ["member"],
    })

    return `${SESSION_COOKIE_NAME}=${token}`
  }

  const token = createSessionToken({
    userId: "acceptance-admin",
    email: "acceptance.admin@example.com",
    displayName: "Acceptance Admin",
    roles: ["admin"],
  })

  return `${SESSION_COOKIE_NAME}=${token}`
}

type ApiJsonOptions = RequestInit & { role?: TestRole | "none" }

export async function apiJson<T>(path: string, init?: ApiJsonOptions): Promise<{ status: number; data: T; headers: Headers }> {
  const baseHeaders = new Headers(init?.headers ?? {})
  const role = init?.role ?? "admin"

  if (!baseHeaders.has("cookie") && role !== "none") {
    baseHeaders.set("cookie", getSessionCookie(role))
  }

  const response = await fetch(`${getAcceptanceBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...Object.fromEntries(baseHeaders.entries()),
    },
    redirect: "manual",
  })

  const data = (await response.json()) as T
  return { status: response.status, data, headers: response.headers }
}

export async function pageHtml(path: string, options?: { authenticated?: boolean }): Promise<{ status: number; html: string }> {
  const authenticated = options?.authenticated ?? true
  const headers = authenticated ? { cookie: getSessionCookie("admin") } : undefined

  const response = await fetch(`${getAcceptanceBaseUrl()}${path}`, {
    redirect: "manual",
    headers,
  })
  const html = await response.text()
  return { status: response.status, html }
}

export async function ensureBaseData(): Promise<{ assetId: string }> {
  const setupResponse = await apiJson<{ setup?: { setupComplete?: boolean }; error?: unknown }>("/api/setup/complete", {
    method: "POST",
    body: JSON.stringify({
      appName: "Inventory OS",
      organizationName: "Acceptance Org",
      adminUsername: "admin",
      adminPassword: "supersecret123",
      firstLocationName: "HQ",
      firstLocationAddress: "Main Street 1",
      locale: "en",
    }),
  })

  if (setupResponse.status >= 400) {
    throw new Error(`Setup failed with status ${setupResponse.status}: ${JSON.stringify(setupResponse.data)}`)
  }

  const locationsResponse = await apiJson<{ locations?: Array<{ id: string; name: string }>; error?: unknown }>("/api/locations")
  if (locationsResponse.status >= 400) {
    throw new Error(`List locations failed with status ${locationsResponse.status}: ${JSON.stringify(locationsResponse.data)}`)
  }

  const locations = Array.isArray(locationsResponse.data.locations) ? locationsResponse.data.locations : []
  let locationId = locations.find((location) => location.name === "HQ")?.id

  if (!locationId) {
    const createLocation = await apiJson<{ location?: { id: string }; error?: unknown }>("/api/locations", {
      method: "POST",
      body: JSON.stringify({
        name: "HQ",
        address: "Main Street 1",
        kind: "building",
      }),
    })

    if (createLocation.status >= 400 || !createLocation.data.location?.id) {
      throw new Error(`Create location failed with status ${createLocation.status}: ${JSON.stringify(createLocation.data)}`)
    }

    locationId = createLocation.data.location.id
  }

  const assetsResponse = await apiJson<{ assets?: Array<{ id: string; name: string }>; error?: unknown }>("/api/assets?page=1&pageSize=100&search=Acceptance%20Laptop")
  if (assetsResponse.status >= 400) {
    throw new Error(`List assets failed with status ${assetsResponse.status}: ${JSON.stringify(assetsResponse.data)}`)
  }

  const assets = Array.isArray(assetsResponse.data.assets) ? assetsResponse.data.assets : []
  let assetId = assets.find((asset) => asset.name === "Acceptance Laptop")?.id

  if (!assetId) {
    const createAsset = await apiJson<{ asset?: { id: string }; error?: unknown }>("/api/assets", {
      method: "POST",
      body: JSON.stringify({
        name: "Acceptance Laptop",
        category: "Laptops",
        status: "available",
        locationId,
        value: 1200,
        purchaseDate: "2025-01-01",
        tags: ["acceptance"],
      }),
    })

    if (createAsset.status >= 400 || !createAsset.data.asset?.id) {
      throw new Error(`Create asset failed with status ${createAsset.status}: ${JSON.stringify(createAsset.data)}`)
    }

    assetId = createAsset.data.asset.id
  }

  return { assetId }
}

export function readCookie(setCookieHeader: string | null, name: string): string | null {
  if (!setCookieHeader) {
    return null
  }

  const expression = new RegExp(`${name}=([^;]+)`)
  const match = setCookieHeader.match(expression)
  return match?.[1] ?? null
}
