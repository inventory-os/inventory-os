"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAppRuntime } from "@/components/app-runtime-provider"
import { NotificationBell } from "@/components/notification-bell"
import { EUROPEAN_LOCALES, LOCALE_LABELS } from "@/lib/utils/i18n"
import type { EuropeanLocale } from "@/lib/types"

interface PageHeaderProps {
  title: string
  breadcrumbs?: { label: string; href?: string }[]
}

export function PageHeader({ title, breadcrumbs }: PageHeaderProps) {
  const { t, locale, setLocale } = useAppRuntime()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "")
  }, [searchParams])

  const submitSearch = () => {
    const trimmed = query.trim()
    if (!trimmed) {
      router.push("/search")
      return
    }
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <header className="sticky top-0 z-20 flex min-h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-background/80 px-5 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1 md:hidden" />
      <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />

      <div className="hidden min-w-0 flex-1 flex-col md:flex">
        <span className="truncate text-sm font-semibold tracking-tight">{title}</span>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">{t("appName")}</BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbs?.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Select value={locale} onValueChange={(value) => setLocale(value as EuropeanLocale)}>
          <SelectTrigger className="h-9 w-[148px] rounded-xl border-border/70 bg-card/80 text-xs shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EUROPEAN_LOCALES.map((supportedLocale) => (
              <SelectItem key={supportedLocale} value={supportedLocale}>
                {LOCALE_LABELS[supportedLocale]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative hidden lg:block">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitSearch()
              }
            }}
            placeholder={t("globalSearchPlaceholder")}
            className="h-9 w-64 rounded-xl border-border/70 bg-card/80 pl-8 text-xs shadow-sm"
          />
        </div>
        <NotificationBell />
      </div>
    </header>
  )
}
