import { z } from "zod"

export const IncidentStatusSchema = z.enum(["open", "investigating", "resolved"])
export const IncidentSeveritySchema = z.enum(["low", "medium", "high", "critical"])
export const IncidentTypeSchema = z.enum(["damage", "malfunction", "loss", "theft", "safety", "other"])
export const IncidentFileKindSchema = z.enum(["image", "document"])

export type IncidentStatus = z.infer<typeof IncidentStatusSchema>
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>
export type IncidentType = z.infer<typeof IncidentTypeSchema>
export type IncidentFileKind = z.infer<typeof IncidentFileKindSchema>

export interface IncidentFile {
  id: string
  incidentId: string
  kind: IncidentFileKind
  originalName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export interface IncidentRecord {
  id: string
  assetId: string
  assetName: string
  incidentType: IncidentType
  title: string
  description: string
  severity: IncidentSeverity
  status: IncidentStatus
  reportedBy: string
  occurredAt: string | null
  estimatedRepairCost: number | null
  reportedAt: string
  resolvedAt: string | null
  resolutionNotes: string | null
  attachmentCount: number
  updatedAt: string
}

export const ListIncidentsInputSchema = z.object({
  assetId: z.string().optional(),
  status: z.union([IncidentStatusSchema, z.literal("all"), z.null()]).optional(),
  search: z.string().optional(),
})

export const CreateIncidentInputSchema = z.object({
  assetId: z.string().min(1),
  incidentType: IncidentTypeSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  severity: IncidentSeveritySchema,
  occurredAt: z.string().nullable().optional(),
  estimatedRepairCost: z.number().nullable().optional(),
  reportedBy: z.string().min(1),
})

export const UpdateIncidentInputSchema = z.object({
  assetId: z.string().optional(),
  status: IncidentStatusSchema.optional(),
  incidentType: IncidentTypeSchema.optional(),
  severity: IncidentSeveritySchema.optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  occurredAt: z.string().nullable().optional(),
  estimatedRepairCost: z.number().nullable().optional(),
  resolutionNotes: z.string().nullable().optional(),
})

export const CreateIncidentFileRecordInputSchema = z.object({
  incidentId: z.string().min(1),
  kind: IncidentFileKindSchema,
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  storageKey: z.string().min(1),
})

export type ListIncidentsInput = z.infer<typeof ListIncidentsInputSchema>
export type CreateIncidentInput = z.infer<typeof CreateIncidentInputSchema>
export type UpdateIncidentInput = z.infer<typeof UpdateIncidentInputSchema>
export type CreateIncidentFileRecordInput = z.infer<typeof CreateIncidentFileRecordInputSchema>
