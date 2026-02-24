import { z } from "zod"

export const EuropeanLocaleSchema = z.enum([
  "bg",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "et",
  "fi",
  "fr",
  "ga",
  "hr",
  "hu",
  "it",
  "lt",
  "lv",
  "mt",
  "nl",
  "pl",
  "pt",
  "ro",
  "sk",
  "sl",
  "sv",
])

export type EuropeanLocale = z.infer<typeof EuropeanLocaleSchema>

export interface SetupStatus {
  setupComplete: boolean
  appName: string
  organizationName: string
  locale: EuropeanLocale
  currency: string
}

export const CompleteInitialSetupInputSchema = z.object({
  appName: z.string().trim().min(1),
  organizationName: z.string().trim().min(1),
  adminUsername: z.string().trim().min(1),
  adminPassword: z.string().min(8),
  firstLocationName: z.string().trim().min(1),
  firstLocationAddress: z.string().trim().min(1),
  locale: EuropeanLocaleSchema,
})

export const SaveWorkspaceSettingsInputSchema = z.object({
  appName: z.string().trim().min(1),
  organizationName: z.string().trim().min(1),
  locale: EuropeanLocaleSchema,
  currency: z.string().trim().min(3).max(8),
})
