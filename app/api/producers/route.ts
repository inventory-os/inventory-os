import { NextResponse } from "next/server"
import { z } from "zod"
import { createProducer, listProducers } from "@/lib/core-repository"
import { toPublicErrorMessage } from "@/lib/api-error"

const importProducerSchema = z.object({
  url: z.string().url(),
})

const manualProducerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  websiteUrl: z.string().url(),
  description: z.string().trim().max(2000).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
})

function normalizeWebsiteUrl(input: string): string {
  const parsed = new URL(input)
  parsed.hash = ""
  parsed.search = ""
  parsed.pathname = "/"
  return parsed.toString().replace(/\/$/, "")
}

function extractMetaTag(html: string, key: string, by: "name" | "property") {
  const pattern = new RegExp(`<meta[^>]*${by}=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i")
  return html.match(pattern)?.[1]?.trim() ?? null
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return match?.[1]?.trim() ?? null
}

function toProducerName(hostname: string): string {
  const base = hostname.replace(/^www\./i, "").split(".")[0] ?? hostname
  if (!base) {
    return hostname
  }
  return base.charAt(0).toUpperCase() + base.slice(1)
}

async function importFromWebsite(inputUrl: string) {
  const normalized = normalizeWebsiteUrl(inputUrl)
  const websiteUrl = new URL(normalized)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(websiteUrl.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Inventory OsProducerImporter/1.0 (+https://inventory-os.local)",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`Could not fetch website (${response.status})`)
    }

    const html = await response.text()
    const finalUrl = normalizeWebsiteUrl(response.url || websiteUrl.toString())
    const finalParsed = new URL(finalUrl)

    const title = extractTitle(html)
    const ogSiteName = extractMetaTag(html, "og:site_name", "property")
    const ogTitle = extractMetaTag(html, "og:title", "property")
    const description =
      extractMetaTag(html, "description", "name") ?? extractMetaTag(html, "og:description", "property") ?? null
    const ogImage = extractMetaTag(html, "og:image", "property")

    const name = ogSiteName ?? ogTitle ?? title ?? toProducerName(finalParsed.hostname)
    const logoUrl = ogImage
      ? new URL(ogImage, `${finalParsed.protocol}//${finalParsed.host}`).toString()
      : `${finalParsed.protocol}//${finalParsed.host}/favicon.ico`

    return {
      name,
      websiteUrl: finalUrl,
      domain: finalParsed.hostname.replace(/^www\./i, ""),
      description,
      logoUrl,
      sourceUrl: inputUrl,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET() {
  const producers = await listProducers()
  return NextResponse.json({ producers })
}

export async function POST(request: Request) {
  const body = await request.json()

  try {
    const parsedImport = importProducerSchema.safeParse(body)
    if (parsedImport.success) {
      const imported = await importFromWebsite(parsedImport.data.url)
      const producer = await createProducer(imported)
      return NextResponse.json({ producer }, { status: 201 })
    }

    const parsedManual = manualProducerSchema.safeParse(body)
    if (!parsedManual.success) {
      return NextResponse.json(
        { error: { import: parsedImport.error.flatten(), manual: parsedManual.error.flatten() } },
        { status: 400 },
      )
    }

    const normalizedWebsite = normalizeWebsiteUrl(parsedManual.data.websiteUrl)
    const website = new URL(normalizedWebsite)

    const producer = await createProducer({
      name: parsedManual.data.name,
      websiteUrl: normalizedWebsite,
      domain: website.hostname.replace(/^www\./i, ""),
      description: parsedManual.data.description ?? null,
      logoUrl: parsedManual.data.logoUrl ?? null,
      sourceUrl: parsedManual.data.sourceUrl ?? parsedManual.data.websiteUrl,
    })

    return NextResponse.json({ producer }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: toPublicErrorMessage(error, "Failed to save producer") },
      { status: 400 },
    )
  }
}
