import { z } from 'zod'
import { IdSchema, RevisionSchema, TimestampSchema } from './common.ts'
import { OperationSchema, OrganizationRoleV2Schema, uniqueBy } from './product-common.ts'
export const ProductBranchGrantSchema = z
  .object({ branchId: IdSchema, role: z.enum(['coach', 'member']), active: z.boolean() })
  .strict()
export const ProductMemberSchema = z
  .object({
    schemaVersion: z.literal(2),
    userId: IdSchema,
    name: z.string(),
    email: z.email(),
    role: OrganizationRoleV2Schema,
    active: z.boolean(),
    revision: RevisionSchema,
    branchGrants: z.array(ProductBranchGrantSchema),
    coachIds: z.array(IdSchema),
  })
  .strict()
export const UpdateProductMemberSchema = OperationSchema.extend({
  memberId: IdSchema,
  role: OrganizationRoleV2Schema.optional(),
  active: z.boolean().optional(),
  branchGrants: z.array(ProductBranchGrantSchema).optional(),
})
  .strict()
  .refine(
    (v) => v.role !== undefined || v.active !== undefined || v.branchGrants !== undefined,
    'Choose a change',
  )
  .refine(
    (v) => !v.branchGrants || uniqueBy(v.branchGrants, (g) => `${g.branchId}:${g.role}`),
    'Duplicate branch grant',
  )
export const InviteProductMemberSchema = OperationSchema.extend({
  id: IdSchema,
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  name: z.string().trim().min(1).max(100),
  role: OrganizationRoleV2Schema,
  branchGrants: z.array(ProductBranchGrantSchema),
})
  .strict()
  .refine(
    (v) => uniqueBy(v.branchGrants, (g) => `${g.branchId}:${g.role}`),
    'Duplicate branch grant',
  )
export const ProductInvitationSchema = z
  .object({
    schemaVersion: z.literal(2),
    id: IdSchema,
    role: OrganizationRoleV2Schema,
    expiresAt: TimestampSchema,
    invitationUrl: z.url(),
  })
  .strict()
