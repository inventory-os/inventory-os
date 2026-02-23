import { NextResponse } from "next/server"
import { z } from "zod"
import { getEffectiveSecuritySettings, getSecuritySettings, saveSecuritySettings } from "@/lib/core-repository"

const securitySettingsSchema = z.object({
  trustedProxies: z.array(z.string().trim().min(1).max(128)).max(100),
  trustedDomains: z.array(z.string().trim().min(1).max(128)).max(100),
})

export async function GET() {
  const [settings, effective] = await Promise.all([
    getSecuritySettings(),
    getEffectiveSecuritySettings(),
  ])

  return NextResponse.json({
    settings,
    effective: {
      trustedProxies: effective.trustedProxies,
      trustedDomains: effective.trustedDomains,
      trustedProxiesSource: effective.trustedProxiesSource,
      trustedDomainsSource: effective.trustedDomainsSource,
    },
  })
}

export async function PUT(request: Request) {
  const body = await request.json()
  const parsed = securitySettingsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const settings = await saveSecuritySettings(parsed.data)
  return NextResponse.json({ settings })
}
