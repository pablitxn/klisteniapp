import assert from 'node:assert/strict'
import test from 'node:test'
import type { Assignment } from '@klisteniapp/b2b-contracts/training'
import {
  changeDraftSet,
  createSessionDraft,
  discardConfirmedSession,
  isDefinitiveRejection,
  parseSessionDraft,
  prepareExecution,
  recoverSessionDraft,
  sessionDraftKey,
  substituteExercise,
} from '../src/features/training/sessionDraft.ts'

const timestamp = '2026-10-10T12:00:00.000Z'
const assignment: Assignment = {
  id: 'assignment-a',
  memberId: 'member-a',
  memberName: 'Ana',
  assignedBy: 'coach-a',
  createdAt: timestamp,
  program: {
    programId: 'program-a',
    version: 1,
    name: 'Training',
    description: '',
    publishedAt: timestamp,
    exercises: [],
    machines: [],
    steps: [
      {
        id: 'step-a',
        exerciseId: 'squat',
        sets: 2,
        reps: 12,
        durationSeconds: null,
        targetRpe: null,
        loadKg: 20,
        restSeconds: 60,
        alternatives: ['air-squat'],
        notes: '',
      },
      {
        id: 'step-b',
        exerciseId: 'plank',
        sets: 1,
        reps: 8,
        durationSeconds: null,
        targetRpe: null,
        loadKg: null,
        restSeconds: 60,
        alternatives: [],
        notes: '',
      },
    ],
  },
  availability: [
    {
      stepId: 'step-a',
      exercises: [
        { exerciseId: 'squat', status: 'available', equipment: 'rack' },
        { exerciseId: 'air-squat', status: 'available', equipment: 'none' },
      ],
    },
    {
      stepId: 'step-b',
      exercises: [{ exerciseId: 'plank', status: 'equipment-required', equipment: 'mat' }],
    },
  ],
}

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}

function completedDraft() {
  const draft = createSessionDraft(assignment, 'execution-a')
  return { ...draft, sets: draft.sets.map((set) => ({ ...set, done: true })) }
}

test('new drafts retain the assigned prescription and isolate recovery by gym, account and assignment', () => {
  const draft = createSessionDraft(assignment, 'execution-a')
  assert.deepEqual(
    draft.sets.map((set) => [set.stepId, set.set, set.exerciseId, set.reps, set.loadKg, set.done]),
    [
      ['step-a', 1, 'squat', 12, 20, false],
      ['step-a', 2, 'squat', 12, 20, false],
      ['step-b', 1, 'plank', 8, null, false],
    ],
  )
  const key = sessionDraftKey('gym-a', 'member-a', assignment.id)
  assert.equal(key, 'klisteni.b2b.session.v1.gym-a.member-a.assignment-a')
  assert.notEqual(key, sessionDraftKey('gym-b', 'member-a', assignment.id))
  assert.notEqual(key, sessionDraftKey('gym-a', 'member-b', assignment.id))
  assert.notEqual(key, sessionDraftKey('gym-a', 'member-a', 'assignment-b'))
})

test('recovery validates all prescribed sets and authorized alternatives instead of trusting JSON casts', () => {
  const draft = createSessionDraft(assignment, 'execution-a')
  const alternative = changeDraftSet(draft, 0, { exerciseId: 'air-squat', loadKg: null })
  assert.deepEqual(parseSessionDraft(alternative, assignment), alternative)
  const invalid = [
    null,
    [],
    {},
    { ...draft, assignmentId: 'another-assignment' },
    { ...draft, id: '../wrong' },
    { ...draft, notes: 'x'.repeat(2001) },
    { ...draft, sets: draft.sets.slice(1) },
    { ...draft, sets: [draft.sets[0], draft.sets[0], draft.sets[2]] },
    changeDraftSet(draft, 0, { exerciseId: 'unauthorized' }),
    changeDraftSet(draft, 0, { stepId: 'another-step' }),
    changeDraftSet(draft, 0, { set: 3 }),
    changeDraftSet(draft, 0, { reps: Number.POSITIVE_INFINITY }),
    changeDraftSet(draft, 0, { loadKg: Number.NaN }),
  ]
  for (const value of invalid) assert.equal(parseSessionDraft(value, assignment), null)
})

