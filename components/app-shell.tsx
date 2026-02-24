"use client"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { useAppRuntime } from "@/components/app-runtime-provider"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { loading } = useAppRuntime()

  if (loading) {
    return <div className="min-h-screen bg-background" />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
