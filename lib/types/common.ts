import { z } from "zod"

export const IdInputSchema = z.object({
  id: z.string().min(1),
})

export const EmailInputSchema = z.object({
  email: z.string().email(),
})

export const SubjectInputSchema = z.object({
  issuer: z.string().min(1),
  sub: z.string().min(1),
})

export const NameInputSchema = z.object({
  name: z.string().min(1),
})

export const MessageInputSchema = z.object({
  message: z.string().min(1),
})

export const ChangedFieldsInputSchema = z.object({
  changedFields: z.array(z.string()),
})

export const NotificationListInputSchema = z.object({
  memberId: z.string().min(1),
  limit: z.number().int().positive().max(200).optional(),
})

export const NotificationMutationInputSchema = z.object({
  id: z.string().min(1),
  memberId: z.string().min(1),
})

export const MemberIdInputSchema = z.object({
  memberId: z.string().min(1),
})

export const AssetIdInputSchema = z.object({
  assetId: z.string().min(1),
})

export const ParentAssetIdInputSchema = z.object({
  parentAssetId: z.string().min(1),
})

export const SourceAssetIdInputSchema = z.object({
  sourceAssetId: z.string().min(1),
})

export const LocationIdInputSchema = z.object({
  locationId: z.string().min(1),
})

export const IncidentIdInputSchema = z.object({
  incidentId: z.string().min(1),
})

export const AssetFileRefInputSchema = z.object({
  assetId: z.string().min(1),
  fileId: z.string().min(1),
})

export const IncidentFileRefInputSchema = z.object({
  incidentId: z.string().min(1),
  fileId: z.string().min(1),
})

export const UpdateByIdNameInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
})

export const AuthUpdateByIdInputSchema = z.object({
  id: z.string().min(1),
  input: z.object({
    oidcSub: z.string().optional(),
    email: z.string().email().optional(),
    displayName: z.string().optional(),
    roles: z.array(z.string()).optional(),
    active: z.boolean().optional(),
  }),
})

export const IdWithDateInputSchema = z
  .object({
    referenceDate: z.string().datetime().optional(),
  })
  .optional()
