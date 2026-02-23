"use client"

import { useEffect, useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Plus, CalendarDays, Clock, CheckCircle2, Search } from "lucide-react"
import { type Asset, type LoanRecord, type TeamMember } from "@/lib/data"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useAppRuntime } from "@/components/app-runtime-provider"

type BookingStatus = "active" | "upcoming" | "completed"

const statusConfig: Record<BookingStatus, { labelKey: string; className: string }> = {
  active: {
    labelKey: "bookingsStatusActive",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  upcoming: {
    labelKey: "bookingsStatusUpcoming",
    className: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  },
  completed: {
    labelKey: "bookingsStatusCompleted",
    className: "bg-muted text-muted-foreground border-border",
  },
}

export default function BookingsPage() {
  const { isAdmin } = useCurrentUser()
  const { t, formatDate } = useAppRuntime()
  const [bookings, setBookings] = useState<LoanRecord[]>([])
  const [search, setSearch] = useState("")
  const [showCompleted, setShowCompleted] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [assets, setAssets] = useState<Asset[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [bookingAssetId, setBookingAssetId] = useState<string>("")
  const [bookingMemberId, setBookingMemberId] = useState<string>("")
  const [bookingDueDate, setBookingDueDate] = useState<string>("")
  const [creatingBooking, setCreatingBooking] = useState(false)

  useEffect(() => {
    const loadBookings = async () => {
      const response = await fetch("/api/loans", { cache: "no-store" })
      if (!response.ok) {
        return
      }
      const payload = await response.json()
      setBookings(payload.loans)
    }

    loadBookings()
  }, [])

  const loadBookings = async () => {
    const response = await fetch("/api/loans", { cache: "no-store" })
    if (!response.ok) {
      return
    }
    const payload = await response.json()
    setBookings(payload.loans)
  }

  const openCreateDialog = async () => {
    const [assetsResponse, membersResponse] = await Promise.all([
      fetch("/api/assets?page=1&pageSize=100", { cache: "no-store" }),
      fetch("/api/members?page=1&pageSize=100", { cache: "no-store" }),
    ])

    if (assetsResponse.ok) {
      const payload = await assetsResponse.json()
      const loadedAssets = (payload.assets ?? []) as Asset[]
      setAssets(loadedAssets)
      if (!bookingAssetId && loadedAssets.length > 0) {
        setBookingAssetId(loadedAssets[0]!.id)
      }
    }

    if (membersResponse.ok) {
      const payload = await membersResponse.json()
      const loadedMembers = (payload.members ?? []) as TeamMember[]
      setMembers(loadedMembers)
      if (!bookingMemberId && loadedMembers.length > 0) {
        setBookingMemberId(loadedMembers[0]!.id)
      }
    }

    setOpenCreate(true)
  }

  const handleCreateBooking = async () => {
    if (!bookingAssetId || !bookingMemberId) {
      return
    }

    setCreatingBooking(true)
    const response = await fetch(`/api/assets/${bookingAssetId}/borrow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "borrow",
        memberId: bookingMemberId,
        dueAt: bookingDueDate || undefined,
      }),
    })
    setCreatingBooking(false)

    if (!response.ok) {
      return
    }

    setOpenCreate(false)
    setBookingDueDate("")
    await loadBookings()
  }

  const withStatus = useMemo(() => {
    const now = Date.now()
    return bookings.map((booking) => {
      const dueAt = booking.dueAt ? new Date(booking.dueAt).getTime() : null
      const status: BookingStatus = booking.returnedAt ? "completed" : dueAt && dueAt > now ? "upcoming" : "active"
      return { ...booking, status }
    })
  }, [bookings])

  const filteredBookings = useMemo(() => {
    const terms = search
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean)

    return withStatus.filter((booking) => {
      if (!showCompleted && booking.status === "completed") {
        return false
      }

      const searchable = [booking.id, booking.assetName, booking.memberName, booking.status].join(" ").toLowerCase()
      return terms.length === 0 || terms.every((term) => searchable.includes(term))
    })
  }, [withStatus, search, showCompleted])

  const formatBookingDate = (value: string | null) => {
    if (!value) {
      return t("bookingsNoDueDate")
    }
    return formatDate(value, { month: "short", day: "numeric", year: "numeric" })
  }

  const getInitials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")

  const selectedBookingAsset = assets.find((entry) => entry.id === bookingAssetId) ?? null

  return (
    <AppShell>
      <PageHeader title={t("navBookings")} breadcrumbs={[{ label: t("navBookings") }]} />
      <div className="app-page">
        <div className="app-hero flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("navBookings")}</h1>
            <p className="text-sm text-muted-foreground">{t("bookingsSubtitle")}</p>
          </div>
          {isAdmin ? (
            <Button size="sm" onClick={() => void openCreateDialog()}>
              <Plus className="mr-1.5 size-3.5" />
              {t("bookingsNew")}
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="app-kpi">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <CalendarDays className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{withStatus.filter((b) => b.status === "active").length}</p>
                <p className="text-xs text-muted-foreground">{t("bookingsActive")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="app-kpi">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-chart-3/10">
                <Clock className="size-5 text-chart-3" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{withStatus.filter((b) => b.status === "upcoming").length}</p>
                <p className="text-xs text-muted-foreground">{t("bookingsUpcoming")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="app-kpi">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle2 className="size-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{withStatus.filter((b) => b.status === "completed").length}</p>
                <p className="text-xs text-muted-foreground">{t("bookingsCompleted")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="app-surface p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-2xl">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("bookingsSearch")}
                className="pl-8"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={showCompleted} onCheckedChange={setShowCompleted} />
              <span>{t("bookingsShowDone")}</span>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {filteredBookings.map((booking) => {
            const config = statusConfig[booking.status]
            return (
              <Card key={booking.id} className="app-surface gap-0 py-0">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">{getInitials(booking.memberName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{booking.assetName}</span>
                      <span className="text-xs text-muted-foreground">
                        {booking.memberName} &middot; <span className="font-mono">{booking.id}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden flex-col items-end gap-0.5 sm:flex">
                      <span className="text-xs font-medium">{formatBookingDate(booking.borrowedAt)}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {t("bookingsTo")} {formatBookingDate(booking.dueAt)}
                      </span>
                    </div>
                    <Badge variant="outline" className={`text-[11px] font-medium ${config.className}`}>
                      {t(config.labelKey)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {withStatus.length > 0 && filteredBookings.length === 0 ? (
            <Card className="app-surface">
              <CardContent className="py-10 text-center">
                <p className="text-sm font-medium">{t("bookingsNoMatches")}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("bookingsCreateTitle")}</DialogTitle>
            <DialogDescription>{t("bookingsCreateDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <SearchableSelect
                value={bookingAssetId}
                onValueChange={setBookingAssetId}
                items={assets.map((asset) => ({
                  value: asset.id,
                  label: asset.name,
                  description: asset.id,
                }))}
                placeholder={t("bookingsSelectAsset")}
                searchPlaceholder={t("searchAssets")}
                emptyLabel={t("bookingsNoMatches")}
              />
              {selectedBookingAsset ? (
                <div className="text-xs text-muted-foreground">
                  <a href={`/assets/${selectedBookingAsset.id}`} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-primary">
                    {t("assetViewDetails")}: {selectedBookingAsset.name}
                  </a>
                </div>
              ) : null}
            </div>
            <div className="grid gap-2">
              <SearchableSelect
                value={bookingMemberId}
                onValueChange={setBookingMemberId}
                items={members.map((member) => ({
                  value: member.id,
                  label: member.name,
                  description: `${member.id} · ${member.email}`,
                }))}
                placeholder={t("bookingsSelectMember")}
                searchPlaceholder={t("teamSearchPlaceholder")}
                emptyLabel={t("bookingsNoMatches")}
              />
            </div>
            <div className="grid gap-2">
              <Input
                type="date"
                value={bookingDueDate}
                onChange={(event) => setBookingDueDate(event.target.value)}
                placeholder={t("bookingsOptionalDueDate")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>{t("commonCancel")}</Button>
            <Button onClick={handleCreateBooking} disabled={creatingBooking || !bookingAssetId || !bookingMemberId}>
              {creatingBooking ? t("settingsSaving") : t("bookingsCreateAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
