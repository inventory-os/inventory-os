"use client"

import { AppRuntimeProvider } from "@/components/app-runtime-provider"
import { TrpcProvider } from "@/components/trpc-provider"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TrpcProvider>
      <AppRuntimeProvider>{children}</AppRuntimeProvider>
    </TrpcProvider>
  )
}
