import { z } from "zod"
import { AssetStatusSchema } from "./assets"
import { TeamRoleSchema } from "./members"

export const NotificationLevelSchema = z.enum(["info", "warning", "critical"])
export type NotificationLevel = z.infer<typeof NotificationLevelSchema>

export const NotificationDeliverySchema = z.enum(["immediate", "digest"])
export type NotificationDelivery = z.infer<typeof NotificationDeliverySchema>

export interface NotificationRecord {
  id: string
  recipientMemberId: string
  type: string
  title: string
  message: string
  level: NotificationLevel
  delivery: NotificationDelivery
  linkUrl: string | null
  readAt: string | null
  createdAt: string
}

export const NotifyAssetBorrowedInputSchema = z.object({
  assetId: z.string().min(1),
  assetName: z.string().min(1),
  memberId: z.string().min(1),
  memberName: z.string().min(1),
})

export const NotifyAssetReturnedInputSchema = z.object({
  assetId: z.string().min(1),
  assetName: z.string().min(1),
  memberId: z.string().min(1),
})

export const NotifyAssetStatusChangedInputSchema = z.object({
  assetId: z.string().min(1),
  assetName: z.string().min(1),
  fromStatus: AssetStatusSchema,
  toStatus: AssetStatusSchema,
  assignedMemberId: z.string().nullable(),
})

export const NotifyLowInventoryForAssetInputSchema = z.object({
  assetId: z.string().min(1),
  assetName: z.string().min(1),
  quantity: z.number(),
  minimumQuantity: z.number(),
})

export const NotifyMemberRoleChangedInputSchema = z.object({
  memberId: z.string().min(1),
  memberName: z.string().min(1),
  fromRole: TeamRoleSchema,
  toRole: TeamRoleSchema,
})