test('recovery preserves malformed original bytes and reports recovered only for valid drafts', () => {
  const device = storage()
  device.setItem('draft', '{broken-json')
  const fresh = recoverSessionDraft(
    device,
    'draft',
    assignment,
    () => 'new-execution',
    () => 100,
  )
  assert.equal(fresh.recovered, false)
  assert.equal(fresh.draft.id, 'new-execution')
  assert.equal(device.getItem('draft.recovery.100'), '{broken-json')
  assert.equal(device.getItem('draft'), '{broken-json')
  device.setItem('draft', JSON.stringify(fresh.draft))
  const recovered = recoverSessionDraft(device, 'draft', assignment, () => 'unused')
  assert.equal(recovered.recovered, true)
  assert.deepEqual(recovered.draft, fresh.draft)
})

test('disabled local storage does not prevent starting a session', () => {
  const blocked = {
    getItem: () => {
      throw new Error('Storage disabled')
    },
    setItem: () => {
      throw new Error('Storage disabled')
    },
  }
  const result = recoverSessionDraft(blocked, 'draft', assignment, () => 'new-execution')
  assert.equal(result.recovered, false)
  assert.equal(result.draft.id, 'new-execution')
})

test('substitution clears load, completion and the previous reason without changing prescription reps', () => {
  const original = changeDraftSet(createSessionDraft(assignment, 'execution-a'), 0, {
    done: true,
    reason: 'Earlier reason',
    rpe: 8,
  })
  const changed = changeDraftSet(original, 0, substituteExercise('air-squat'))
  assert.deepEqual(changed.sets[0], {
    stepId: 'step-a',
    set: 1,
    exerciseId: 'air-squat',
    reps: 12,
    durationSeconds: null,
    rpe: null,
    loadKg: null,
    done: false,
    reason: '',
  })
  assert.equal(original.sets[0].done, true)
  assert.equal(original.sets[0].loadKg, 20)
})

test('partial sessions include only performed sets; completed sessions require every set', () => {
  const draft = createSessionDraft(assignment, 'execution-a')
  assert.equal(prepareExecution(draft, assignment, 'partial', timestamp).ok, false)
  const performed = changeDraftSet(draft, 0, { done: true })
  assert.equal(prepareExecution(performed, assignment, 'completed', timestamp).ok, false)
  const partial = prepareExecution(performed, assignment, 'partial', timestamp)
  if (!partial.ok) assert.fail(partial.error)
  assert.equal(partial.payload.sets.length, 1)
  assert.equal(partial.payload.status, 'partial')
  assert.equal('done' in partial.payload.sets[0], false)
  const complete = prepareExecution(completedDraft(), assignment, 'completed', timestamp)
  assert.equal(complete.ok, true)
})

test('substitutions require a reason and invalid numeric input is rejected before sending', () => {
  const draft = changeDraftSet(completedDraft(), 0, { exerciseId: 'air-squat', reason: '  ' })
  const missingReason = prepareExecution(draft, assignment, 'completed', timestamp)
  assert.equal(missingReason.ok, false)
  if (missingReason.ok) assert.fail('Missing substitution reason was accepted')
  assert.match(missingReason.error, /motivo/)
  assert.equal(
    prepareExecution(
      changeDraftSet(draft, 0, { reason: 'Equipo ocupado' }),
      assignment,
      'completed',
      timestamp,
    ).ok,
    true,
  )
  assert.equal(
    prepareExecution(
      changeDraftSet(completedDraft(), 0, { reps: 1.5 }),
      assignment,
      'completed',
      timestamp,
    ).ok,
    false,
  )
})

test('submission applies the same prescribed set and repetition rules as the API', () => {
  for (const patch of [
    { exerciseId: 'unauthorized', reason: 'Tengo un motivo' },
    { stepId: 'another-step' },
    { set: 3 },
  ]) {
    assert.equal(
      prepareExecution(
        changeDraftSet(completedDraft(), 0, patch),
        assignment,
        'completed',
        timestamp,
      ).ok,
      false,
    )
  }
  const zeroReps = changeDraftSet(completedDraft(), 0, { reps: 0 })
  assert.equal(prepareExecution(zeroReps, assignment, 'completed', timestamp).ok, false)
  assert.equal(prepareExecution(zeroReps, assignment, 'partial', timestamp).ok, true)
})

