import { readFileSync } from 'node:fs'
import { PersonalExportSchema, type ProductAccess } from '@klisteniapp/b2b-contracts/product-v2'

const legacy = JSON.parse(
  readFileSync(
    new URL('../../../../packages/b2b-contracts/tests/fixtures/product-v2.json', import.meta.url),
    'utf8',
  ),
)
export const identity = { userId: 'member', organizationId: 'atlas' }
export const inactive: ProductAccess = {
  schemaVersion: 2,
  organizationId: 'atlas',
  userId: 'member',
  role: 'member',
  accessMode: 'export-only',
  accessRevision: 4,
  branches: [],
  capabilities: ['export-own-records'],
}
export const now = '2026-10-17T12:00:00.000Z'

export function syntheticExport() {
  const scope = legacy.scope
  const dose = {
    ...legacy.dose,
    load: { mode: 'external', kilograms: { kind: 'range', min: 10, max: 15 } },
  }
  const targetDose = {
    ...dose,
    mode: 'duration',
    repetitions: null,
    durationSeconds: { kind: 'range', min: 30, max: 45 },
    laterality: 'per-side',
  }
  const target = {
    id: 'target',
    scope: 'base',
    status: 'published',
    version: 1,
    revision: 1,
    name: 'Synthetic target',
    description: '',
    instructions: ['Synthetic instructions'],
    equipment: 'none',
    machineId: null,
    compatibleMachineIds: [],
    pattern: '',
    muscles: [],
    animationId: null,
    assets: [],
    baseExerciseId: null,
  }
  const relation = {
    id: 'reviewed',
    sourceExerciseId: 'exercise',
    targetExerciseId: 'target',
    type: 'alternative',
    conditions: ['target-requirements-confirmed', 'use-target-dose'],
    rationale: 'Synthetic source provenance',
    catalogRevision: 'a'.repeat(64),
    sourceContentHash: 'b'.repeat(64),
    targetContentHash: 'c'.repeat(64),
    requirements: ['Explicit own target dose'],
    target,
    targetDose,
  }
  const v2 = {
    schemaVersion: 2,
    programId: 'range-routine',
    version: 2,
    scope: { organizationId: 'atlas', branchId: 'atlas-principal' },
    name: 'Range routine',
    description: '',
    publishedAt: now,
    steps: [{ id: 'step', exerciseId: 'exercise', dose, substitutionPolicy: 'reviewed' }],
    exercises: [],
    machines: [],
    relations: [relation],
  }
  const reference = { programId: 'range-routine', version: 2, schemaVersion: 2 }
  const sessions = [1, 2].map((revision) => ({
    schemaVersion: 2,
    id: 'session',
    scope,
    revision,
    operationId: `operation-${revision}`,
    origin: { kind: 'occurrence', occurrenceId: 'occurrence', routine: reference },
    content: {
      status: 'partial',
      explicitCompletion: false,
      performedAt: now,
      notes: 'Actual record',
      correctionReason: 'Owner correction',
      segments: [
        {
          segmentId: 'source',
          originalStepId: 'step',
          exerciseId: 'exercise',
          dose,
          relation: null,
          confirmedConditions: [],
          createdAt: now,
        },
        {
          segmentId: 'target',
          originalStepId: 'step',
          exerciseId: 'target',
          dose: targetDose,
          relation,
          confirmedConditions: relation.conditions,
          createdAt: now,
        },
      ],
      selectedSegments: [{ originalStepId: 'step', segmentId: 'target' }],
      sets: [
        {
          performedSetId: 'set-source',
          segmentId: 'source',
          ordinal: 1,
          side: 'both',
          repetitions: 6,
          durationSeconds: null,
          loadKg: 12.5,
          rpe: null,
          notes: '',
        },
        {
          performedSetId: 'set-target',
          segmentId: 'target',
          ordinal: 1,
          side: 'left',
          repetitions: null,
          durationSeconds: 32 + revision,
          loadKg: 10,
          rpe: 7,
          notes: '',
        },
      ],
    },
    actorId: 'member',
    acceptedAt: now,
  }))
  const training = {
    format: 'klisteni-training',
    version: 2,
    exportedAt: now,
    ownerId: 'member',
    scope,
    routines: [
      { schemaVersion: 1, snapshot: legacy.legacyRoutine },
      { schemaVersion: 2, snapshot: v2 },
    ],
    legacyExecutions: [
      {
        schemaVersion: 1,
        revision: 0,
        scope,
        original: legacy.legacyRetry,
        routine: legacy.legacyRoutine,
        createdAt: now,
      },
    ],
    enrollments: [1, 2].map((revision) => ({
      schemaVersion: 2,
      id: 'enrollment',
      scope,
      revision,
      goalProgramId: 'goal',
      issuedGoalRevision: 1,
      status: 'active',
      createdAt: now,
      content: {
        name: 'Goal',
        goal: 'Continuity',
        timeZone: 'UTC',
        stages: [
          {
            id: 'stage',
            name: 'Stage',
            startDate: '2026-10-12',
            endDate: '2026-10-18',
            slots: [{ id: 'slot', weekday: 1, routine: reference }],
          },
        ],
      },
    })),
    occurrences: [1, 2].map((revision) => ({
      schemaVersion: 2,
      id: 'occurrence',
      scope,
      enrollmentId: 'enrollment',
      stageId: 'stage',
      slotId: 'slot',
      slotOrdinal: 0,
      routine: reference,
      issuedEnrollmentRevision: 1,
      originalDate: '2026-10-12',
      originalWeek: { startDate: '2026-10-12', timeZone: 'UTC' },
      scheduledDate: revision === 1 ? '2026-10-12' : '2026-10-13',
      currentWeek: { startDate: '2026-10-12', timeZone: 'UTC' },
      permittedDateOverride: null,
      revision,
      eligibility: 'required',
      cancellationReason: null,
    })),
    sessionRevisions: sessions,
    supplements: [
      {
        schemaVersion: 2,
        scope,
        programId: 'routine',
        version: 1,
        sourceSnapshotHash: 'd'.repeat(64),
        supplement: { ...v2, programId: 'routine', version: 1 },
      },
    ],
  }
  const second = JSON.parse(
    JSON.stringify(training).replaceAll('atlas-principal', 'atlas-archived'),
  )
  return PersonalExportSchema.parse({
    format: 'klisteni-personal-export',
    version: 2,
    exportedAt: now,
    ownerId: 'member',
    serverAcceptedOnly: true,
    training: [training, second],
    health: {
      schemaVersion: 2,
      ownerId: 'member',
      revision: 2,
      data: {
        version: 1,
        profile: {},
        measurements: [
          {
            id: 'health',
            date: '2026-10-16',
            recordedAt: now,
            source: { kind: 'manual' },
            weightKg: 72.5,
          },
        ],
        sleep: [],
        activity: [],
        nutrition: [],
        supplements: [],
        goals: [],
      },
    },
  })
}
