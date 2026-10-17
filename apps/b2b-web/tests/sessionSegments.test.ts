import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyPerformedSet } from '@klisteniapp/b2b-domain/alternatives'
import {
  changeWorkoutActual,
  selectWorkoutAlternative,
  restoreWorkoutSegment,
  prepareWorkoutContent,
  segmentRows,
} from '../src/features/training/sync/workoutEdit.ts'
import { draft, routine, environment, relation, now } from './fixtures/workout.ts'
test('switching reps to timed per-side target preserves earlier actuals and renews completion intent', () => {
  const d = draft()
  const original = d.content.segments[0]
  const source = { ...emptyPerformedSet(original, 'actual', 1, 'both'), repetitions: 4, loadKg: 15 }
  d.content = changeWorkoutActual(d.content, source)
  const changed = selectWorkoutAlternative(
    d.content,
    routine,
    'step',
    relation.id,
    relation.conditions,
    environment,
    'target-segment',
    now,
  )
  assert.deepEqual(changed.sets, [source])
  assert.equal(changed.status, 'partial')
  assert.equal(changed.explicitCompletion, false)
  const target = changed.segments[1]
  assert.deepEqual(target.dose, relation.targetDose)
  const empty = emptyPerformedSet(target, 'new-actual', 1, 'left')
  assert.equal(empty.loadKg, null)
  assert.equal(empty.repetitions, null)
  assert.equal(empty.durationSeconds, 0)
  assert.deepEqual(segmentRows(target), [
    { ordinal: 1, side: 'left' },
    { ordinal: 1, side: 'right' },
  ])
  assert.throws(
    () => prepareWorkoutContent({ ...d, content: changed }, routine, true),
    /positive actuals/,
  )
  assert.deepEqual(restoreWorkoutSegment(changed, original.segmentId).sets, [source])
})
test('blocked, empty, missing conditions and withdrawn equipment cannot create target segments', () => {
  const d = draft()
  assert.throws(
    () =>
      selectWorkoutAlternative(
        d.content,
        { ...routine, steps: routine.steps.map((s) => ({ ...s, substitutionPolicy: 'blocked' })) },
        'step',
        relation.id,
        relation.conditions,
        environment,
        'target',
        now,
      ),
    /UNAVAILABLE/,
  )
  assert.throws(
    () =>
      selectWorkoutAlternative(
        d.content,
        { ...routine, relations: [] },
        'step',
        relation.id,
        relation.conditions,
        environment,
        'target',
        now,
      ),
    /UNAVAILABLE/,
  )
  assert.throws(
    () =>
      selectWorkoutAlternative(
        d.content,
        routine,
        'step',
        relation.id,
        [],
        environment,
        'target',
        now,
      ),
    /UNCONFIRMED/,
  )
  assert.throws(
    () =>
      selectWorkoutAlternative(
        d.content,
        routine,
        'step',
        relation.id,
        relation.conditions,
        { ...environment, confirmedEquipment: new Set() },
        'target',
        now,
      ),
    /EQUIPMENT/,
  )
})

test('withdrawing a rejected target allows explicit archival while keeping source work and a recovery copy', async () => {
  const { archiveUnacceptedTarget } = await import('../src/features/training/sync/workoutEdit.ts')
  const d = draft()
  const original = d.content.segments[0]
  const source = {
    ...emptyPerformedSet(original, 'source-actual', 1, 'both'),
    repetitions: 4,
    loadKg: 12,
  }
  d.content = changeWorkoutActual(d.content, source)
  d.content = selectWorkoutAlternative(
    d.content,
    routine,
    'step',
    relation.id,
    relation.conditions,
    environment,
    'rejected-target',
    now,
  )
  assert.throws(() => archiveUnacceptedTarget(d, 'rejected-target'), /unselected/)
  d.content = restoreWorkoutSegment(d.content, original.segmentId)
  const archived = archiveUnacceptedTarget(d, 'rejected-target')
  assert.deepEqual(archived.content.sets, [source])
  assert.equal(archived.recovery[0].segments.length, 2)
  assert.equal(archived.content.segments.length, 1)
})
