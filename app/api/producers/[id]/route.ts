import { NextResponse } from "next/server"
import { z } from "zod"
import { deleteProducer, updateProducer } from "@/lib/core-repository"
import { toPublicErrorMessage } from "@/lib/api-error"

const updateProducerSchema = z.object({
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = updateProducerSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const normalizedWebsite = normalizeWebsiteUrl(parsed.data.websiteUrl)
    const website = new URL(normalizedWebsite)

    const producer = await updateProducer(id, {
      name: parsed.data.name,
      websiteUrl: normalizedWebsite,
      domain: website.hostname.replace(/^www\./i, ""),
      description: parsed.data.description ?? null,
      logoUrl: parsed.data.logoUrl ?? null,
      sourceUrl: parsed.data.sourceUrl ?? parsed.data.websiteUrl,
    })

    if (!producer) {
      return NextResponse.json({ error: "Producer not found" }, { status: 404 })
    }

    return NextResponse.json({ producer })
  } catch (error) {
    return NextResponse.json(
      { error: toPublicErrorMessage(error, "Failed to update producer") },
      { status: 400 },
    )
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const deleted = await deleteProducer(id)
    if (!deleted) {
      return NextResponse.json({ error: "Producer not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: toPublicErrorMessage(error, "Failed to delete producer") },
      { status: 400 },
    )
  }
}
