import assert from 'node:assert/strict'
import test from 'node:test'
import { exportOwnerLocalWorkout } from '../src/features/training/storage/ownerRecoveryExport.ts'
import { queueWorkout } from '../src/features/training/sync/workoutSync.ts'
import { access, scope, stored, now, receipt } from './fixtures/workout.ts'

test('export-only owner can recover unsynchronized work without operational grants, requests or mutation', async () => {
  const { store, d } = await stored()
  const q = await queueWorkout(d, 1, 'pending-owner', now)
  await store.compareAndSet({ ...q, generation: 1 }, 0)
  const before = await store.read(d.key)
  const restricted = {
    ...access,
    accessMode: 'export-only' as const,
    branches: [],
    capabilities: ['export-own-records' as const],
  }
  const output = JSON.parse(
    (await exportOwnerLocalWorkout(store, { scope, access: restricted }, d.id))!,
  )
  assert.equal(output.serverConfirmed, false)
  assert.equal(output.operations[0].operationId, 'pending-owner')
  assert.deepEqual(output.operations[0].payload, q.operations[0].payload)
  assert.equal(output.localContent.status, 'draft')
  assert.equal(output.acceptedRevision, null)
  assert.equal('health' in output, false)
  assert.deepEqual(await store.read(d.key), before)
})

test('owner export refuses other identities, organizations and missing export capability', async () => {
  const { store, d } = await stored()
  for (const changed of [
    { ...access, userId: 'foreign' },
    { ...access, organizationId: 'foreign' },
    { ...access, capabilities: [] },
  ])
    await assert.rejects(
      exportOwnerLocalWorkout(store, { scope, access: changed }, d.id),
      /owner export access/,
    )
  assert.equal(
    await exportOwnerLocalWorkout(
      store,
      { scope: { ...scope, branchId: 'foreign' }, access },
      d.id,
    ),
    null,
  )
  assert.equal(
    await exportOwnerLocalWorkout(
      store,
      { scope: { ...scope, origin: 'https://foreign.example' }, access },
      d.id,
    ),
    null,
  )
})

test('server-confirmed content is omitted from a local-only export unless recovery work remains', async () => {
  const { store, d } = await stored()
  const accepted = (
    await receipt({
      id: d.id,
      operationId: 'accepted',
      expectedRevision: 0,
      origin: d.origin,
      content: d.content,
    })
  ).session
  await store.compareAndSet({ ...d, accepted, generation: 1 }, 0)
  assert.equal(await exportOwnerLocalWorkout(store, { scope, access }, d.id), null)
  const saved = (await store.read(d.key))!
  await store.compareAndSet({ ...saved, recovery: [saved.content], generation: 2 }, 1)
  const output = JSON.parse((await exportOwnerLocalWorkout(store, { scope, access }, d.id))!)
  assert.equal(output.localContent, null)
  assert.equal(output.acceptedRevision, 1)
  assert.equal(output.recovery.length, 1)
  assert.equal('accepted' in output, false)
})
