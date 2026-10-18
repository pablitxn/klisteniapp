import assert from 'node:assert/strict'
import test from 'node:test'
import { createProductV2Client, type ProductV2Client } from '@klisteniapp/b2b-client'
import type { ProductOutput } from '@klisteniapp/b2b-contracts/product-v2'
import {
  loadEnrollmentRevision,
  loadHistorySubjects,
  loadRoutineHistory,
} from '../src/features/training/routine-history/historyReads.ts'
import {
  actualEligibility,
  contextForRecord,
} from '../src/features/training/routine-history/model.ts'
import {
  atomicContext,
  enrollment,
  legacy,
  occurrence,
  scope,
  session,
} from './routineHistoryFixtures.ts'

const continuity = () => ({
  schemaVersion: 2,
  scope,
  current: [enrollment()],
  past: [],
  future: [],
  unscheduledLegacyAssignmentIds: ['unexecuted'],
})
const assignment = (): ProductOutput<'legacyAssignments'>[number] => ({
  schemaVersion: 2,
  id: 'unexecuted',
  scope,
  active: false,
  assignedBy: 'coach',
  createdAt: '2026-10-01T00:00:00Z',
  routine: { programId: 'retired-routine', version: 1, schemaVersion: 1 },
  name: 'Retired unexecuted routine',
  archivedAt: '2026-10-10T00:00:00Z',
})
function historyClient(
  overrides: Record<string, unknown> = {},
  options: { signal?: AbortSignal; deny?: string } = {},
) {
  const paths: string[] = []
  const prefix = `/api/b2b/orgs/${scope.organizationId}/product/v2`
  const responses: Record<string, unknown> = {
    [`/members/${scope.memberId}/continuity`]: continuity(),
    [`/members/${scope.memberId}/sessions`]: [session()],
    [`/members/${scope.memberId}/legacy-assignments`]: [assignment()],
    '/occurrences/occurrence': atomicContext(),
    '/history-subjects': {
      schemaVersion: 2,
      scope: { organizationId: scope.organizationId, branchId: scope.branchId },
      members: [{ userId: 'retained-inactive', name: 'Historical subject', active: false }],
    },
    ...overrides,
  }
  const client: ProductV2Client = createProductV2Client('actor', scope.organizationId, {
    branchId: scope.branchId,
    signal: options.signal,
    onAuthChange: () => {},
    fetch: async (url, init) => {
      const path = String(url).slice(prefix.length)
      paths.push(path)
      assert.equal(init?.method, 'GET')
      assert.equal(new Headers(init?.headers).get('X-Klisteni-B2B-Contract'), '2')
      assert.equal(new Headers(init?.headers).get('X-Klisteni-B2B-Branch'), scope.branchId)
      if (path === options.deny)
        return Response.json(
          { error: 'Current context revoked', code: 'CONTEXT_REVOKED' },
          { status: 403 },
        )
      assert.ok(path in responses, `Unexpected endpoint ${path}`)
      return Response.json(responses[path])
    },
  })
  return { client, paths }
}

test('history reads retain an unexecuted retired assignment and fetch each linked occurrence once outside any loaded week', async () => {
  const record = session()
  const moved = occurrence('occurrence', {
    currentWeek: { startDate: '2026-10-19', timeZone: 'America/New_York' },
    scheduledDate: '2026-10-19',
    revision: 3,
  })
  const pair = atomicContext(moved)
  const { client, paths } = historyClient({
    [`/members/${scope.memberId}/sessions`]: [record, { ...record, id: 'second-record' }, legacy()],
    '/occurrences/occurrence': pair,
  })
  const loaded = await loadRoutineHistory(client, scope)
  assert.equal(loaded.assignments[0]!.id, 'unexecuted')
  assert.equal(loaded.assignments[0]!.active, false)
  assert.equal(paths.filter((path) => path === '/occurrences/occurrence').length, 1)
  assert.equal(
    paths.some((path) => path.includes('week') || path.includes('?')),
    false,
  )
  assert.equal(actualEligibility(record, loaded.contexts), 'excluded')
  assert.equal(
    contextForRecord(record, loaded.contexts)?.enrollment.revision,
    pair.enrollment.revision,
  )
  assert.equal(loaded.records.length, 3)
  assert.equal(record.origin.routine.version, 2)
})

test('atomic paired current enrollment wins over an earlier continuity snapshot in the same week', async () => {
  const pairedEnrollment = enrollment()
  pairedEnrollment.revision = 3
  pairedEnrollment.content.stages[0]!.startDate = '2026-10-14'
  pairedEnrollment.content.stages[0]!.endDate = '2026-10-18'
  const { client } = historyClient({
    '/occurrences/occurrence': atomicContext(occurrence(), pairedEnrollment),
  })
  const loaded = await loadRoutineHistory(client, scope)
  assert.equal(loaded.continuity.current[0]!.revision, 2)
  assert.equal(loaded.contexts[0]!.enrollment.revision, 3)
  assert.equal(actualEligibility(loaded.records[0]!, loaded.contexts), 'excluded')
})

test('inclusion also preserves the paired enrollment when independently loaded continuity is newer', async () => {
  const different = continuity()
  different.current[0]!.revision = 5
  different.current[0]!.content.stages[0]!.startDate = '2026-10-14'
  const { client } = historyClient({ [`/members/${scope.memberId}/continuity`]: different })
  const loaded = await loadRoutineHistory(client, scope)
  assert.equal(actualEligibility(loaded.records[0]!, loaded.contexts), 'eligible')
  assert.equal(loaded.contexts[0]!.enrollment.revision, 2)
})

