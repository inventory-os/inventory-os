import { z } from "zod"

export interface AddressRecord {
  id: string
  label: string
  addressLine1: string
  addressLine2: string | null
  postalCode: string
  city: string
  country: string
  fullAddress: string
  locationCount: number
}

export const AddressInputSchema = z.object({
  label: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().nullable().optional(),
  postalCode: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
})

export type AddressInput = z.infer<typeof AddressInputSchema>
