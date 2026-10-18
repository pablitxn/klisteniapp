import { z } from 'zod'
import { IdSchema, RevisionSchema, TimestampSchema } from './common.ts'
import {
  LocalDateSchema,
  OperationSchema,
  ProductScopeSchema,
  Sha256Schema,
  uniqueBy,
} from './product-common.ts'

export const HealthCategorySchema = z.enum([
  'measurements',
  'sleep',
  'activity',
  'nutrition',
  'supplements',
])
export type HealthCategory = z.infer<typeof HealthCategorySchema>
const JsonObjectSchema = z.record(z.string(), z.json())
/** Transport shape only. WP05 must validate every payload with the canonical
 * scene-schema HealthDataSchema/adapter on the server before storing it. This
 * boundary intentionally does not duplicate medical-unit validation. */
export const NormalizedHealthRecordSchema = z
  .object({
    id: z.string().min(1).max(200),
    date: LocalDateSchema,
    recordedAt: TimestampSchema,
    source: z
      .object({
        kind: z.enum(['manual', 'samsung-health', 'health-connect']),
        device: z.string().min(1).max(200).optional(),
        externalId: z.string().min(1).max(200).optional(),
      })
      .strict(),
  })
  .catchall(z.json())
export const NormalizedHealthSchema = z
  .object({
    version: z.literal(1),
    profile: JsonObjectSchema,
    measurements: z.array(NormalizedHealthRecordSchema).max(10000),
    sleep: z.array(NormalizedHealthRecordSchema).max(10000),
    activity: z.array(NormalizedHealthRecordSchema).max(10000),
    nutrition: z.array(NormalizedHealthRecordSchema).max(10000),
    supplements: z.array(NormalizedHealthRecordSchema).max(10000),
    goals: z.array(JsonObjectSchema).max(100),
  })
  .strict()
  .refine(
    (v) => new TextEncoder().encode(JSON.stringify(v)).byteLength <= 4 * 1024 * 1024,
    'Health payload exceeds 4 MiB',
  )
export type NormalizedHealth = z.infer<typeof NormalizedHealthSchema>
export const OwnHealthSchema = z
  .object({
    schemaVersion: z.literal(2),
    ownerId: IdSchema,
    revision: RevisionSchema,
    data: NormalizedHealthSchema,
  })
  .strict()
export const HealthImportRequestSchema = OperationSchema.extend({
  format: z.literal('klisteniapp.health'),
  version: z.literal(1),
  raw: z
    .string()
    .refine(
      (v) => new TextEncoder().encode(v).byteLength <= 2 * 1024 * 1024,
      'Import exceeds 2 MiB',
    ),
}).strict()
export const HealthImportPreviewSchema = z
  .object({
    schemaVersion: z.literal(2),
    expectedRevision: RevisionSchema,
    format: z.literal('klisteniapp.health'),
    version: z.literal(1),
    previewHash: Sha256Schema,
    expiresAt: TimestampSchema,
    additions: z.record(HealthCategorySchema, z.number().int().nonnegative()),
    duplicates: z.number().int().nonnegative(),
    conflicts: z.array(z.object({ category: HealthCategorySchema, recordId: z.string() }).strict()),
    issues: z.array(z.object({ path: z.string(), message: z.string() }).strict()),
  })
  .strict()
export const HealthConsentSchema = z
  .object({
    schemaVersion: z.literal(2),
    id: IdSchema,
    ownerId: IdSchema,
    scope: ProductScopeSchema,
    revision: RevisionSchema,
    status: z.enum(['active', 'revoked']),
    categories: z.array(HealthCategorySchema).min(1),
    audience: z.literal('current-authorized-branch-trainers'),
    disclosureVersion: z.literal(1),
    grantedAt: TimestampSchema,
    revokedAt: TimestampSchema.nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!uniqueBy(v.categories, (c) => c) || (v.status === 'revoked') !== (v.revokedAt !== null))
      ctx.addIssue({
        code: 'custom',
        message: 'Consent categories and revocation must be explicit',
      })
  })
export const GrantHealthConsentSchema = OperationSchema.extend({
  id: IdSchema,
  categories: z.array(HealthCategorySchema).min(1),
  audience: z.literal('current-authorized-branch-trainers'),
  disclosureVersion: z.literal(1),
})
  .strict()
  .refine((v) => uniqueBy(v.categories, (c) => c), 'Duplicate category')
/** Filtered projection has no profile/goals or ungranted category placeholders.
 * No trainer bulk export, local cache or admin bypass is part of this contract. */
export const ConsentedHealthSchema = z
  .object({
    schemaVersion: z.literal(2),
    ownerId: IdSchema,
    consentId: IdSchema,
    consentRevision: RevisionSchema,
    scope: ProductScopeSchema,
    viewedAt: TimestampSchema,
    categories: z.array(
      z
        .object({ category: HealthCategorySchema, records: z.array(NormalizedHealthRecordSchema) })
        .strict(),
    ),
  })
  .strict()
  .refine((v) => uniqueBy(v.categories, (c) => c.category), 'Duplicate category')
