import { NextResponse } from "next/server"
import { z } from "zod"
import { getLdapIntegrationSettings, saveLdapIntegrationSettings } from "@/lib/core-repository"
import { toPublicErrorMessage } from "@/lib/api-error"

const ldapSettingsSchema = z.object({
  enabled: z.boolean(),
  url: z.string().min(1),
  bindDn: z.string().min(1),
  bindPassword: z.string().optional(),
  baseDn: z.string().min(1),
  userFilter: z.string().min(1),
  usernameAttribute: z.string().min(1),
  emailAttribute: z.string().min(1),
  nameAttribute: z.string().min(1),
  defaultRole: z.enum(["admin", "member"]),
  syncIssuer: z.string().min(1),
})

export async function GET() {
  const settings = await getLdapIntegrationSettings()
  return NextResponse.json({ settings })
}

export async function PUT(request: Request) {
  const body = await request.json()
  const parsed = ldapSettingsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const settings = await saveLdapIntegrationSettings(parsed.data)
    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json({ error: toPublicErrorMessage(error, "Failed to save LDAP settings") }, { status: 500 })
  }
}
