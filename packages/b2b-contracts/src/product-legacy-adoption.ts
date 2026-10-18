import { z } from 'zod'
import { IdSchema } from './common.ts'
import { ProgramVersionSchema } from './training.ts'
import { OperationSchema, MemberScopeSchema, Sha256Schema, uniqueBy } from './product-common.ts'
import {
  DoseSchema,
  RoutineStepDraftSchema,
  RoutineStepSchema,
  RoutineDraftContentSchema,
  RoutineVersionV2Schema,
  ReviewedRelationSchema,
} from './product-prescription.ts'
import { LegacyExecutionRecordSchema, LegacySupplementSchema } from './product-compatibility.ts'
import { SessionRevisionSchema } from './product-sessions.ts'

export const LegacySupplementPreviewSchema = z
  .object({
    assignmentId: IdSchema,
    scope: MemberScopeSchema,
    sourceSnapshotHash: Sha256Schema,
    original: ProgramVersionSchema,
    draft: RoutineDraftContentSchema,
    proposals: z.array(z.object({ relation: ReviewedRelationSchema, hash: Sha256Schema }).strict()),
    supplement: LegacySupplementSchema.nullable(),
  })
  .strict()

/** Source doses are confirmed explicitly. The server owns all snapshots and
 * target doses; each confirmation binds the complete displayed reviewed link. */
export const AdoptLegacySupplementSchema = OperationSchema.extend({
  id: IdSchema,
  expectedRevision: z.literal(0),
  sourceSnapshotHash: Sha256Schema,
  sourceSteps: z.array(RoutineStepSchema).min(1).max(100),
  sourceDosesConfirmed: z.literal(true),
  sharedVersionConfirmed: z.literal(true),
  targetConfirmations: z.array(
    z.object({ relationId: IdSchema, relationHash: Sha256Schema }).strict(),
  ),
})
  .strict()
  .refine(
    (v) =>
      uniqueBy(v.sourceSteps, (s) => s.id) && uniqueBy(v.targetConfirmations, (r) => r.relationId),
    'Confirmation identities must be unique',
  )

/** Compatibility is a historical interpretation, never a reviewed publication.
 * Unspecified load remains unspecified, including when correcting old records. */
export const SessionPrescriptionBindingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('reviewed'), routine: RoutineVersionV2Schema }).strict(),
  z
    .object({
      kind: z.literal('legacy-compatibility'),
      original: ProgramVersionSchema,
      steps: z.array(RoutineStepDraftSchema.extend({ exerciseId: IdSchema, dose: DoseSchema })),
      relations: z.array(ReviewedRelationSchema).max(0),
    })
    .strict(),
])
export const SessionBindingSchema = z
  .object({
    original: LegacyExecutionRecordSchema.nullable(),
    accepted: SessionRevisionSchema.nullable(),
    prescription: SessionPrescriptionBindingSchema,
  })
  .strict()
export type SessionPrescriptionBinding = z.infer<typeof SessionPrescriptionBindingSchema>
