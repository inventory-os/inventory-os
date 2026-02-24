import { createTRPCProxyClient, httpBatchLink } from "@trpc/client"
import superjson from "superjson"
import type { AppRouter } from "@/lib/trpc/router"
import { getAcceptanceBaseUrl } from "./acceptance-env"
import { createSessionToken } from "@/lib/services/auth-session.service"
import { SESSION_COOKIE_NAME } from "@/lib/utils/auth-constants"

type TestRole = "admin" | "member" | "none"

function getSessionCookie(role: Exclude<TestRole, "none">): string {
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

export function createAcceptanceTrpcClient(role: TestRole = "admin") {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${getAcceptanceBaseUrl()}/api/trpc`,
        transformer: superjson,
        fetch(url, options) {
          const headers = new Headers(options?.headers ?? {})
          if (role !== "none") {
            headers.set("cookie", getSessionCookie(role))
          }

          return fetch(url, {
            ...options,
            headers,
            redirect: "manual",
          })
        },
      }),
    ],
  })
}
