import { NextResponse } from "next/server"
import { z } from "zod"
import { EUROPEAN_LOCALES } from "@/lib/i18n"
import type { EuropeanLocale } from "@/lib/data"
import { getSetupStatus, saveWorkspaceSettings } from "@/lib/core-repository"

const localeSchema = z.custom<EuropeanLocale>((value) => {
  return typeof value === "string" && EUROPEAN_LOCALES.includes(value as EuropeanLocale)
}, "Invalid locale")

const generalSettingsSchema = z.object({
  appName: z.string().min(2),
  organizationName: z.string().min(2),
  locale: localeSchema,
  currency: z.string().min(3).max(3),
})

export async function GET() {
  const settings = await getSetupStatus()
  return NextResponse.json({ settings })
}

export async function PUT(request: Request) {
  const body = await request.json()
  const parsed = generalSettingsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const settings = await saveWorkspaceSettings(parsed.data)
  return NextResponse.json({ settings })
}
