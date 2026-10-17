import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, createProductV2Client } from '@klisteniapp/b2b-client'
import {
  RoutineDraftContentSchema,
  ProductEndpoints,
  type ProductAccess,
} from '@klisteniapp/b2b-contracts/product-v2'
import {
  readEditorDraft,
  writeEditorDraft,
  editorDraftKey,
} from '../src/shared/editor/editorDraftStorage.ts'
import {
  blankStep,
  isRoutineContent,
  isWorkingCopy,
  routineContent,
  routineIssues,
  setDoseMode,
  mutationAttempt,
  canEditPlanning,
  type Routine,
  type WorkingCopy,
} from '../src/features/programs/product/programmingModel.ts'

const scope = { organizationId: 'brand', branchId: 'center' }
function complete() {
  const step = blankStep('step')
  step.exerciseId = 'press'
  step.dose = {
    ...step.dose,
    mode: 'repetitions',
    sets: { kind: 'range', min: 2, max: 4 },
    repetitions: { kind: 'range', min: 8, max: 12 },
    load: { mode: 'bodyweight' },
    laterality: 'bilateral',
  }
  return { name: 'Routine', description: '', steps: [step] }
}
const access: ProductAccess = {
  schemaVersion: 2,
  organizationId: 'brand',
  userId: 'coach',
  role: 'coach',
  accessMode: 'active',
  accessRevision: 1,
  branches: [{ branchId: 'center', role: 'coach' }],
  capabilities: ['edit-planning'],
}
function memory() {
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

test('blank and incomplete routine drafts use the server DTO without invented dose or balance scores', () => {
  assert.deepEqual(RoutineDraftContentSchema.parse(routineContent()), {
    name: '',
    description: '',
    steps: [],
  })
  const draft = { name: '', description: '', steps: [blankStep('empty')] }
  assert.deepEqual(RoutineDraftContentSchema.parse(draft), draft)
  const issues = routineIssues(draft)
  assert.ok(issues.some((i) => i.stepId === 'empty' && i.path.join('.') === 'steps.0.exerciseId'))
  assert.ok(issues.some((i) => i.stepId === 'empty' && i.path.join('.') === 'steps.0.dose.sets'))
  assert.equal('score' in draft, false)
})

test('range targets, explicit zero load/rest, laterality and mode applicability survive publication validation', () => {
  const draft = complete()
  assert.deepEqual(routineIssues(draft), [])
  draft.steps[0].dose.load = { mode: 'external', kilograms: { kind: 'range', min: 0, max: 20 } }
  draft.steps[0].dose.restSeconds = { kind: 'fixed', value: 0 }
  draft.steps[0].dose.laterality = 'per-side'
  assert.deepEqual(routineIssues(draft), [])
  draft.steps[0].dose = setDoseMode(draft.steps[0].dose, 'duration')
  assert.equal(draft.steps[0].dose.repetitions, null)
  assert.ok(routineIssues(draft).some((i) => i.path.join('.') === 'steps.0.dose.durationSeconds'))
  draft.steps[0].dose.durationSeconds = { kind: 'range', min: 15, max: 30 }
  assert.deepEqual(routineIssues(draft), [])
  draft.steps[0].dose.load = { mode: 'unspecified' }
  assert.ok(routineIssues(draft).some((i) => i.path.join('.') === 'steps.0.dose.load'))
})

test('unaccepted invalid ranges remain recoverable locally, but never pass the frozen transport', () => {
  const draft = complete()
  draft.steps[0].dose.sets = { kind: 'range', min: 5, max: 2 }
  assert.equal(isRoutineContent(draft), true)
  assert.equal(RoutineDraftContentSchema.safeParse(draft).success, false)
  const storage = memory()
  const working: WorkingCopy<typeof draft> = { id: 'routine', content: draft, attempt: null }
  writeEditorDraft(storage, 'local', working, 3)
  assert.deepEqual(
    readEditorDraft(storage, 'local', isWorkingCopy(isRoutineContent))?.value.content,
    draft,
  )
  assert.equal(
    isRoutineContent({
      ...draft,
      steps: [
        {
          ...draft.steps[0],
          dose: { ...draft.steps[0].dose, sets: { kind: 'fixed', value: Infinity } },
        },
      ],
    }),
    false,
  )
})

test('editing dose/policy never mutates a fetched routine or earlier publication', () => {
  const fetched: Routine = {
    ...complete(),
    id: 'routine',
    schemaVersion: 2,
    scope,
    revision: 4,
    publishedVersion: 2,
    archivedAt: null,
  }
  const draft = routineContent(fetched)
  draft.steps[0].substitutionPolicy = 'blocked'
  draft.steps[0].dose.sets = { kind: 'fixed', value: 8 }
  assert.equal(fetched.steps[0].substitutionPolicy, 'reviewed')
  assert.deepEqual(fetched.steps[0].dose.sets, { kind: 'range', min: 2, max: 4 })
  assert.equal(fetched.publishedVersion, 2)
})

test('planning capability requires current account, brand, active access and selected coach branch', () => {
  assert.equal(canEditPlanning(access, 'coach', 'brand', 'center'), true)
  assert.equal(canEditPlanning(access, 'coach', 'brand', 'foreign'), false)
  assert.equal(canEditPlanning(access, 'other', 'brand', 'center'), false)
  assert.equal(canEditPlanning(access, 'coach', 'other', 'center'), false)
  assert.equal(canEditPlanning(access, 'coach', 'brand'), false)
  assert.equal(
    canEditPlanning(
      { ...access, accessMode: 'export-only', capabilities: ['export-own-records'] },
      'coach',
      'brand',
      'center',
    ),
    false,
  )
  assert.equal(canEditPlanning({ ...access, capabilities: [] }, 'coach', 'brand', 'center'), false)
})

test('local copies and retry identity stay isolated by account, brand, branch, role and editor version', () => {
  const storage = memory()
  const key = editorDraftKey(
    'coach',
    'brand',
    'program',
    'product-v2/routine/new',
    'center',
    'coach',
  )
  const input = { id: 'routine', expectedRevision: 0, content: routineContent() }
  const attempt = mutationAttempt('saveRoutine', input, null, () => 'operation')
  const copy = { id: 'routine', content: routineContent(), attempt }
  writeEditorDraft(storage, key, copy, 0)
  const recovered = readEditorDraft(storage, key, isWorkingCopy(isRoutineContent))!
  assert.deepEqual(mutationAttempt('saveRoutine', input, recovered.value.attempt), attempt)
  for (const args of [
    ['other', 'brand', 'center', 'coach'],
    ['coach', 'other', 'center', 'coach'],
    ['coach', 'brand', 'other', 'coach'],
    ['coach', 'brand', 'center', 'admin'],
  ]) {
    assert.equal(
      readEditorDraft(
        storage,
        editorDraftKey(args[0], args[1], 'program', 'product-v2/routine/new', args[2], args[3]),
        isWorkingCopy(isRoutineContent),
      ),
      null,
    )
  }
  assert.notEqual(
    mutationAttempt('saveRoutine', { ...input, expectedRevision: 1 }, attempt).operationId,
    attempt.operationId,
  )
  assert.notEqual(
    mutationAttempt('publishRoutine', input, attempt).operationId,
    attempt.operationId,
  )
})

test('frozen client sends exact blank draft and retry ID, preserving actionable server conflict issues', async () => {
  const bodies: unknown[] = []
  const headers: Headers[] = []
  const issue = {
    code: 'conflict',
    path: ['revision'],
    stepId: null,
    message: 'Another trainer saved revision 2',
  }
  const client = createProductV2Client('coach', 'brand', {
    branchId: 'center',
    role: 'coach',
    fetch: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)))
      headers.push(new Headers(init?.headers))
      return new Response(
        JSON.stringify({
          error: 'Refresh before saving',
          code: 'REVISION_CONFLICT',
          issues: [issue],
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    },
  })
  const input = { id: 'routine', expectedRevision: 1, content: routineContent() }
  const attempt = mutationAttempt('saveRoutine', input, null, () => 'same-operation')
  const draftBefore = structuredClone(input)
  for (let i = 0; i < 2; i++)
    await assert.rejects(
      client.call('saveRoutine', { ...input, operationId: attempt.operationId }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError)
        assert.equal(error.code, 'REVISION_CONFLICT')
        assert.deepEqual(error.issues, [issue])
        return true
      },
    )
  assert.deepEqual(input, draftBefore)
  assert.deepEqual(bodies[0], bodies[1])
  assert.equal(headers[0].get('X-Klisteni-B2B-Contract'), '2')
  assert.equal(headers[0].get('X-Klisteni-B2B-Branch'), 'center')
  assert.equal(headers[0].get('Idempotency-Key'), 'same-operation')
  assert.equal(ProductEndpoints.saveRoutine.input.safeParse(bodies[0]).success, true)
})