test('cancelled linked work remains excluded, with its original IDs and reason retained', async () => {
  const { client } = historyClient({
    '/occurrences/occurrence': atomicContext(
      occurrence('occurrence', {
        eligibility: 'cancelled',
        cancellationReason: 'Stage removed',
        revision: 4,
      }),
    ),
  })
  const loaded = await loadRoutineHistory(client, scope)
  assert.equal(actualEligibility(loaded.records[0]!, loaded.contexts), 'excluded')
  assert.equal(loaded.contexts[0]!.occurrence.cancellationReason, 'Stage removed')
  assert.equal(loaded.records[0]!.schemaVersion, 2)
})

test('legacy-only and unexecuted histories never invent an occurrence or a scheduled absence', async () => {
  const { client, paths } = historyClient({ [`/members/${scope.memberId}/sessions`]: [legacy()] })
  const loaded = await loadRoutineHistory(client, scope)
  assert.deepEqual(loaded.contexts, [])
  assert.equal(
    paths.some((path) => path.startsWith('/occurrences')),
    false,
  )
  assert.equal(actualEligibility(loaded.records[0]!, loaded.contexts), 'unplanned')
  assert.equal(loaded.assignments.length, 1)
})

for (const field of ['organizationId', 'branchId', 'memberId'] as const) {
  test(`history loader rejects a foreign ${field} before asking for its occurrence`, async () => {
    const { client, paths } = historyClient({
      [`/members/${scope.memberId}/sessions`]: [
        session('foreign', { scope: { ...scope, [field]: 'foreign' } }),
      ],
    })
    await assert.rejects(loadRoutineHistory(client, scope), /contexto autorizado/)
    assert.equal(
      paths.some((path) => path.startsWith('/occurrences')),
      false,
    )
  })
  test(`atomic pair rejects a foreign enrollment ${field}`, async () => {
    const plan = enrollment()
    plan.scope = { ...scope, [field]: 'foreign' }
    const { client } = historyClient({
      '/occurrences/occurrence': atomicContext(occurrence(), plan),
    })
    await assert.rejects(loadRoutineHistory(client, scope), /contexto autorizado/)
  })
}

test('an atomic pair with a different enrollment or original routine version fails closed', async () => {
  const mismatch = enrollment()
  mismatch.id = 'different-enrollment'
  await assert.rejects(
    loadRoutineHistory(
      historyClient({ '/occurrences/occurrence': atomicContext(occurrence(), mismatch) }).client,
      scope,
    ),
    /contexto autorizado/,
  )
  const wrongVersion = occurrence('occurrence', {
    routine: { ...occurrence().routine, version: 9 },
  })
  await assert.rejects(
    loadRoutineHistory(
      historyClient({ '/occurrences/occurrence': atomicContext(wrongVersion) }).client,
      scope,
    ),
    /registro original/,
  )
})

test('issued period reads use occurrence enrollment revision rather than issued goal revision or current period', async () => {
  const original = enrollment()
  original.revision = 1
  original.issuedGoalRevision = 7
  original.content.goal = 'Original issued objective'
  const snapshot = {
    enrollment: original,
    actorId: 'issuing-coach',
    recordedAt: '2026-10-01T01:00:00Z',
  }
  const { client, paths } = historyClient({ '/enrollments/enrollment/revisions/1': snapshot })
  assert.deepEqual(
    await loadEnrollmentRevision(client, scope, {
      id: 'enrollment',
      revision: 1,
      stageId: 'stage',
    }),
    snapshot,
  )
  assert.deepEqual(paths, ['/enrollments/enrollment/revisions/1'])
})

test('issued period detail rejects another revision, scope, enrollment and missing original stage', async () => {
  for (const mutate of [
    (plan: ReturnType<typeof enrollment>) => {
      plan.revision = 2
    },
    (plan: ReturnType<typeof enrollment>) => {
      plan.scope.branchId = 'foreign'
    },
    (plan: ReturnType<typeof enrollment>) => {
      plan.id = 'foreign-enrollment'
    },
    (plan: ReturnType<typeof enrollment>) => {
      plan.content.stages[0]!.id = 'different-stage'
    },
  ]) {
    const plan = enrollment()
    plan.revision = 1
    mutate(plan)
    const { client } = historyClient({
      '/enrollments/enrollment/revisions/1': {
        enrollment: plan,
        actorId: 'coach',
        recordedAt: '2026-10-01T00:00:00Z',
      },
    })
    await assert.rejects(
      loadEnrollmentRevision(client, scope, { id: 'enrollment', revision: 1, stageId: 'stage' }),
      /período solicitado/,
    )
  }
})

test('inactive historical subjects use the scoped history endpoint and never people or health', async () => {
  const { client, paths } = historyClient()
  const members = await loadHistorySubjects(client, scope)
  assert.equal(members[0]!.active, false)
  assert.deepEqual(paths, ['/history-subjects'])
  const foreign = historyClient({
    '/history-subjects': {
      schemaVersion: 2,
      scope: { organizationId: scope.organizationId, branchId: 'other' },
      members: [],
    },
  })
  await assert.rejects(loadHistorySubjects(foreign.client, scope), /sede autorizada/)
})

test('revoked linked reads reject the entire projection; departed context makes no new request', async () => {
  const denied = historyClient({}, { deny: '/occurrences/occurrence' })
  await assert.rejects(loadRoutineHistory(denied.client, scope), {
    status: 403,
    code: 'CONTEXT_REVOKED',
  })
  const controller = new AbortController()
  controller.abort()
  const departed = historyClient({}, { signal: controller.signal })
  await assert.rejects(loadRoutineHistory(departed.client, scope), { code: 'ABORTED' })
  assert.deepEqual(departed.paths, [])
})
