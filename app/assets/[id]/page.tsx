"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { AssetCustodyHistory, AssetDetailInfo } from "@/components/assets/asset-detail-info"
import { AssetLocationMap } from "@/components/assets/asset-location-map"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { ArrowDownToLine, ArrowLeft, Copy, FileText, Image as ImageIcon, Pencil, Trash2, Upload } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { type Asset, type AssetFile, type IncidentRecord, type LoanRecord, type TeamMember } from "@/lib/types"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useAppRuntime } from "@/components/app-runtime-provider"
import { trpc } from "@/lib/trpc/react"
import { StyledQrCodeCard } from "@/components/styled-qr-code-card"

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const { t, formatCurrency } = useAppRuntime()
  const { isAdmin } = useCurrentUser()
  const trpcUtils = trpc.useUtils()
  const [asset, setAsset] = useState<Asset | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [history, setHistory] = useState<LoanRecord[]>([])
  const [incidents, setIncidents] = useState<IncidentRecord[]>([])
  const [children, setChildren] = useState<Asset[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [files, setFiles] = useState<AssetFile[]>([])
  const [borrowMemberId, setBorrowMemberId] = useState<string>("")
  const [borrowDueDate, setBorrowDueDate] = useState<string>("")
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [uploadKind, setUploadKind] = useState<"image" | "document">("image")
  const [pictureIndex, setPictureIndex] = useState(0)
  const [openDeleteAssetDialog, setOpenDeleteAssetDialog] = useState(false)
  const [pendingDeleteFile, setPendingDeleteFile] = useState<AssetFile | null>(null)

  const borrowAssetMutation = trpc.assets.borrow.useMutation()
  const returnAssetMutation = trpc.assets.return.useMutation()
  const removeAssetMutation = trpc.assets.remove.useMutation()
  const duplicateAssetMutation = trpc.assets.duplicate.useMutation()

  const loadData = async () => {
    setIsLoading(true)
    const [assetData, historyData, incidentsData, childrenData, membersData] = await Promise.all([
      trpcUtils.assets.byId.fetch({ id }),
      trpcUtils.assets.history.fetch({ assetId: id }),
      trpcUtils.incidents.listByAsset.fetch({ assetId: id }),
      trpcUtils.assets.listChildren.fetch({ parentAssetId: id }),
      trpcUtils.members.list.fetch(),
    ])

    const filesResponse = await fetch(`/api/assets/${id}/files`, { cache: "no-store" })

    setAsset((assetData as Asset | null | undefined) ?? null)
    setHistory((historyData as LoanRecord[] | undefined) ?? [])
    setIncidents((incidentsData as IncidentRecord[] | undefined) ?? [])
    setChildren((childrenData as Asset[] | undefined) ?? [])
    setMembers((membersData as TeamMember[] | undefined) ?? [])

    if (filesResponse.ok) {
      const payload = await filesResponse.json()
      setFiles(payload.files)
    }

    setIsLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [id])

  useEffect(() => {
    const totalImages = files.filter((file) => file.kind === "image" || file.mimeType.startsWith("image/")).length
    if (totalImages <= 1) {
      setPictureIndex(0)
      return
    }

    const timer = window.setInterval(() => {
      setPictureIndex((current) => (current + 1) % totalImages)
    }, 3200)

    return () => window.clearInterval(timer)
  }, [files])

  const handleBorrow = async () => {
    if (!borrowMemberId) {
      return
    }
    await borrowAssetMutation.mutateAsync({ assetId: id, memberId: borrowMemberId, dueAt: borrowDueDate || undefined })
    setBorrowMemberId("")
    setBorrowDueDate("")
    await loadData()
  }

  const handleReturn = async () => {
    await returnAssetMutation.mutateAsync({ assetId: id })
    await loadData()
  }

  const handleDelete = async () => {
    const response = await removeAssetMutation.mutateAsync({ id }).then(
      () => ({ ok: true }),
      () => ({ ok: false }),
    )
    if (!response.ok) {
      return
    }
    router.push("/assets")
  }

  const handleDuplicate = async () => {
    const duplicated = await duplicateAssetMutation.mutateAsync({ sourceAssetId: id }).then(
      (asset) => asset,
      () => null,
    )
    if (!duplicated) {
      return
    }

    const duplicatedId = duplicated?.id
    if (duplicatedId) {
      router.push(`/assets/${duplicatedId}/edit`)
    }
  }

  const handleUploadFile = async (file: File | null) => {
    if (!file) {
      return
    }

    setIsUploadingFile(true)
    const formData = new FormData()
    formData.set("file", file)
    formData.set("kind", uploadKind)

    const response = await fetch(`/api/assets/${id}/files`, {
      method: "POST",
      body: formData,
    })

    setIsUploadingFile(false)
    if (!response.ok) {
      return
    }
    await loadData()
  }

  const handleDeleteFile = async (fileId: string) => {
    const response = await fetch(`/api/assets/${id}/files/${fileId}`, { method: "DELETE" })
    if (!response.ok) {
      return
    }
    await loadData()
  }

  if (isLoading) {
    return (
      <AppShell>
        <PageHeader
          title={t("assetLoadingTitle")}
          breadcrumbs={[{ label: t("navAssets"), href: "/assets" }, { label: t("commonLoading") }]}
        />
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {t("assetLoadingDetails")}
        </div>
      </AppShell>
    )
  }

  if (!asset) {
    return (
      <AppShell>
        <PageHeader
          title={t("assetNotFoundTitle")}
          breadcrumbs={[{ label: t("navAssets"), href: "/assets" }, { label: t("commonNotFound") }]}
        />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold">{t("assetNotFoundTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("assetNotFoundDescription")}</p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/assets">{t("assetBackToAssets")}</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  const isBorrowed = Boolean(asset.assignedTo)
  const assetQrUrl = typeof window === "undefined" ? `/qr/${asset.id}` : `${window.location.origin}/qr/${asset.id}`
  const imageFiles = files.filter((file) => file.kind === "image" || file.mimeType.startsWith("image/"))
  const activePicture = imageFiles[pictureIndex] ?? null

  return (
    <AppShell>
      <PageHeader
        title={asset.name}
        breadcrumbs={[{ label: t("navAssets"), href: "/assets" }, { label: asset.name }]}
      />
      <div className="app-page">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/assets">
              <ArrowLeft className="mr-1.5 size-3.5" />
              {t("assetBackToAssets")}
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleDuplicate()
                }}
              >
                <Copy className="mr-1.5 size-3.5" />
                {t("commonDuplicate")}
              </Button>
            ) : null}
            {isAdmin ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/assets/${asset.id}/edit`}>
                  <Pencil className="mr-1.5 size-3.5" />
                  {t("commonEdit")}
                </Link>
              </Button>
            ) : null}
            {isAdmin ? (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setOpenDeleteAssetDialog(true)}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                {t("assetDelete")}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <div className="mb-6">
              <AssetDetailInfo asset={asset} />
            </div>

            <div className="mb-6">
              <Card className="app-surface">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {t("assetNestedAssets")} ({children.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {children.length === 0 ? (
                    <div className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                      {t("assetNoNestedAssets")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {children.map((child) => (
                        <Link
                          key={child.id}
                          href={`/assets/${child.id}`}
                          className="flex items-center gap-3 rounded-lg border bg-background/70 px-3 py-2 transition-colors hover:bg-muted/30"
                        >
                          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/20">
                            {child.thumbnailFileId ? (
                              <img
                                src={`/api/assets/${child.id}/files/${child.thumbnailFileId}`}
                                alt={child.name}
                                className="size-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="size-4 text-muted-foreground" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium">{child.name}</p>
                              <StatusBadge status={child.status} />
                              <Badge variant="secondary" className="text-[10px]">
                                {child.category}
                              </Badge>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                              <span className="font-mono">{child.id}</span>
                              <span>
                                {t("assetTableLocation")}: {child.location}
                              </span>
                              <span>
                                {t("assetTableAssignedTo")}: {child.assignedTo ?? t("assetUnassigned")}
                              </span>
                              {child.tags.slice(0, 2).map((tag) => (
                                <Badge
                                  key={`${child.id}-${tag}`}
                                  variant="outline"
                                  className="rounded-full text-[10px]"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="shrink-0 text-right text-xs font-medium text-foreground">
                            {formatCurrency(child.value)}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  <p className="pt-1 text-[11px] text-muted-foreground">{t("assetNestedLocationHint")}</p>
                </CardContent>
              </Card>
            </div>

            <div className="mb-6">
              <Card className="app-surface">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">{t("assetBorrowing")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    {isBorrowed ? t("assetBorrowedBy", { name: asset.assignedTo ?? "" }) : t("assetAvailableNow")}
                  </div>
                  {isAdmin ? (
                    <div className="flex flex-wrap gap-2">
                      <SearchableSelect
                        value={borrowMemberId}
                        onValueChange={setBorrowMemberId}
                        items={members.map((member) => ({
                          value: member.id,
                          label: member.name,
                          description: `${member.id} · ${member.email}`,
                        }))}
                        placeholder={t("assetAssignToMember")}
                        searchPlaceholder={t("teamSearchPlaceholder")}
                        emptyLabel={t("bookingsNoMatches")}
                        className="w-[280px]"
                      />
                      <Input
                        type="date"
                        value={borrowDueDate}
                        onChange={(event) => setBorrowDueDate(event.target.value)}
                        className="w-[180px]"
                        placeholder={t("bookingsOptionalDueDate")}
                      />
                      <Button onClick={handleBorrow} disabled={!borrowMemberId}>
                        {t("assetBorrowToMember")}
                      </Button>
                      <Button variant="outline" onClick={handleReturn} disabled={!isBorrowed}>
                        {t("assetMarkReturned")}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="mb-6">
              <Card className="app-surface">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {t("incidentsOnAsset")} ({incidents.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {incidents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("incidentsNoneOnAsset")}</p>
                  ) : (
                    incidents.slice(0, 5).map((incident) => (
                      <div key={incident.id} className="rounded-md border px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/incidents/${incident.id}`} className="text-xs font-medium hover:text-primary">
                            {incident.title}
                          </Link>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {incident.id}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {incident.status === "open"
                              ? t("incidentsStatusOpen")
                              : incident.status === "investigating"
                                ? t("incidentsStatusInvestigating")
                                : t("incidentsStatusResolved")}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {incident.severity === "low"
                              ? t("incidentsSeverityLow")
                              : incident.severity === "medium"
                                ? t("incidentsSeverityMedium")
                                : incident.severity === "high"
                                  ? t("incidentsSeverityHigh")
                                  : t("incidentsSeverityCritical")}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {incident.attachmentCount} {t("incidentsAttachments")}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{incident.description}</p>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {t("incidentsReportedAt")}: {new Date(incident.reportedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                  {isAdmin ? (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/incidents?assetId=${asset.id}`}>{t("incidentsNew")}</Link>
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/incidents?assetId=${asset.id}`}>{t("navIncidents")}</Link>
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="mb-6">
              <Card className="app-surface">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">{t("assetFilesMedia")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {isAdmin ? (
                    <div className="grid gap-3 sm:grid-cols-[180px_1fr] sm:items-end">
                      <div className="grid gap-2">
                        <Label>{t("assetUploadType")}</Label>
                        <Select
                          value={uploadKind}
                          onValueChange={(value) => setUploadKind(value as "image" | "document")}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="image">{t("assetUploadImage")}</SelectItem>
                            <SelectItem value="document">{t("assetUploadDocument")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="rounded-lg border border-dashed p-3">
                        <Label htmlFor="asset-file-upload" className="sr-only">
                          {t("assetUploadFile")}
                        </Label>
                        <Input
                          id="asset-file-upload"
                          type="file"
                          accept={
                            uploadKind === "image"
                              ? "image/*"
                              : ".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
                          }
                          disabled={isUploadingFile}
                          onChange={(event) => {
                            const selected = event.target.files?.[0] ?? null
                            void handleUploadFile(selected)
                            event.currentTarget.value = ""
                          }}
                        />
                        <p className="mt-2 text-xs text-muted-foreground">
                          {isUploadingFile ? t("assetUploading") : t("assetUploadHelp")}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{t("assetAllUploadedFiles")}</p>
                    <div className="space-y-2">
                      {files.map((file) => {
                        const isImage = file.kind === "image" || file.mimeType.startsWith("image/")
                        return (
                          <div
                            key={file.id}
                            className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {isImage ? (
                                <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
                              ) : (
                                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                              )}
                              <a
                                href={
                                  isImage
                                    ? `/api/assets/${asset.id}/files/${file.id}`
                                    : `/api/assets/${asset.id}/files/${file.id}?download=1`
                                }
                                target={isImage ? "_blank" : undefined}
                                rel={isImage ? "noreferrer" : undefined}
                                className="truncate text-xs font-medium hover:text-primary"
                              >
                                {file.originalName}
                              </a>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
                                <a href={`/api/assets/${asset.id}/files/${file.id}?download=1`}>
                                  {t("commonDownload")}
                                </a>
                              </Button>
                              {isAdmin ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-destructive"
                                  onClick={() => setPendingDeleteFile(file)}
                                >
                                  {t("commonRemove")}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                      {files.length === 0 && <p className="text-xs text-muted-foreground">{t("assetNoFilesYet")}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <AssetCustodyHistory history={history} />
          </div>
          <div>
            {activePicture ? (
              <div className="mb-6">
                <a
                  href={`/api/assets/${asset.id}/files/${activePicture.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-xl bg-white/60"
                >
                  <img
                    src={`/api/assets/${asset.id}/files/${activePicture.id}`}
                    alt={activePicture.originalName}
                    className="h-[240px] w-full object-contain"
                  />
                </a>
              </div>
            ) : null}

            <StyledQrCodeCard
              title={t("assetQrCardTitle")}
              payload={assetQrUrl}
              entityName={asset.name}
              downloadFileName={`asset-${asset.id}-qr-styled.png`}
              downloadLabel={t("assetDownloadPng")}
              preparingLabel={t("assetPreparingPng")}
            />
            <AssetLocationMap asset={asset} />
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={openDeleteAssetDialog}
        onOpenChange={setOpenDeleteAssetDialog}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription", { name: asset.name })}
        cancelLabel={t("commonCancel")}
        confirmLabel={t("deleteConfirmAction")}
        onConfirm={() => {
          void handleDelete()
        }}
      />

      <ConfirmDeleteDialog
        open={pendingDeleteFile !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteFile(null)
          }
        }}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription", { name: pendingDeleteFile?.originalName ?? "" })}
        cancelLabel={t("commonCancel")}
        confirmLabel={t("deleteConfirmAction")}
        onConfirm={() => {
          if (pendingDeleteFile) {
            void handleDeleteFile(pendingDeleteFile.id)
          }
          setPendingDeleteFile(null)
        }}
      />
    </AppShell>
  )
}
