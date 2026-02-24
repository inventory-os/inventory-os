"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { Badge } from "@/components/ui/badge"
import { IsAdmin } from "@/components/is-admin"
import { useCurrentUser } from "@/hooks/use-current-user"
import type { ActivityRecord } from "@/lib/types"
import { useAppRuntime } from "@/components/app-runtime-provider"
import { trpc } from "@/lib/trpc/react"

type ActivityResponse = {
  events: ActivityRecord[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

const typeOptions = [
  { value: "all", labelKey: "activityAll" },
  { value: "qr.scan", labelKey: "activityTypeQrScan" },
  { value: "asset.create", labelKey: "activityTypeAssetCreate" },
  { value: "asset.borrow", labelKey: "activityTypeAssetBorrow" },
  { value: "asset.return", labelKey: "activityTypeAssetReturn" },
  { value: "asset.status", labelKey: "activityTypeAssetStatus" },
  { value: "settings", labelKey: "activityTypeSettings" },
  { value: "auth", labelKey: "activityTypeAuth" },
]

function formatRelative(value: string): string {
  const now = Date.now()
  const target = new Date(value).getTime()
  const diffMinutes = Math.max(1, Math.round((now - target) / 60000))

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 14) {
    return `${diffDays}d ago`
  }

  return new Date(value).toLocaleString()
}

export default function ActivityPage() {
  const { t } = useAppRuntime()
  const { isAdmin, loading: userLoading } = useCurrentUser()
  const [search, setSearch] = useState("")
  const [type, setType] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)

  const activityQuery = trpc.activity.list.useQuery(
    {
      page,
      pageSize,
      search,
      type,
    },
    {
      enabled: !userLoading && isAdmin,
      staleTime: 10_000,
    },
  )

  const payload = (activityQuery.data as ActivityResponse | undefined) ?? {
    events: [],
    pagination: { page: 1, pageSize, total: 0, totalPages: 1 },
  }
  const events: ActivityRecord[] = payload.events
  const total = payload.pagination.total
  const loading = activityQuery.isLoading || activityQuery.isFetching

  useEffect(() => {
    setPage(1)
  }, [search, type])

  if (userLoading) {
    return (
      <AppShell>
        <PageHeader title={t("activityTitle")} breadcrumbs={[{ label: t("activityTitle") }]} />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader
        title={t("activityTitle")}
        breadcrumbs={[{ label: t("navSettings") }, { label: t("activityTitle") }]}
      />
      <IsAdmin
        isAdmin={isAdmin}
        loading={userLoading}
        fallback={
          <div className="app-page">
            <Card className="app-surface">
              <CardContent className="py-8 text-sm text-muted-foreground">{t("activityAdminOnly")}</CardContent>
            </Card>
          </div>
        }
      >
        <div className="app-page">
          <div className="app-hero">
            <h1 className="text-2xl font-semibold tracking-tight">{t("activityTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("activitySubtitle")}</p>
          </div>

          <Card className="app-surface">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t("activityFilters")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-[1fr_220px]">
              <div className="grid gap-2">
                <Label className="text-xs">{t("activitySearch")}</Label>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("activitySearchPlaceholder")}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">{t("activityType")}</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface">
            <CardContent className="p-0">
              {loading ? (
                <div className="px-4 py-8 text-sm text-muted-foreground">{t("activityLoading")}</div>
              ) : events.length === 0 ? (
                <div className="px-4 py-8 text-sm text-muted-foreground">{t("activityEmpty")}</div>
              ) : (
                <div className="divide-y">
                  {events.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="mt-1 size-2 rounded-full bg-primary/60" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{event.actorName}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {event.type}
                          </Badge>
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{event.message}</p>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {event.subjectName ?? event.subjectId ?? "—"} · {formatRelative(event.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <DataTablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </div>
        </div>
      </IsAdmin>
    </AppShell>
  )
}
