import * as repository from "@/lib/repository/domains/members.repository"
import { MemberInputSchema } from "@/lib/types/members"

export const listMembers = (
  ...args: Parameters<typeof repository.listMembers>
): ReturnType<typeof repository.listMembers> => repository.listMembers(...args)
export const findMemberIdByEmail = (
  ...args: Parameters<typeof repository.findMemberIdByEmail>
): ReturnType<typeof repository.findMemberIdByEmail> => repository.findMemberIdByEmail(...args)
export const createMember = (
  ...args: Parameters<typeof repository.createMember>
): ReturnType<typeof repository.createMember> => {
  const [input] = args
  return repository.createMember(MemberInputSchema.parse(input))
}
export const getMemberProfile = (
  ...args: Parameters<typeof repository.getMemberProfile>
): ReturnType<typeof repository.getMemberProfile> => repository.getMemberProfile(...args)
export const upsertMemberByEmail = (
  ...args: Parameters<typeof repository.upsertMemberByEmail>
): ReturnType<typeof repository.upsertMemberByEmail> => {
  const [input] = args
  return repository.upsertMemberByEmail(MemberInputSchema.parse(input))
}
