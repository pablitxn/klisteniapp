import { z } from 'zod'
import { IdSchema, RevisionSchema, TimestampSchema } from './common.ts'
import {
  IanaTimeZoneSchema,
  LocalDateSchema,
  MemberScopeSchema,
  OperationSchema,
  Sha256Schema,
  uniqueBy,
} from './product-common.ts'
import { RoutineReferenceSchema } from './product-prescription.ts'

/** ISO weekdays: Monday=1, Sunday=7. Slot IDs survive ordering changes. */
export const ScheduleSlotSchema = z
  .object({
    id: IdSchema,
    weekday: z.number().int().min(1).max(7),
    routine: RoutineReferenceSchema,
  })
  .strict()
export const ScheduleSlotDraftSchema = z
  .object({
    id: IdSchema,
    weekday: z.number().int().min(1).max(7).nullable(),
    routine: RoutineReferenceSchema.nullable(),
  })
  .strict()
export const StageDraftSchema = z
  .object({
    id: IdSchema,
    name: z.string().max(150),
    startDate: LocalDateSchema.nullable(),
    endDate: LocalDateSchema.nullable(),
    slots: z.array(ScheduleSlotDraftSchema).max(100),
  })
  .strict()
export const StageSchema = StageDraftSchema.extend({
  name: z.string().min(1).max(150),
  startDate: LocalDateSchema,
  endDate: LocalDateSchema,
  slots: z.array(ScheduleSlotSchema).min(1).max(100),
}).superRefine((v, ctx) => {
  if (v.endDate < v.startDate)
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End precedes start' })
  if (!uniqueBy(v.slots, (slot) => slot.id))
    ctx.addIssue({ code: 'custom', path: ['slots'], message: 'Duplicate slot identity' })
})
export const GoalProgramDraftContentSchema = z
  .object({
    name: z.string().max(150),
    goal: z.string().max(2000),
    timeZone: IanaTimeZoneSchema.nullable(),
    stages: z.array(StageDraftSchema).max(100),
  })
  .strict()
  .refine((v) => uniqueBy(v.stages, (s) => s.id), 'Duplicate stage identity')
export const GoalProgramContentSchema = z
  .object({
    name: z.string().min(1).max(150),
    goal: z.string().max(2000),
    timeZone: IanaTimeZoneSchema,
    stages: z.array(StageSchema).min(1).max(100),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!uniqueBy(v.stages, (s) => s.id))
      ctx.addIssue({ code: 'custom', path: ['stages'], message: 'Duplicate stage identity' })
    v.stages.forEach((stage, index) => {
      if (index > 0 && stage.startDate <= v.stages[index - 1]!.endDate)
        ctx.addIssue({
          code: 'custom',
          path: ['stages', index, 'startDate'],
          message: 'Stages must be sequential and nonoverlapping; gaps are allowed',
        })
    })
  })
export const GoalProgramSchema = GoalProgramDraftContentSchema.safeExtend({
  schemaVersion: z.literal(2),
  id: IdSchema,
  scope: MemberScopeSchema,
  revision: RevisionSchema,
  status: z.enum(['draft', 'active', 'archived']),
  archivedAt: TimestampSchema.nullable(),
})
export const EnrollmentSchema = z
  .object({
    schemaVersion: z.literal(2),
    id: IdSchema,
    scope: MemberScopeSchema,
    goalProgramId: IdSchema,
    issuedGoalRevision: RevisionSchema,
    revision: RevisionSchema,
    status: z.enum(['active', 'ended']),
    content: GoalProgramContentSchema,
    createdAt: TimestampSchema,
  })
  .strict()
export type Enrollment = z.infer<typeof EnrollmentSchema>

export const WeekSchema = z
  .object({ startDate: LocalDateSchema, timeZone: IanaTimeZoneSchema })
  .strict()
  .refine((v) => new Date(`${v.startDate}T12:00:00Z`).getUTCDay() === 1, 'Week starts on Monday')
export const OccurrenceSchema = z
  .object({
    schemaVersion: z.literal(2),
    id: IdSchema,
    scope: MemberScopeSchema,
    enrollmentId: IdSchema,
    stageId: IdSchema,
    slotId: IdSchema,
    slotOrdinal: z.number().int().nonnegative(),
    routine: RoutineReferenceSchema,
    issuedEnrollmentRevision: RevisionSchema,
    originalDate: LocalDateSchema,
    originalWeek: WeekSchema,
    scheduledDate: LocalDateSchema,
    currentWeek: WeekSchema,
    permittedDateOverride: LocalDateSchema.nullable(),
    revision: RevisionSchema,
    eligibility: z.enum(['required', 'cancelled']),
    cancellationReason: z.string().max(1000).nullable(),
  })
  .strict()
export type Occurrence = z.infer<typeof OccurrenceSchema>
export const PeriodImpactSchema = z
  .object({
    occurrenceId: IdSchema,
    expectedRevision: RevisionSchema,
    beforeDate: LocalDateSchema,
    afterDate: LocalDateSchema.nullable(),
    beforeEligibility: z.enum(['required', 'cancelled']),
    afterEligibility: z.enum(['required', 'cancelled']),
    linkedSessionIds: z.array(IdSchema),
    reason: z.string().min(1).max(1000),
  })
  .strict()
export const PeriodPreviewSchema = z
  .object({
    schemaVersion: z.literal(2),
    enrollmentId: IdSchema,
    expectedRevision: RevisionSchema,
    proposed: GoalProgramContentSchema,
    impacts: z.array(PeriodImpactSchema),
    previewHash: Sha256Schema,
    expiresAt: TimestampSchema,
  })
  .strict()
  .refine((v) => uniqueBy(v.impacts, (i) => i.occurrenceId), 'Duplicate occurrence impact')
export const ApplyPeriodSchema = OperationSchema.extend({
  enrollmentId: IdSchema,
  proposed: GoalProgramContentSchema,
  previewHash: Sha256Schema,
}).strict()
export const WeekSummarySchema = z
  .object({
    schemaVersion: z.literal(2),
    scope: MemberScopeSchema,
    week: WeekSchema,
    revision: RevisionSchema,
    asOf: TimestampSchema,
    closed: z.boolean(),
    required: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    partial: z.number().int().nonnegative(),
    missed: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    occurrenceIds: z.array(IdSchema),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!uniqueBy(v.occurrenceIds, (id) => id) || v.occurrenceIds.length !== v.required)
      ctx.addIssue({
        code: 'custom',
        path: ['occurrenceIds'],
        message: 'One obligation per stable occurrence',
      })
    if (
      v.required !== v.completed + v.missed + v.pending ||
      v.partial > v.missed + v.pending ||
      (v.closed && v.pending !== 0)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Partial work never completes an obligation; missed and pending are disjoint',
      })
  })
/** Deliberately separate from actual-session detail: no substitution counter. */
export const RoutineContinuitySchema = z
  .object({
    schemaVersion: z.literal(2),
    scope: MemberScopeSchema,
    current: z.array(EnrollmentSchema),
    past: z.array(EnrollmentSchema),
    future: z.array(EnrollmentSchema),
    unscheduledLegacyAssignmentIds: z.array(IdSchema),
  })
  .strict()
