import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-session"
import { findAuthUserById, listActivityEvents } from "@/lib/core-repository"

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const authUser = await findAuthUserById(session.uid)
  if (!authUser || !authUser.active || !authUser.roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("pageSize") ?? 20) || 20))
  const search = (request.nextUrl.searchParams.get("search") ?? "").trim()
  const type = (request.nextUrl.searchParams.get("type") ?? "all").trim()

  const result = await listActivityEvents({ page, pageSize, search, type })
  return NextResponse.json(result)
}
