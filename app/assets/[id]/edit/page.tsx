"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { TagInput } from "@/components/ui/tag-input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft } from "lucide-react"
import {
  DEFAULT_UNCATEGORIZED_CATEGORY,
  type Asset,
  type AssetCategory,
  type AssetStatus,
  type LocationData,
  type Producer,
} from "@/lib/data"
import { useAppRuntime } from "@/components/app-runtime-provider"

export default function AssetEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)
  const { t } = useAppRuntime()

  const [asset, setAsset] = useState<Asset | null>(null)
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [locations, setLocations] = useState<LocationData[]>([])
  const [allAssets, setAllAssets] = useState<Asset[]>([])
  const [tagSuggestions, setTagSuggestions] = useState<Array<{ name: string; count: number }>>([])
  const [producers, setProducers] = useState<Producer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    name: "",
    parentAssetId: "none",
    category: DEFAULT_UNCATEGORIZED_CATEGORY as AssetCategory,
    status: "available" as AssetStatus,
    producerId: "none",
    model: "",
    serialNumber: "",
    sku: "",
    supplier: "",
    warrantyUntil: "",
    condition: "good" as "new" | "good" | "fair" | "damaged",
    quantity: "1",
    minimumQuantity: "0",
    notes: "",
    value: "0",
    locationId: "none",
    purchaseDate: new Date().toISOString().slice(0, 10),
    tags: [] as string[],
  })

  const loadData = async () => {
    setIsLoading(true)
    const [assetResponse, locationsResponse, assetsResponse, producersResponse, categoriesResponse, tagsResponse] = await Promise.all([
      fetch(`/api/assets/${id}`, { cache: "no-store" }),
      fetch("/api/locations", { cache: "no-store" }),
      fetch("/api/assets?page=1&pageSize=100", { cache: "no-store" }),
      fetch("/api/producers", { cache: "no-store" }),
      fetch("/api/categories", { cache: "no-store" }),
      fetch("/api/tags", { cache: "no-store" }),
    ])

    let loadedAsset: Asset | null = null

    if (assetResponse.ok) {
      const payload = await assetResponse.json()
      const parsedAsset = payload.asset as Asset
      loadedAsset = parsedAsset
      setAsset(parsedAsset)
      setForm((prev) => ({
        ...prev,
        name: parsedAsset.name,
        parentAssetId: parsedAsset.parentAssetId ?? "none",
        category: parsedAsset.category,
        status: parsedAsset.status,
        producerId: parsedAsset.producerId ?? "none",
        model: parsedAsset.model ?? "",
        serialNumber: parsedAsset.serialNumber ?? "",
        sku: parsedAsset.sku ?? "",
        supplier: parsedAsset.supplier ?? "",
        warrantyUntil: parsedAsset.warrantyUntil ?? "",
        condition: parsedAsset.condition ?? "good",
        quantity: String(parsedAsset.quantity ?? 1),
        minimumQuantity: String(parsedAsset.minimumQuantity ?? 0),
        notes: parsedAsset.notes ?? "",
        value: String(parsedAsset.value),
        purchaseDate: parsedAsset.purchaseDate,
        tags: parsedAsset.tags,
      }))
    }

    if (locationsResponse.ok) {
      const payload = await locationsResponse.json()
      setLocations(payload.locations)
      if (loadedAsset) {
        setForm((prev) => ({ ...prev, locationId: loadedAsset.locationId ?? "none" }))
      }
    }

    if (producersResponse.ok) {
      const payload = await producersResponse.json()
      setProducers(payload.producers)
    }

    if (assetsResponse.ok) {
      const payload = await assetsResponse.json()
      setAllAssets(payload.assets ?? [])
    }

    if (categoriesResponse.ok) {
      const payload = await categoriesResponse.json()
      const categoryNames = (payload.managedCategories ?? []).map((category: { name: string }) => category.name)
      setCategories(categoryNames)
      if (loadedAsset && categoryNames.length > 0 && !categoryNames.includes(loadedAsset.category)) {
        setForm((prev) => ({ ...prev, category: categoryNames[0] }))
      }
    }

    if (tagsResponse.ok) {
      const payload = await tagsResponse.json()
      setTagSuggestions(payload.tags ?? [])
    }

    setIsLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [id])

  const saveAsset = async () => {
    setIsSaving(true)
    const response = await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        parentAssetId: form.parentAssetId === "none" ? null : form.parentAssetId,
        category: form.category,
        status: form.status,
        producerId: form.producerId === "none" ? null : form.producerId,
        model: form.model.trim() || null,
        serialNumber: form.serialNumber.trim() || null,
        sku: form.sku.trim() || null,
        supplier: form.supplier.trim() || null,
        warrantyUntil: form.warrantyUntil || null,
        condition: form.condition,
        quantity: Math.max(1, Number(form.quantity || 1)),
        minimumQuantity: Math.max(0, Number(form.minimumQuantity || 0)),
        notes: form.notes.trim() || null,
        locationId: form.locationId === "none" ? null : form.locationId,
        value: Number(form.value),
        purchaseDate: form.purchaseDate,
        tags: form.tags,
      }),
    })
    setIsSaving(false)

    if (!response.ok) {
      return
    }

    router.push(`/assets/${id}`)
  }

  if (isLoading) {
    return (
      <AppShell>
        <PageHeader title={t("assetEditTitle")} breadcrumbs={[{ label: t("navAssets"), href: "/assets" }, { label: t("commonEdit") }]} />
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t("assetEditLoading")}</div>
      </AppShell>
    )
  }

  if (!asset) {
    return (
      <AppShell>
        <PageHeader title={t("assetNotFoundTitle")} breadcrumbs={[{ label: t("navAssets"), href: "/assets" }, { label: t("commonNotFound") }]} />
      </AppShell>
    )
  }

  const selectedParentAsset = form.parentAssetId === "none"
    ? null
    : allAssets.find((entry) => entry.id === form.parentAssetId) ?? null
  const parentCandidates = allAssets.filter((entry) => entry.id !== asset.id)

  return (
    <AppShell>
      <PageHeader title={`${t("commonEdit")} ${asset.name}`} breadcrumbs={[{ label: t("navAssets"), href: "/assets" }, { label: asset.name, href: `/assets/${asset.id}` }, { label: t("commonEdit") }]} />
      <div className="app-page">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href={`/assets/${asset.id}`}>
            <ArrowLeft className="mr-1.5 size-3.5" />
            {t("assetBackToDetails")}
          </Link>
        </Button>

        <div className="mx-auto w-full max-w-5xl space-y-6">
          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-sm font-medium">{t("assetEditIdentity")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2 md:col-span-2">
                <Label>{t("commonName")}</Label>
                <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t("assetProducer")}</Label>
                <SearchableSelect
                  value={form.producerId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, producerId: value }))}
                  items={[
                    { value: "none", label: t("assetNoProducer") },
                    ...producers.map((producer) => ({
                      value: producer.id,
                      label: producer.name,
                    })),
                  ]}
                  placeholder={t("assetAssignProducer")}
                  searchPlaceholder={t("assetAssignProducer")}
                  emptyLabel={t("globalSearchNoSectionResults")}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("assetTableCategory")}</Label>
                <SearchableSelect
                  value={form.category}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, category: value as AssetCategory }))}
                  items={categories.map((category) => ({
                    value: category,
                    label: category,
                  }))}
                  placeholder={t("assetTableCategory")}
                  searchPlaceholder={t("assetTableCategory")}
                  emptyLabel={t("globalSearchNoSectionResults")}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("assetParentAsset")}</Label>
                <SearchableSelect
                  value={form.parentAssetId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, parentAssetId: value }))}
                  items={[
                    { value: "none", label: t("assetNoParentAsset") },
                    ...parentCandidates.map((entry) => ({
                      value: entry.id,
                      label: entry.name,
                      description: entry.id,
                    })),
                  ]}
                  placeholder={t("assetParentAsset")}
                  searchPlaceholder={t("assetsSearchPlaceholder")}
                  emptyLabel={t("globalSearchNoSectionResults")}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("assetModel")}</Label>
                <Input value={form.model} onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t("assetSerialNumber")}</Label>
                <Input value={form.serialNumber} onChange={(event) => setForm((prev) => ({ ...prev, serialNumber: event.target.value }))} />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>{t("assetSku")}</Label>
                <Input value={form.sku} onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-sm font-medium">{t("assetEditStockLifecycle")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2"><Label>{t("assetTableStatus")}</Label><Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as AssetStatus }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="available">{t("statusAvailable")}</SelectItem><SelectItem value="in-use">{t("statusInUse")}</SelectItem><SelectItem value="maintenance">{t("statusMaintenance")}</SelectItem><SelectItem value="retired">{t("statusRetired")}</SelectItem></SelectContent></Select></div>
              <div className="grid gap-2"><Label>{t("assetCondition")}</Label><Select value={form.condition} onValueChange={(value) => setForm((prev) => ({ ...prev, condition: value as "new" | "good" | "fair" | "damaged" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">{t("assetConditionNew")}</SelectItem><SelectItem value="good">{t("assetConditionGood")}</SelectItem><SelectItem value="fair">{t("assetConditionFair")}</SelectItem><SelectItem value="damaged">{t("assetConditionDamaged")}</SelectItem></SelectContent></Select></div>
              <div className="grid gap-2"><Label>{t("assetQuantity")}</Label><Input type="number" min="1" value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))} /></div>
              <div className="grid gap-2"><Label>{t("assetMinQuantity")}</Label><Input type="number" min="0" value={form.minimumQuantity} onChange={(event) => setForm((prev) => ({ ...prev, minimumQuantity: event.target.value }))} /></div>
            </CardContent>
          </Card>

          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-sm font-medium">{t("assetEditProcurementLocation")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2"><Label>{t("assetSupplier")}</Label><Input value={form.supplier} onChange={(event) => setForm((prev) => ({ ...prev, supplier: event.target.value }))} /></div>
              <div className="grid gap-2"><Label>{t("assetTableLocation")}</Label><SearchableSelect value={form.locationId} onValueChange={(value) => setForm((prev) => ({ ...prev, locationId: value }))} disabled={Boolean(selectedParentAsset)} items={[{ value: "none", label: t("assetUnassigned") }, ...locations.map((location) => ({ value: location.id, label: location.path }))]} placeholder={t("assetTableLocation")} searchPlaceholder={t("locationsSearch")} emptyLabel={t("globalSearchNoSectionResults")} />{selectedParentAsset ? <p className="text-[11px] text-muted-foreground">{t("assetLocationInherited", { name: selectedParentAsset.name })}</p> : null}</div>
              <div className="grid gap-2"><Label>{t("assetValue")}</Label><Input type="number" min="0" value={form.value} onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))} /></div>
              <div className="grid gap-2"><Label>{t("assetPurchaseDate")}</Label><Input type="date" value={form.purchaseDate} onChange={(event) => setForm((prev) => ({ ...prev, purchaseDate: event.target.value }))} /></div>
              <div className="grid gap-2 md:col-span-2"><Label>{t("assetWarrantyUntil")}</Label><Input type="date" value={form.warrantyUntil} onChange={(event) => setForm((prev) => ({ ...prev, warrantyUntil: event.target.value }))} /></div>
            </CardContent>
          </Card>

          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-sm font-medium">{t("assetEditTagsNotes")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2"><Label>{t("commonTags")}</Label><TagInput value={form.tags} onChange={(value) => setForm((prev) => ({ ...prev, tags: value }))} suggestions={tagSuggestions.map((entry) => entry.name)} placeholder={t("assetTagsPlaceholder")} /></div>
              <div className="grid gap-2"><Label>{t("assetNotes")}</Label><Textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} className="min-h-[96px]" /></div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild><Link href={`/assets/${asset.id}`}>{t("commonCancel")}</Link></Button>
            <Button onClick={saveAsset} disabled={isSaving || form.name.trim().length < 2}>{isSaving ? t("settingsSaving") : t("settingsSaveChanges")}</Button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
