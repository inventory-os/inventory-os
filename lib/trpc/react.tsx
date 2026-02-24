"use client"

import { QueryClient } from "@tanstack/react-query"
import { createTRPCReact, httpBatchLink } from "@trpc/react-query"
import { useState } from "react"
import superjson from "superjson"
import type { AppRouter } from "@/lib/trpc/router"

export const trpc = createTRPCReact<AppRouter>()

export function createTrpcQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  })
}

export function useTrpcClient() {
  return useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: "include",
            })
          },
        }),
      ],
    }),
  )[0]
}
