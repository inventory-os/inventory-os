import { z } from "zod"

export interface ActivityRecord {
  id: string
  type: string
  actorMemberId: string | null
  actorName: string
  subjectType: "asset" | "location" | "booking" | "auth" | "settings" | "system" | "other"
  subjectId: string | null
  subjectName: string | null
  message: string
  createdAt: string
}

export const RecordActivityEventInputSchema = z.object({
  type: z.string().min(1),
  actorMemberId: z.string().nullable().optional(),
  actorName: z.string().min(1),
  subjectType: z.enum(["asset", "location", "booking", "auth", "settings", "system", "other"]),
  subjectId: z.string().nullable().optional(),
  subjectName: z.string().nullable().optional(),
  message: z.string().min(1),
})

export const ListActivityEventsInputSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  search: z.string().optional(),
  type: z.string().nullable().optional(),
})

export type RecordActivityEventInput = z.infer<typeof RecordActivityEventInputSchema>
export type ListActivityEventsInput = z.infer<typeof ListActivityEventsInputSchema>
