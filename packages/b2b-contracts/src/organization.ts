import { z } from 'zod'
import { IdSchema, RoleSchema, TimestampSchema } from './common.ts'
import { BrandInputSchema, ResponseBrandSchema } from './brand.ts'
import { WhiteLabelMeSchema } from './white-label.ts'
export { BrandInputSchema, type Brand } from './brand.ts'

export const OrganizationSchema = z
  .object({
    id: IdSchema,
    slug: z.string().min(1),
    brand: ResponseBrandSchema,
    serviceActive: z.boolean(),
    serviceEndsAt: TimestampSchema.nullable(),
  })
  .strict()

export type Organization = z.infer<typeof OrganizationSchema>

export const MembershipSchema = z
  .object({ organization: OrganizationSchema, role: RoleSchema })
  .strict()

export type Membership = z.infer<typeof MembershipSchema>

export const UserSchema = z.object({
  id: IdSchema,
  name: z.string(),
  email: z.email(),
})

export const MeSchema = z
  .object({
    user: UserSchema,
    memberships: z.array(MembershipSchema),
    whiteLabel: WhiteLabelMeSchema.optional(),
  })
  .strict()

export type Me = z.infer<typeof MeSchema>

export const MemberSchema = z
  .object({
    userId: IdSchema,
    name: z.string(),
    email: z.email(),
    role: RoleSchema,
    active: z.boolean(),
    coachIds: z.array(IdSchema),
  })
  .strict()

export type Member = z.infer<typeof MemberSchema>

export const InvitationInputSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    name: z.string().trim().min(1).max(100),
    role: RoleSchema,
  })
  .strict()

export const AcceptInvitationSchema = z
  .object({
    token: z.string().min(32).max(200),
    name: z.string().trim().min(1).max(100),
    password: z.string().min(12).max(128),
  })
  .strict()

export const CoachAssignmentSchema = z.object({ coachId: IdSchema, memberId: IdSchema }).strict()

export const MembershipUpdateSchema = z
  .object({ role: RoleSchema.optional(), active: z.boolean().optional() })
  .strict()
  .refine((v) => v.role !== undefined || v.active !== undefined, 'Choose a change')

/** Request payloads may omit fields that the parser supplies with defaults. */
export type BrandInput = z.input<typeof BrandInputSchema>
export type InvitationInput = z.input<typeof InvitationInputSchema>
export type AcceptInvitationInput = z.input<typeof AcceptInvitationSchema>
export type CoachAssignmentInput = z.input<typeof CoachAssignmentSchema>
export type MembershipUpdateInput = z.input<typeof MembershipUpdateSchema>
