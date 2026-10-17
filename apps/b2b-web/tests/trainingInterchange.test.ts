import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  personalExportDownload,
  readTrainingInterchange,
  writeTrainingInterchange,
} from '../src/features/membership/trainingInterchange.ts'
import { identity, syntheticExport } from './membership/fixture.ts'

test('interchange archives every branch/revision, original actuals, ranges, units and reviewed provenance', () => {
  const source = syntheticExport()
  const download = personalExportDownload(source, identity)
  assert.deepEqual(JSON.parse(download.json), source)
  assert.equal(source.training.length, 2)
  for (const training of source.training) {
    assert.deepEqual(readTrainingInterchange(writeTrainingInterchange(training)), training)
    assert.deepEqual(
      training.sessionRevisions.map((r) => r.revision),
      [1, 2],
    )
    assert.deepEqual(
      training.enrollments.map((r) => r.revision),
      [1, 2],
    )
    assert.deepEqual(
      training.occurrences.map((r) => r.revision),
      [1, 2],
    )
    const session = training.sessionRevisions[1]!
    assert.equal(session.content.sets[0]!.loadKg, 12.5)
    assert.equal(session.content.sets[1]!.durationSeconds, 34)
    assert.equal(session.content.sets[1]!.side, 'left')
    assert.equal(session.content.segments[1]!.relation!.sourceContentHash, 'b'.repeat(64))
    assert.deepEqual(session.content.segments[1]!.dose.durationSeconds, {
      kind: 'range',
      min: 30,
      max: 45,
    })
    assert.equal(training.legacyExecutions[0]!.revision, 0)
  }
})

test('user-managed routine archive preserves both original and range semantics without normalizing issued strings', () => {
  const training = syntheticExport().training[0]!
  training.routines[1]!.snapshot.name = '  Original issued spacing  '
  const recovered = readTrainingInterchange(writeTrainingInterchange(training))
  assert.deepEqual(recovered.routines, training.routines)
  assert.equal(recovered.routines[1]!.snapshot.name, '  Original issued spacing  ')
})

test('unknown versions and unsupported fields return explicit schema issues, never flattened content', () => {
  const training = syntheticExport().training[0]!
  assert.throws(
    () => readTrainingInterchange(JSON.stringify({ ...training, version: 3 })),
    /version/,
  )
  assert.throws(
    () => readTrainingInterchange(JSON.stringify({ ...training, unsupportedB2CField: 1 })),
    /unsupportedB2CField/,
  )
  const invalid = structuredClone(training)
  const routine = invalid.routines.find((r) => r.schemaVersion === 2)!
  if (routine.schemaVersion !== 2) throw new Error('Fixture missing v2 routine')
  // A legacy scalar cannot stand in for the declared range.
  Object.assign(routine.snapshot.steps[0]!.dose, { sets: 3 })
  assert.throws(() => readTrainingInterchange(JSON.stringify(invalid)), /sets/)
})

test('export rejects foreign owner, health, tenant, branch and nested revision scopes', () => {
  const data = syntheticExport()
  assert.throws(() => personalExportDownload(data, { ...identity, userId: 'other' }), /owner/)
  assert.throws(
    () => personalExportDownload(data, { ...identity, organizationId: 'sur' }),
    /identity/,
  )
  data.health.ownerId = 'other'
  assert.throws(() => personalExportDownload(data, identity), /owner/)
  data.health.ownerId = identity.userId
  data.training[0]!.sessionRevisions[0]!.scope.branchId = 'foreign'
  assert.throws(() => personalExportDownload(data, identity), /branch/)
})