test('recovered publication retry retains the exact old expected revision instead of overwriting a newer head', async () => {
  const { readAttempt } = await import('../src/features/programs/product/programmingModel.ts')
  const attempt = mutationAttempt(
    'publishRoutine',
    { id: 'routine', expectedRevision: 3 },
    null,
    () => 'publish-once',
  )
  const request = readAttempt(attempt, 'publishRoutine')!
  assert.equal(request.expectedRevision, 3)
  assert.equal(request.operationId, 'publish-once')
  assert.equal(readAttempt(attempt, 'saveRoutine'), null)
  assert.equal(readAttempt({ ...attempt, payload: '{broken' }, 'publishRoutine'), null)
  assert.equal(
    readAttempt(
      {
        ...attempt,
        payload: JSON.stringify({ id: 'routine', expectedRevision: 3, unrecognized: true }),
      },
      'publishRoutine',
    ),
    null,
  )
})

test('a lost-save replay followed by another trainer save reads current head without flattening the receipt', async () => {
  const { saveRoutineAndReadCurrent } = await import(
    '../src/features/programs/product/planningRequests.ts'
  )
  const accepted: Routine = {
    ...complete(),
    schemaVersion: 2,
    id: 'routine',
    scope,
    revision: 2,
    publishedVersion: 1,
    archivedAt: null,
  }
  const current: Routine = {
    ...structuredClone(accepted),
    revision: 3,
    name: 'Other trainer correction',
  }
  const responses = [accepted, current]
  const paths: string[] = []
  const client = createProductV2Client('coach', 'brand', {
    branchId: 'center',
    fetch: async (url) => {
      paths.push(String(url))
      return new Response(JSON.stringify(responses.shift()), {
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })
  const result = await saveRoutineAndReadCurrent(client, {
    id: 'routine',
    expectedRevision: 1,
    operationId: 'original-operation',
    content: complete(),
  })
  assert.equal(result.accepted.revision, 2)
  assert.equal(result.current.revision, 3)
  assert.equal(result.accepted.name, 'Routine')
  assert.equal(result.current.name, 'Other trainer correction')
  assert.equal(paths.length, 2)
})
