import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  SessionContentSchema,
  type RoutineVersionV2,
  type SessionContent,
} from '@klisteniapp/b2b-contracts/product-v2'
import { canonicalJson, sessionIssues } from '../src/sessions.ts'
const fixture = JSON.parse(
  readFileSync(
    new URL('../../b2b-contracts/tests/fixtures/product-v2.json', import.meta.url),
    'utf8',
  ),
)
const prescription: Pick<RoutineVersionV2, 'steps' | 'relations'> = {
  steps: [
    { id: 'step', exerciseId: 'exercise', dose: fixture.dose, substitutionPolicy: 'reviewed' },
  ],
  relations: [],
}
function content(): SessionContent {
  return SessionContentSchema.parse({
    status: 'completed',
    explicitCompletion: true,
    performedAt: '2026-10-22T10:00:00Z',
    notes: '',
    correctionReason: '',
    segments: [
      {
        segmentId: 'source',
        originalStepId: 'step',
        exerciseId: 'exercise',
        dose: fixture.dose,
        relation: null,
        confirmedConditions: [],
        createdAt: '2026-10-22T10:00:00Z',
      },
    ],
    selectedSegments: [{ originalStepId: 'step', segmentId: 'source' }],
    sets: [1, 2, 3].map((ordinal) => ({
      performedSetId: `set-${ordinal}`,
      segmentId: 'source',
      ordinal,
      side: 'both',
      repetitions: 1,
      durationSeconds: null,
      loadKg: null,
      rpe: null,
      notes: '',
    })),
  })
}
test('explicit completion requires range-minimum sets and positive actuals, while truthful below-target reps are valid', () => {
  assert.deepEqual(sessionIssues(content(), prescription), [])
  const missing = content()
  missing.sets.pop()
  assert.ok(sessionIssues(missing, prescription).length)
  const zero = content()
  zero.sets[0]!.repetitions = 0
  assert.ok(sessionIssues(zero, prescription).length)
  const draft = content()
  draft.status = 'draft'
  draft.explicitCompletion = false
  draft.sets = []
  draft.selectedSegments = []
  assert.deepEqual(sessionIssues(draft, prescription), [])
  const implicit = content()
  implicit.explicitCompletion = false
  assert.ok(sessionIssues(implicit, prescription).length)
})
test('target duration and per-side requirements use their own dose and cannot consume source sets', () => {
  const target = content()
  target.segments[0]!.dose = {
    ...fixture.dose,
    mode: 'duration',
    repetitions: null,
    durationSeconds: { kind: 'fixed', value: 30 },
    laterality: 'per-side',
  }
  const timed = {
    steps: [{ ...prescription.steps[0]!, dose: target.segments[0]!.dose }],
    relations: [],
  }
  target.sets = [1, 2, 3].flatMap((ordinal) =>
    (['left', 'right'] as const).map((side) => ({
      performedSetId: `${ordinal}-${side}`,
      segmentId: 'source',
      ordinal,
      side,
      repetitions: null,
      durationSeconds: 1,
      loadKg: null,
      rpe: null,
      notes: '',
    })),
  )
  assert.deepEqual(sessionIssues(target, timed), [])
  target.sets.pop()
  assert.ok(sessionIssues(target, timed).length)
})
test('segment identity is immutable and switching must retain actuals; unreviewed and forged target doses fail', () => {
  const before = content(),
    after = content()
  after.segments[0]!.dose.notes = 'Changed'
  assert.ok(sessionIssues(after, prescription, before).length)
  const target = content()
  target.segments[0]!.exerciseId = 'other'
  assert.ok(sessionIssues(target, prescription).length)
  const removed = content()
  removed.segments = []
  removed.sets = []
  removed.selectedSegments = []
  removed.status = 'partial'
  removed.explicitCompletion = false
  removed.correctionReason = 'Fix'
  assert.ok(sessionIssues(removed, prescription, before).length)
})
test('completed-to-partial and void corrections require an explanation', () => {
  const before = content(),
    after = content()
  after.status = 'partial'
  after.explicitCompletion = false
  assert.ok(sessionIssues(after, prescription, before).length)
  after.correctionReason = 'Corrected mistaken completion'
  assert.deepEqual(sessionIssues(after, prescription, before), [])
  after.status = 'void'
  assert.deepEqual(sessionIssues(after, prescription, before), [])
})
test('operation canonicalization sorts objects and preserves array order and actual scalar values', () => {
  assert.equal(
    canonicalJson({ b: 2, a: { d: 4, c: 3 } }),
    canonicalJson({ a: { c: 3, d: 4 }, b: 2 }),
  )
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]))
  assert.notEqual(canonicalJson({ reps: 1 }), canonicalJson({ reps: 2 }))
})
test('alternating coverage needs both sides, ranged maxima bound extra sets and bodyweight has no external load', () => {
  const alternating = content()
  const dose = {
    ...fixture.dose,
    laterality: 'alternating' as const,
    sets: { kind: 'range' as const, min: 1, max: 2 },
  }
  alternating.segments[0]!.dose = dose
  alternating.sets = ['left', 'right'].map((side) => ({
    ...content().sets[0]!,
    performedSetId: `set-${side}`,
    side: side as 'left' | 'right',
  }))
  const issued = { steps: [{ ...prescription.steps[0]!, dose }], relations: [] }
  assert.deepEqual(sessionIssues(alternating, issued), [])
  alternating.sets[0]!.ordinal = 3
  assert.ok(sessionIssues(alternating, issued).length)
  alternating.sets[0]!.ordinal = 1
  alternating.sets[0]!.loadKg = 10
  assert.ok(sessionIssues(alternating, issued).length)
})
