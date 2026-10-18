import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  RoutineDraftContentSchema,
  checkRoutineAssignable,
  DoseSchema,
  GoalProgramContentSchema,
  ProductAccessSchema,
  ReviewedRelationSchema,
  SessionContentSchema,
  OutboxEntrySchema,
  WeekSchema,
  WeekSummarySchema,
  HealthConsentSchema,
  HealthImportRequestSchema,
  ProductEndpoints,
  IanaTimeZoneSchema,
} from '../src/product-v2.ts'
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/product-v2.json', import.meta.url), 'utf8'),
)
const dose = DoseSchema.parse(fixture.dose)
const routine = {
  name: 'Routine',
  description: '',
  steps: [{ id: 'step', exerciseId: 'exercise', dose, substitutionPolicy: 'reviewed' }],
}
const stage = {
  id: 'stage',
  name: 'Stage',
  startDate: '2026-10-19',
  endDate: '2026-11-01',
  slots: [
    { id: 'slot', weekday: 1, routine: { programId: 'routine', version: 1, schemaVersion: 1 } },
  ],
}
const content = {
  status: 'partial',
  explicitCompletion: false,
  performedAt: '2026-10-20T10:00:00Z',
  notes: '',
  segments: [
    {
      segmentId: 'segment',
      originalStepId: 'step',
      exerciseId: 'exercise',
      dose,
      relation: null,
      confirmedConditions: [],
      createdAt: '2026-10-20T10:00:00Z',
    },
  ],
  selectedSegments: [{ originalStepId: 'step', segmentId: 'segment' }],
  sets: [
    {
      performedSetId: 'set',
      segmentId: 'segment',
      ordinal: 1,
      side: 'both',
      repetitions: 8,
      durationSeconds: null,
      loadKg: null,
      rpe: null,
      notes: '',
    },
  ],
  correctionReason: '',
}

