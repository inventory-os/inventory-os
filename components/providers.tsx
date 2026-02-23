"use client"

import { AppRuntimeProvider } from "@/components/app-runtime-provider"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AppRuntimeProvider>{children}</AppRuntimeProvider>
}
