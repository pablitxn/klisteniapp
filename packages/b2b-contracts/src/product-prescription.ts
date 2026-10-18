import { z } from 'zod'
import { IdSchema, RevisionSchema, TimestampSchema, VersionSchema } from './common.ts'
import { ExerciseSchema, MachineSchema } from './catalog.ts'
import { ProductScopeSchema, Sha256Schema, uniqueBy, type ProductIssue } from './product-common.ts'

function target(min: number, max: number, integer: boolean) {
  const value = integer ? z.number().int().min(min).max(max) : z.number().finite().min(min).max(max)
  return z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('fixed'), value }).strict(),
      z.object({ kind: z.literal('range'), min: value, max: value }).strict(),
    ])
    .refine((v) => v.kind === 'fixed' || v.min <= v.max, 'Range minimum exceeds maximum')
}
export const SetsTargetSchema = target(1, 30, true)
export const RepetitionsTargetSchema = target(1, 1000, true)
export const DurationTargetSchema = target(1, 86400, false)
export const RestTargetSchema = target(0, 3600, false)
export const LoadTargetSchema = target(0, 1000, false)
export const LoadPrescriptionSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('bodyweight') }).strict(),
  z.object({ mode: z.literal('external'), kilograms: LoadTargetSchema }).strict(),
  z.object({ mode: z.literal('unspecified') }).strict(),
])
export const DraftDoseSchema = z
  .object({
    mode: z.enum(['repetitions', 'duration']).nullable(),
    sets: SetsTargetSchema.nullable(),
    repetitions: RepetitionsTargetSchema.nullable(),
    durationSeconds: DurationTargetSchema.nullable(),
    load: LoadPrescriptionSchema.nullable(),
    restSeconds: RestTargetSchema.nullable(),
    laterality: z.enum(['bilateral', 'alternating', 'per-side']).nullable(),
    targetRpe: z.number().min(1).max(10).nullable(),
    notes: z.string().max(1000),
  })
  .strict()
export const DoseSchema = DraftDoseSchema.extend({
  mode: z.enum(['repetitions', 'duration']),
  sets: SetsTargetSchema,
  load: LoadPrescriptionSchema,
  restSeconds: RestTargetSchema,
  laterality: z.enum(['bilateral', 'alternating', 'per-side']),
}).superRefine((v, ctx) => {
  if (v.mode === 'repetitions' && (v.repetitions === null || v.durationSeconds !== null))
    ctx.addIssue({ code: 'custom', path: ['repetitions'], message: 'Prescribe repetitions only' })
  if (v.mode === 'duration' && (v.durationSeconds === null || v.repetitions !== null))
    ctx.addIssue({ code: 'custom', path: ['durationSeconds'], message: 'Prescribe duration only' })
})
export type Dose = z.infer<typeof DoseSchema>
export function minimumTarget(targetValue: z.infer<typeof SetsTargetSchema>): number {
  return targetValue.kind === 'fixed' ? targetValue.value : targetValue.min
}

export const RoutineStepDraftSchema = z
  .object({
    id: IdSchema,
    exerciseId: IdSchema.nullable(),
    dose: DraftDoseSchema,
    substitutionPolicy: z.enum(['reviewed', 'blocked']),
  })
  .strict()
export const RoutineDraftContentSchema = z
  .object({
    name: z.string().trim().max(150),
    description: z.string().max(2000),
    steps: z.array(RoutineStepDraftSchema).max(100),
  })
  .strict()
  .refine((v) => uniqueBy(v.steps, (s) => s.id), 'Step IDs must be unique')
export const RoutineStepSchema = RoutineStepDraftSchema.extend({
  exerciseId: IdSchema,
  dose: DoseSchema,
}).refine((step) => step.dose.load.mode !== 'unspecified', {
  path: ['dose', 'load'],
  message: 'Confirm bodyweight or external load before publication',
})
export const AssignableRoutineSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    description: z.string().max(2000),
    steps: z.array(RoutineStepSchema).min(1).max(100),
  })
  .strict()
  .refine((v) => uniqueBy(v.steps, (s) => s.id), 'Step IDs must be unique')

