"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import type { ComponentType } from "react"
import {
  LayoutDashboard,
  Package,
  MapPin,
  Tags,
  Users,
  History,
  Settings,
  QrCode,
  CalendarRange,
  Box,
  Factory,
  HeartPulse,
  ShieldAlert,
  LogOut,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAppRuntime } from "@/components/app-runtime-provider"
import type { I18nKey } from "@/lib/utils/i18n"
import { useCurrentUser } from "@/hooks/use-current-user"
import { IsAdmin } from "@/components/is-admin"

const mainNav: { key: I18nKey; icon: ComponentType<{ className?: string }>; href: string; adminOnly?: boolean }[] = [
  { key: "navDashboard", icon: LayoutDashboard, href: "/" },
  { key: "navAssets", icon: Package, href: "/assets" },
  { key: "navIncidents", icon: ShieldAlert, href: "/incidents", adminOnly: true },
  { key: "navProducers", icon: Factory, href: "/producers" },
  { key: "navCategories", icon: Tags, href: "/categories" },
  { key: "navLocations", icon: MapPin, href: "/locations" },
  { key: "navBookings", icon: CalendarRange, href: "/bookings" },
]

const secondaryNav: { key: I18nKey; icon: ComponentType<{ className?: string }>; href: string }[] = [
  { key: "navActivity", icon: History, href: "/activity" },
  { key: "navHealth", icon: HeartPulse, href: "/health" },
  { key: "navTeam", icon: Users, href: "/team" },
  { key: "navSettings", icon: Settings, href: "/settings" },
]

function toInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { state, toggleSidebar } = useSidebar()
  const { config, t } = useAppRuntime()
  const { user: currentUser, isAdmin } = useCurrentUser()

  const displayName = currentUser?.displayName ?? t("currentUser")
  const displayRole = currentUser?.roles?.[0] ? currentUser.roles[0].toUpperCase() : "USER"
  const initials = toInitials(displayName || "U") || "U"

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="p-3 group-data-[collapsible=icon]:p-1">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/70 px-2.5 py-2 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0"
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary shadow-sm group-data-[collapsible=icon]:size-6">
            <Box className="size-4 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">{config.appName}</span>
            <span className="text-[11px] text-sidebar-foreground/50">{t("inventoryOs")}</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebarNavigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) =>
                item.adminOnly && !isAdmin ? null : (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      className="rounded-lg"
                      tooltip={t(item.key)}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{t(item.key)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <IsAdmin isAdmin={isAdmin}>
          <SidebarGroup>
            <SidebarGroupLabel>{t("sidebarManagement")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {secondaryNav.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      className="rounded-lg"
                      tooltip={t(item.key)}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{t(item.key)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </IsAdmin>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={t("navScanQr")}
              className="gap-2.5 rounded-lg"
              isActive={pathname === "/scan"}
              onClick={() => {
                if (pathname === "/scan") {
                  window.dispatchEvent(new Event("scan:restart"))
                  return
                }
                router.push("/scan")
              }}
            >
              <QrCode className="size-4" />
              <span className="group-data-[collapsible=icon]:hidden">{t("navScanQr")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={displayName}
              size="lg"
              className="gap-2.5 rounded-lg group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center"
            >
              <Link href={currentUser?.memberId ? `/team/${currentUser.memberId}` : "/team"}>
                <Avatar className="size-6 rounded-md group-data-[collapsible=icon]:size-5">
                  <AvatarFallback className="rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-[10px]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                  <span className="text-xs font-medium text-sidebar-foreground">{displayName}</span>
                  <span className="text-[10px] text-sidebar-foreground/50">{displayRole}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="gap-2.5 rounded-lg" tooltip={t("signOut")}>
              <a href="/api/auth/logout?returnTo=/">
                <LogOut className="size-4" />
                <span className="group-data-[collapsible=icon]:hidden">{t("signOut")}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarSeparator className="my-1" />
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleSidebar} className="gap-2.5 rounded-lg">
              <Box className="size-4" />
              <span>{state === "collapsed" ? t("expandSidebar") : t("collapseSidebar")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
