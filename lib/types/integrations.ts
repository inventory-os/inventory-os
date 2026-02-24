import { z } from "zod"

export interface LdapIntegrationSettings {
  enabled: boolean
  url: string
  bindDn: string
  baseDn: string
  userFilter: string
  usernameAttribute: string
  emailAttribute: string
  nameAttribute: string
  defaultRole: string
  syncIssuer: string
  hasBindPassword: boolean
  updatedAt: string | null
}

export const SaveLdapIntegrationSettingsInputSchema = z.object({
  enabled: z.boolean(),
  url: z.string().min(1),
  bindDn: z.string().min(1),
  bindPassword: z.string().optional(),
  baseDn: z.string().min(1),
  userFilter: z.string().min(1),
  usernameAttribute: z.string().min(1),
  emailAttribute: z.string().min(1),
  nameAttribute: z.string().min(1),
  defaultRole: z.string().min(1),
  syncIssuer: z.string().min(1),
})

export type SaveLdapIntegrationSettingsInput = z.infer<typeof SaveLdapIntegrationSettingsInputSchema>
