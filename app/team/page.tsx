"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { ArrowDownAZ, ArrowUpAZ, ArrowUpDown, MoreHorizontal, Plus, Search } from "lucide-react"
import { type TeamMember, type TeamRole } from "@/lib/data"
import { useAppRuntime } from "@/components/app-runtime-provider"

const roleConfig = {
  admin: { className: "bg-primary/10 text-primary border-primary/20" },
  member: { className: "bg-secondary text-secondary-foreground border-border" },
}

type TeamSortKey = "name" | "email" | "role" | "assetsAssigned"
type SortDirection = "asc" | "desc"

function SortableHead({
  label,
  sortKey,
  activeSort,
  sortDirection,
  onSortChange,
  align = "left",
}: {
  label: string
  sortKey: TeamSortKey
  activeSort: TeamSortKey
  sortDirection: SortDirection
  onSortChange: (key: TeamSortKey) => void
  align?: "left" | "right"
}) {
  const isActive = activeSort === sortKey
  const Icon = !isActive ? ArrowUpDown : sortDirection === "asc" ? ArrowUpAZ : ArrowDownAZ

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <Button
        variant="ghost"
        size="sm"
        className={align === "right" ? "ml-auto h-7 px-1 text-xs" : "h-7 px-1 text-xs"}
        onClick={() => onSortChange(sortKey)}
      >
        {label}
        <Icon className="ml-1 size-3.5" />
      </Button>
    </TableHead>
  )
}

export default function TeamPage() {
  const { t } = useAppRuntime()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<TeamRole | "all">("all")
  const [sortBy, setSortBy] = useState<TeamSortKey>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalMembers, setTotalMembers] = useState(0)
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "member" as TeamRole,
  })

  const loadMembers = async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      search,
      role: roleFilter,
    })

    const response = await fetch(`/api/members?${params.toString()}`, { cache: "no-store" })
    if (!response.ok) {
      return
    }
    const payload = await response.json()
    setTeamMembers(payload.members)
    setTotalMembers(payload.pagination?.total ?? payload.members.length)
  }

  useEffect(() => {
    void loadMembers()
  }, [page, pageSize, search, roleFilter])

  useEffect(() => {
    setPage(1)
  }, [search, roleFilter])

  const sortedMembers = useMemo(() => {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
    const direction = sortDirection === "asc" ? 1 : -1

    const getSortValue = (member: TeamMember): string | number => {
      switch (sortBy) {
        case "name":
          return member.name
        case "email":
          return member.email
        case "role":
          return member.role
        case "assetsAssigned":
          return member.assetsAssigned
        default:
          return member.name
      }
    }

    return [...teamMembers].sort((left, right) => {
      const leftValue = getSortValue(left)
      const rightValue = getSortValue(right)

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction
      }

      return collator.compare(String(leftValue), String(rightValue)) * direction
    })
  }, [teamMembers, sortBy, sortDirection])

  const handleSortChange = (key: TeamSortKey) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortBy(key)
    setSortDirection("asc")
  }

  const createMember = async () => {
    setSaving(true)
    const response = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!response.ok) {
      return
    }
    setOpen(false)
    setForm({ name: "", email: "", role: "member" })
    await loadMembers()
  }

  return (
    <AppShell>
      <PageHeader title={t("navTeam")} breadcrumbs={[{ label: t("navTeam") }]} />
      <div className="app-page">
        <div className="app-hero flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("teamMembersTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("teamMembersSubtitle")}
            </p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />
            {t("teamAddMember")}
          </Button>
        </div>

        <div className="app-surface space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("teamSearchPlaceholder")}
                className="pl-8"
              />
            </div>
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as TeamRole | "all")}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder={t("teamRole")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("teamAllRoles")}</SelectItem>
                <SelectItem value="admin">{t("teamRoleAdmin")}</SelectItem>
                <SelectItem value="member">{t("teamRoleMember")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHead
                  label={t("commonName")}
                  sortKey="name"
                  activeSort={sortBy}
                  sortDirection={sortDirection}
                  onSortChange={handleSortChange}
                />
                <SortableHead
                  label={t("commonEmail")}
                  sortKey="email"
                  activeSort={sortBy}
                  sortDirection={sortDirection}
                  onSortChange={handleSortChange}
                />
                <SortableHead
                  label={t("teamRole")}
                  sortKey="role"
                  activeSort={sortBy}
                  sortDirection={sortDirection}
                  onSortChange={handleSortChange}
                />
                <SortableHead
                  label={t("teamAssetsAssigned")}
                  sortKey="assetsAssigned"
                  activeSort={sortBy}
                  sortDirection={sortDirection}
                  onSortChange={handleSortChange}
                  align="right"
                />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMembers.map((member) => {
                const role = roleConfig[member.role]
                const roleLabelKey = member.role === "admin" ? "teamRoleAdmin" : "teamRoleMember"
                return (
                  <TableRow key={member.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-medium">
                            {member.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <Link href={`/team/${member.id}`} className="truncate text-sm font-medium hover:text-primary">
                            {member.name}
                          </Link>
                          <span className="text-[11px] text-muted-foreground">{member.id}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{member.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${role.className}`}>
                        {t(roleLabelKey)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{member.assetsAssigned}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontal className="size-3.5" />
                            <span className="sr-only">{t("assetTableActions")}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/team/${member.id}`}>{t("assetViewDetails")}</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t("teamShowing", { current: sortedMembers.length, total: totalMembers })}
            </span>
            <DataTablePagination page={page} pageSize={pageSize} total={totalMembers} onPageChange={setPage} />
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("teamAddMember")}</DialogTitle>
            <DialogDescription>{t("teamDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>{t("commonName")}</Label>
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>{t("commonEmail")}</Label>
              <Input value={form.email} type="email" onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>{t("teamRole")}</Label>
              <Select value={form.role} onValueChange={(value) => setForm((prev) => ({ ...prev, role: value as TeamRole }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t("teamRoleAdmin")}</SelectItem>
                  <SelectItem value="member">{t("teamRoleMember")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("commonCancel")}
            </Button>
            <Button onClick={createMember} disabled={saving || form.name.length < 2 || !form.email.includes("@")}>
              {saving ? t("settingsSaving") : t("teamCreateMember")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
