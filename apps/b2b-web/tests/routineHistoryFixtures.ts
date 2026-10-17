import {
  EnrollmentSchema,
  LegacyExecutionRecordSchema,
  OccurrenceSchema,
  SessionRevisionSchema,
  WeekSummarySchema,
  type Enrollment,
  type Occurrence,
  type SessionRevision,
} from '@klisteniapp/b2b-contracts/product-v2'
export const scope = { organizationId: 'brand-a', branchId: 'branch-a', memberId: 'member-a' }
export const ref = { programId: 'routine', version: 2, schemaVersion: 2 as const }
export function enrollment(): Enrollment {
  return EnrollmentSchema.parse({
    schemaVersion: 2,
    id: 'enrollment',
    scope,
    goalProgramId: 'goal',
    issuedGoalRevision: 1,
    revision: 2,
    status: 'active',
    createdAt: '2026-10-01T00:00:00Z',
    content: {
      name: 'Strength goal',
      goal: 'Progress consistently',
      timeZone: 'America/New_York',
      stages: [
        {
          id: 'stage',
          name: 'First stage',
          startDate: '2026-10-01',
          endDate: '2026-10-14',
          slots: [{ id: 'slot', weekday: 1, routine: ref }],
        },
        {
          id: 'future-stage',
          name: 'Next stage',
          startDate: '2026-10-19',
          endDate: '2026-11-30',
          slots: [{ id: 'future-slot', weekday: 3, routine: ref }],
        },
      ],
    },
  })
}
export function occurrence(id = 'occurrence', overrides: Partial<Occurrence> = {}): Occurrence {
  return OccurrenceSchema.parse({
    schemaVersion: 2,
    id,
    scope,
    enrollmentId: 'enrollment',
    stageId: 'stage',
    slotId: 'slot',
    slotOrdinal: 0,
    routine: ref,
    issuedEnrollmentRevision: 1,
    originalDate: '2026-10-12',
    originalWeek: { startDate: '2026-10-12', timeZone: 'America/New_York' },
    scheduledDate: '2026-10-12',
    currentWeek: { startDate: '2026-10-12', timeZone: 'America/New_York' },
    permittedDateOverride: null,
    revision: 1,
    eligibility: 'required',
    cancellationReason: null,
    ...overrides,
  })
}
export function session(id = 'session', overrides: Partial<SessionRevision> = {}): SessionRevision {
  return SessionRevisionSchema.parse({
    schemaVersion: 2,
    id,
    scope,
    origin: { kind: 'occurrence', occurrenceId: 'occurrence', routine: ref },
    revision: 1,
    operationId: `op-${id}`,
    actorId: scope.memberId,
    acceptedAt: '2026-10-12T15:00:00Z',
    content: {
      status: 'partial',
      explicitCompletion: false,
      performedAt: '2026-10-12T14:00:00Z',
      notes: 'Kept actual notes',
      correctionReason: '',
      segments: [
        {
          segmentId: 'segment',
          originalStepId: 'step',
          exerciseId: 'pushup',
          dose: {
            mode: 'repetitions',
            sets: { kind: 'range', min: 1, max: 3 },
            repetitions: { kind: 'range', min: 5, max: 8 },
            durationSeconds: null,
            load: { mode: 'bodyweight' },
            restSeconds: { kind: 'fixed', value: 60 },
            laterality: 'bilateral',
            targetRpe: null,
            notes: '',
          },
          relation: null,
          confirmedConditions: [],
          createdAt: '2026-10-12T14:00:00Z',
        },
      ],
      selectedSegments: [{ originalStepId: 'step', segmentId: 'segment' }],
      sets: [
        {
          performedSetId: 'actual',
          segmentId: 'segment',
          ordinal: 1,
          side: 'both',
          repetitions: 4,
          durationSeconds: null,
          loadKg: null,
          rpe: null,
          notes: 'Truthful below-target actuals',
        },
      ],
    },
    ...overrides,
  })
}
export function legacy() {
  return LegacyExecutionRecordSchema.parse({
    schemaVersion: 1,
    revision: 0,
    scope,
    original: {
      id: 'old-log',
      assignmentId: 'old-assignment',
      status: 'partial',
      sets: [
        {
          stepId: 'old-step',
          set: 1,
          exerciseId: 'old-exercise',
          reps: 6,
          durationSeconds: null,
          loadKg: null,
          rpe: null,
          reason: 'Original reason',
        },
      ],
      notes: 'Original notes',
      completedAt: '2026-10-01T13:00:00Z',
    },
    routine: {
      name: 'Legacy snapshot',
      description: 'Original description',
      programId: 'old-routine',
      version: 1,
      publishedAt: '2026-09-01T12:00:00Z',
      exercises: [],
      machines: [],
      steps: [
        {
          id: 'old-step',
          exerciseId: 'old-exercise',
          sets: 1,
          reps: 8,
          durationSeconds: null,
          loadKg: null,
          restSeconds: 60,
          targetRpe: null,
          alternatives: [],
          notes: '',
        },
      ],
    },
    createdAt: '2026-10-01T13:01:00Z',
  })
}
export function summary(closed = false) {
  return WeekSummarySchema.parse({
    schemaVersion: 2,
    scope,
    week: { startDate: '2026-10-12', timeZone: 'America/New_York' },
    revision: 29,
    asOf: closed ? '2026-10-20T00:00:00Z' : '2026-10-15T12:00:00Z',
    closed,
    required: 4,
    completed: 3,
    partial: 1,
    missed: closed ? 1 : 0,
    pending: closed ? 0 : 1,
    occurrenceIds: ['o1', 'o2', 'o3', 'o4'],
  })
}