test('recovery rejects pending executions that cannot satisfy the assigned snapshot rules', () => {
  for (const patch of [{ reps: 0 }, { exerciseId: 'air-squat', reason: '  ' }]) {
    const draft = changeDraftSet(completedDraft(), 0, patch)
    const pending = {
      id: draft.id,
      assignmentId: assignment.id,
      completedAt: timestamp,
      status: 'completed',
      notes: draft.notes,
      sets: draft.sets.map(({ stepId, set, exerciseId, reps, loadKg, reason }) => ({
        stepId,
        set,
        exerciseId,
        reps,
        loadKg,
        reason,
      })),
    }
    assert.equal(parseSessionDraft({ ...draft, pending }, assignment), null)
  }
})

test('availability blocks performed unavailable exercises while allowing a partial session using available ones', () => {
  const unavailable = structuredClone(assignment)
  unavailable.availability[0].exercises[0].status = 'unavailable'
  const blocked = prepareExecution(completedDraft(), unavailable, 'completed', timestamp)
  assert.equal(blocked.ok, false)
  if (blocked.ok) assert.fail('Unavailable exercise was accepted')
  assert.match(blocked.error, /disponible/)
  const partial = changeDraftSet(createSessionDraft(assignment, 'execution-a'), 2, { done: true })
  assert.equal(prepareExecution(partial, unavailable, 'partial', timestamp).ok, true)
})

test('lost-response retries preserve payload identity, timestamp and status despite later inventory changes', () => {
  const draft = completedDraft()
  const prepared = prepareExecution(draft, assignment, 'completed', timestamp)
  if (!prepared.ok) assert.fail(prepared.error)
  const pendingDraft = { ...draft, pending: prepared.payload }
  assert.equal(changeDraftSet(pendingDraft, 0, { reps: 99 }), pendingDraft)
  const unavailable = structuredClone(assignment)
  unavailable.availability[0].exercises[0].status = 'unavailable'
  const retry = prepareExecution(pendingDraft, unavailable, 'partial', '2026-10-11T12:00:00.000Z')
  if (!retry.ok) assert.fail(retry.error)
  assert.equal(retry.payload, prepared.payload)
  assert.equal(retry.payload.status, 'completed')
  assert.equal(retry.payload.completedAt, timestamp)
  assert.deepEqual(
    parseSessionDraft(JSON.parse(JSON.stringify(pendingDraft)), assignment),
    pendingDraft,
  )
})

test('partial retry recovery retains unfinished numeric edits in unperformed sets', () => {
  for (const patch of [
    { reps: 1.5 },
    { reps: -1 },
    { reps: 2000 },
    { loadKg: -5 },
    { loadKg: 1001 },
  ]) {
    const performed = changeDraftSet(createSessionDraft(assignment, 'execution-a'), 0, {
      done: true,
    })
    const draft = changeDraftSet(performed, 1, patch)
    const prepared = prepareExecution(draft, assignment, 'partial', timestamp)
    if (!prepared.ok) assert.fail(prepared.error)
    const device = storage()
    device.setItem('draft', JSON.stringify({ ...draft, pending: prepared.payload }))
    const recovered = recoverSessionDraft(
      device,
      'draft',
      assignment,
      () => 'must-not-create-new-id',
    )
    assert.equal(recovered.recovered, true)
    assert.deepEqual(recovered.draft.sets, draft.sets)
    assert.deepEqual(recovered.draft.pending, prepared.payload)
    const retry = prepareExecution(
      recovered.draft,
      assignment,
      'completed',
      '2026-10-11T12:00:00.000Z',
    )
    if (!retry.ok) assert.fail(retry.error)
    assert.deepEqual(retry.payload, prepared.payload)
  }
})

test('recovery refuses mismatched pending identity, payload and assignment contents', () => {
  const draft = completedDraft()
  const prepared = prepareExecution(draft, assignment, 'completed', timestamp)
  if (!prepared.ok) assert.fail(prepared.error)
  const invalidPending = [
    { ...prepared.payload, id: 'different-execution' },
    { ...prepared.payload, assignmentId: 'different-assignment' },
    { ...prepared.payload, notes: 'Not the retained notes' },
    { ...prepared.payload, sets: prepared.payload.sets.slice(1) },
    {
      ...prepared.payload,
      sets: [
        { ...prepared.payload.sets[0], exerciseId: 'unauthorized' },
        ...prepared.payload.sets.slice(1),
      ],
    },
  ]
  for (const pending of invalidPending)
    assert.equal(parseSessionDraft({ ...draft, pending }, assignment), null)
})

