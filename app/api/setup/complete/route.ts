import { NextResponse } from "next/server"
import { z } from "zod"
import { completeInitialSetup, getSetupStatus } from "@/lib/core-repository"
import { EUROPEAN_LOCALES } from "@/lib/i18n"
import type { EuropeanLocale } from "@/lib/data"

const localeSchema = z.custom<EuropeanLocale>((value) => {
  return typeof value === "string" && EUROPEAN_LOCALES.includes(value as EuropeanLocale)
}, "Invalid locale")

const setupSchema = z.object({
  appName: z.string().min(2),
  organizationName: z.string().min(2),
  adminUsername: z.string().min(3),
  adminPassword: z.string().min(8),
  firstLocationName: z.string().min(2),
  firstLocationAddress: z.string().min(3),
  locale: localeSchema,
})

export async function POST(request: Request) {
  const current = await getSetupStatus()
  if (current.setupComplete) {
    return NextResponse.json({ setup: current })
  }

  const body = await request.json()
  const parsed = setupSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const setup = await completeInitialSetup(parsed.data)
  return NextResponse.json({ setup })
}
