import { z } from 'zod'
import { IdSchema, TimestampSchema } from './common.ts'
import {
  ExecutionInputSchema,
  ProgramInputSchema,
  ProgramVersionSchema,
  type ProgramVersion,
} from './training.ts'
import { MemberScopeSchema, Sha256Schema } from './product-common.ts'
import { RoutineVersionV2Schema, type AssignableRoutine } from './product-prescription.ts'
import { EnrollmentSchema, OccurrenceSchema } from './product-planning.ts'
import { SessionRevisionSchema } from './product-sessions.ts'
import { OwnHealthSchema } from './product-health.ts'

export const StoredRoutineSchema = z.discriminatedUnion('schemaVersion', [
  z.object({ schemaVersion: z.literal(1), snapshot: ProgramVersionSchema }).strict(),
  z.object({ schemaVersion: z.literal(2), snapshot: RoutineVersionV2Schema }).strict(),
])
/** Never guess from JSON shape: the database discriminator is authoritative. */
export function decodeRoutine(schemaVersion: unknown, snapshot: unknown) {
  return StoredRoutineSchema.parse({ schemaVersion, snapshot })
}
export function decodeLegacyDraft(value: unknown) {
  return ProgramInputSchema.parse(value)
}
export function decodeLegacyRetry(value: unknown) {
  return ExecutionInputSchema.parse(value)
}
/** Projection only. Never persist it over the source snapshot, infer a schedule,
 * infer bodyweight from null load, or carry legacy allowlists as reviewed links. */
export function projectLegacyRoutine(value: ProgramVersion): AssignableRoutine {
  const original = ProgramVersionSchema.parse(value)
  return {
    name: original.name,
    description: original.description,
    steps: original.steps.map((step) => ({
      id: step.id,
      exerciseId: step.exerciseId,
      substitutionPolicy: 'reviewed',
      dose: {
        mode: step.reps === null ? 'duration' : 'repetitions',
        sets: { kind: 'fixed', value: step.sets },
        repetitions: step.reps === null ? null : { kind: 'fixed', value: step.reps },
        durationSeconds:
          step.durationSeconds === null ? null : { kind: 'fixed', value: step.durationSeconds },
        load:
          step.loadKg === null
            ? { mode: 'unspecified' }
            : { mode: 'external', kilograms: { kind: 'fixed', value: step.loadKg } },
        restSeconds: { kind: 'fixed', value: step.restSeconds },
        laterality: 'bilateral',
        targetRpe: step.targetRpe,
        notes: step.notes,
      },
    })),
  }
}
export const LegacyExecutionRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.literal(0),
    scope: MemberScopeSchema,
    original: ExecutionInputSchema,
    routine: ProgramVersionSchema,
    createdAt: TimestampSchema,
  })
  .strict()
export const LegacySupplementSchema = z
  .object({
    schemaVersion: z.literal(2),
    scope: MemberScopeSchema,
    programId: IdSchema,
    version: z.number().int().positive(),
    sourceSnapshotHash: Sha256Schema,
    supplement: RoutineVersionV2Schema,
  })
  .strict()
/** Lossless, user-directed interchange. B2C adapters must preserve this original
 * envelope or return structured unsupported-field issues; no range flattening. */
export const TrainingInterchangeSchema = z
  .object({
    format: z.literal('klisteni-training'),
    version: z.literal(2),
    exportedAt: TimestampSchema,
    ownerId: IdSchema,
    scope: MemberScopeSchema,
    routines: z.array(StoredRoutineSchema),
    legacyExecutions: z.array(LegacyExecutionRecordSchema),
    enrollments: z.array(EnrollmentSchema),
    occurrences: z.array(OccurrenceSchema),
    sessionRevisions: z.array(SessionRevisionSchema),
    supplements: z.array(LegacySupplementSchema),
  })
  .strict()
export const PersonalExportSchema = z
  .object({
    format: z.literal('klisteni-personal-export'),
    version: z.literal(2),
    exportedAt: TimestampSchema,
    ownerId: IdSchema,
    training: z.array(TrainingInterchangeSchema),
    health: OwnHealthSchema,
    serverAcceptedOnly: z.literal(true),
  })
  .strict()
export const B2CInvitationSchema = z
  .object({
    separateProduct: z.literal(true),
    paid: z.literal(true),
    automaticConversion: z.literal(false),
    url: z
      .url()
      .refine((url) => new URL(url).protocol === 'https:')
      .nullable(),
  })
  .strict()
