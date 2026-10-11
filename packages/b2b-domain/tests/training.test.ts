import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ExecutionInputSchema, ProgramInputSchema } from '@klisteniapp/b2b-contracts/training'
import {
  checkExecution,
  checkProgramAlternatives,
  isAuthorizedSet,
  programExerciseIds,
} from '../src/training.ts'

const program = ProgramInputSchema.parse({
  name: 'Routine',
  steps: [
    { id: 'press', exerciseId: 'bench-press', alternatives: ['push-up'], sets: 2, reps: 10 },
    { id: 'squat', exerciseId: 'squat', sets: 1, reps: 10 },
  ],
})
const execution = ExecutionInputSchema.parse({
  id: 'execution',
  assignmentId: 'assignment',
  status: 'completed',
  completedAt: '2026-10-10T12:00:00.000Z',
  sets: [
    { stepId: 'press', exerciseId: 'bench-press', set: 1, reps: 10 },
    { stepId: 'press', exerciseId: 'push-up', set: 2, reps: 8, reason: 'Equipo ocupado' },
    { stepId: 'squat', exerciseId: 'squat', set: 1, reps: 10 },
  ],
})

test('catalog references retain stable order and alternatives must be distinct within their step', () => {
  const repeated = structuredClone(program)
  repeated.steps[1].alternatives = ['push-up', 'bench-press']
  const original = structuredClone(repeated)
  assert.deepEqual(programExerciseIds(repeated), ['bench-press', 'push-up', 'squat'])
  assert.deepEqual(checkProgramAlternatives(repeated), { ok: true })
  assert.deepEqual(repeated, original)
  for (const alternatives of [['push-up', 'push-up'], ['bench-press']]) {
    repeated.steps[0].alternatives = alternatives
    assert.deepEqual(checkProgramAlternatives(repeated), {
      ok: false,
      code: 'INVALID_ALTERNATIVE',
    })
  }
})

test('editable set references accept permitted alternatives without requiring a reason yet', () => {
  assert.equal(isAuthorizedSet(program, execution.sets[0]), true)
  const unfinishedAlternative = { ...execution.sets[1], reason: '' }
  assert.equal(isAuthorizedSet(program, unfinishedAlternative), true)
  for (const patch of [
    { stepId: 'unknown' },
    { exerciseId: 'squat' },
    { set: 0 },
    { set: -1 },
    { set: 1.5 },
    { set: 3 },
  ]) {
    assert.equal(isAuthorizedSet(program, { ...execution.sets[0], ...patch }), false)
  }
})

test('submitted substitutions require both permission and a reason with stable error categories', () => {
  for (const patch of [
    { exerciseId: 'push-up', reason: '  ' },
    { exerciseId: 'squat', reason: 'Not permitted in this step' },
  ]) {
    assert.deepEqual(
      checkExecution(program, { status: 'partial', sets: [{ ...execution.sets[0], ...patch }] }),
      { ok: false, code: 'INVALID_SUBSTITUTION' },
    )
  }
  assert.deepEqual(
    checkExecution(program, {
      status: 'partial',
      sets: [{ ...execution.sets[0], stepId: 'unknown' }],
    }),
    { ok: false, code: 'INVALID_SET' },
  )
})

test('completion checks prescribed identities and positive repetitions, not just row counts', () => {
  const incomplete = [
    execution.sets.slice(1),
    [execution.sets[0], execution.sets[0], execution.sets[2]],
    execution.sets.map((set) => (set.stepId === 'squat' ? { ...set, reps: 0 } : set)),
  ]
  for (const sets of incomplete) {
    assert.deepEqual(checkExecution(program, { status: 'completed', sets }), {
      ok: false,
      code: 'INCOMPLETE_EXECUTION',
    })
    assert.deepEqual(checkExecution(program, { status: 'partial', sets }), { ok: true })
  }
})

test('valid execution checks preserve both the historical snapshot and the recorded payload', () => {
  const original = structuredClone({ program, execution })
  assert.deepEqual(checkExecution(program, execution), { ok: true })
  assert.deepEqual({ program, execution }, original)
})

test('timed completion uses actual positive seconds and cannot change the prescribed unit', () => {
  const timed = ProgramInputSchema.parse({
    name: 'Hold',
    steps: [{ id: 's', exerciseId: 'plank', sets: 1, reps: null, durationSeconds: 30 }],
  })
  const input = ExecutionInputSchema.parse({
    ...execution,
    sets: [{ stepId: 's', exerciseId: 'plank', set: 1, reps: null, durationSeconds: 20, rpe: 8 }],
  })
  assert.deepEqual(checkExecution(timed, input), { ok: true })
  assert.deepEqual(
    checkExecution(timed, { ...input, sets: [{ ...input.sets[0], durationSeconds: 0 }] }),
    { ok: false, code: 'INCOMPLETE_EXECUTION' },
  )
  assert.deepEqual(
    checkExecution(timed, {
      ...input,
      status: 'partial',
      sets: [{ ...input.sets[0], durationSeconds: 0 }],
    }),
    { ok: true },
  )
  assert.deepEqual(
    checkExecution(timed, {
      ...input,
      sets: [{ ...input.sets[0], reps: 20, durationSeconds: null }],
    }),
    { ok: false, code: 'INVALID_MEASUREMENT' },
  )
})
