import assert from 'node:assert/strict'
import test from 'node:test'
import { canonicalJson } from '@klisteniapp/b2b-domain/sessions'
import { createProductV2Client } from '@klisteniapp/b2b-client'
import { createWorkoutClient } from '../src/features/training/sync/workoutClient.ts'
import {
  createBoundWorkoutDocument,
  loadSessionWorkout,
  restoreOfflineSessionWorkout,
} from '../src/features/training/sync/sessionWorkoutBinding.ts'
import {
  firstCorrectionProblem,
  confirmLegacyEntry,
  legacySetKey,
  validateWorkoutBinding,
} from '../src/features/training/sync/workoutPrescription.ts'
import {
  queueWorkout,
  WorkoutSync,
  resolveWorkoutConflict,
} from '../src/features/training/sync/workoutSync.ts'
import { prepareWorkoutContent } from '../src/features/training/sync/workoutEdit.ts'
import {
  parseWorkoutDocument,
  assertWorkoutTransition,
} from '../src/features/training/storage/workoutStore.ts'
import { legacyBinding, legacySelection, ids } from './fixtures/legacyWorkout.ts'
import { MemoryWorkoutStore, now, access, receipt } from './fixtures/workout.ts'
import { recoveryContext } from './fixtures/workoutRecovery.ts'
const signal = () => new AbortController().signal
const create = (manual = false) =>
  createBoundWorkoutDocument(legacySelection, legacyBinding(manual), ids(), now)
