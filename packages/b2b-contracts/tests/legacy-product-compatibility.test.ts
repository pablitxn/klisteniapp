import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  decodeRoutine,
  decodeLegacyRetry,
  projectLegacyRoutine,
  TrainingInterchangeSchema,
  DoseSchema,
} from '../src/product-v2.ts'
import { ProgramVersionSchema } from '../src/training.ts'
const raw = readFileSync(new URL('./fixtures/product-v2.json', import.meta.url), 'utf8')
const fixture = JSON.parse(raw)
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
test('legacy fixed-dose snapshots and pending create retry decode without modifying original payload bytes', () => {
  const before = hash(fixture)
  assert.deepEqual(decodeRoutine(1, fixture.legacyRoutine).snapshot, fixture.legacyRoutine)
  assert.deepEqual(decodeLegacyRetry(fixture.legacyRetry), fixture.legacyRetry)
  const projected = projectLegacyRoutine(ProgramVersionSchema.parse(fixture.legacyRoutine))
  assert.deepEqual(projected.steps[0]!.dose.load, { mode: 'unspecified' })
  assert.equal(projected.steps[0]!.substitutionPolicy, 'reviewed')
  assert.equal(hash(fixture), before)
  assert.throws(() => decodeRoutine(2, fixture.legacyRoutine))
  assert.throws(() => decodeRoutine(undefined, fixture.legacyRoutine))
})
test('lossless interchange round-trips both versions and rejects a flattened or unversioned prescription', () => {
  const v2 = {
    schemaVersion: 2,
    programId: 'routine',
    version: 2,
    scope: { organizationId: 'atlas', branchId: 'atlas-principal' },
    publishedAt: '2026-10-17T10:00:00Z',
    name: 'Ranges',
    description: '',
    steps: [
      {
        id: 'step',
        exerciseId: 'exercise',
        dose: DoseSchema.parse(fixture.dose),
        substitutionPolicy: 'reviewed',
      },
    ],
    exercises: [],
    machines: [],
    relations: [],
  }
  const interchange = {
    format: 'klisteni-training',
    version: 2,
    exportedAt: '2026-10-17T11:00:00Z',
    ownerId: 'member',
    scope: fixture.scope,
    routines: [
      { schemaVersion: 1, snapshot: fixture.legacyRoutine },
      { schemaVersion: 2, snapshot: v2 },
    ],
    legacyExecutions: [
      {
        schemaVersion: 1,
        revision: 0,
        scope: fixture.scope,
        original: fixture.legacyRetry,
        routine: fixture.legacyRoutine,
        createdAt: '2026-10-02T10:00:00Z',
      },
    ],
    enrollments: [],
    occurrences: [],
    sessionRevisions: [],
    supplements: [],
  }
  assert.deepEqual(
    TrainingInterchangeSchema.parse(JSON.parse(JSON.stringify(interchange))),
    interchange,
  )
  assert.equal(ProgramVersionSchema.safeParse(v2).success, false)
  assert.equal(TrainingInterchangeSchema.safeParse({ ...interchange, version: 1 }).success, false)
})
