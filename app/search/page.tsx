"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Package, Factory, Users, MapPin, Tags } from "lucide-react"
import type { Asset, LocationData, ManagedCategory, Producer, TeamMember } from "@/lib/data"
import { useAppRuntime } from "@/components/app-runtime-provider"

type AssetSearchResult = {
  asset: Asset
  matchType: "direct" | "related-member" | "related-producer" | "related-location" | "related-category"
}

const matchTypeLabelKey: Record<AssetSearchResult["matchType"], string> = {
  direct: "",
  "related-member": "globalSearchRelatedMember",
  "related-producer": "globalSearchRelatedProducer",
  "related-location": "globalSearchRelatedLocation",
  "related-category": "globalSearchRelatedCategory",
}

type SearchPayload = {
  query: string
  assets: AssetSearchResult[]
  producers: Producer[]
  members: TeamMember[]
  locations: LocationData[]
  categories: ManagedCategory[]
}

const EMPTY_RESULTS: SearchPayload = {
  query: "",
  assets: [],
  producers: [],
  members: [],
  locations: [],
  categories: [],
}

export default function GlobalSearchPage() {
  const { t, formatCurrency } = useAppRuntime()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryFromUrl = searchParams.get("q") ?? ""

  const [search, setSearch] = useState(queryFromUrl)
  const [results, setResults] = useState<SearchPayload>(EMPTY_RESULTS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSearch(queryFromUrl)
  }, [queryFromUrl])

  useEffect(() => {
    const trimmed = search.trim()
    const current = queryFromUrl.trim()
    if (trimmed === current) {
      return
    }

    const timer = window.setTimeout(() => {
      if (!trimmed) {
        router.replace("/search")
        return
      }
      router.replace(`/search?q=${encodeURIComponent(trimmed)}`)
    }, 220)

    return () => window.clearTimeout(timer)
  }, [queryFromUrl, router, search])

  useEffect(() => {
    const query = queryFromUrl.trim()
    if (!query) {
      setResults(EMPTY_RESULTS)
      return
    }

    let cancelled = false
    setLoading(true)

    const loadResults = async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: "no-store" })
      if (!response.ok) {
        if (!cancelled) {
          setResults(EMPTY_RESULTS)
          setLoading(false)
        }
        return
      }

      const payload = (await response.json()) as SearchPayload
      if (!cancelled) {
        setResults(payload)
        setLoading(false)
      }
    }

    void loadResults()

    return () => {
      cancelled = true
    }
  }, [queryFromUrl])

  const totalMatches = useMemo(() => {
    return (
      results.assets.length +
      results.producers.length +
      results.members.length +
      results.locations.length +
      results.categories.length
    )
  }, [results])

  const submitSearch = () => {
    const trimmed = search.trim()
    if (!trimmed) {
      router.push("/search")
      return
    }
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <AppShell>
      <PageHeader title={t("globalSearchTitle")} breadcrumbs={[{ label: t("globalSearchTitle") }]} />
      <div className="app-page">
        <div className="app-hero">
          <h1 className="text-2xl font-semibold tracking-tight">{t("globalSearchTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("globalSearchSubtitle")}</p>
        </div>

        <Card className="app-surface">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      submitSearch()
                    }
                  }}
                  placeholder={t("globalSearchPlaceholder")}
                  className="pl-8"
                />
              </div>
              <Button onClick={submitSearch}>{t("globalSearchButton")}</Button>
            </div>
          </CardContent>
        </Card>

        {!queryFromUrl.trim() ? (
          <Card className="app-surface">
            <CardContent className="py-10 text-center">
              <p className="text-sm font-medium">{t("globalSearchStart")}</p>
            </CardContent>
          </Card>
        ) : null}

        {queryFromUrl.trim() ? (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{loading ? t("commonLoading") : t("globalSearchResultsCount", { count: totalMatches, query: queryFromUrl })}</span>
          </div>
        ) : null}

        {queryFromUrl.trim() && !loading && totalMatches === 0 ? (
          <Card className="app-surface">
            <CardContent className="py-10 text-center">
              <p className="text-sm font-medium">{t("globalSearchNoResults")}</p>
            </CardContent>
          </Card>
        ) : null}

        {totalMatches > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="app-surface">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><Package className="size-4" /> {t("navAssets")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {results.assets.length === 0 ? <p className="text-xs text-muted-foreground">{t("globalSearchNoSectionResults")}</p> : null}
                {results.assets.map((result) => (
                  <Link key={result.asset.id} href={`/assets/${result.asset.id}`} className="block rounded-md border p-2.5 hover:bg-muted/40">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{result.asset.name}</p>
                      {result.matchType !== "direct" ? <Badge variant="outline" className="text-[10px]">{t(matchTypeLabelKey[result.matchType])}</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{result.asset.id} · {result.asset.producerName ?? t("assetNoProducer")}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{result.asset.category}</Badge>
                      <span className="text-[11px] text-muted-foreground">{formatCurrency(result.asset.value)}</span>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card className="app-surface">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><Factory className="size-4" /> {t("navProducers")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {results.producers.length === 0 ? <p className="text-xs text-muted-foreground">{t("globalSearchNoSectionResults")}</p> : null}
                {results.producers.map((producer) => (
                  <Link key={producer.id} href="/producers" className="block rounded-md border p-2.5 hover:bg-muted/40">
                    <p className="text-sm font-medium">{producer.name}</p>
                    <p className="text-xs text-muted-foreground">{producer.domain}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card className="app-surface">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><Users className="size-4" /> {t("navTeam")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {results.members.length === 0 ? <p className="text-xs text-muted-foreground">{t("globalSearchNoSectionResults")}</p> : null}
                {results.members.map((member) => (
                  <Link key={member.id} href={`/team/${member.id}`} className="block rounded-md border p-2.5 hover:bg-muted/40">
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card className="app-surface">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><MapPin className="size-4" /> {t("navLocations")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {results.locations.length === 0 ? <p className="text-xs text-muted-foreground">{t("globalSearchNoSectionResults")}</p> : null}
                {results.locations.map((location) => (
                  <Link key={location.id} href={`/locations/${location.id}`} className="block rounded-md border p-2.5 hover:bg-muted/40">
                    <p className="text-sm font-medium">{location.name}</p>
                    <p className="text-xs text-muted-foreground">{location.path}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card className="app-surface lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><Tags className="size-4" /> {t("navCategories")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {results.categories.length === 0 ? <p className="text-xs text-muted-foreground">{t("globalSearchNoSectionResults")}</p> : null}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {results.categories.map((category) => (
                    <Link key={category.id} href="/categories" className="block rounded-md border p-2.5 hover:bg-muted/40">
                      <p className="text-sm font-medium">{category.name}</p>
                      <p className="text-xs text-muted-foreground">{t("navAssets")}: {category.assetCount}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
