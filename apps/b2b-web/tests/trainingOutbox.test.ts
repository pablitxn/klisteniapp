import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { canonicalJson } from '@klisteniapp/b2b-domain/sessions'
import {
  queueWorkout,
  workoutRequestHash,
  ownerWorkoutExport,
} from '../src/features/training/sync/workoutSync.ts'
import { parseWorkoutDocument, workoutKey } from '../src/features/training/storage/workoutStore.ts'
import { draft, scope, access, now, stored } from './fixtures/workout.ts'
test('queued payload is an immutable snapshot and uses WP03 scoped request hash', async () => {
  const d = draft()
  const queued = await queueWorkout(d, access.accessRevision, 'op-1', now)
  d.content.notes = 'later edit'
  assert.equal(queued.operations[0].payload.content.notes, '')
  const expected = createHash('sha256')
    .update(
      canonicalJson({
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        actorId: scope.actorId,
        action: 'session.save',
        input: queued.operations[0].payload,
      }),
    )
    .digest('hex')
  assert.equal(await workoutRequestHash(scope, queued.operations[0].payload), expected)
  assert.deepEqual(await queueWorkout(queued, 1, 'op-2', now), queued)
})
test('local CAS detects competing tabs; reload retains durable draft and quota failure never reports success', async () => {
  const { store, d } = await stored()
  const tab = await store.read(d.key)
  await store.compareAndSet(
    { ...d, content: { ...d.content, notes: 'first tab' }, generation: 1 },
    0,
  )
  await assert.rejects(store.compareAndSet({ ...tab!, generation: 1 }, 0), /another tab/)
  assert.equal((await store.read(d.key))?.content.notes, 'first tab')
  store.fail = true
  await assert.rejects(store.compareAndSet({ ...d, generation: 2 }, 1), /quota/)
  assert.equal((await store.read(d.key))?.generation, 1)
})
test('keys isolate browser origin, gym, branch, account and session; exports require owner identity', () => {
  const d = draft()
  const keys = new Set([
    workoutKey(scope, 'session'),
    workoutKey({ ...scope, origin: 'https://other.example' }, 'session'),
    workoutKey({ ...scope, organizationId: 'other' }, 'session'),
    workoutKey({ ...scope, branchId: 'west' }, 'session'),
    workoutKey({ ...scope, accountId: 'other' }, 'session'),
    workoutKey(scope, 'other-session'),
  ])
  assert.equal(keys.size, 6)
  assert.throws(() => ownerWorkoutExport(d, { accountId: 'other', actorId: 'other' }), /Owner/)
  const exported = JSON.parse(ownerWorkoutExport(d, scope))
  assert.equal(exported.serverConfirmed, false)
  assert.equal(exported.workout.content.status, 'draft')
  assert.throws(() => parseWorkoutDocument({ ...d, schemaVersion: 99 }), /Unsupported/)
  assert.throws(
    () => parseWorkoutDocument({ ...d, scope: { ...scope, actorId: 'foreign' } }),
    /Unsupported/,
  )
})

test('durable updates reject mutation or removal of an existing operation payload', async () => {
  const { store, d } = await stored()
  const q = await queueWorkout(d, 1, 'op-immutable', now)
  await store.compareAndSet({ ...q, generation: 1 }, 0)
  const changed = structuredClone(q)
  changed.operations[0].payload.content.notes = 'overwritten retry'
  await assert.rejects(store.compareAndSet({ ...changed, generation: 2 }, 1), /immutable/)
  await assert.rejects(store.compareAndSet({ ...q, operations: [], generation: 2 }, 1), /immutable/)
  assert.equal((await store.read(d.key))?.operations[0].payload.content.notes, '')
})

test('fresh occurrence identity survives reload and two devices without relabeling accepted or legacy IDs', async () => {
  const { occurrenceWorkoutId } = await import('../src/features/training/sync/workoutEdit.ts')
  const first = await occurrenceWorkoutId(scope, 'occurrence')
  assert.equal(first, await occurrenceWorkoutId(scope, 'occurrence'))
  assert.notEqual(first, await occurrenceWorkoutId({ ...scope, branchId: 'west' }, 'occurrence'))
  assert.notEqual(first, await occurrenceWorkoutId(scope, 'another-occurrence'))
  assert.match(first, /^session-[a-f0-9]{40}$/)
})