test('only definitive client rejections unlock editing; uncertain deliveries retain their pending payload', () => {
  for (const status of [400, 401, 403, 404, 409, 422])
    assert.equal(isDefinitiveRejection(status), true)
  for (const status of [0, 200, 408, 429, 500, 502, 503, 504])
    assert.equal(isDefinitiveRejection(status), false)
})

test('confirmed requests clear their own draft without removing a replacement session', () => {
  const device = storage()
  const draft = createSessionDraft(assignment, 'new-execution')
  device.setItem('draft', JSON.stringify(draft))
  discardConfirmedSession(device, 'draft', 'older-execution')
  assert.equal(device.getItem('draft'), JSON.stringify(draft))
  discardConfirmedSession(device, 'draft', 'new-execution')
  assert.equal(device.getItem('draft'), null)
  device.setItem('draft', '{unreadable-but-preserved')
  discardConfirmedSession(device, 'draft', 'new-execution')
  assert.equal(device.getItem('draft'), '{unreadable-but-preserved')
})

test('timed sessions keep performed duration and effort distinct from prescription and retry exactly', () => {
  const timed = structuredClone(assignment)
  timed.program.steps = [
    { ...timed.program.steps[0], sets: 1, reps: null, durationSeconds: 45, targetRpe: 7 },
  ]
  let draft = createSessionDraft(timed, 'timed-execution')
  assert.equal(draft.sets[0].durationSeconds, 45)
  assert.equal(draft.sets[0].reps, null)
  assert.equal(draft.sets[0].rpe, null)
  draft = changeDraftSet(draft, 0, { durationSeconds: 38, rpe: 7.5, done: true })
  const prepared = prepareExecution(draft, timed, 'completed', timestamp)
  if (!prepared.ok) assert.fail(prepared.error)
  assert.equal(prepared.payload.sets[0].durationSeconds, 38)
  assert.equal(prepared.payload.sets[0].rpe, 7.5)
  assert.equal(timed.program.steps[0].durationSeconds, 45)
  const pending = { ...draft, pending: prepared.payload }
  const recovered = parseSessionDraft(JSON.parse(JSON.stringify(pending)), timed)
  assert.deepEqual(recovered, pending)
  const retry = prepareExecution(recovered!, timed, 'partial', '2026-10-11T00:00:00Z')
  assert.deepEqual(retry, prepared)
  assert.equal(
    prepareExecution(
      changeDraftSet(draft, 0, { durationSeconds: 0 }),
      timed,
      'completed',
      timestamp,
    ).ok,
    false,
  )
  assert.equal(
    prepareExecution(changeDraftSet(draft, 0, { rpe: 11 }), timed, 'completed', timestamp).ok,
    false,
  )
})

test('fractional RPE survives device recovery without rounding or losing the pending execution', () => {
  for (const rpe of [7.5, 7.25]) {
    const draft = changeDraftSet(completedDraft(), 0, { rpe })
    const prepared = prepareExecution(draft, assignment, 'completed', timestamp)
    if (!prepared.ok) assert.fail(prepared.error)
    const device = storage()
    const pending = { ...draft, pending: prepared.payload }
    device.setItem('draft', JSON.stringify(pending))
    const recovered = recoverSessionDraft(device, 'draft', assignment, () => {
      assert.fail('A fractional RPE must not replace the existing session')
    })
    assert.equal(recovered.recovered, true)
    assert.deepEqual(recovered.draft, pending)
    assert.equal(recovered.draft.sets[0].rpe, rpe)
    assert.deepEqual(
      prepareExecution(recovered.draft, assignment, 'partial', '2026-10-11T00:00:00Z'),
      prepared,
    )
  }
})

test('old local drafts and pending retries decode without added duration or RPE fields', () => {
  const draft = completedDraft()
  const prepared = prepareExecution(draft, assignment, 'completed', timestamp)
  if (!prepared.ok) assert.fail(prepared.error)
  const old = JSON.parse(JSON.stringify({ ...draft, pending: prepared.payload }))
  for (const set of [...old.sets, ...old.pending.sets]) {
    delete set.durationSeconds
    delete set.rpe
  }
  const recovered = parseSessionDraft(old, assignment)
  assert.deepEqual(recovered, { ...draft, pending: prepared.payload })
  assert.equal(recovered?.id, draft.id)
  assert.equal(recovered?.pending?.completedAt, timestamp)
})

