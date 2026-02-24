"use client"

import { useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Building2, Globe, Import, Link as LinkIcon, Search } from "lucide-react"
import type { Producer } from "@/lib/types"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useAppRuntime } from "@/components/app-runtime-provider"
import { trpc } from "@/lib/trpc/react"

function normalizeWebsiteUrl(input: string): string {
  const parsed = new URL(input)
  parsed.hash = ""
  parsed.search = ""
  parsed.pathname = "/"
  return parsed.toString().replace(/\/$/, "")
}

function getDomainFromUrl(input: string): string {
  return new URL(input).hostname.replace(/^www\./i, "")
}

export default function ProducersPage() {
  const { isAdmin } = useCurrentUser()
  const { t } = useAppRuntime()
  const [openCreate, setOpenCreate] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [createMode, setCreateMode] = useState<"import" | "manual">("import")
  const [message, setMessage] = useState<string | null>(null)
  const [editingProducer, setEditingProducer] = useState<Producer | null>(null)
  const [pendingDeleteProducer, setPendingDeleteProducer] = useState<Producer | null>(null)
  const [url, setUrl] = useState("")
  const [manualForm, setManualForm] = useState({
    name: "",
    websiteUrl: "",
    description: "",
    logoUrl: "",
    sourceUrl: "",
  })

  const [editForm, setEditForm] = useState({
    name: "",
    websiteUrl: "",
    description: "",
    logoUrl: "",
    sourceUrl: "",
  })

  const producerListQuery = trpc.producers.list.useQuery(undefined, {
    staleTime: 30_000,
  })

  const importProducerMutation = trpc.producers.importFromUrl.useMutation()
  const createProducerMutation = trpc.producers.create.useMutation()
  const updateProducerMutation = trpc.producers.update.useMutation()
  const removeProducerMutation = trpc.producers.remove.useMutation()

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim()) {
      return error.message
    }
    return fallback
  }

  const producers: Producer[] = producerListQuery.data ?? []

  const importProducer = async () => {
    setSaving(true)
    setMessage(null)

    try {
      await importProducerMutation.mutateAsync({ url })
    } catch (error) {
      setSaving(false)
      setCreateMode("manual")
      setManualForm((prev) => ({
        ...prev,
        websiteUrl: prev.websiteUrl || url,
        sourceUrl: prev.sourceUrl || url,
      }))
      setMessage(getErrorMessage(error, t("producersImportFailed")))
      return
    }

    setSaving(false)

    setOpenCreate(false)
    setUrl("")
    setMessage(null)
    await producerListQuery.refetch()
  }

  const createProducerManually = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const normalizedWebsite = normalizeWebsiteUrl(manualForm.websiteUrl)
      await createProducerMutation.mutateAsync({
        name: manualForm.name,
        websiteUrl: normalizedWebsite,
        domain: getDomainFromUrl(normalizedWebsite),
        description: manualForm.description || null,
        logoUrl: manualForm.logoUrl || null,
        sourceUrl: manualForm.sourceUrl || normalizedWebsite,
      })
    } catch (error) {
      setSaving(false)
      setMessage(getErrorMessage(error, t("producersManualCreateFailed")))
      return
    }

    setSaving(false)

    setOpenCreate(false)
    setMessage(null)
    setManualForm({ name: "", websiteUrl: "", description: "", logoUrl: "", sourceUrl: "" })
    await producerListQuery.refetch()
  }

  const startEditProducer = (producer: Producer) => {
    setEditingProducer(producer)
    setEditForm({
      name: producer.name,
      websiteUrl: producer.websiteUrl,
      description: producer.description ?? "",
      logoUrl: producer.logoUrl ?? "",
      sourceUrl: producer.sourceUrl ?? producer.websiteUrl,
    })
    setMessage(null)
    setOpenEdit(true)
  }

  const saveEditedProducer = async () => {
    if (!editingProducer) {
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const normalizedWebsite = normalizeWebsiteUrl(editForm.websiteUrl)
      await updateProducerMutation.mutateAsync({
        id: editingProducer.id,
        input: {
          name: editForm.name,
          websiteUrl: normalizedWebsite,
          domain: getDomainFromUrl(normalizedWebsite),
          description: editForm.description || null,
          logoUrl: editForm.logoUrl || null,
          sourceUrl: editForm.sourceUrl || normalizedWebsite,
        },
      })
    } catch (error) {
      setSaving(false)
      setMessage(getErrorMessage(error, t("producersUpdateFailed")))
      return
    }

    setSaving(false)

    setOpenEdit(false)
    setEditingProducer(null)
    setMessage(null)
    await producerListQuery.refetch()
  }

  const removeProducer = async (producer: Producer) => {
    setDeletingId(producer.id)
    setMessage(null)

    try {
      await removeProducerMutation.mutateAsync({ id: producer.id })
    } catch (error) {
      setDeletingId(null)
      setMessage(getErrorMessage(error, t("producersDeleteFailed")))
      return
    }

    setDeletingId(null)

    setPendingDeleteProducer(null)
    await producerListQuery.refetch()
  }

  const filteredProducers = useMemo(() => {
    const terms = search
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean)

    return producers.filter((producer) => {
      const searchable = [
        producer.name,
        producer.domain,
        producer.websiteUrl,
        producer.sourceUrl,
        producer.description ?? "",
      ]
        .join(" ")
        .toLowerCase()

      return terms.length === 0 || terms.every((term) => searchable.includes(term))
    })
  }, [producers, search])

  return (
    <AppShell>
      <PageHeader title={t("navProducers")} breadcrumbs={[{ label: t("navProducers") }]} />
      <div className="app-page">
        <div className="app-hero flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("navProducers")}</h1>
            <p className="text-sm text-muted-foreground">{t("producersSubtitle")}</p>
          </div>
          {isAdmin ? (
            <Button size="sm" onClick={() => setOpenCreate(true)}>
              <Import className="mr-1.5 size-3.5" />
              {t("producersImportByUrl")}
            </Button>
          ) : null}
        </div>

        {message ? <p className="text-sm text-destructive">{message}</p> : null}

        <div className="app-surface p-4">
          <div className="relative sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("producersSearch")}
              className="pl-8"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducers.map((producer) => (
            <Card key={producer.id} className="app-surface gap-0 py-0">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center overflow-hidden rounded-lg border bg-white">
                    {producer.logoUrl ? (
                      <img src={producer.logoUrl} alt={producer.name} className="size-full object-contain" />
                    ) : (
                      <Building2 className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" title={producer.name}>
                      {producer.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground" title={producer.domain}>
                      {producer.domain}
                    </p>
                  </div>
                </div>

                <p className="line-clamp-3 text-xs text-muted-foreground">
                  {producer.description || t("producersNoDescription")}
                </p>

                <div className="space-y-1 text-xs">
                  <a
                    href={producer.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 truncate hover:text-primary"
                    title={producer.websiteUrl}
                  >
                    <Globe className="size-3.5 shrink-0" />
                    {producer.websiteUrl}
                  </a>
                  <a
                    href={producer.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 truncate text-muted-foreground hover:text-primary"
                    title={producer.sourceUrl}
                  >
                    <LinkIcon className="size-3.5 shrink-0" />
                    {t("producersSourceUrl")}
                  </a>
                </div>

                {isAdmin ? (
                  <div className="flex items-center justify-end gap-2 border-t pt-3">
                    <Button variant="outline" size="sm" onClick={() => startEditProducer(producer)}>
                      {t("commonEdit")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deletingId === producer.id}
                      onClick={() => setPendingDeleteProducer(producer)}
                    >
                      {deletingId === producer.id ? t("settingsSaving") : t("assetDelete")}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>

        {producers.length === 0 && (
          <Card className="app-surface">
            <CardContent className="py-10 text-center">
              <p className="text-sm font-medium">{t("producersEmptyTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("producersEmptyDescription")}</p>
            </CardContent>
          </Card>
        )}

        {producers.length > 0 && filteredProducers.length === 0 && (
          <Card className="app-surface">
            <CardContent className="py-10 text-center">
              <p className="text-sm font-medium">{t("producersNoMatches")}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDeleteDialog
        open={pendingDeleteProducer !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteProducer(null)
          }
        }}
        title={t("deleteConfirmTitle")}
        description={t("producersDeleteConfirm", { name: pendingDeleteProducer?.name ?? "" })}
        cancelLabel={t("commonCancel")}
        confirmLabel={t("deleteConfirmAction")}
        onConfirm={() => {
          if (pendingDeleteProducer) {
            void removeProducer(pendingDeleteProducer)
          }
        }}
      />

      {isAdmin ? (
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("producersDialogTitle")}</DialogTitle>
              <DialogDescription>{t("producersDialogDescription")}</DialogDescription>
            </DialogHeader>
            <Tabs value={createMode} onValueChange={(value) => setCreateMode(value as "import" | "manual")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="import">{t("producersImportTab")}</TabsTrigger>
                <TabsTrigger value="manual">{t("producersManualTab")}</TabsTrigger>
              </TabsList>

              <TabsContent value="import" className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="producer-url">{t("producersWebsiteUrl")}</Label>
                  <Input
                    id="producer-url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder={t("producersWebsitePlaceholder")}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenCreate(false)}>
                    {t("commonCancel")}
                  </Button>
                  <Button onClick={importProducer} disabled={saving || !url.startsWith("http")}>
                    {saving ? t("producersImporting") : t("producersImport")}
                  </Button>
                </DialogFooter>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="manual-producer-name">{t("commonName")}</Label>
                  <Input
                    id="manual-producer-name"
                    value={manualForm.name}
                    onChange={(event) => setManualForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder={t("producersManualNamePlaceholder")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-producer-website">{t("producersWebsiteUrl")}</Label>
                  <Input
                    id="manual-producer-website"
                    value={manualForm.websiteUrl}
                    onChange={(event) => setManualForm((prev) => ({ ...prev, websiteUrl: event.target.value }))}
                    placeholder={t("producersWebsitePlaceholder")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-producer-description">{t("producersDescriptionLabel")}</Label>
                  <Textarea
                    id="manual-producer-description"
                    value={manualForm.description}
                    onChange={(event) => setManualForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-producer-logo">{t("producersLogoUrlLabel")}</Label>
                  <Input
                    id="manual-producer-logo"
                    value={manualForm.logoUrl}
                    onChange={(event) => setManualForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
                    placeholder={t("producersLogoUrlPlaceholder")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-producer-source">{t("producersSourceUrl")}</Label>
                  <Input
                    id="manual-producer-source"
                    value={manualForm.sourceUrl}
                    onChange={(event) => setManualForm((prev) => ({ ...prev, sourceUrl: event.target.value }))}
                    placeholder={t("producersWebsitePlaceholder")}
                  />
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenCreate(false)}>
                    {t("commonCancel")}
                  </Button>
                  <Button
                    onClick={createProducerManually}
                    disabled={saving || manualForm.name.trim().length < 2 || !manualForm.websiteUrl.startsWith("http")}
                  >
                    {saving ? t("settingsSaving") : t("commonCreate")}
                  </Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      ) : null}

      {isAdmin ? (
        <Dialog open={openEdit} onOpenChange={setOpenEdit}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("producersEditTitle")}</DialogTitle>
              <DialogDescription>{t("producersEditDescription")}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label htmlFor="edit-producer-name">{t("commonName")}</Label>
              <Input
                id="edit-producer-name"
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-producer-website">{t("producersWebsiteUrl")}</Label>
              <Input
                id="edit-producer-website"
                value={editForm.websiteUrl}
                onChange={(event) => setEditForm((prev) => ({ ...prev, websiteUrl: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-producer-description">{t("producersDescriptionLabel")}</Label>
              <Textarea
                id="edit-producer-description"
                value={editForm.description}
                onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-producer-logo">{t("producersLogoUrlLabel")}</Label>
              <Input
                id="edit-producer-logo"
                value={editForm.logoUrl}
                onChange={(event) => setEditForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
                placeholder={t("producersLogoUrlPlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-producer-source">{t("producersSourceUrl")}</Label>
              <Input
                id="edit-producer-source"
                value={editForm.sourceUrl}
                onChange={(event) => setEditForm((prev) => ({ ...prev, sourceUrl: event.target.value }))}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenEdit(false)}>
                {t("commonCancel")}
              </Button>
              <Button
                onClick={saveEditedProducer}
                disabled={saving || editForm.name.trim().length < 2 || !editForm.websiteUrl.startsWith("http")}
              >
                {saving ? t("settingsSaving") : t("commonSave")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </AppShell>
  )
}
