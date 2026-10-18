import assert from 'node:assert/strict'
import test from 'node:test'
import {
  authenticatedRecoveryOwner,
  restoreSelectedWorkout,
  rememberSelectedWorkout,
  exportSelectedOwnerWorkout,
  mayResumeSelectedWorkout,
  legacyWorkoutChoices,
  resumeLegacyWorkout,
  startNewLegacyWorkout,
} from '../src/features/training/storage/selectedWorkoutRecovery.ts'
import { recoveryOwnerKey } from '../src/features/training/storage/recoverySelection.ts'
import {
  workoutKey,
  unboundWorkoutScope,
} from '../src/features/training/storage/workoutIdentity.ts'
import { queueWorkout } from '../src/features/training/sync/workoutSync.ts'
import {
  MemoryRecoveryStore,
  recoveryContext,
  legacyRecoveryDraft,
  legacyAssignment,
} from './fixtures/workoutRecovery.ts'
import { routine, now, receipt } from './fixtures/workout.ts'

async function selectedPending() {
  const context = recoveryContext(),
    store = new MemoryRecoveryStore(),
    initial = legacyRecoveryDraft(context)
  const document = await queueWorkout(initial, 1, 'original-operation', now)
  await store.compareAndSet(document, null)
  const selected = await rememberSelectedWorkout(store, context, {
    scope: document.scope,
    id: document.id,
  })
  return { context, store, document, selected }
}
test('inactive branchless reload resolves only the durable realm/owner pointer and keeps exact pending bytes', async () => {
  const { context, store, document } = await selectedPending()
  const inactive = structuredClone({ bootstrap: context.bootstrap, access: context.access })
  inactive.bootstrap.memberships[0].accessMode = 'export-only'
  inactive.bootstrap.memberships[0].choices = []
  inactive.bootstrap.memberships[0].accessRevision = 2
  inactive.access.accessMode = 'export-only'
  inactive.access.accessRevision = 2
  inactive.access.branches = []
  inactive.access.capabilities = ['export-own-records']
  const reloaded = { ...context, ...inactive, branchId: '', signal: new AbortController().signal }
  const selected = await restoreSelectedWorkout(store, reloaded)
  assert.equal(selected?.document.key, document.key)
  assert.equal(JSON.stringify(selected?.document.operations), JSON.stringify(document.operations))
  assert.equal(mayResumeSelectedWorkout(reloaded, selected!.document), false)
  const before = structuredClone(store.documents)
  const exported = JSON.parse((await exportSelectedOwnerWorkout(store, reloaded))!)
  assert.equal(exported.serverConfirmed, false)
  assert.equal(exported.operations[0].operationId, 'original-operation')
  assert.deepEqual(store.documents, before)
})
test('account, origin, organization, realm key and realm mode changes cannot recover another selection', async () => {
  const { context, store } = await selectedPending()
  for (const changed of [
    { ...context, origin: 'https://other.example' },
    recoveryContext('realm-b'),
    {
      ...context,
      bootstrap: { ...context.bootstrap, realm: { mode: 'unified' as const, key: 'realm-a' } },
    },
    {
      ...context,
      bootstrap: { ...context.bootstrap, user: { ...context.bootstrap.user, id: 'other' } },
      access: { ...context.access, userId: 'other' },
    },
    {
      ...context,
      bootstrap: {
        ...context.bootstrap,
        memberships: context.bootstrap.memberships.map((m) => ({ ...m, organizationId: 'other' })),
      },
      access: { ...context.access, organizationId: 'other' },
    },
  ])
    assert.equal(await restoreSelectedWorkout(store, changed), null)
  assert.equal(store.commits, 1)
})
test('a pointer is not an authority or a fabricated document; tampered/missing records fail closed and stay preserved', async () => {
  const { context, store, selected } = await selectedPending()
  const owner = authenticatedRecoveryOwner(context),
    key = recoveryOwnerKey(owner)
  store.pointers.set(key, {
    ...selected.pointer,
    id: 'foreign',
    documentKey: workoutKey(selected.document.scope, 'foreign'),
  })
  await assert.rejects(restoreSelectedWorkout(store, context), /missing/)
  assert.equal(store.pointers.get(key)?.id, 'foreign')
  store.pointers.set(key, {
    ...selected.pointer,
    scope: { ...selected.pointer.scope, actorId: 'foreign' },
  })
  await assert.rejects(restoreSelectedWorkout(store, context), /owner realm/)
  store.pointers.set(key, selected.pointer)
  const altered = structuredClone(selected.document)
  altered.origin = { ...altered.origin, routine: { ...altered.origin.routine, version: 2 } }
  store.documents.set(altered.key, altered)
  await assert.rejects(restoreSelectedWorkout(store, context), /identity mismatch/)
})
test('selection CAS refuses a delayed competing selection and quota failure leaves the old pointer intact', async () => {
  const { context, store, selected } = await selectedPending()
  const next = legacyRecoveryDraft(context, 'next-session')
  await store.compareAndSet(next, null)
  const input = {
    owner: authenticatedRecoveryOwner(context),
    scope: next.scope,
    id: next.id,
    expectedPointerGeneration: selected.pointer.generation,
    expectedDocumentGeneration: next.generation,
  }
  const outcomes = await Promise.allSettled([
    store.commitSelection(input, context.signal),
    store.commitSelection(input, context.signal),
  ])
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
  const before = structuredClone(store.pointers)
  store.fail = true
  await assert.rejects(
    store.commitSelection(
      { ...input, expectedPointerGeneration: selected.pointer.generation + 1 },
      context.signal,
    ),
    /quota/,
  )
  assert.deepEqual(store.pointers, before)
})
test('context departure while recovery is read prevents returned private work or export', async () => {
  const { context, store } = await selectedPending()
  const controller = new AbortController()
  const original = store.selected.bind(store)
  let release!: () => void
  const wait = new Promise<void>((resolve) => {
    release = resolve
  })
  store.selected = async (owner, signal) => {
    const result = await original(owner, signal)
    await wait
    return result
  }
  const pending = exportSelectedOwnerWorkout(store, { ...context, signal: controller.signal })
  controller.abort()
  release()
  await assert.rejects(
    pending,
    (error) => error instanceof DOMException && error.name === 'AbortError',
  )
})
test('retired branch/grant context may export owned work but cannot resume or change durable selection', async () => {
  const { context, store, document } = await selectedPending()
  const retired = {
    ...context,
    access: { ...context.access, branches: [] },
    bootstrap: {
      ...context.bootstrap,
      memberships: context.bootstrap.memberships.map((m) => ({ ...m, choices: [] })),
    },
  }
  const selected = await restoreSelectedWorkout(store, retired)
  assert.equal(mayResumeSelectedWorkout(retired, selected!.document), false)
  await assert.rejects(
    rememberSelectedWorkout(store, retired, { scope: document.scope, id: document.id }),
    /current member context/,
  )
  assert.ok(await exportSelectedOwnerWorkout(store, retired))
  assert.equal(store.commits, 1)
})
test('legacy inspection makes no selection; explicit resume retains IDs/bytes and explicit new creates separate durable work', async () => {
  const { context, store, document } = await selectedPending()
  const before = JSON.stringify(document.operations)
  const inspected = await legacyWorkoutChoices(store, context, legacyAssignment)
  assert.equal(inspected.choices.length, 1)
  assert.equal(inspected.canStartNew, true)
  assert.equal(store.commits, 1)
  const resumed = await resumeLegacyWorkout(store, context, legacyAssignment, inspected.choices[0])
  assert.equal(resumed.document.id, document.id)
  assert.equal(JSON.stringify(resumed.document.operations), before)
  let ordinal = 0
  const fresh = await startNewLegacyWorkout(
    store,
    context,
    legacyAssignment,
    routine,
    () => `new-${++ordinal}`,
    now,
  )
  assert.equal(fresh.document.id, 'new-1')
  assert.equal(fresh.document.operations.length, 0)
  assert.equal(fresh.document.content.status, 'draft')
  assert.equal(JSON.stringify((await store.read(document.key))?.operations), before)
  assert.equal((await restoreSelectedWorkout(store, context))?.document.id, 'new-1')
})
test('explicit adoption of an old unbound draft copies exact operations while retaining its original realm-less bytes', async () => {
  const context = recoveryContext(),
    store = new MemoryRecoveryStore()
  const original = legacyRecoveryDraft(context)
  original.scope = unboundWorkoutScope(original.scope)
  original.key = workoutKey(original.scope, original.id)
  const old = await queueWorkout(original, 1, 'old-operation', now)
  await store.compareAndSet(old, null)
  const before = JSON.stringify(await store.read(old.key))
  const inspected = await legacyWorkoutChoices(store, context, legacyAssignment)
  assert.equal(inspected.choices[0].requiresRealmAdoption, true)
  const selected = await resumeLegacyWorkout(store, context, legacyAssignment, inspected.choices[0])
  assert.notEqual(selected.document.key, old.key)
  assert.deepEqual(selected.document.scope.realm, context.bootstrap.realm)
  assert.equal(JSON.stringify(selected.document.operations), JSON.stringify(old.operations))
  assert.equal(JSON.stringify(await store.read(old.key)), before)
  assert.equal(await restoreSelectedWorkout(store, recoveryContext('other-realm')), null)
})
test('stale resume choice cannot replace newer actuals or bind a changed unbound source', async () => {
  const { context, store, document } = await selectedPending()
  const inspected = await legacyWorkoutChoices(store, context, legacyAssignment)
  await store.compareAndSet(
    {
      ...document,
      generation: document.generation + 1,
      content: { ...document.content, notes: 'newer tab' },
    },
    document.generation,
  )
  await assert.rejects(
    resumeLegacyWorkout(store, context, legacyAssignment, inspected.choices[0]),
    /changed/,
  )
  assert.equal((await store.read(document.key))?.content.notes, 'newer tab')
})
test('retired assignment blocks genuinely new queued work; accepted partial corrections and uncertain exact replay remain explicit choices', async () => {
  const { context, store, document } = await selectedPending(),
    retired = { ...legacyAssignment, active: false }
  let inspected = await legacyWorkoutChoices(store, context, retired)
  assert.equal(inspected.canStartNew, false)
  assert.equal(inspected.choices[0].canResume, false)
  await assert.rejects(
    startNewLegacyWorkout(store, context, retired, routine, () => 'forbidden-new', now),
    /RETIRED/,
  )
  const sending = {
    ...document,
    operations: document.operations.map((op) => ({ ...op, state: 'sending' as const })),
  }
  await store.compareAndSet({ ...sending, generation: 1 }, 0)
  inspected = await legacyWorkoutChoices(store, context, retired)
  assert.equal(inspected.choices[0].canResume, true)
  const resumed = await resumeLegacyWorkout(store, context, retired, inspected.choices[0])
  assert.equal(resumed.document.operations[0].state, 'sending')
  const accepted = (await receipt(document.operations[0].payload)).session
  const latest = (await store.read(document.key))!
  await store.compareAndSet(
    {
      ...latest,
      generation: latest.generation + 1,
      accepted,
      content: { ...latest.content, status: 'partial' },
    },
    latest.generation,
  )
  assert.equal((await legacyWorkoutChoices(store, context, retired)).choices[0].canResume, true)
})
test('blocked v1 POST bytes are never translated or resumed automatically, and missing doses never create a new session', async () => {
  const { context, store, document } = await selectedPending()
  const bytes = JSON.stringify({
    id: 'old-execution',
    pending: { id: 'old-execution', status: 'completed', completedAt: now },
  })
  await store.compareAndSet(
    { ...document, generation: 1, legacyDraft: { key: 'old-key', bytes } },
    0,
  )
  const inspected = await legacyWorkoutChoices(store, context, legacyAssignment)
  assert.equal(inspected.choices[0].canResume, false)
  await assert.rejects(
    resumeLegacyWorkout(store, context, legacyAssignment, inspected.choices[0]),
    /LEGACY_POST/,
  )
  const before = store.documents.size
  await assert.rejects(
    startNewLegacyWorkout(
      store,
      context,
      legacyAssignment,
      {
        ...routine,
        steps: routine.steps.map((step) => ({
          ...step,
          dose: { ...step.dose, repetitions: null },
        })),
      },
      () => 'missing-dose',
      now,
    ),
  )
  assert.equal(store.documents.size, before)
  assert.equal((await store.read(document.key))?.legacyDraft?.bytes, bytes)
})

