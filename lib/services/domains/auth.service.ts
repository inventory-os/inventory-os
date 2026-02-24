import * as repository from "@/lib/repository/domains/auth.repository"
import {
  BindOrCreateAuthUserFromOidcInputSchema,
  UpdateAuthUserByIdInputSchema,
  UpsertAuthUserFromLdapInputSchema,
} from "@/lib/types/auth"

export const listAuthUsers = (
  ...args: Parameters<typeof repository.listAuthUsers>
): ReturnType<typeof repository.listAuthUsers> => repository.listAuthUsers(...args)
export const findAuthUserBySubject = (
  ...args: Parameters<typeof repository.findAuthUserBySubject>
): ReturnType<typeof repository.findAuthUserBySubject> => repository.findAuthUserBySubject(...args)
export const findAuthUserByEmail = (
  ...args: Parameters<typeof repository.findAuthUserByEmail>
): ReturnType<typeof repository.findAuthUserByEmail> => repository.findAuthUserByEmail(...args)
export const findAuthUserById = (
  ...args: Parameters<typeof repository.findAuthUserById>
): ReturnType<typeof repository.findAuthUserById> => repository.findAuthUserById(...args)
export const updateAuthUserById = (
  ...args: Parameters<typeof repository.updateAuthUserById>
): ReturnType<typeof repository.updateAuthUserById> => {
  const [id, input] = args
  return repository.updateAuthUserById(id, UpdateAuthUserByIdInputSchema.parse(input))
}
export const deactivateAuthUserById = (
  ...args: Parameters<typeof repository.deactivateAuthUserById>
): ReturnType<typeof repository.deactivateAuthUserById> => repository.deactivateAuthUserById(...args)
export const bindOrCreateAuthUserFromOidc = (
  ...args: Parameters<typeof repository.bindOrCreateAuthUserFromOidc>
): ReturnType<typeof repository.bindOrCreateAuthUserFromOidc> => {
  const [input] = args
  return repository.bindOrCreateAuthUserFromOidc(BindOrCreateAuthUserFromOidcInputSchema.parse(input))
}
export const upsertAuthUserFromLdap = (
  ...args: Parameters<typeof repository.upsertAuthUserFromLdap>
): ReturnType<typeof repository.upsertAuthUserFromLdap> => {
  const [input] = args
  return repository.upsertAuthUserFromLdap(UpsertAuthUserFromLdapInputSchema.parse(input))
}
