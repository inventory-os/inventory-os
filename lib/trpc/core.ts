import { initTRPC } from "@trpc/server"
import { TRPCError } from "@trpc/server"
import type { TrpcContext } from "@/lib/trpc/context"
import superjson from "superjson"
import { SESSION_COOKIE_NAME } from "@/lib/utils/auth-constants"
import { verifySessionToken } from "@/lib/services/auth-session.service"

const trpc = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
})

const PUBLIC_MUTATIONS = new Set<string>(["setup.completeInitial"])

function readCookieValue(cookieHeader: string, name: string): string | null {
  const cookies = new Map(
    cookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf("=")
        if (separatorIndex < 0) {
          return [entry, ""] as const
        }
        return [entry.slice(0, separatorIndex), decodeURIComponent(entry.slice(separatorIndex + 1))] as const
      }),
  )

  return cookies.get(name) ?? null
}

const enforceMutationAuthorization = trpc.middleware(async (opts) => {
  if (opts.type !== "mutation") {
    return opts.next()
  }

  if (PUBLIC_MUTATIONS.has(opts.path)) {
    return opts.next()
  }

  const cookieHeader = opts.ctx.req.headers.get("cookie") ?? ""
  const token = readCookieValue(cookieHeader, SESSION_COOKIE_NAME)
  const session = verifySessionToken(token)
  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" })
  }

  if (!session.roles.includes("admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin role required" })
  }

  return opts.next()
})

export const createTrpcRouter = trpc.router
export const publicProcedure = trpc.procedure.use(enforceMutationAuthorization)
