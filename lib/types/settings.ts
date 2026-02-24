import { z } from "zod"

export interface QrPublicSettings {
  enabled: boolean
  ownerLabel: string
  publicMessage: string
  showLoginButton: boolean
  loginButtonText: string
  selectedAddressId: string | null
  logoUrl: string
  contactPhone: string
  contactEmail: string
  websiteUrl: string
  extraLinks: Array<{ label: string; url: string }>
  updatedAt: string | null
}

export interface NotificationPreferences {
  checkoutAlerts: boolean
  maintenanceAlerts: boolean
  bookingAlerts: boolean
  digestEnabled: boolean
  lowInventoryAlerts: boolean
  updatedAt: string | null
}

export interface SecuritySettings {
  trustedProxies: string[]
  trustedDomains: string[]
  updatedAt: string | null
}

export const QrExtraLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
})

export const SaveQrPublicSettingsInputSchema = z.object({
  enabled: z.boolean(),
  ownerLabel: z.string(),
  publicMessage: z.string(),
  showLoginButton: z.boolean(),
  loginButtonText: z.string(),
  selectedAddressId: z.string().nullable(),
  logoUrl: z.string(),
  contactPhone: z.string(),
  contactEmail: z.string(),
  websiteUrl: z.string(),
  extraLinks: z.array(QrExtraLinkSchema),
})

export const SaveNotificationPreferencesInputSchema = z.object({
  checkoutAlerts: z.boolean(),
  maintenanceAlerts: z.boolean(),
  bookingAlerts: z.boolean(),
  digestEnabled: z.boolean(),
  lowInventoryAlerts: z.boolean(),
})

export const SaveSecuritySettingsInputSchema = z.object({
  trustedProxies: z.array(z.string()),
  trustedDomains: z.array(z.string()),
})

export type SaveQrPublicSettingsInput = z.infer<typeof SaveQrPublicSettingsInputSchema>
export type SaveNotificationPreferencesInput = z.infer<typeof SaveNotificationPreferencesInputSchema>
export type SaveSecuritySettingsInput = z.infer<typeof SaveSecuritySettingsInputSchema>
