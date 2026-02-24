import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "@/lib/trpc/router"
import { createTrpcContext } from "@/lib/trpc/context"

const endpoint = "/api/trpc"

const handler = (request: Request) =>
  fetchRequestHandler({
    endpoint,
    req: request,
    router: appRouter,
    createContext: createTrpcContext,
  })

export { handler as GET, handler as POST }
