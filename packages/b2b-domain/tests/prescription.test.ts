import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DurationTargetSchema,
  LoadTargetSchema,
  RepetitionsTargetSchema,
  RestTargetSchema,
  RoutineDraftContentSchema,
  SetsTargetSchema,
  type RoutineDraftContent,
} from '@klisteniapp/b2b-contracts/product-v2'
import {
  checkGoalActivation,
  checkPrescription,
  DEFAULT_REST_SECONDS,
  targetBounds,
  targetContains,
} from '../src/prescription.ts'

const dose = {
  mode: 'repetitions' as const,
  sets: { kind: 'range' as const, min: 3, max: 4 },
  repetitions: { kind: 'range' as const, min: 8, max: 12 },
  durationSeconds: null,
  load: { mode: 'bodyweight' as const },
  restSeconds: DEFAULT_REST_SECONDS,
  laterality: 'bilateral' as const,
  targetRpe: null,
  notes: '',
}
function routine(): RoutineDraftContent {
  return {
    name: 'Routine',
    description: '',
    steps: [
      {
        id: 'step',
        exerciseId: 'exercise',
        dose: structuredClone(dose),
        substitutionPolicy: 'reviewed',
      },
    ],
  }
}

test('empty and incomplete drafts remain saveable; completeness reports stable step IDs and exact fields', () => {
  const empty = RoutineDraftContentSchema.parse({ name: '', description: '', steps: [] })
  const result = checkPrescription(empty)
  assert.equal(result.ok, false)
  if (!result.ok)
    assert.deepEqual(
      result.issues.map((issue) => issue.path),
      [['name'], ['steps']],
    )
  const draft = routine()
  Object.assign(draft.steps[0]!, {
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
  })
  assert.deepEqual(RoutineDraftContentSchema.parse(draft), draft)
  const missing = checkPrescription(draft)
  assert.equal(missing.ok, false)
  if (!missing.ok) {
    assert.ok(missing.issues.every((issue) => issue.stepId === 'step'))
    for (const field of ['exerciseId', 'mode', 'sets', 'load', 'restSeconds', 'laterality'])
      assert.ok(
        missing.issues.some((issue) => issue.path.at(-1) === field),
        field,
      )
  }
})

test('fixed and range targets retain boundaries, units, zero distinctions and existing maxima', () => {
  for (const schema of [SetsTargetSchema, RepetitionsTargetSchema, DurationTargetSchema])
    assert.equal(schema.safeParse({ kind: 'fixed', value: 0 }).success, false)
  assert.equal(SetsTargetSchema.safeParse({ kind: 'fixed', value: 1.5 }).success, false)
  assert.equal(
    RepetitionsTargetSchema.safeParse({ kind: 'range', min: 2.5, max: 3 }).success,
    false,
  )
  assert.equal(SetsTargetSchema.safeParse({ kind: 'range', min: 4, max: 3 }).success, false)
  assert.equal(SetsTargetSchema.safeParse({ kind: 'fixed', value: 31 }).success, false)
  assert.equal(RepetitionsTargetSchema.safeParse({ kind: 'fixed', value: 1001 }).success, false)
  assert.equal(DurationTargetSchema.safeParse({ kind: 'fixed', value: 86401 }).success, false)
  assert.equal(LoadTargetSchema.safeParse({ kind: 'fixed', value: 1001 }).success, false)
  assert.equal(RestTargetSchema.safeParse({ kind: 'fixed', value: 3601 }).success, false)
  assert.deepEqual(LoadTargetSchema.parse({ kind: 'fixed', value: 0 }), { kind: 'fixed', value: 0 })
  assert.deepEqual(RestTargetSchema.parse({ kind: 'range', min: 0, max: 60 }), {
    kind: 'range',
    min: 0,
    max: 60,
  })
  assert.equal(
    DurationTargetSchema.safeParse({ kind: 'fixed', value: 1, unit: 'minutes' }).success,
    false,
  )
  assert.deepEqual(targetBounds(dose.sets), [3, 4])
  assert.deepEqual(targetBounds({ kind: 'fixed', value: 5 }), [5, 5])
  assert.equal(targetContains(dose.repetitions, 8), true)
  assert.equal(targetContains(dose.repetitions, 12), true)
  assert.equal(targetContains(dose.repetitions, 7), false)
  assert.equal(targetContains(dose.repetitions, Infinity), false)
})

test('repetition, timed, per-side, bodyweight and zero external load prescriptions are complete without balance scoring', () => {
  const draft = routine()
  assert.equal(checkPrescription(draft).ok, true)
  draft.steps[0]!.dose.load = { mode: 'external', kilograms: { kind: 'range', min: 0, max: 15 } }
  draft.steps[0]!.dose.laterality = 'per-side'
  assert.equal(checkPrescription(draft).ok, true)
  draft.steps[0]!.dose.mode = 'duration'
  draft.steps[0]!.dose.repetitions = null
  draft.steps[0]!.dose.durationSeconds = { kind: 'range', min: 30, max: 45 }
  assert.equal(checkPrescription(draft).ok, true)
  draft.steps[0]!.dose.repetitions = { kind: 'fixed', value: 10 }
  assert.equal(checkPrescription(draft).ok, false)
  draft.steps[0]!.dose.repetitions = null
  draft.steps[0]!.dose.load = { mode: 'unspecified' }
  assert.equal(checkPrescription(draft).ok, false)
})

test('activation requires dates, timezone and slots; same-day slots and explicit stage gaps remain distinct', () => {
  const routine = { programId: 'routine', version: 1, schemaVersion: 2 as const }
  const stage = {
    id: 'stage',
    name: 'Stage',
    startDate: '2026-10-01',
    endDate: '2026-10-10',
    slots: [
      { id: 'slot-a', weekday: 1, routine },
      { id: 'slot-b', weekday: 1, routine },
    ],
  }
  const content = {
    name: 'Goal',
    goal: '',
    timeZone: 'America/New_York',
    stages: [stage, { ...stage, id: 'second', startDate: '2026-10-12', endDate: '2026-10-20' }],
  }
  assert.equal(checkGoalActivation(content).ok, true)
  for (const change of [
    { timeZone: null },
    { stages: [] },
    { stages: [{ ...stage, startDate: null }] },
    { stages: [{ ...stage, endDate: '2026-09-30' }] },
    { stages: [stage, { ...stage, id: 'second', startDate: '2026-10-10' }] },
    { stages: [{ ...stage, slots: [{ ...stage.slots[0], weekday: null }] }] },
  ])
    assert.equal(checkGoalActivation({ ...content, ...change }).ok, false)
})
