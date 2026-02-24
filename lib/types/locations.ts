import { z } from "zod"

export const LocationKindSchema = z.enum(["building", "floor", "room", "storage", "area"])
export type LocationKind = z.infer<typeof LocationKindSchema>

export interface LocationData {
  id: string
  name: string
  address: string
  addressId: string | null
  addressLine1: string
  addressLine2: string | null
  city: string
  postalCode: string
  country: string
  floorNumber: string | null
  roomNumber: string | null
  locationCode: string | null
  kind: LocationKind
  parentId: string | null
  level: number
  path: string
  directAssetCount: number
  assetCount: number
}

export const LocationInputSchema = z.object({
  name: z.string().min(1),
  addressId: z.string().nullable().optional(),
  address: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().nullable().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  floorNumber: z.string().nullable().optional(),
  roomNumber: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  kind: LocationKindSchema.optional(),
})

export type LocationInput = z.infer<typeof LocationInputSchema>
