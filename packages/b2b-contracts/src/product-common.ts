import { z } from 'zod'
import { IdSchema, RevisionSchema, TimestampSchema } from './common.ts'

export const PRODUCT_CONTRACT_VERSION = 2 as const
export const PRODUCT_CONTRACT_HEADER = 'X-Klisteni-B2B-Contract'
export const LocalDateSchema = z.iso.date()
export const IanaTimeZoneSchema = z
  .string()
  .min(1)
  .max(100)
  .refine((value) => {
    if (!/^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)*$/.test(value)) return false
    try {
      new Intl.DateTimeFormat('en', { timeZone: value })
      return true
    } catch {
      return false
    }
  }, 'An explicit IANA timezone is required')
export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
export const OrganizationRoleV2Schema = z.enum(['superadmin', 'admin', 'coach', 'member'])
export type OrganizationRoleV2 = z.infer<typeof OrganizationRoleV2Schema>
export const ProductScopeSchema = z
  .object({ organizationId: IdSchema, branchId: IdSchema })
  .strict()
export const MemberScopeSchema = ProductScopeSchema.extend({ memberId: IdSchema }).strict()
export const OperationSchema = z
  .object({ operationId: IdSchema, expectedRevision: RevisionSchema })
  .strict()
export const ProductIssueSchema = z
  .object({
    code: z.enum(['required', 'invalid', 'conflict', 'unavailable']),
    path: z.array(z.union([z.string(), z.number().int().nonnegative()])).max(12),
    stepId: IdSchema.nullable(),
    message: z.string().min(1).max(1000),
  })
  .strict()
export type ProductIssue = z.infer<typeof ProductIssueSchema>

export const ProductAccessSchema = z
  .object({
    schemaVersion: z.literal(2),
    organizationId: IdSchema,
    userId: IdSchema,
    role: OrganizationRoleV2Schema,
    accessMode: z.enum(['active', 'export-only']),
    accessRevision: RevisionSchema,
    branches: z.array(z.object({ branchId: IdSchema, role: z.enum(['coach', 'member']) }).strict()),
    capabilities: z.array(
      z.enum([
        'manage-admins',
        'manage-people',
        'edit-planning',
        'read-training-history',
        'edit-own-sessions',
        'manage-own-health',
        'read-consented-health',
        'export-own-records',
      ]),
    ),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.capabilities).size !== value.capabilities.length)
      ctx.addIssue({ code: 'custom', path: ['capabilities'], message: 'Duplicate capability' })
    if (
      value.accessMode === 'export-only' &&
      value.capabilities.some((c) => c !== 'export-own-records')
    )
      ctx.addIssue({
        code: 'custom',
        path: ['capabilities'],
        message: 'Inactive access is export-only',
      })
  })
export type ProductAccess = z.infer<typeof ProductAccessSchema>

export const OperationReceiptSchema = z
  .object({
    schemaVersion: z.literal(2),
    operationId: IdSchema,
    resourceId: IdSchema,
    revision: RevisionSchema,
    requestHash: Sha256Schema,
    acceptedAt: TimestampSchema,
  })
  .strict()
export type OperationReceipt = z.infer<typeof OperationReceiptSchema>
export const ProductErrorSchema = z
  .object({
    error: z.string(),
    code: z.enum([
      'PRODUCT_NOT_ACTIVE',
      'UPGRADE_REQUIRED',
      'INVALID_INPUT',
      'REVISION_CONFLICT',
      'OPERATION_CONFLICT',
      'CONTEXT_REVOKED',
      'MEMBERSHIP_REQUIRED',
      'CONSENT_REQUIRED',
      'INCOMPLETE_PRESCRIPTION',
      'INCOMPLETE_EXECUTION',
      'STALE_PERIOD_PREVIEW',
      'OUTSIDE_PRESCRIBED_WEEK',
      'UNSUPPORTED_FORMAT',
    ]),
    issues: z.array(ProductIssueSchema).optional(),
  })
  .strict()

/** A capability is never an authorization result: server context still checks
 * current session, tenant, branch grants, entitlement and resource ownership. */
export const ProductCapabilitiesSchema = z
  .object({
    schemaVersion: z.literal(2),
    minimumClientVersion: z.literal(2),
    activated: z.boolean(),
    migration: z.literal('006-product-foundation'),
  })
  .strict()

export const AuditChangeSchema = z
  .object({
    id: z.string(),
    organizationId: IdSchema,
    branchId: IdSchema.nullable(),
    actorId: IdSchema.nullable(),
    action: z.string().min(1).max(100),
    resourceId: IdSchema,
    operationId: IdSchema.nullable(),
    beforeRevision: RevisionSchema.nullable(),
    afterRevision: RevisionSchema.nullable(),
    changedFields: z.array(z.string().max(100)).max(100),
    createdAt: TimestampSchema,
  })
  .strict()

export function uniqueBy<T>(values: readonly T[], key: (value: T) => string): boolean {
  return new Set(values.map(key)).size === values.length
}
