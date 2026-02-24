"use client"

import Link from "next/link"
import { use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAppRuntime } from "@/components/app-runtime-provider"
import { Building2, ExternalLink, Globe, LogIn, Mail, MapPin, Package, Phone, ShieldCheck } from "lucide-react"
import { trpc } from "@/lib/trpc/react"

type QrResolvePayload = {
  found: boolean
  authenticated: boolean
  redirectTo: string | null
  entity: {
    type: "asset" | "location"
    id: string
    name: string
  }
  public?: {
    ownerLabel: string
    message: string
    showLoginButton: boolean
    loginButtonText: string
    logoUrl: string
    contactPhone: string
    contactEmail: string
    websiteUrl: string
    extraLinks: Array<{ label: string; url: string }>
    selectedAddress: {
      id: string
      label: string
      fullAddress: string
    } | null
    loginUrl: string
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function renderRichMessage(input: string): string {
  if (!input.trim()) {
    return ""
  }

  let html = escapeHtml(input)

  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer" class="underline underline-offset-2">$1</a>',
  )
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>")
  html = html.replace(/\n/g, "<br />")

  return html
}

function ensureExternalUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) {
    return ""
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }
  return `https://${trimmed}`
}

export default function QrLandingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { t } = useAppRuntime()
  const resolveQuery = trpc.qr.resolve.useQuery(
    { id },
    {
      staleTime: 10_000,
    },
  )

  const payload = (resolveQuery.data as QrResolvePayload | { found: false } | undefined) ?? null
  const loading = resolveQuery.isLoading || resolveQuery.isFetching
  const notFound = payload ? payload.found === false : false

  useEffect(() => {
    if (!payload || payload.found === false) {
      return
    }

    if (payload.authenticated && payload.redirectTo) {
      router.replace(payload.redirectTo)
    }
  }, [payload, router])

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">{t("qrLoading")}</p>
      </main>
    )
  }

  if (notFound || !payload || payload.found === false) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{t("qrNotFoundTitle")}</CardTitle>
            <CardDescription>{t("qrNotFoundDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/">{t("navDashboard")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40 px-4 py-10">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-center">
        <Card className="w-full overflow-hidden border-border/70 shadow-xl shadow-black/5">
          <div className="h-1 w-full bg-gradient-to-r from-primary/70 via-chart-3/60 to-primary/70" />
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShieldCheck className="size-5 text-primary" />
                  {payload.entity.name}
                </CardTitle>
                <CardDescription>
                  {payload.entity.type === "asset" ? t("qrPublicAssetLabel") : t("qrPublicLocationLabel")} ·{" "}
                  {payload.entity.id}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="flex items-center gap-1.5">
                {payload.entity.type === "asset" ? <Package className="size-3.5" /> : <MapPin className="size-3.5" />}
                {payload.entity.type === "asset" ? t("qrPublicAssetLabel") : t("qrPublicLocationLabel")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {payload.public?.logoUrl ? (
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <div className="flex h-24 items-center justify-center">
                  <img
                    src={payload.public.logoUrl}
                    alt="Owner logo"
                    className="h-16 w-auto max-w-[240px] object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-card shadow-sm">
                <Building2 className="size-7 text-muted-foreground" />
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground">{t("qrPublicOwnership")}</p>
              <p className="text-base font-semibold tracking-tight">{payload.public?.ownerLabel}</p>
            </div>

            {payload.public?.selectedAddress ? (
              <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background">
                    <MapPin className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("qrPublicAddress")}
                    </p>
                    <p className="text-sm font-semibold leading-snug">{payload.public.selectedAddress.label}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                      {payload.public.selectedAddress.fullAddress}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {payload.public?.message ? (
              <div
                className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderRichMessage(payload.public.message) }}
              />
            ) : null}

            <div className="flex flex-wrap gap-2.5">
              {payload.public?.websiteUrl ? (
                <Button asChild size="icon" variant="outline" className="rounded-full" title={t("qrPublicWebsite")}>
                  <a
                    href={ensureExternalUrl(payload.public.websiteUrl)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t("qrPublicWebsite")}
                  >
                    <Globe className="size-4" />
                  </a>
                </Button>
              ) : null}
              {payload.public?.contactPhone ? (
                <Button asChild size="icon" variant="outline" className="rounded-full" title={t("qrPublicCall")}>
                  <a href={`tel:${payload.public.contactPhone}`} aria-label={t("qrPublicCall")}>
                    <Phone className="size-4" />
                  </a>
                </Button>
              ) : null}
              {payload.public?.contactEmail ? (
                <Button asChild size="icon" variant="outline" className="rounded-full" title={t("qrPublicEmail")}>
                  <a href={`mailto:${payload.public.contactEmail}`} aria-label={t("qrPublicEmail")}>
                    <Mail className="size-4" />
                  </a>
                </Button>
              ) : null}
              {(payload.public?.extraLinks ?? []).map((entry) => (
                <Button
                  key={`${entry.label}-${entry.url}`}
                  asChild
                  size="icon"
                  variant="outline"
                  className="rounded-full"
                  title={entry.label || t("qrPublicOpenLink")}
                >
                  <a
                    href={ensureExternalUrl(entry.url)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={entry.label || t("qrPublicOpenLink")}
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              ))}
            </div>

            {payload.public?.showLoginButton ? (
              <Button asChild className="w-full sm:w-auto rounded-full px-5">
                <a href={payload.public.loginUrl} className="inline-flex items-center gap-2">
                  <LogIn className="size-4" />
                  {payload.public.loginButtonText}
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
