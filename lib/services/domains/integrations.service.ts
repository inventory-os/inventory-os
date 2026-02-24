import * as repository from "@/lib/repository/domains/integrations.repository"
import { SaveLdapIntegrationSettingsInputSchema } from "@/lib/types/integrations"

export const getLdapIntegrationSettings = (
  ...args: Parameters<typeof repository.getLdapIntegrationSettings>
): ReturnType<typeof repository.getLdapIntegrationSettings> => repository.getLdapIntegrationSettings(...args)
export const saveLdapIntegrationSettings = (
  ...args: Parameters<typeof repository.saveLdapIntegrationSettings>
): ReturnType<typeof repository.saveLdapIntegrationSettings> => {
  const [input] = args
  return repository.saveLdapIntegrationSettings(SaveLdapIntegrationSettingsInputSchema.parse(input))
}
export const getLdapIntegrationBindPassword = (
  ...args: Parameters<typeof repository.getLdapIntegrationBindPassword>
): ReturnType<typeof repository.getLdapIntegrationBindPassword> => repository.getLdapIntegrationBindPassword(...args)
