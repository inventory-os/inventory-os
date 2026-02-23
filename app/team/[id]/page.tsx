"use client"

import Link from "next/link"
import { use, useEffect, useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { type AssetCategory, type AssetStatus, type LoanRecord, type TeamMember } from "@/lib/data"
import { useAppRuntime } from "@/components/app-runtime-provider"

type AssignedMemberAsset = {
  id: string
  name: string
  category: AssetCategory
  status: AssetStatus
  location: string
}

type MemberProfilePayload = {
  member: TeamMember
  assignedAssets: AssignedMemberAsset[]
  loanHistory: LoanRecord[]
}

type ActivityEntry = {
  id: string
  type: "assigned" | "unassigned"
  at: string
  assetId: string
  assetName: string
}

function formatDateTime(value: string | null, formatter: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string, fallback: string): string {
  if (!value) {
    return fallback
  }

  return formatter(value)
}

export default function TeamMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { t, formatDate } = useAppRuntime()
  const { id } = use(params)
  const [profile, setProfile] = useState<MemberProfilePayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadProfile = async () => {
    setIsLoading(true)
    const response = await fetch(`/api/members/${id}`, { cache: "no-store" })

    if (response.ok) {
      const payload = (await response.json()) as MemberProfilePayload
      setProfile(payload)
    } else {
      setProfile(null)
    }

    setIsLoading(false)
  }

  useEffect(() => {
    loadProfile()
  }, [id])

  const activity = useMemo(() => {
    if (!profile) {
      return []
    }

    const entries: ActivityEntry[] = profile.loanHistory.flatMap((loan) => {
      const events: ActivityEntry[] = [
        {
          id: `${loan.id}-borrowed`,
          type: "assigned",
          at: loan.borrowedAt,
          assetId: loan.assetId,
          assetName: loan.assetName,
        },
      ]

      if (loan.returnedAt) {
        events.push({
          id: `${loan.id}-returned`,
          type: "unassigned",
          at: loan.returnedAt,
          assetId: loan.assetId,
          assetName: loan.assetName,
        })
      }

      return events
    })

    return entries.sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
  }, [profile])

  if (isLoading) {
    return (
      <AppShell>
        <PageHeader title={t("teamLoadingTitle")} breadcrumbs={[{ label: t("navTeam"), href: "/team" }, { label: t("commonLoading") }]} />
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t("teamLoadingDetails")}</div>
      </AppShell>
    )
  }

  if (!profile) {
    return (
      <AppShell>
        <PageHeader title={t("teamMemberNotFoundTitle")} breadcrumbs={[{ label: t("navTeam"), href: "/team" }, { label: t("commonNotFound") }]} />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold">{t("teamMemberNotFoundTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("teamMemberNotFoundDescription")}</p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/team">{t("teamBackToList")}</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  const roleClass =
    profile.member.role === "admin"
      ? "bg-primary/10 text-primary border-primary/20"
      : "bg-secondary text-secondary-foreground border-border"

  return (
    <AppShell>
      <PageHeader
        title={profile.member.name}
        breadcrumbs={[
          { label: t("navTeam"), href: "/team" },
          { label: profile.member.name },
        ]}
      />

      <div className="app-page">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">{profile.member.avatar}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{profile.member.name}</h1>
              <p className="text-sm text-muted-foreground">{profile.member.email}</p>
            </div>
          </div>
          <Badge variant="outline" className={`text-[10px] ${roleClass}`}>
            {profile.member.role}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="app-surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t("teamAssignedAssets")}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{profile.assignedAssets.length}</CardContent>
          </Card>
          <Card className="app-surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t("teamTotalActivity")}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{profile.loanHistory.length}</CardContent>
          </Card>
        </div>

        <Card className="app-surface">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("teamAssignedAssets")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("assetTableAsset")}</TableHead>
                  <TableHead>{t("assetTableCategory")}</TableHead>
                  <TableHead>{t("assetTableStatus")}</TableHead>
                  <TableHead>{t("assetTableLocation")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile.assignedAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-xs text-muted-foreground">
                      {t("teamNoAssignedAssets")}
                    </TableCell>
                  </TableRow>
                ) : (
                  profile.assignedAssets.map((asset) => (
                    <TableRow key={asset.id} className="hover:bg-muted/30">
                      <TableCell>
                        <Link href={`/assets/${asset.id}`} className="font-medium hover:text-primary">
                          {asset.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{asset.category}</TableCell>
                      <TableCell>
                        <StatusBadge status={asset.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{asset.location}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="app-surface">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("teamActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("teamTime")}</TableHead>
                  <TableHead>{t("teamAction")}</TableHead>
                  <TableHead>{t("assetTableAsset")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activity.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-xs text-muted-foreground">
                      {t("teamNoActivity")}
                    </TableCell>
                  </TableRow>
                ) : (
                  activity.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(entry.at, formatDate, "—")}</TableCell>
                      <TableCell>
                        <Badge variant={entry.type === "assigned" ? "secondary" : "outline"} className="text-[10px]">
                          {entry.type === "assigned" ? t("teamAssigned") : t("teamUnassigned")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/assets/${entry.assetId}`} className="text-xs font-medium hover:text-primary">
                          {entry.assetName}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
