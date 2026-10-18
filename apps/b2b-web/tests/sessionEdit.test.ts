import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyPerformedSet } from '@klisteniapp/b2b-domain/alternatives'
import {
  changeWorkoutActual,
  prepareWorkoutContent,
} from '../src/features/training/sync/workoutEdit.ts'
import { editedContent, resolveWorkoutConflict } from '../src/features/training/sync/workoutSync.ts'
import { draft, routine, receipt } from './fixtures/workout.ts'
test('zero-set autosave stays draft and truthful below-target completion needs explicit intent', () => {
  const d = draft()
  assert.equal(prepareWorkoutContent(d, routine, false).status, 'draft')
  assert.throws(() => prepareWorkoutContent(d, routine, true))
  const segment = d.content.segments[0]
  for (let ordinal = 1; ordinal <= 2; ordinal++)
    d.content = changeWorkoutActual(d.content, {
      ...emptyPerformedSet(segment, `actual-${ordinal}`, ordinal, 'both'),
      repetitions: 1,
      loadKg: 0,
    })
  assert.equal(d.content.status, 'partial')
  assert.equal(d.content.explicitCompletion, false)
  const completed = prepareWorkoutContent(d, routine, true)
  assert.equal(completed.status, 'completed')
  assert.equal(completed.explicitCompletion, true)
  assert.equal(editedContent(completed).status, 'partial')
})
test('accepted corrections need reasons, preserve performed identity and explicitly resolve remote conflicts', async () => {
  const d = draft()
  const accepted = (
    await receipt({
      id: d.id,
      origin: d.origin,
      content: { ...d.content, status: 'completed', explicitCompletion: true },
      operationId: 'remote',
      expectedRevision: 0,
    })
  ).session
  d.accepted = accepted
  assert.throws(() => prepareWorkoutContent(d, routine, false), /Explain/)
  d.content.correctionReason = 'Correcting mistaken completion'
  assert.equal(prepareWorkoutContent(d, routine, false).status, 'draft')
  const recovered = resolveWorkoutConflict(d, accepted, 'server')
  assert.deepEqual(recovered.content, accepted.content)
  assert.deepEqual(recovered.recovery, [d.content])
  assert.throws(
    () =>
      resolveWorkoutConflict(
        d,
        { ...accepted, scope: { ...accepted.scope, memberId: 'foreign' } },
        'local',
      ),
    /Foreign/,
  )
})

test('void is an explicit retained correction and requires a reason', () => {
  const d = draft()
  assert.throws(() => prepareWorkoutContent(d, routine, 'void'), /Explain/)
  d.content.correctionReason = 'Mistaken duplicate workout'
  const voided = prepareWorkoutContent(d, routine, 'void')
  assert.equal(voided.status, 'void')
  assert.equal(voided.explicitCompletion, false)
  assert.deepEqual(voided.segments, d.content.segments)
})