test('incomplete drafts persist but activation reports exact missing step fields', () => {
  const empty = RoutineDraftContentSchema.parse({ name: '', description: '', steps: [] })
  assert.equal(checkRoutineAssignable(empty).ok, false)
  const draft = RoutineDraftContentSchema.parse({
    ...routine,
    steps: [
      {
        ...routine.steps[0],
        exerciseId: null,
        dose: {
          mode: null,
          sets: null,
          repetitions: null,
          durationSeconds: null,
          load: null,
          restSeconds: null,
          laterality: null,
          targetRpe: null,
          notes: '',
        },
      },
    ],
  })
  const result = checkRoutineAssignable(draft)
  assert.equal(result.ok, false)
  if (!result.ok)
    assert.ok(
      result.issues.some((i) => i.stepId === 'step' && i.path.join('.') === 'steps.0.exerciseId'),
    )
  assert.equal(checkRoutineAssignable(RoutineDraftContentSchema.parse(routine)).ok, true)
})
test('fixed and range targets retain units and reject reversed ranges and ambiguous dose', () => {
  assert.deepEqual(DoseSchema.parse(fixture.dose), fixture.dose)
  assert.equal(
    DoseSchema.safeParse({ ...dose, repetitions: { kind: 'range', min: 12, max: 8 } }).success,
    false,
  )
  assert.equal(
    DoseSchema.safeParse({ ...dose, durationSeconds: { kind: 'fixed', value: 20 } }).success,
    false,
  )
  assert.equal(DoseSchema.safeParse({ ...dose, sets: { kind: 'fixed', value: 0 } }).success, false)
  assert.equal(
    DoseSchema.safeParse({
      ...dose,
      mode: 'duration',
      repetitions: null,
      durationSeconds: { kind: 'fixed', value: 20 },
      load: { mode: 'external', kilograms: { kind: 'range', min: 5, max: 8 } },
    }).success,
    true,
  )
})
test('stage boundaries are inclusive, sequential and allow gaps and multiple same-day slots', () => {
  const goal = {
    name: 'Goal',
    goal: '',
    timeZone: 'America/Argentina/Buenos_Aires',
    stages: [stage, { ...stage, id: 'next', startDate: '2026-11-03', endDate: '2026-11-20' }],
  }
  assert.equal(GoalProgramContentSchema.safeParse(goal).success, true)
  assert.equal(
    GoalProgramContentSchema.safeParse({ ...goal, stages: [stage, { ...stage, id: 'next' }] })
      .success,
    false,
  )
  assert.equal(
    GoalProgramContentSchema.safeParse({
      ...goal,
      stages: [{ ...stage, slots: [...stage.slots, { ...stage.slots[0], id: 'second' }] }],
    }).success,
    true,
  )
  assert.equal(IanaTimeZoneSchema.safeParse('Imaginary/Clock').success, false)
})
test('export-only access cannot carry operational capabilities or an invented role', () => {
  const access = {
    schemaVersion: 2,
    organizationId: 'atlas',
    userId: 'member',
    role: 'member',
    accessMode: 'export-only',
    accessRevision: 1,
    branches: [],
    capabilities: ['export-own-records'],
  }
  assert.equal(ProductAccessSchema.safeParse(access).success, true)
  assert.equal(
    ProductAccessSchema.safeParse({ ...access, capabilities: ['edit-own-sessions'] }).success,
    false,
  )
  assert.equal(ProductAccessSchema.safeParse({ ...access, role: 'platform-admin' }).success, false)
})
test('relation vocabulary is directed and requires an independent target dose', () => {
  const target = {
    id: 'target',
    scope: 'base',
    status: 'published',
    version: 1,
    revision: 0,
    name: 'Target',
    description: '',
    instructions: ['Move'],
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
    id: 'relation',
    sourceExerciseId: 'exercise',
    targetExerciseId: 'target',
    type: 'progression',
    conditions: [
      'target-requirements-confirmed',
      'use-target-dose',
      'accept-higher-demand',
      'accept-different-supports',
    ],
    rationale: 'Reviewed',
    catalogRevision: 'a'.repeat(64),
    sourceContentHash: 'b'.repeat(64),
    targetContentHash: 'c'.repeat(64),
    requirements: ['Stable support'],
    target,
    targetDose: dose,
  }
  assert.equal(ReviewedRelationSchema.safeParse(relation).success, true)
  assert.equal(
    ReviewedRelationSchema.safeParse({ ...relation, targetDose: undefined }).success,
    false,
  )
  assert.equal(
    ReviewedRelationSchema.safeParse({ ...relation, type: 'alternative' }).success,
    false,
  )
  assert.equal(
    ReviewedRelationSchema.safeParse({ ...relation, targetExerciseId: 'exercise' }).success,
    false,
  )
})
test('sessions preserve additional segments and reject implicit completion and dangling actuals', () => {
  assert.equal(SessionContentSchema.safeParse(content).success, true)
  assert.equal(SessionContentSchema.safeParse({ ...content, status: 'completed' }).success, false)
  assert.equal(
    SessionContentSchema.safeParse({
      ...content,
      selectedSegments: [{ originalStepId: 'step', segmentId: 'missing' }],
    }).success,
    false,
  )
  assert.equal(
    SessionContentSchema.safeParse({
      ...content,
      sets: [...content.sets, { ...content.sets[0], performedSetId: 'another' }],
    }).success,
    false,
  )
  assert.equal(
    SessionContentSchema.safeParse({
      ...content,
      segments: [...content.segments, { ...content.segments[0], segmentId: 'earlier' }],
      sets: [
        ...content.sets,
        { ...content.sets[0], performedSetId: 'earlier-set', segmentId: 'earlier' },
      ],
    }).success,
    true,
  )
})
test('outbox transport receipt does not change the explicit session status', () => {
  const payload = {
    id: 'session',
    operationId: 'operation',
    expectedRevision: 0,
    origin: {
      kind: 'occurrence',
      occurrenceId: 'occurrence',
      routine: { programId: 'routine', version: 1, schemaVersion: 1 },
    },
    content,
  }
  const entry = {
    schemaVersion: 2,
    accountId: 'atlas',
    branchId: 'atlas-principal',
    actorId: 'member',
    accessRevision: 0,
    operationId: 'operation',
    predecessorOperationId: null,
    requestHash: 'a'.repeat(64),
    payload,
    state: 'queued',
    createdAt: '2026-10-20T10:00:00Z',
    receipt: null,
  }
  assert.equal(OutboxEntrySchema.parse(entry).payload.content.status, 'partial')
  assert.equal(OutboxEntrySchema.safeParse({ ...entry, state: 'accepted' }).success, false)
  assert.equal(OutboxEntrySchema.safeParse({ ...entry, operationId: 'different' }).success, false)
})
test('Monday-Sunday summaries count four/three/one once; partial remains an absence after close', () => {
  const week = { startDate: '2026-10-19', timeZone: 'Europe/Madrid' }
  const summary = {
    schemaVersion: 2,
    scope: fixture.scope,
    week,
    revision: 2,
    asOf: '2026-10-26T00:00:00Z',
    closed: true,
    required: 4,
    completed: 3,
    partial: 1,
    missed: 1,
    pending: 0,
    occurrenceIds: ['one', 'two', 'three', 'four'],
  }
  assert.equal(WeekSummarySchema.safeParse(summary).success, true)
  assert.equal(WeekSummarySchema.safeParse({ ...summary, completed: 4 }).success, false)
  assert.equal(WeekSchema.safeParse({ ...week, startDate: '2026-10-25' }).success, false)
})
test('consent is explicit, category-scoped and revocable; only supported manual JSON is accepted', () => {
  const consent = {
    schemaVersion: 2,
    id: 'consent',
    ownerId: 'member',
    scope: { organizationId: 'atlas', branchId: 'atlas-principal' },
    revision: 0,
    status: 'active',
    categories: ['sleep'],
    audience: 'current-authorized-branch-trainers',
    disclosureVersion: 1,
    grantedAt: '2026-10-20T10:00:00Z',
    revokedAt: null,
  }
  assert.equal(HealthConsentSchema.safeParse(consent).success, true)
  assert.equal(HealthConsentSchema.safeParse({ ...consent, status: 'revoked' }).success, false)
  assert.equal(
    HealthConsentSchema.safeParse({ ...consent, categories: ['sleep', 'sleep'] }).success,
    false,
  )
  const request = {
    operationId: 'import',
    expectedRevision: 0,
    format: 'klisteniapp.health',
    version: 1,
    raw: '{}',
  }
  assert.equal(HealthImportRequestSchema.safeParse(request).success, true)
  assert.equal(
    HealthImportRequestSchema.safeParse({ ...request, format: 'samsung-csv' }).success,
    false,
  )
})
test('all endpoint paths are versioned and route parameters are declared by their input schema', () => {
  for (const endpoint of Object.values(ProductEndpoints)) {
    assert.ok(endpoint.path.startsWith(endpoint.scope === 'self' ? '/self/' : '/product/v2/'))
    for (const match of endpoint.path.matchAll(/:([a-zA-Z]+)/g))
      assert.ok(match[1]! in endpoint.input.shape)
  }
})
