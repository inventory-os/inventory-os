import { NextResponse } from "next/server"
import { getSetupStatus } from "@/lib/core-repository"

export async function GET() {
  const setup = await getSetupStatus()
  return NextResponse.json({ setup })
}
