import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { deleteIncident, findAuthUserById, findMemberIdByEmail, listIncidents, recordActivityEvent, updateIncident } from "@/lib/core-repository"
import { getSessionFromRequest } from "@/lib/auth-session"
import { removeStoredIncidentFile } from "@/lib/asset-storage"

const updateIncidentSchema = z.object({
  assetId: z.string().trim().min(2).optional(),
  status: z.enum(["open", "investigating", "resolved"]).optional(),
  incidentType: z.enum(["damage", "malfunction", "loss", "theft", "safety", "other"]).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().min(5).max(4000).optional(),
  occurredAt: z.string().trim().nullable().optional(),
  estimatedRepairCost: z.number().nonnegative().nullable().optional(),
  resolutionNotes: z.string().trim().max(4000).nullable().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = updateIncidentSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const incident = await updateIncident(id, parsed.data)
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 })
  }

  const session = getSessionFromRequest(request)
  const authUser = session ? await findAuthUserById(session.uid) : null
  const actorName = authUser?.displayName ?? "System"
  const actorMemberId = authUser ? await findMemberIdByEmail(authUser.email) : null

  await recordActivityEvent({
    type: "asset.incident.update",
    actorMemberId,
    actorName,
    subjectType: "asset",
    subjectId: incident.assetId,
    subjectName: incident.assetName,
    message: `${actorName} updated incident ${incident.title} (${incident.status}).`,
  })

  return NextResponse.json({ incident })
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const incident = (await listIncidents()).find((entry) => entry.id === id)

  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 })
  }

  return NextResponse.json({ incident })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const deleted = await deleteIncident(id)
  if (!deleted) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 })
  }

  const session = getSessionFromRequest(request)
  const authUser = session ? await findAuthUserById(session.uid) : null
  const actorName = authUser?.displayName ?? "System"
  const actorMemberId = authUser ? await findMemberIdByEmail(authUser.email) : null

  await recordActivityEvent({
    type: "asset.incident.delete",
    actorMemberId,
    actorName,
    subjectType: "asset",
    subjectId: deleted.incident.assetId,
    subjectName: deleted.incident.assetName,
    message: `${actorName} deleted incident ${deleted.incident.title}.`,
  })

  await Promise.allSettled(deleted.storageKeys.map((storageKey) => removeStoredIncidentFile(storageKey)))

  return NextResponse.json({ success: true })
}
