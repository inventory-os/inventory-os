import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createIncident, findAuthUserById, findMemberIdByEmail, listIncidents, recordActivityEvent } from "@/lib/core-repository"
import { getSessionFromRequest } from "@/lib/auth-session"

const createIncidentSchema = z.object({
  assetId: z.string().trim().min(2),
  incidentType: z.enum(["damage", "malfunction", "loss", "theft", "safety", "other"]),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(5).max(4000),
  severity: z.enum(["low", "medium", "high", "critical"]),
  occurredAt: z.string().trim().optional().nullable(),
  estimatedRepairCost: z.number().nonnegative().optional().nullable(),
})

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 10) || 10))
  const severity = (searchParams.get("severity") as "low" | "medium" | "high" | "critical" | "all" | null) ?? "all"

  const incidents = await listIncidents({
    assetId: searchParams.get("assetId")?.trim() || undefined,
    status: (searchParams.get("status") as "open" | "investigating" | "resolved" | "all" | null) ?? "all",
    search: searchParams.get("search")?.trim() || undefined,
  })

  const filtered = severity === "all"
    ? incidents
    : incidents.filter((incident) => incident.severity === severity)

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const normalizedPage = Math.min(page, totalPages)
  const start = (normalizedPage - 1) * pageSize
  const pagedIncidents = filtered.slice(start, start + pageSize)

  const counts = {
    open: filtered.filter((incident) => incident.status === "open").length,
    investigating: filtered.filter((incident) => incident.status === "investigating").length,
    resolved: filtered.filter((incident) => incident.status === "resolved").length,
    critical: filtered.filter((incident) => incident.severity === "critical").length,
  }

  return NextResponse.json({
    incidents: pagedIncidents,
    counts,
    pagination: {
      page: normalizedPage,
      pageSize,
      total,
      totalPages,
    },
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = createIncidentSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const session = getSessionFromRequest(request)
    const authUser = session ? await findAuthUserById(session.uid) : null
    const actorName = authUser?.displayName ?? "System"
    const actorMemberId = authUser ? await findMemberIdByEmail(authUser.email) : null

    const incident = await createIncident({
      ...parsed.data,
      reportedBy: actorName,
    })

    await recordActivityEvent({
      type: "asset.incident.create",
      actorMemberId,
      actorName,
      subjectType: "asset",
      subjectId: incident.assetId,
      subjectName: incident.assetName,
      message: `${actorName} reported incident ${incident.title} for ${incident.assetName}.`,
    })

    return NextResponse.json({ incident }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create incident" },
      { status: 400 },
    )
  }
}
