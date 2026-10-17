import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WorkoutSync,
  queueWorkout,
  canEditWorkout,
  resolveWorkoutConflict,
} from '../src/features/training/sync/workoutSync.ts'
import { access, scope, now, stored, receipt } from './fixtures/workout.ts'
import type { SaveWorkout } from '../src/features/training/storage/workoutStore.ts'
async function queued() {
  const { store, d } = await stored()
  const q = await queueWorkout(d, 1, 'op-1', now)
  await store.compareAndSet({ ...q, generation: 1 }, 0)
  return { store, d: q }
}
test('replay is disabled until integrated access acceptance and fails closed across all scope boundaries', async () => {
  const { store, d } = await queued()
  let calls = 0
  await new WorkoutSync(store, scope, {
    access: async () => access,
    save: async () => {
      calls++
      throw Error('unexpected')
    },
  }).replay(d.key)
  assert.equal(calls, 0)
  for (const changed of [
    { ...access, organizationId: 'other' },
    { ...access, userId: 'other' },
    { ...access, branches: [] },
    { ...access, capabilities: [] },
    { ...access, accessMode: 'export-only', capabilities: ['export-own-records'] },
  ] as (typeof access)[])
    assert.equal(canEditWorkout(scope, changed), false)
  await new WorkoutSync(
    store,
    { ...scope, actorId: 'other' },
    {
      access: async () => access,
      save: async () => {
        calls++
        return null
      },
    },
    true,
  ).replay(d.key)
  assert.equal(calls, 0)
})
test('response loss replays exact operation after reload and edits become accepted-revision successors', async () => {
  const { store, d } = await queued()
  const sent: SaveWorkout[] = []
  let responseLost = true
  const transport = {
    access: async () => access,
    save: async (p: SaveWorkout) => {
      sent.push(p)
      if (responseLost) {
        responseLost = false
        throw new TypeError('Network response lost')
      }
      return receipt(p)
    },
  }
  await assert.rejects(new WorkoutSync(store, scope, transport, true).replay(d.key), /lost/)
  assert.equal((await store.read(d.key))?.operations[0].state, 'sending')
  let local = (await store.read(d.key))!
  local.content.notes = 'edit while response uncertain'
  await store.compareAndSet({ ...local, generation: local.generation + 1 }, local.generation)
  await new WorkoutSync(store, scope, transport, true).replay(d.key)
  assert.deepEqual(sent[0], sent[1])
  assert.equal(sent[1].operationId, 'op-1')
  local = (await store.read(d.key))!
  assert.equal(local.content.notes, 'edit while response uncertain')
  assert.equal(local.accepted?.content.notes, '')
  const successor = await queueWorkout(local, 1, 'op-2', now)
  assert.equal(successor.operations[1].payload.expectedRevision, 1)
  assert.equal(successor.operations[1].predecessorOperationId, 'op-1')
  assert.equal(successor.operations[1].payload.content.explicitCompletion, false)
  await store.compareAndSet({ ...successor, generation: local.generation + 1 }, local.generation)
  await new WorkoutSync(store, scope, transport, true).replay(d.key)
  assert.equal((await store.read(d.key))?.accepted?.revision, 2)
})
test('concurrent local edit during a slow send survives metadata acknowledgement', async () => {
  const { store, d } = await queued()
  let release!: () => void
  let started!: () => void
  const begin = new Promise<void>((r) => {
    started = r
  })
  const wait = new Promise<void>((r) => {
    release = r
  })
  const runner = new WorkoutSync(
    store,
    scope,
    {
      access: async () => access,
      save: async (p) => {
        started()
        await wait
        return receipt(p)
      },
    },
    true,
  )
  const pending = runner.replay(d.key)
  await begin
  const local = (await store.read(d.key))!
  await store.compareAndSet(
    {
      ...local,
      content: { ...local.content, notes: 'during send' },
      generation: local.generation + 1,
    },
    local.generation,
  )
  release()
  await pending
  const latest = (await store.read(d.key))!
  assert.equal(latest.content.notes, 'during send')
  assert.equal(latest.operations[0].state, 'accepted')
})
test('revocation and changed access revision block replay, retaining an owner-exportable payload', async () => {
  for (const revoked of [
    { ...access, accessMode: 'export-only', capabilities: ['export-own-records'] } as typeof access,
    { ...access, accessRevision: 2 },
  ]) {
    const { store, d } = await queued()
    let sent = false
    await new WorkoutSync(
      store,
      scope,
      {
        access: async () => revoked,
        save: async () => {
          sent = true
        },
      },
      true,
    ).replay(d.key)
    assert.equal(sent, false)
    const local = (await store.read(d.key))!
    assert.equal(local.problem?.kind, 'blocked')
    assert.equal(local.operations[0].state, 'access-revoked')
    assert.deepEqual(local.operations[0].payload, d.operations[0].payload)
  }
})
test('CAS conflict and catalog withdrawal retain local work without logout or automatic overwrite', async () => {
  for (const failure of [
    { status: 409, code: 'REVISION_CONFLICT', message: 'stale' },
    {
      status: 409,
      code: 'INVALID_INPUT',
      message: 'withdrawn',
      issues: [{ code: 'unavailable', message: 'target withdrawn' }],
    },
  ]) {
    const { store, d } = await queued()
    await new WorkoutSync(
      store,
      scope,
      {
        access: async () => access,
        save: async () => {
          throw failure
        },
      },
      true,
    ).replay(d.key)
    const local = (await store.read(d.key))!
    assert.equal(local.problem?.kind, failure.code === 'INVALID_INPUT' ? 'unavailable' : 'conflict')
    assert.deepEqual(local.content, d.content)
    assert.deepEqual(local.operations[0].payload, d.operations[0].payload)
    const remote = (
      await receipt({ ...d.operations[0].payload, operationId: 'remote', expectedRevision: 1 })
    ).session
    const resolved = resolveWorkoutConflict(local, remote, 'local')
    assert.equal(resolved.operations.length, 1)
    assert.deepEqual(resolved.supersededOperationIds, ['op-1'])
    assert.deepEqual(resolved.recovery, [local.content])
    resolved.content.notes = 'explicit corrected retry'
    const successor = await queueWorkout(resolved, 1, 'op-next', now)
    assert.equal(successor.operations[1].payload.expectedRevision, 2)
    assert.equal(successor.operations[1].predecessorOperationId, 'remote')
  }
})
test('late acknowledgement after account/brand/branch departure cannot repopulate local state', async () => {
  const { store, d } = await queued()
  let release!: () => void
  let started!: () => void
  const begin = new Promise<void>((r) => {
    started = r
  })
  const wait = new Promise<void>((r) => {
    release = r
  })
  const runner = new WorkoutSync(
    store,
    scope,
    {
      access: async () => access,
      save: async (p) => {
        started()
        await wait
        return receipt(p)
      },
    },
    true,
  )
  const pending = runner.replay(d.key)
  await begin
  runner.cancel()
  release()
  await assert.rejects(pending, /Departed/)
  assert.equal((await store.read(d.key))?.accepted, null)
})
test('a mismatched receipt never reports synchronization', async () => {
  const { store, d } = await queued()
  await assert.rejects(
    new WorkoutSync(
      store,
      scope,
      {
        access: async () => access,
        save: async (p) => {
          const r = await receipt(p)
          return { ...r, receipt: { ...r.receipt, requestHash: '0'.repeat(64) } }
        },
      },
      true,
    ).replay(d.key),
    /does not match/,
  )
  assert.equal((await store.read(d.key))?.accepted, null)
})
