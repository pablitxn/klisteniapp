import { z } from 'zod'
import { IdSchema, RevisionSchema, TimestampSchema } from './common.ts'
import {
  MemberScopeSchema,
  OperationSchema,
  OperationReceiptSchema,
  Sha256Schema,
  uniqueBy,
} from './product-common.ts'
import {
  DoseSchema,
  ReviewedRelationSchema,
  RoutineReferenceSchema,
} from './product-prescription.ts'

export const EffectiveSegmentSchema = z
  .object({
    segmentId: IdSchema,
    originalStepId: IdSchema,
    exerciseId: IdSchema,
    dose: DoseSchema,
    relation: ReviewedRelationSchema.nullable(),
    confirmedConditions: z.array(z.string().max(100)),
    createdAt: TimestampSchema,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.relation &&
      (v.relation.targetExerciseId !== v.exerciseId ||
        JSON.stringify(v.relation.targetDose) !== JSON.stringify(v.dose) ||
        v.relation.conditions.some((c) => !v.confirmedConditions.includes(c)))
    )
      ctx.addIssue({
        code: 'custom',
        path: ['relation'],
        message: 'Use and confirm the selected target prescription',
      })
    if (!uniqueBy(v.confirmedConditions, (c) => c))
      ctx.addIssue({
        code: 'custom',
        path: ['confirmedConditions'],
        message: 'Duplicate confirmation',
      })
  })
export const PerformedSetSchema = z
  .object({
    performedSetId: IdSchema,
    segmentId: IdSchema,
    ordinal: z.number().int().min(1).max(30),
    side: z.enum(['both', 'left', 'right']),
    repetitions: z.number().int().min(0).max(1000).nullable(),
    durationSeconds: z.number().finite().min(0).max(86400).nullable(),
    loadKg: z.number().finite().min(0).max(1000).nullable(),
    rpe: z.number().min(1).max(10).nullable(),
    notes: z.string().max(1000),
  })
  .strict()
  .refine(
    (v) => (v.repetitions === null) !== (v.durationSeconds === null),
    'Record repetitions or duration',
  )
export const SessionContentSchema = z
  .object({
    status: z.enum(['draft', 'partial', 'completed', 'void']),
    explicitCompletion: z.boolean(),
    performedAt: TimestampSchema,
    notes: z.string().max(2000),
    segments: z.array(EffectiveSegmentSchema).max(300),
    selectedSegments: z
      .array(z.object({ originalStepId: IdSchema, segmentId: IdSchema }).strict())
      .max(100),
    sets: z.array(PerformedSetSchema).max(9000),
    correctionReason: z.string().max(1000),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.explicitCompletion !== (v.status === 'completed'))
      ctx.addIssue({
        code: 'custom',
        path: ['explicitCompletion'],
        message: 'Only an explicit completed submission may complete a session',
      })
    if (
      !uniqueBy(v.segments, (s) => s.segmentId) ||
      !uniqueBy(v.selectedSegments, (s) => s.originalStepId) ||
      !uniqueBy(v.sets, (s) => s.performedSetId) ||
      !uniqueBy(v.sets, (s) => `${s.segmentId}:${s.ordinal}:${s.side}`)
    )
      ctx.addIssue({ code: 'custom', message: 'Duplicate segment, selection or performed set' })
    const segments = new Map(v.segments.map((s) => [s.segmentId, s]))
    if (
      v.selectedSegments.some(
        (s) => segments.get(s.segmentId)?.originalStepId !== s.originalStepId,
      ) ||
      v.sets.some((s) => !segments.has(s.segmentId))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Selection and actuals must reference a retained segment',
      })
  })
export const SessionOriginSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('occurrence'),
      occurrenceId: IdSchema,
      routine: RoutineReferenceSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('legacy'),
      assignmentId: IdSchema,
      executionId: IdSchema.nullable(),
      routine: RoutineReferenceSchema,
    })
    .strict(),
])
export const SessionRevisionSchema = z
  .object({
    schemaVersion: z.literal(2),
    id: IdSchema,
    scope: MemberScopeSchema,
    origin: SessionOriginSchema,
    revision: RevisionSchema,
    operationId: IdSchema,
    content: SessionContentSchema,
    actorId: IdSchema,
    acceptedAt: TimestampSchema,
  })
  .strict()
export type SessionContent = z.infer<typeof SessionContentSchema>
export type SessionRevision = z.infer<typeof SessionRevisionSchema>
export const SaveSessionSchema = OperationSchema.extend({
  id: IdSchema,
  origin: SessionOriginSchema,
  content: SessionContentSchema,
}).strict()
export const SessionReceiptSchema = z
  .object({ receipt: OperationReceiptSchema, session: SessionRevisionSchema })
  .strict()
/** A sent payload is immutable. A local edit creates a successor operation; the
 * accepted receipt supplies its expected revision. Transport state is not work. */
export const OutboxEntrySchema = z
  .object({
    schemaVersion: z.literal(2),
    accountId: IdSchema,
    branchId: IdSchema,
    actorId: IdSchema,
    accessRevision: RevisionSchema,
    operationId: IdSchema,
    predecessorOperationId: IdSchema.nullable(),
    requestHash: Sha256Schema,
    payload: SaveSessionSchema,
    state: z.enum(['queued', 'sending', 'accepted', 'conflict', 'access-revoked']),
    createdAt: TimestampSchema,
    receipt: OperationReceiptSchema.nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.operationId !== v.payload.operationId ||
      v.operationId === v.predecessorOperationId ||
      (v.receipt !== null &&
        (v.receipt.operationId !== v.operationId || v.receipt.requestHash !== v.requestHash)) ||
      (v.state === 'accepted') !== (v.receipt !== null)
    )
      ctx.addIssue({ code: 'custom', message: 'Outbox identity and immutable receipt must agree' })
  })
