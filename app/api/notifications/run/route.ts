import { NextRequest, NextResponse } from "next/server"
import { runDueAndOverdueNotifications } from "@/lib/core-repository"

function hasCronAccess(request: NextRequest): boolean {
  const required = process.env.NOTIFICATION_CRON_SECRET
  if (!required) {
    return true
  }

  const auth = request.headers.get("authorization")
  if (!auth) {
    return false
  }

  const [scheme, token] = auth.split(" ")
  return scheme?.toLowerCase() === "bearer" && token === required
}

export async function POST(request: NextRequest) {
  if (!hasCronAccess(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await runDueAndOverdueNotifications(new Date())
  return NextResponse.json({ success: true, ...result })
}
