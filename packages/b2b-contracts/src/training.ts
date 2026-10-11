import { z } from 'zod'
import { IdSchema, RevisionSchema, TimestampSchema, VersionSchema } from './common.ts'
import { ExerciseSchema, MachineSchema } from './catalog.ts'

export const ProgramStepSchema = z
  .object({
    id: IdSchema,
    exerciseId: IdSchema,
    sets: z.number().int().min(1).max(30),
    reps: z.number().int().min(1).max(1000).nullable(),
    durationSeconds: z.number().int().min(1).max(86400).nullable().default(null),
    targetRpe: z.number().min(1).max(10).nullable().default(null),
    loadKg: z.number().min(0).max(1000).nullable().default(null),
    restSeconds: z.number().int().min(0).max(3600).default(60),
    alternatives: z.array(IdSchema).max(10).default([]),
    notes: z.string().max(1000).default(''),
  })
  .strict()
  .refine(
    (step) => (step.reps !== null) !== (step.durationSeconds !== null),
    'Prescribe repetitions or duration, never both',
  )

export type ProgramStep = z.infer<typeof ProgramStepSchema>

export const ProgramInputSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    description: z.string().max(2000).default(''),
    steps: z.array(ProgramStepSchema).min(1).max(100),
  })
  .strict()
  .refine(
    (v) => new Set(v.steps.map((s) => s.id)).size === v.steps.length,
    'Step IDs must be unique',
  )

export const ProgramUpdateSchema = z
  .object({ ...ProgramInputSchema.shape, expectedRevision: z.number().int().nonnegative() })
  .strict()
  .refine(
    (v) => new Set(v.steps.map((s) => s.id)).size === v.steps.length,
    'Step IDs must be unique',
  )

const ResponseProgramStepSchema = ProgramStepSchema.safeExtend({
  loadKg: ProgramStepSchema.shape.loadKg.removeDefault(),
  restSeconds: ProgramStepSchema.shape.restSeconds.removeDefault(),
  alternatives: ProgramStepSchema.shape.alternatives.removeDefault(),
  notes: ProgramStepSchema.shape.notes.removeDefault(),
})

const ResponseProgramContentSchema = ProgramInputSchema.safeExtend({
  description: ProgramInputSchema.shape.description.removeDefault(),
  steps: z.array(ResponseProgramStepSchema).min(1).max(100),
})

export const ProgramSchema = ResponseProgramContentSchema.safeExtend({
  id: IdSchema,
  branchId: IdSchema.optional(),
  publishedVersion: VersionSchema.nullable(),
  revision: RevisionSchema,
})

export type Program = z.infer<typeof ProgramSchema>

// Migrations 002/003 added lineage, revision and editorial status to machine rows,
// while existing published snapshots remained immutable. Decode only those missing
// historical fields; current catalog/public responses still require every field.
const HistoricalMachineSchema = MachineSchema.extend({
  derivedFromId: MachineSchema.shape.derivedFromId.default(null),
  derivedFromVersion: MachineSchema.shape.derivedFromVersion.default(null),
  revision: MachineSchema.shape.revision.default(0),
  status: MachineSchema.shape.status.default('published'),
})

export const ProgramVersionSchema = ResponseProgramContentSchema.safeExtend({
  programId: IdSchema,
  branchId: IdSchema.optional(),
  version: VersionSchema,
  exercises: z.array(ExerciseSchema),
  machines: z.array(HistoricalMachineSchema),
  publishedAt: TimestampSchema,
})

export type ProgramVersion = z.infer<typeof ProgramVersionSchema>

export const ProgramAssignmentSchema = z
  .object({ memberId: IdSchema, programId: IdSchema, version: z.number().int().positive() })
  .strict()

export const StepAvailabilitySchema = z
  .object({
    stepId: IdSchema,
    exercises: z.array(
      z
        .object({
          exerciseId: IdSchema,
          status: z.enum(['available', 'unavailable', 'equipment-required']),
          equipment: z.string(),
        })
        .strict(),
    ),
  })
  .strict()

export type StepAvailability = z.infer<typeof StepAvailabilitySchema>

export const AssignmentSchema = z
  .object({
    id: IdSchema,
    branchId: IdSchema.optional(),
    active: z.boolean().optional(),
    memberId: IdSchema,
    memberName: z.string(),
    assignedBy: IdSchema,
    createdAt: TimestampSchema,
    program: ProgramVersionSchema,
    availability: z.array(StepAvailabilitySchema),
  })
  .strict()

export type Assignment = z.infer<typeof AssignmentSchema>

export const ExecutionSetSchema = z
  .object({
    stepId: IdSchema,
    set: z.number().int().min(1).max(30),
    exerciseId: IdSchema,
    reps: z.number().int().min(0).max(1000).nullable(),
    durationSeconds: z.number().int().min(0).max(86400).nullable().default(null),
    rpe: z.number().min(1).max(10).nullable().default(null),
    loadKg: z.number().min(0).max(1000).nullable().default(null),
    reason: z.string().max(1000).default(''),
  })
  .strict()

export const ExecutionInputSchema = z
  .object({
    id: IdSchema,
    assignmentId: IdSchema,
    status: z.enum(['partial', 'completed']),
    sets: z.array(ExecutionSetSchema).min(1).max(3000),
    notes: z.string().max(2000).default(''),
    completedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine(
    (v) => new Set(v.sets.map((s) => `${s.stepId}:${s.set}`)).size === v.sets.length,
    'Duplicate sets',
  )
  .refine(
    (v) => v.sets.every((set) => (set.reps !== null) !== (set.durationSeconds !== null)),
    'Record repetitions or duration, never both',
  )

export type ExecutionInput = z.infer<typeof ExecutionInputSchema>

export const ExecutionSchema = ExecutionInputSchema.safeExtend({
  branchId: IdSchema.optional(),
  notes: ExecutionInputSchema.shape.notes.removeDefault(),
  sets: z
    .array(
      ExecutionSetSchema.extend({
        loadKg: ExecutionSetSchema.shape.loadKg.removeDefault(),
        reason: ExecutionSetSchema.shape.reason.removeDefault(),
      }),
    )
    .min(1)
    .max(3000),
  memberId: IdSchema,
  memberName: z.string(),
  createdAt: TimestampSchema,
  program: ProgramVersionSchema,
})

export type Execution = z.infer<typeof ExecutionSchema>

export const ReportSchema = z
  .object({
    members: z.array(
      z
        .object({
          userId: IdSchema,
          name: z.string(),
          assignments: RevisionSchema,
          completed: RevisionSchema,
          partial: RevisionSchema,
          lastActivityAt: TimestampSchema.nullable(),
        })
        .strict(),
    ),
    executions: z.array(ExecutionSchema),
  })
  .strict()

export type Report = z.infer<typeof ReportSchema>

/** Request payloads may omit fields that the parser supplies with defaults. */
export type ProgramStepInput = z.input<typeof ProgramStepSchema>
export type ProgramInput = z.input<typeof ProgramInputSchema>
export type ProgramUpdateInput = z.input<typeof ProgramUpdateSchema>
export type ProgramAssignmentInput = z.input<typeof ProgramAssignmentSchema>
export type ExecutionSetInput = z.input<typeof ExecutionSetSchema>
export type ExecutionCreateInput = z.input<typeof ExecutionInputSchema>
