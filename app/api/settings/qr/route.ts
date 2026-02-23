import { NextResponse } from "next/server"
import { z } from "zod"
import { getQrPublicSettings, notifyQrSettingsChanged, recordActivityEvent, saveQrPublicSettings } from "@/lib/core-repository"

const qrSettingsSchema = z.object({
  enabled: z.boolean(),
  ownerLabel: z.string().max(160),
  publicMessage: z.string().max(4000),
  showLoginButton: z.boolean(),
  loginButtonText: z.string().max(120),
  selectedAddressId: z.string().nullable(),
  logoUrl: z.string().max(1024),
  contactPhone: z.string().max(80),
  contactEmail: z.string().max(160),
  websiteUrl: z.string().max(1024),
  extraLinks: z.array(z.object({
    label: z.string().min(1).max(120),
    url: z.string().min(1).max(1024),
  })).max(12),
}).superRefine((value, context) => {
  if (value.showLoginButton && value.loginButtonText.trim().length < 2) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Login button text must be at least 2 characters",
      path: ["loginButtonText"],
    })
  }
})

export async function GET() {
  const settings = await getQrPublicSettings()
  return NextResponse.json({ settings })
}

export async function PUT(request: Request) {
  const body = await request.json()
  const parsed = qrSettingsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const previous = await getQrPublicSettings()
  const settings = await saveQrPublicSettings(parsed.data)

  const changedFields = [
    previous.enabled !== settings.enabled ? "enabled" : null,
    previous.ownerLabel !== settings.ownerLabel ? "ownerLabel" : null,
    previous.publicMessage !== settings.publicMessage ? "publicMessage" : null,
    previous.showLoginButton !== settings.showLoginButton ? "showLoginButton" : null,
    previous.loginButtonText !== settings.loginButtonText ? "loginButtonText" : null,
    previous.selectedAddressId !== settings.selectedAddressId ? "selectedAddressId" : null,
    previous.logoUrl !== settings.logoUrl ? "logoUrl" : null,
    previous.contactPhone !== settings.contactPhone ? "contactPhone" : null,
    previous.contactEmail !== settings.contactEmail ? "contactEmail" : null,
    previous.websiteUrl !== settings.websiteUrl ? "websiteUrl" : null,
    JSON.stringify(previous.extraLinks) !== JSON.stringify(settings.extraLinks) ? "extraLinks" : null,
  ].filter((entry): entry is string => Boolean(entry))

  await notifyQrSettingsChanged(changedFields)

  if (changedFields.length > 0) {
    await recordActivityEvent({
      type: "settings.qr",
      actorName: "System",
      subjectType: "settings",
      subjectId: "qr-public",
      subjectName: "QR public settings",
      message: `QR public settings updated: ${changedFields.join(", ")}.`,
    })
  }

  return NextResponse.json({ settings })
}
