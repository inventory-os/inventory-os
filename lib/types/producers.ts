import { z } from "zod"

export interface Producer {
  id: string
  name: string
  websiteUrl: string
  domain: string
  description: string | null
  logoUrl: string | null
  sourceUrl: string
  createdAt: string
}

export const ProducerInputSchema = z.object({
  name: z.string().min(1),
  websiteUrl: z.string().min(1),
  domain: z.string().min(1),
  description: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  sourceUrl: z.string().min(1),
})

export type ProducerInput = z.infer<typeof ProducerInputSchema>
