import { z } from "zod"

export const AssetConditionSchema = z.enum(["new", "good", "fair", "damaged"])
export type AssetCondition = z.infer<typeof AssetConditionSchema>

export const AssetStatusSchema = z.enum(["available", "in-use", "maintenance", "retired"])
export type AssetStatus = z.infer<typeof AssetStatusSchema>
export type AssetStatusType = AssetStatus

export type AssetCategory = string

export const AssetFileKindSchema = z.enum(["image", "document"])
export type AssetFileKind = z.infer<typeof AssetFileKindSchema>
export type AssetFileKindType = AssetFileKind

export interface Asset {
  id: string
  name: string
  parentAssetId?: string | null
  parentAssetName?: string | null
  category: AssetCategory
  status: AssetStatus
  producerId?: string | null
  producerName?: string | null
  model?: string | null
  serialNumber?: string | null
  sku?: string | null
  supplier?: string | null
  warrantyUntil?: string | null
  condition?: AssetCondition
  quantity?: number
  minimumQuantity?: number
  notes?: string | null
  locationId?: string | null
  location: string
  assignedTo: string | null
  qrCode: string
  value: number
  purchaseDate: string
  lastScanned: string
  tags: string[]
  thumbnailFileId?: string | null
}

export interface AssetFile {
  id: string
  assetId: string
  kind: AssetFileKind
  originalName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export const NullableStringSchema = z.string().nullable()

export const DbAssetRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  parent_asset_id: NullableStringSchema,
  parent_asset_name: NullableStringSchema,
  category: z.string(),
  status: AssetStatusSchema,
  location_id: NullableStringSchema,
  producer_id: NullableStringSchema,
  producer_name: NullableStringSchema,
  model: NullableStringSchema,
  serial_number: NullableStringSchema,
  sku: NullableStringSchema,
  supplier: NullableStringSchema,
  warranty_until: NullableStringSchema,
  asset_condition: AssetConditionSchema,
  quantity: z.union([z.number(), z.string()]),
  minimum_quantity: z.union([z.number(), z.string()]),
  notes: NullableStringSchema,
  location_name: NullableStringSchema,
  assigned_member_name: NullableStringSchema,
  qr_code: z.string(),
  value: z.union([z.number(), z.string()]),
  purchase_date: z.string(),
  last_scanned: z.string(),
  tags: z.string(),
  thumbnail_file_id: NullableStringSchema,
})

export type DbAssetRow = z.infer<typeof DbAssetRowSchema>

export const DbAssetFileRowSchema = z.object({
  id: z.string(),
  asset_id: z.string(),
  kind: AssetFileKindSchema,
  original_name: z.string(),
  mime_type: z.string(),
  size_bytes: z.union([z.number(), z.string()]),
  created_at: z.string(),
})

export type DbAssetFileRow = z.infer<typeof DbAssetFileRowSchema>

export const CreateAssetInputSchema = z.object({
  name: z.string().min(1),
  parentAssetId: z.string().nullable().optional(),
  category: z.string().min(1),
  status: AssetStatusSchema,
  producerId: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  warrantyUntil: z.string().nullable().optional(),
  condition: AssetConditionSchema.optional(),
  quantity: z.number().int().nonnegative().optional(),
  minimumQuantity: z.number().int().nonnegative().optional(),
  notes: z.string().nullable().optional(),
  locationId: z.string().nullable(),
  value: z.number(),
  purchaseDate: z.string(),
  tags: z.array(z.string()),
})

export type CreateAssetInput = z.infer<typeof CreateAssetInputSchema>

export const UpdateAssetInputSchema = CreateAssetInputSchema
export type UpdateAssetInput = z.infer<typeof UpdateAssetInputSchema>

export const CreateAssetFileRecordInputSchema = z.object({
  assetId: z.string().min(1),
  kind: AssetFileKindSchema,
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  storageKey: z.string().min(1),
})

export type CreateAssetFileRecordInput = z.infer<typeof CreateAssetFileRecordInputSchema>

export const BorrowAssetInputSchema = z.object({
  assetId: z.string().min(1),
  memberId: z.string().min(1),
  dueAt: z.string().optional(),
  notes: z.string().optional(),
})

export type BorrowAssetInput = z.infer<typeof BorrowAssetInputSchema>

export type AssetWithStorageKey = Asset & { storageKey: string }
