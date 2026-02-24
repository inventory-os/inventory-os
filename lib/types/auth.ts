import { z } from "zod"

export interface AuthUser {
  id: string
  oidcIssuer: string
  oidcSub: string
  email: string
  displayName: string
  roles: string[]
  active: boolean
  source: "jit" | "ldap"
  createdAt: string
  updatedAt: string
}

export const UpdateAuthUserByIdInputSchema = z.object({
  oidcSub: z.string().optional(),
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  roles: z.array(z.string()).optional(),
  active: z.boolean().optional(),
})

export const BindOrCreateAuthUserFromOidcInputSchema = z.object({
  issuer: z.string().min(1),
  sub: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  roles: z.array(z.string()),
  jitCreate: z.boolean(),
})

export const UpsertAuthUserFromLdapInputSchema = z.object({
  issuer: z.string().min(1),
  sub: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: z.string().min(1),
  active: z.boolean().optional(),
})

export type UpdateAuthUserByIdInput = z.infer<typeof UpdateAuthUserByIdInputSchema>
export type BindOrCreateAuthUserFromOidcInput = z.infer<typeof BindOrCreateAuthUserFromOidcInputSchema>
export type UpsertAuthUserFromLdapInput = z.infer<typeof UpsertAuthUserFromLdapInputSchema>