const options = (store: MemoryWorkoutStore) => ({
  ...legacySelection,
  store,
  signal: signal(),
  createId: ids(),
  now,
})
test('first correction retains original revision zero separately, unspecified load and exact execution linkage without accepted/completed invention', () => {
  const binding = legacyBinding(),
    original = JSON.stringify(binding.original),
    d = create()
  assert.equal(d.accepted, null)
  assert.equal(d.id, binding.original!.original.id)
  assert.equal(d.origin.kind, 'legacy')
  assert.deepEqual(d.origin, legacySelection.origin)
  assert.equal(d.content.status, 'partial')
  assert.equal(d.content.explicitCompletion, false)
  assert.deepEqual(d.content.segments[0].dose.load, { mode: 'unspecified' })
  assert.equal(d.content.sets[0].repetitions, 7)
  assert.equal(d.content.sets[0].loadKg, null)
  assert.equal(JSON.stringify(d.binding!.original), original)
  assert.equal(d.binding!.prescription.kind, 'legacy-compatibility')
})
test('revision-zero queue requires reason and authoritative original; autosave cannot send an empty correction', async () => {
  const d = create()
  await assert.rejects(queueWorkout(d, 2, 'op', now), /motivo/)
  const corrected = { ...d, content: { ...d.content, correctionReason: 'Correcting actuals' } }
  const q = await queueWorkout(corrected, 2, 'op', now)
  assert.equal(q.operations[0].payload.expectedRevision, 0)
  assert.deepEqual(q.operations[0].payload.origin, legacySelection.origin)
  assert.equal(q.operations[0].payload.content.explicitCompletion, false)
  const unbound = { ...corrected }
  delete unbound.binding
  await assert.rejects(queueWorkout(unbound, 2, 'op', now), /vínculo original/)
})
test('manual variants preserve original evidence and require entered then explicitly confirmed correction entries', async () => {
  const d = create(true),
    key = legacySetKey(d.binding!.original!.original.sets[0])
  d.content.correctionReason = 'Manual variant needs a correction'
  assert.equal(d.content.sets.length, 0)
  assert.equal(
    d.content.segments.some((s) => s.exerciseId === 'manual-target'),
    false,
  )
  await assert.rejects(queueWorkout(d, 2, 'op', now), /corrección explícita/)
  assert.throws(() => confirmLegacyEntry(d, key), /Enter/)
  d.content.sets.push({
    performedSetId: 'entered',
    segmentId: d.content.segments[0].segmentId,
    ordinal: 1,
    side: 'both',
    repetitions: 5,
    durationSeconds: null,
    loadKg: null,
    rpe: null,
    notes: 'Explicitly corrected source actual',
  })
  await assert.rejects(queueWorkout(d, 2, 'op', now), /corrección explícita/)
  const confirmed = confirmLegacyEntry(d, key)
  const q = await queueWorkout(confirmed, 2, 'op', now)
  assert.equal(q.operations.length, 1)
  assert.equal(q.binding!.original!.original.sets[0].exerciseId, 'manual-target')
  assert.equal(
    firstCorrectionProblem({ ...confirmed, content: { ...confirmed.content, sets: [] } })?.includes(
      'corrección explícita',
    ),
    true,
  )
})
test('binding reader uses exact amendment007 endpoint/current headers and rejects foreign originals before mutation', async () => {
  let request: { url: string; headers: Headers } | undefined
  const io = createWorkoutClient((signal) =>
    createProductV2Client('member', 'gym', {
      signal,
      role: 'member',
      branchId: 'east',
      fetch: async (url, init) => {
        request = { url: String(url), headers: new Headers(init?.headers) }
        return Response.json(legacyBinding())
      },
    }),
  )
  assert.equal((await io.sessionBinding(legacySelection.id, signal())).accepted, null)
  assert.equal(request!.url, '/api/b2b/orgs/gym/product/v2/sessions/original-execution/binding')
  assert.equal(request!.headers.get('X-Klisteni-B2B-Branch'), 'east')
  await assert.rejects(io.sessionBinding('foreign', signal()), /Foreign/)
  for (const selection of [
    { ...legacySelection, id: 'other' },
    { ...legacySelection, scope: { ...legacySelection.scope, branchId: 'west' } },
    {
      ...legacySelection,
      origin: {
        ...legacySelection.origin,
        routine: { ...legacySelection.origin.routine, version: 2 },
      },
    },
  ])
    assert.throws(() => validateWorkoutBinding(selection, legacyBinding()), /Foreign/)
})
test('reload and response loss retain exact operation ID/hash/body and append only one accepted correction', async () => {
  const store = new MemoryWorkoutStore(),
    d = create()
  d.content.correctionReason = 'Correcting actuals'
  const q = await queueWorkout(d, 2, 'immutable-first', now)
  await store.compareAndSet(q, null)
  const before = canonicalJson(q.operations[0]),
    requests: unknown[] = []
  const transport = {
    access: async () => ({ ...access, accessRevision: 2 }),
    save: async (input: (typeof q.operations)[number]['payload']) => {
      requests.push(structuredClone(input))
      if (requests.length === 1) throw new Error('response lost')
      return receipt(input)
    },
  }
  await assert.rejects(new WorkoutSync(store, d.scope, transport, true).replay(d.key), /lost/)
  const loaded = await loadSessionWorkout({
    ...options(store),
    readBinding: async () => legacyBinding(),
  })
  assert.equal(canonicalJson({ ...loaded.initial.operations[0], state: 'queued' }), before)
  await new WorkoutSync(store, d.scope, transport, true).replay(d.key)
  assert.deepEqual(requests[0], requests[1])
  const saved = (await store.read(d.key))!
  assert.equal(saved.accepted!.revision, 1)
  assert.deepEqual(saved.binding!.original, d.binding!.original)
  assert.equal(saved.content.explicitCompletion, false)
})
test('accepted correction after later adoption uses the binding compatibility, never a current global supplement reader', async () => {
  const store = new MemoryWorkoutStore(),
    d = create()
  d.content.correctionReason = 'Correct actuals'
  const accepted = (
    await receipt({
      id: d.id,
      origin: d.origin,
      content: d.content,
      expectedRevision: 0,
      operationId: 'accepted',
    })
  ).session
  const prior = { ...d, accepted }
  await store.compareAndSet(prior, null)
  let calls = 0
  const retained = { ...legacyBinding(), accepted }
  const loaded = await loadSessionWorkout({
    ...options(store),
    readBinding: async () => {
      calls++
      return retained
    },
  })
  assert.equal(calls, 1)
  assert.equal(loaded.prescription.kind, 'legacy-compatibility')
  assert.deepEqual(loaded.initial.content.segments[0].dose.load, { mode: 'unspecified' })
  assert.equal(loaded.initial.accepted!.revision, 1)
  assert.deepEqual(loaded.initial.content, d.content)
})
test('concurrent accepted revision produces explicit CAS recovery while pending bytes and original survive', async () => {
  const store = new MemoryWorkoutStore(),
    d = create()
  d.content.correctionReason = 'Correct actuals'
  const q = await queueWorkout(d, 2, 'local-pending', now)
  await store.compareAndSet(q, null)
  const remote = (
    await receipt({
      ...q.operations[0].payload,
      operationId: 'remote',
      content: { ...d.content, notes: 'Other device' },
    })
  ).session
  const loaded = await loadSessionWorkout({
    ...options(store),
    readBinding: async () => ({ ...legacyBinding(), accepted: remote }),
  })
  assert.equal(loaded.initial.problem?.kind, 'conflict')
  assert.deepEqual(loaded.initial.operations, q.operations)
  const local = resolveWorkoutConflict(loaded.initial, remote, 'local')
  assert.deepEqual(local.content, q.content)
  assert.deepEqual(local.binding!.original, d.binding!.original)
  const next = await queueWorkout(local, 2, 'successor', now)
  assert.equal(next.operations[1].payload.expectedRevision, 1)
  assert.equal(next.operations[1].predecessorOperationId, 'remote')
})
test('response-loss binding recognizing the exact accepted operation leaves retry identity and content intact', async () => {
  const store = new MemoryWorkoutStore(),
    d = create()
  d.content.correctionReason = 'Correct actuals'
  const q = await queueWorkout(d, 2, 'lost', now)
  await store.compareAndSet(q, null)
  const accepted = (await receipt(q.operations[0].payload)).session
  const loaded = await loadSessionWorkout({
    ...options(store),
    readBinding: async () => ({ ...legacyBinding(), accepted }),
  })
  assert.equal(loaded.initial.accepted, null)
  assert.equal(loaded.initial.problem, null)
  assert.deepEqual(loaded.initial.operations, q.operations)
})
test('offline restore requires persisted binding and exact current owner/branch/realm, without guessing missing metadata', async () => {
  const store = new MemoryWorkoutStore(),
    context = recoveryContext('realm-a')
  const selection = {
    ...legacySelection,
    scope: { ...legacySelection.scope, realm: context.bootstrap.realm, origin: context.origin },
  }
  const d = createBoundWorkoutDocument(selection, legacyBinding(), ids(), now)
  await store.compareAndSet(d, null)
  assert.equal(
    (await restoreOfflineSessionWorkout(store, context, selection)).initial.accepted,
    null,
  )
  for (const changed of [
    { ...context, branchId: 'retired' },
    {
      ...context,
      bootstrap: { ...context.bootstrap, realm: { ...context.bootstrap.realm, key: 'other' } },
    },
  ])
    await assert.rejects(restoreOfflineSessionWorkout(store, changed, selection))
  const old = { ...d, generation: 1 }
  delete old.binding
  await assert.rejects(store.compareAndSet(old, 0), /original/)
})
test('cancelled binding load and concurrent local edit never overwrite an existing draft', async () => {
  const store = new MemoryWorkoutStore(),
    d = create()
  await store.compareAndSet(d, null)
  const controller = new AbortController()
  await assert.rejects(
    loadSessionWorkout({
      ...options(store),
      signal: controller.signal,
      readBinding: async () => {
        controller.abort()
        return legacyBinding()
      },
    }),
    /abort/i,
  )
  assert.deepEqual(await store.read(d.key), d)
  await assert.rejects(
    loadSessionWorkout({
      ...options(store),
      readBinding: async () => {
        await store.compareAndSet(
          { ...d, generation: 1, content: { ...d.content, notes: 'Other tab' } },
          0,
        )
        return {
          ...legacyBinding(),
          accepted: (
            await receipt({
              id: d.id,
              origin: d.origin,
              content: d.content,
              expectedRevision: 0,
              operationId: 'remote',
            })
          ).session,
        }
      },
    }),
    /another tab|changed|LocalWorkoutConflict/i,
  )
  assert.equal((await store.read(d.key))!.content.notes, 'Other tab')
})
test('legacy original evidence is immutable and saving partial cannot inherit original completion', () => {
  const d = create()
  assert.equal(
    prepareWorkoutContent(
      d,
      d.binding!.prescription.kind === 'reviewed'
        ? d.binding!.prescription.routine
        : d.binding!.prescription,
      false,
    ).explicitCompletion,
    false,
  )
  const altered = structuredClone(d)
  altered.binding!.original!.original.notes = 'Changed'
  assert.throws(() => assertWorkoutTransition(d, altered), /original/)
  assert.deepEqual(parseWorkoutDocument(d).binding, d.binding)
})

