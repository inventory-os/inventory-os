import { NextResponse } from "next/server"
import { listLoans } from "@/lib/core-repository"

export async function GET() {
  const loans = await listLoans()
  return NextResponse.json({ loans })
}
