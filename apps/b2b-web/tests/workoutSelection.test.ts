import assert from 'node:assert/strict'
import test from 'node:test'
import { createProductV2Client } from '@klisteniapp/b2b-client'
import { loadSelectedWorkout, type WorkoutSelection } from '../src/app/workoutSelection.ts'
import { createBoundWorkoutDocument } from '../src/features/training/sync/sessionWorkoutBinding.ts'
import {
  recoveryWorkoutScope,
  adoptUnboundWorkout,
} from '../src/features/training/storage/selectedWorkoutRecovery.ts'
import {
  unboundWorkoutScope,
  workoutKey,
} from '../src/features/training/storage/workoutIdentity.ts'
import {
  MemoryRecoveryStore,
  recoveryContext,
  legacyRecoveryDraft,
} from './fixtures/workoutRecovery.ts'
import { legacyBinding, legacyOrigin, ids } from './fixtures/legacyWorkout.ts'
import { routine, now } from './fixtures/workout.ts'

function setup(binding: Response | (() => Response | never), selection: WorkoutSelection) {
  const context = recoveryContext(),
    store = new MemoryRecoveryStore(),
    calls: string[] = []
  const createClient = (signal?: AbortSignal) =>
    createProductV2Client('member', 'gym', {
      branchId: 'east',
      role: 'member',
      signal,
      fetch: async (input) => {
        const path = String(input)
        calls.push(path)
        if (path.endsWith('/binding'))
          return typeof binding === 'function' ? binding() : binding.clone()
        if (path.endsWith('/workout-equipment')) return Response.json({ activeMachineIds: [] })
        if (path.endsWith('/versions/1'))
          return Response.json({ schemaVersion: 2, snapshot: routine })
        if (path.endsWith('/sessions')) return Response.json([])
        throw new Error(`Unexpected mutable read: ${path}`)
      },
    })
  return {
    context,
    store,
    calls,
    run: () =>
      loadSelectedWorkout({
        context,
        store,
        selection,
        createClient,
        signal: context.signal,
      }),
  }
}
const missing = () => Response.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })

test('root first correction uses the authoritative original binding without supplement or alternatives reads', async () => {
  const f = setup(Response.json(legacyBinding()), {
    id: 'original-execution',
    origin: legacyOrigin,
  })
  const result = await f.run()
  assert.equal(result.kind, 'workout')
  if (result.kind !== 'workout') return
  assert.equal(result.initial.accepted, null)
  assert.equal(result.initial.id, 'original-execution')
  assert.equal(result.initial.binding?.original?.original.id, 'original-execution')
  assert.equal(result.prescription.kind, 'legacy-compatibility')
  assert.equal(result.initial.content.explicitCompletion, false)
  assert.equal(f.calls.length, 2)
})

test('root resumes a chooser-created durable legacy ID only after an actual missing binding', async () => {
  const document = legacyRecoveryDraft()
  const f = setup(missing(), { id: document.id, origin: document.origin })
  await f.store.compareAndSet(document, null)
  const before = JSON.stringify(document)
  const result = await f.run()
  assert.equal(result.kind, 'workout')
  if (result.kind !== 'workout') return
  assert.equal(JSON.stringify(result.initial), before)
  assert.equal(result.prescription.kind, 'reviewed')
  assert.equal(f.calls[0].endsWith('/binding'), true)
})

test('root denial cannot fall back to a new legacy prescription or replace local data', async () => {
  const document = legacyRecoveryDraft()
  const f = setup(Response.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }), {
    id: document.id,
    origin: document.origin,
  })
  await f.store.compareAndSet(document, null)
  await assert.rejects(f.run())
  assert.equal(f.calls.length, 1)
  assert.deepEqual(await f.store.read(document.key), document)
})

test('missing original execution never creates a replacement session', async () => {
  const f = setup(missing(), { id: 'original-execution', origin: legacyOrigin })
  await assert.rejects(f.run())
  assert.equal(f.calls.length, 1)
  assert.equal(f.store.documents.size, 0)
})

test('temporary disconnect can reopen only a persisted authoritative binding in the current realm', async () => {
  const f = setup(
    () => {
      throw new TypeError('Offline')
    },
    { id: 'original-execution', origin: legacyOrigin },
  )
  const document = createBoundWorkoutDocument(
    { scope: recoveryWorkoutScope(f.context), id: 'original-execution', origin: legacyOrigin },
    legacyBinding(),
    ids(),
    now,
  )
  await f.store.compareAndSet(document, null)
  const result = await f.run()
  assert.equal(result.kind, 'workout')
  if (result.kind !== 'workout') return
  assert.equal(result.offline, true)
  assert.deepEqual(result.initial, document)
  assert.deepEqual(result.equipment.activeMachineIds, [])
})

test('temporary disconnect without a persisted binding never authorizes new work', async () => {
  const document = legacyRecoveryDraft()
  const f = setup(
    () => {
      throw new TypeError('Offline')
    },
    { id: document.id, origin: document.origin },
  )
  await f.store.compareAndSet(document, null)
  await assert.rejects(f.run(), /No retained session binding/)
  assert.equal(f.calls.length, 1)
})

test('pre-realm work is shown as an explicit recovery choice without mutation or send', async () => {
  const f = setup(Response.json(legacyBinding()), {
    id: 'original-execution',
    origin: legacyOrigin,
  })
  const scope = unboundWorkoutScope(recoveryWorkoutScope(f.context))
  const document = createBoundWorkoutDocument(
    { scope, id: 'original-execution', origin: legacyOrigin },
    legacyBinding(),
    ids(),
    now,
  )
  await f.store.compareAndSet(document, null)
  const result = await f.run()
  assert.equal(result.kind, 'unbound')
  assert.equal(f.calls.length, 0)
  assert.deepEqual(await f.store.read(workoutKey(scope, document.id)), document)
  assert.equal(f.store.commits, 0)
  const adopted = await adoptUnboundWorkout(f.store, f.context, document)
  assert.equal(adopted.document.id, document.id)
  const resumed = await f.run()
  assert.equal(resumed.kind, 'workout')
  if (resumed.kind === 'workout')
    assert.deepEqual(resumed.initial.binding?.original, document.binding?.original)
  assert.deepEqual(await f.store.read(document.key), document)
})

test('new occurrence identity is stable and requires authoritative absence before immutable prescription reads', async () => {
  const selection: WorkoutSelection = {
    origin: {
      kind: 'occurrence',
      occurrenceId: 'occurrence',
      routine: { programId: 'routine', version: 1, schemaVersion: 2 },
    },
  }
  const f = setup(missing(), selection)
  const first = await f.run(),
    second = await f.run()
  assert.equal(first.kind, 'workout')
  assert.equal(second.kind, 'workout')
  if (first.kind !== 'workout' || second.kind !== 'workout') return
  assert.equal(first.initial.id, second.initial.id)
  assert.equal(first.initial.scope.realm?.key, 'realm-a')
  assert.equal(f.calls[1].endsWith('/binding'), true)
  assert.equal(f.calls[2].endsWith('/versions/1'), true)
  assert.equal(first.initial.content.explicitCompletion, false)
})
