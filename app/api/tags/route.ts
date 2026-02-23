import { NextResponse } from "next/server"
import { listAssetTags } from "@/lib/core-repository"

export async function GET() {
  const tags = await listAssetTags()
  return NextResponse.json({ tags })
}
