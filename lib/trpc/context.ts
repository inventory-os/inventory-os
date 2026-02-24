import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch"

export async function createTrpcContext(opts: FetchCreateContextFnOptions) {
  return {
    req: opts.req,
    resHeaders: opts.resHeaders,
  }
}

export type TrpcContext = Awaited<ReturnType<typeof createTrpcContext>>
