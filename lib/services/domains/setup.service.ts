import * as repository from "@/lib/repository/domains/setup.repository"
import { CompleteInitialSetupInputSchema, SaveWorkspaceSettingsInputSchema } from "@/lib/types/setup"

export const ensureCoreSchema = (
  ...args: Parameters<typeof repository.ensureCoreSchema>
): ReturnType<typeof repository.ensureCoreSchema> => repository.ensureCoreSchema(...args)
export const getSetupStatus = (
  ...args: Parameters<typeof repository.getSetupStatus>
): ReturnType<typeof repository.getSetupStatus> => repository.getSetupStatus(...args)
export const completeInitialSetup = (
  ...args: Parameters<typeof repository.completeInitialSetup>
): ReturnType<typeof repository.completeInitialSetup> => {
  const [input] = args
  return repository.completeInitialSetup(CompleteInitialSetupInputSchema.parse(input))
}
export const saveWorkspaceSettings = (
  ...args: Parameters<typeof repository.saveWorkspaceSettings>
): ReturnType<typeof repository.saveWorkspaceSettings> => {
  const [input] = args
  return repository.saveWorkspaceSettings(SaveWorkspaceSettingsInputSchema.parse(input))
}
