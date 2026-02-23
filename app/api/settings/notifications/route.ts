import { NextResponse } from "next/server"
import { z } from "zod"
import { getNotificationPreferences, recordActivityEvent, saveNotificationPreferences } from "@/lib/core-repository"

const notificationPreferencesSchema = z.object({
  checkoutAlerts: z.boolean(),
  maintenanceAlerts: z.boolean(),
  bookingAlerts: z.boolean(),
  digestEnabled: z.boolean(),
  lowInventoryAlerts: z.boolean(),
})

export async function GET() {
  const settings = await getNotificationPreferences()
  return NextResponse.json({ settings })
}

export async function PUT(request: Request) {
  const body = await request.json()
  const parsed = notificationPreferencesSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const settings = await saveNotificationPreferences(parsed.data)

  await recordActivityEvent({
    type: "settings.notifications",
    actorName: "System",
    subjectType: "settings",
    subjectId: "notification-preferences",
    subjectName: "Notification preferences",
    message: "Notification preferences were updated.",
  })

  return NextResponse.json({ settings })
}
