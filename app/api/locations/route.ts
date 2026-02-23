import { NextResponse } from "next/server"
import { z } from "zod"
import { createLocation, listLocations, updateLocation } from "@/lib/core-repository"
import { toPublicErrorMessage } from "@/lib/api-error"
import type { LocationKind } from "@/lib/data"

const locationKindSchema = z.custom<LocationKind>((value) => {
  return ["building", "floor", "room", "storage", "area"].includes(String(value))
}, "Invalid location kind")

const createLocationSchema = z.object({
  name: z.string().min(2),
  addressId: z.string().nullable().optional(),
  address: z.string().trim().optional(),
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().optional(),
  floorNumber: z.string().trim().max(24).optional(),
  roomNumber: z.string().trim().max(24).optional(),
  parentId: z.string().nullable().optional(),
  kind: locationKindSchema.optional(),
})

const updateLocationSchema = createLocationSchema.extend({
  id: z.string().min(2),
})

export async function GET() {
  const locations = await listLocations()
  return NextResponse.json({ locations })
}

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = createLocationSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const location = await createLocation(parsed.data)
    return NextResponse.json({ location }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toPublicErrorMessage(error, "Failed to create location") }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const parsed = updateLocationSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const location = await updateLocation(parsed.data.id, {
      name: parsed.data.name,
      addressId: parsed.data.addressId,
      address: parsed.data.address,
      addressLine1: parsed.data.addressLine1,
      addressLine2: parsed.data.addressLine2,
      city: parsed.data.city,
      postalCode: parsed.data.postalCode,
      country: parsed.data.country,
      floorNumber: parsed.data.floorNumber,
      roomNumber: parsed.data.roomNumber,
      parentId: parsed.data.parentId,
      kind: parsed.data.kind,
    })

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 })
    }

    return NextResponse.json({ location })
  } catch (error) {
    return NextResponse.json({ error: toPublicErrorMessage(error, "Failed to update location") }, { status: 400 })
  }
}
