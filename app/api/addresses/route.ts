import { NextResponse } from "next/server"
import { z } from "zod"
import { createAddress, listAddresses } from "@/lib/core-repository"
import { toPublicErrorMessage } from "@/lib/api-error"

const addressSchema = z.object({
  label: z.string().trim().min(2).max(120),
  addressLine1: z.string().trim().min(2).max(160),
  addressLine2: z.string().trim().max(160).optional(),
  postalCode: z.string().trim().min(2).max(24),
  city: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(120),
})

export async function GET() {
  const addresses = await listAddresses()
  return NextResponse.json({ addresses })
}

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = addressSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const address = await createAddress(parsed.data)
    return NextResponse.json({ address }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toPublicErrorMessage(error, "Failed to create address") }, { status: 400 })
  }
}
