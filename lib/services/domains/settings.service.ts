import * as repository from "@/lib/repository/domains/settings.repository"
import {
  SaveNotificationPreferencesInputSchema,
  SaveQrPublicSettingsInputSchema,
  SaveSecuritySettingsInputSchema,
} from "@/lib/types/settings"

export const getQrPublicSettings = (
  ...args: Parameters<typeof repository.getQrPublicSettings>
): ReturnType<typeof repository.getQrPublicSettings> => repository.getQrPublicSettings(...args)
export const saveQrPublicSettings = (
  ...args: Parameters<typeof repository.saveQrPublicSettings>
): ReturnType<typeof repository.saveQrPublicSettings> => {
  const [input] = args
  return repository.saveQrPublicSettings(SaveQrPublicSettingsInputSchema.parse(input))
}
export const getNotificationPreferences = (
  ...args: Parameters<typeof repository.getNotificationPreferences>
): ReturnType<typeof repository.getNotificationPreferences> => repository.getNotificationPreferences(...args)
export const saveNotificationPreferences = (
  ...args: Parameters<typeof repository.saveNotificationPreferences>
): ReturnType<typeof repository.saveNotificationPreferences> => {
  const [input] = args
  return repository.saveNotificationPreferences(SaveNotificationPreferencesInputSchema.parse(input))
}
export const getSecuritySettings = (
  ...args: Parameters<typeof repository.getSecuritySettings>
): ReturnType<typeof repository.getSecuritySettings> => repository.getSecuritySettings(...args)
export const saveSecuritySettings = (
  ...args: Parameters<typeof repository.saveSecuritySettings>
): ReturnType<typeof repository.saveSecuritySettings> => {
  const [input] = args
  return repository.saveSecuritySettings(SaveSecuritySettingsInputSchema.parse(input))
}
export const getEffectiveSecuritySettings = (
  ...args: Parameters<typeof repository.getEffectiveSecuritySettings>
): ReturnType<typeof repository.getEffectiveSecuritySettings> => repository.getEffectiveSecuritySettings(...args)