test('white-label training draft keys isolate branch context while retaining the legacy key adapter', () => {
  assert.notEqual(
    sessionDraftKey('atlas', 'member', 'assignment', 'center'),
    sessionDraftKey('atlas', 'member', 'assignment', 'north'),
  )
  assert.notEqual(
    sessionDraftKey('atlas', 'member', 'assignment', 'center'),
    sessionDraftKey('sur', 'member', 'assignment', 'center'),
  )
  assert.equal(
    sessionDraftKey('atlas', 'member', 'assignment'),
    'klisteni.b2b.session.v1.atlas.member.assignment',
  )
})

test('IndexedDB migration archives exact legacy pending POST bytes and retains the original key', async () => {
  const { preserveLegacyWorkout } = await import(
    '../src/features/training/storage/legacyMigration.ts'
  )
  const local = storage()
  const original = completedDraft()
  const prepared = prepareExecution(original, assignment, 'completed', timestamp)
  assert.equal(prepared.ok, true)
  if (!prepared.ok) return
  const bytes = JSON.stringify({ ...original, pending: prepared.payload })
  local.setItem('legacy-key', bytes)
  const copies: string[] = []
  const result = await preserveLegacyWorkout(
    {
      read: async () => null,
      compareAndSet: async () => {},
      preserveLegacy: async (_key, value) => {
        copies.push(value)
      },
    },
    local,
    'legacy-key',
    assignment,
  )
  assert.equal(result?.requiresLegacyReplay, true)
  assert.equal(local.getItem('legacy-key'), bytes)
  assert.deepEqual(copies, [bytes])
  assert.deepEqual(result?.draft.pending, prepared.payload)
})

test('unreadable legacy bytes are archived before migration refuses a replacement', async () => {
  const { preserveLegacyWorkout } = await import(
    '../src/features/training/storage/legacyMigration.ts'
  )
  const local = storage()
  local.setItem('legacy-key', '{broken')
  const copies: string[] = []
  await assert.rejects(
    preserveLegacyWorkout(
      {
        read: async () => null,
        compareAndSet: async () => {},
        preserveLegacy: async (_key, value) => {
          copies.push(value)
        },
      },
      local,
      'legacy-key',
      assignment,
    ),
    /preserved/,
  )
  assert.deepEqual(copies, ['{broken'])
  assert.equal(local.getItem('legacy-key'), '{broken')
})

test('readable legacy drafts migrate performed actuals with stable links and retain all unfinished source fields', async () => {
  const { migrateLegacyWorkoutDraft } = await import(
    '../src/features/training/storage/legacyMigration.ts'
  )
  const { MemoryWorkoutStore, draft: productDraft } = await import('./fixtures/workout.ts')
  const store = new MemoryWorkoutStore()
  const local = storage()
  const legacy = createSessionDraft(assignment, 'execution-a')
  legacy.sets[0].done = true
  legacy.sets[0].reps = 7
  legacy.sets[1].reps = 11
  legacy.notes = 'Unfinished original fields retained'
  const bytes = JSON.stringify(legacy)
  local.setItem('legacy-key', bytes)
  const initial = productDraft()
  initial.id = legacy.id
  initial.origin = {
    kind: 'legacy',
    assignmentId: assignment.id,
    executionId: null,
    routine: { programId: assignment.program.programId, version: 1, schemaVersion: 1 },
  }
  const source = initial.content.segments[0]
  initial.content.segments = [{ ...source, originalStepId: 'step-a', exerciseId: 'squat' }]
  initial.content.selectedSegments = [{ originalStepId: 'step-a', segmentId: source.segmentId }]
  const { workoutKey } = await import('../src/features/training/storage/workoutStore.ts')
  initial.key = workoutKey(initial.scope, initial.id)
  const migrated = await migrateLegacyWorkoutDraft({
    store,
    storage: local,
    key: 'legacy-key',
    assignment,
    initial,
  })
  assert.equal(migrated?.id, 'execution-a')
  assert.equal(migrated?.content.sets[0].repetitions, 7)
  assert.equal(migrated?.content.sets.length, 1)
  assert.equal(migrated?.content.explicitCompletion, false)
  assert.equal(migrated?.legacyDraft?.bytes, bytes)
  assert.equal(local.getItem('legacy-key'), bytes)
})
