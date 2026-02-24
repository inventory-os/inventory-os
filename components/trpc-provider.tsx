"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useState } from "react"
import { createTrpcQueryClient, trpc, useTrpcClient } from "@/lib/trpc/react"

export function TrpcProvider({ children }: { children: ReactNode }) {
  const client = useTrpcClient()
  const [queryClient] = useState(() => createTrpcQueryClient())

  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