export const RoutineDraftV2Schema = RoutineDraftContentSchema.safeExtend({
  schemaVersion: z.literal(2),
  id: IdSchema,
  scope: ProductScopeSchema,
  revision: RevisionSchema,
  publishedVersion: VersionSchema.nullable(),
  archivedAt: TimestampSchema.nullable(),
})
export type RoutineDraftContent = z.infer<typeof RoutineDraftContentSchema>
export type AssignableRoutine = z.infer<typeof AssignableRoutineSchema>

/** Completeness only: no balance, suitability or performance score. */
export function checkRoutineAssignable(
  draft: RoutineDraftContent,
): { ok: true; routine: AssignableRoutine } | { ok: false; issues: ProductIssue[] } {
  const result = AssignableRoutineSchema.safeParse(draft)
  if (result.success) return { ok: true, routine: result.data }
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      code: 'required',
      path: issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
      stepId:
        issue.path[0] === 'steps' && typeof issue.path[1] === 'number'
          ? (draft.steps[issue.path[1]]?.id ?? null)
          : null,
      message: issue.message,
    })),
  }
}

export const RelationConditionSchema = z.enum([
  'target-requirements-confirmed',
  'use-target-dose',
  'accept-higher-demand',
  'accept-lower-demand',
  'accept-different-supports',
  'accept-different-balance',
  'accept-different-laterality',
  'accept-different-emphasis',
])
export const ReviewedRelationSchema = z
  .object({
    id: IdSchema,
    sourceExerciseId: IdSchema,
    targetExerciseId: IdSchema,
    type: z.enum(['alternative', 'progression', 'regression']),
    conditions: z.array(RelationConditionSchema).min(2),
    rationale: z.string().min(1).max(2000),
    catalogRevision: Sha256Schema,
    sourceContentHash: Sha256Schema,
    targetContentHash: Sha256Schema,
    requirements: z.array(z.string().min(1).max(500)).min(1).max(30),
    target: ExerciseSchema,
    targetDose: DoseSchema,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.targetDose.load.mode === 'unspecified')
      ctx.addIssue({
        code: 'custom',
        path: ['targetDose', 'load'],
        message: 'Target load must be independently prescribed',
      })
    if (v.sourceExerciseId === v.targetExerciseId || v.target.id !== v.targetExerciseId)
      ctx.addIssue({
        code: 'custom',
        path: ['targetExerciseId'],
        message: 'Invalid directed target',
      })
    if (!uniqueBy(v.conditions, (c) => c))
      ctx.addIssue({ code: 'custom', path: ['conditions'], message: 'Duplicate condition' })
    const required = ['target-requirements-confirmed', 'use-target-dose']
    if (v.type === 'progression') required.push('accept-higher-demand')
    if (v.type === 'regression') required.push('accept-lower-demand')
    if (
      required.some(
        (condition) => !v.conditions.includes(condition as z.infer<typeof RelationConditionSchema>),
      ) ||
      (v.type !== 'progression' && v.conditions.includes('accept-higher-demand')) ||
      (v.type !== 'regression' && v.conditions.includes('accept-lower-demand'))
    )
      ctx.addIssue({
        code: 'custom',
        path: ['conditions'],
        message: 'Missing or contradictory relation conditions',
      })
  })
export type ReviewedRelation = z.infer<typeof ReviewedRelationSchema>
export const RoutineReferenceSchema = z
  .object({
    programId: IdSchema,
    version: VersionSchema,
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
  })
  .strict()
export const RoutineVersionV2Schema = AssignableRoutineSchema.safeExtend({
  schemaVersion: z.literal(2),
  programId: IdSchema,
  version: VersionSchema,
  scope: ProductScopeSchema,
  publishedAt: TimestampSchema,
  exercises: z.array(ExerciseSchema),
  machines: z.array(MachineSchema),
  relations: z.array(ReviewedRelationSchema).max(1000),
})
export type RoutineVersionV2 = z.infer<typeof RoutineVersionV2Schema>
