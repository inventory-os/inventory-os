import { NextResponse } from "next/server"
import { z } from "zod"
import { deleteAddress, updateAddress } from "@/lib/core-repository"
import { toPublicErrorMessage } from "@/lib/api-error"

const addressSchema = z.object({
  label: z.string().trim().min(2).max(120),
  addressLine1: z.string().trim().min(2).max(160),
  addressLine2: z.string().trim().max(160).optional(),
  postalCode: z.string().trim().min(2).max(24),
  city: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(120),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = addressSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const address = await updateAddress(id, parsed.data)
    if (!address) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 })
    }
    return NextResponse.json({ address })
  } catch (error) {
    return NextResponse.json({ error: toPublicErrorMessage(error, "Failed to update address") }, { status: 400 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const deleted = await deleteAddress(id)
    if (!deleted) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: toPublicErrorMessage(error, "Failed to delete address") }, { status: 400 })
  }
}