test('an older revision-zero payload with blank reason is retained but never sent or logged out', async () => {
  const store = new MemoryWorkoutStore(),
    d = create()
  d.content.correctionReason = 'Initially valid'
  const q = await queueWorkout(d, 1, 'old-pending', now)
  // Simulate an existing frozen producer payload, before this UI reason gate.
  q.operations[0].payload.content.correctionReason = ''
  const { workoutRequestHash } = await import('../src/features/training/sync/workoutSync.ts')
  q.operations[0].requestHash = await workoutRequestHash(q.scope, q.operations[0].payload)
  await store.compareAndSet(q, null)
  const bytes = canonicalJson(q.operations[0].payload)
  let saves = 0
  await new WorkoutSync(
    store,
    q.scope,
    {
      access: async () => access,
      save: async () => {
        saves++
        throw new Error('must not send')
      },
    },
    true,
  ).replay(q.key)
  const preserved = (await store.read(q.key))!
  assert.equal(saves, 0)
  assert.equal(preserved.problem?.kind, 'invalid')
  assert.equal(canonicalJson(preserved.operations[0].payload), bytes)
  assert.equal(preserved.operations[0].operationId, 'old-pending')
})

test('later unfinished edits do not block exact replay of an already valid immutable first correction', async () => {
  const store = new MemoryWorkoutStore(),
    d = create()
  d.content.correctionReason = 'Valid frozen reason'
  const q = await queueWorkout(d, 1, 'frozen', now)
  q.content.correctionReason = ''
  assert.equal(await queueWorkout(q, 1, 'must-not-replace', now), q)
  await store.compareAndSet(q, null)
  let body: unknown
  await new WorkoutSync(
    store,
    q.scope,
    {
      access: async () => access,
      save: async (input) => {
        body = input
        return receipt(input)
      },
    },
    true,
  ).replay(q.key)
  assert.deepEqual(body, q.operations[0].payload)
  assert.equal((await store.read(q.key))!.content.correctionReason, '')
  assert.equal((await store.read(q.key))!.accepted!.content.correctionReason, 'Valid frozen reason')
})
