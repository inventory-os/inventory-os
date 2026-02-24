import { z } from "zod"

export const TeamRoleSchema = z.enum(["admin", "member"])
export type TeamRole = z.infer<typeof TeamRoleSchema>

export interface TeamMember {
  id: string
  name: string
  email: string
  role: TeamRole
  avatar: string
  assetsAssigned: number
}

export const MemberInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: TeamRoleSchema,
})

export type MemberInput = z.infer<typeof MemberInputSchema>