test('one explicit realm claim prevents the same old source from transferring to another realm', async () => {
  const { findUnboundWorkout, adoptUnboundWorkout } = await import(
    '../src/features/training/storage/selectedWorkoutRecovery.ts'
  )
  const context = recoveryContext(),
    store = new MemoryRecoveryStore(),
    source = legacyRecoveryDraft(context)
  source.scope = unboundWorkoutScope(source.scope)
  source.key = workoutKey(source.scope, source.id)
  await store.compareAndSet(source, null)
  assert.ok(await findUnboundWorkout(store, context, source.id, source.origin))
  const original = JSON.stringify(await store.read(source.key))
  const choices = await legacyWorkoutChoices(store, context, legacyAssignment)
  await resumeLegacyWorkout(store, context, legacyAssignment, choices.choices[0])
  const other = recoveryContext('other-realm')
  assert.equal(await findUnboundWorkout(store, other, source.id, source.origin), null)
  await assert.rejects(adoptUnboundWorkout(store, other, source), /already adopted/)
  assert.equal(JSON.stringify(await store.read(source.key)), original)
  assert.equal((await legacyWorkoutChoices(store, context, legacyAssignment)).choices.length, 1)
  assert.equal((await legacyWorkoutChoices(store, other, legacyAssignment)).choices.length, 0)
})
test('competing different-realm adoptions have one winner and preserve source operation bytes', async () => {
  const { adoptUnboundWorkout } = await import(
    '../src/features/training/storage/selectedWorkoutRecovery.ts'
  )
  const context = recoveryContext(),
    store = new MemoryRecoveryStore(),
    source = legacyRecoveryDraft(context)
  source.scope = unboundWorkoutScope(source.scope)
  source.key = workoutKey(source.scope, source.id)
  source.origin = {
    kind: 'occurrence',
    occurrenceId: 'issued-occurrence',
    routine: legacyAssignment.routine,
  }
  const queued = await queueWorkout(source, 1, 'old-uncertain', now)
  await store.compareAndSet(queued, null)
  const outcomes = await Promise.allSettled([
    adoptUnboundWorkout(store, context, queued),
    adoptUnboundWorkout(store, recoveryContext('realm-b'), queued),
  ])
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(store.claims.size, 1)
  assert.equal(
    JSON.stringify((await store.read(queued.key))?.operations),
    JSON.stringify(queued.operations),
  )
})
test('realm-bound operations cannot replay when supplied to another realm or a realm-less runner', async () => {
  const { WorkoutSync } = await import('../src/features/training/sync/workoutSync.ts')
  const { context, store, document } = await selectedPending()
  let sent = 0
  const transport = {
    access: async () => context.access,
    save: async () => {
      sent++
      return null
    },
  }
  await new WorkoutSync(
    store,
    { ...document.scope, realm: { mode: 'white-label', key: 'realm-b' } },
    transport,
    true,
  ).replay(document.key)
  await new WorkoutSync(store, unboundWorkoutScope(document.scope), transport, true).replay(
    document.key,
  )
  assert.equal(sent, 0)
  assert.equal((await store.read(document.key))?.operations[0].state, 'queued')
})
