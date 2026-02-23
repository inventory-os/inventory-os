import { NextResponse } from "next/server"
import { getMemberProfile } from "@/lib/core-repository"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getMemberProfile(id)

  if (!profile) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 })
  }

  return NextResponse.json(profile)
}
