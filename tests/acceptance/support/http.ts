import { getAcceptanceBaseUrl } from "./acceptance-env"
import { createSessionToken } from "@/lib/services/auth-session.service"
import { SESSION_COOKIE_NAME } from "@/lib/utils/auth-constants"
import { createAcceptanceTrpcClient } from "./trpc"

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

export async function apiJson<T>(
  path: string,
  init?: ApiJsonOptions,
): Promise<{ status: number; data: T; headers: Headers }> {
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

export async function pageHtml(
  path: string,
  options?: { authenticated?: boolean },
): Promise<{ status: number; html: string }> {
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
  const trpcClient = createAcceptanceTrpcClient("admin")

  const setup = await trpcClient.setup.status.query()
  if (!setup.setupComplete) {
    await trpcClient.setup.completeInitial.mutate({
      appName: "Inventory OS",
      organizationName: "Acceptance Org",
      adminUsername: "admin",
      adminPassword: "supersecret123",
      firstLocationName: "HQ",
      firstLocationAddress: "Main Street 1",
      locale: "en",
    })
  }

  const locations = await trpcClient.locations.list.query()
  let locationId = locations.find((location) => location.name === "HQ")?.id

  if (!locationId) {
    const createdLocation = await trpcClient.locations.create.mutate({
      name: "HQ",
      address: "Main Street 1",
      kind: "building",
    })
    locationId = createdLocation.id
  }

  const assets = await trpcClient.assets.list.query()
  let assetId = assets.find((asset) => asset.name === "Acceptance Laptop")?.id

  if (!assetId) {
    if (!locationId) {
      throw new Error("Failed to resolve or create acceptance location")
    }

    const createdAsset = await trpcClient.assets.create.mutate({
      name: "Acceptance Laptop",
      category: "Laptops",
      status: "available",
      locationId,
      value: 1200,
      purchaseDate: "2025-01-01",
      tags: ["acceptance"],
    })
    assetId = createdAsset.id
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
