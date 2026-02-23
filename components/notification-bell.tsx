"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Bell, CheckCheck, ExternalLink, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { NotificationRecord } from "@/lib/data"

type NotificationsResponse = {
  notifications: NotificationRecord[]
  unread: number
}

function formatRelative(value: string): string {
  const now = Date.now()
  const target = new Date(value).getTime()
  const diffSeconds = Math.max(1, Math.round((now - target) / 1000))

  if (diffSeconds < 60) {
    return "just now"
  }

  const minutes = Math.floor(diffSeconds / 60)
  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)
  if (days < 7) {
    return `${days}d ago`
  }

  return new Date(value).toLocaleDateString()
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/notifications?limit=25", { cache: "no-store" })
      if (!response.ok) {
        return
      }

      const payload = (await response.json()) as NotificationsResponse
      setNotifications(payload.notifications)
      setUnread(payload.unread)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      void load()
    }, 45_000)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (open) {
      void load()
    }
  }, [open, load])

  const markAllRead = async () => {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      cache: "no-store",
    })

    if (!response.ok) {
      return
    }

    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })))
    setUnread(0)
  }

  const removeAll = async () => {
    const response = await fetch("/api/notifications", {
      method: "DELETE",
      cache: "no-store",
    })

    if (!response.ok) {
      return
    }

    setNotifications([])
    setUnread(0)
  }

  const unreadIds = useMemo(() => new Set(notifications.filter((item) => !item.readAt).map((item) => item.id)), [notifications])

  const markRead = async (id: string) => {
    if (!unreadIds.has(id)) {
      return
    }

    const response = await fetch(`/api/notifications/${id}/read`, {
      method: "POST",
      cache: "no-store",
    })

    if (!response.ok) {
      return
    }

    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)))
    setUnread((current) => Math.max(0, current - 1))
  }

  const removeNotification = async (id: string) => {
    const response = await fetch(`/api/notifications/${id}/read`, {
      method: "DELETE",
      cache: "no-store",
    })

    if (!response.ok) {
      return
    }

    setNotifications((current) => current.filter((item) => item.id !== id))
    if (unreadIds.has(id)) {
      setUnread((current) => Math.max(0, current - 1))
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative size-9 rounded-xl border-border/70 bg-card/80 text-muted-foreground hover:text-foreground">
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary" />
          ) : null}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <DropdownMenuLabel className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Notifications</span>
            <span className="text-[11px] font-normal text-muted-foreground">{unread} unread</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => void markAllRead()} disabled={unread === 0}>
              Read all
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive" onClick={() => void removeAll()} disabled={notifications.length === 0}>
              Clear
            </Button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="max-h-[420px]">
          {loading && notifications.length === 0 ? (
            <div className="px-3 py-5 text-xs text-muted-foreground">Loading notifications…</div>
          ) : notifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">No notifications yet.</div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((item) => {
                const unreadItem = !item.readAt
                const dotClass = item.level === "critical"
                  ? "bg-destructive"
                  : item.level === "warning"
                    ? "bg-warning"
                    : "bg-primary/60"

                return (
                  <div key={item.id} className={`border-b px-3 py-2.5 last:border-b-0 ${unreadItem ? "bg-muted/20" : ""}`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${dotClass} ${unreadItem ? "opacity-100" : "opacity-40"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="line-clamp-1 text-xs font-medium">{item.title}</p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{formatRelative(item.createdAt)}</span>
                        </div>
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">{item.message}</p>
                        <div className="mt-1.5 flex items-center justify-end gap-0.5">
                          {item.linkUrl ? (
                            <Link
                              href={item.linkUrl}
                              className="inline-flex"
                              onClick={() => {
                                void markRead(item.id)
                                setOpen(false)
                              }}
                            >
                              <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground">
                                <ExternalLink className="size-3.5" />
                                <span className="sr-only">Open notification</span>
                              </Button>
                            </Link>
                          ) : null}
                          {unreadItem ? (
                            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground" onClick={() => void markRead(item.id)}>
                              <CheckCheck className="size-3.5" />
                              <span className="sr-only">Mark as read</span>
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive" onClick={() => void removeNotification(item.id)}>
                            <Trash2 className="size-3.5" />
                            <span className="sr-only">Remove notification</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
