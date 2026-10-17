import assert from 'node:assert/strict'
import test from 'node:test'
import { createProductV2Client } from '@klisteniapp/b2b-client'
import { ProductEndpoints, ProductErrorSchema } from '@klisteniapp/b2b-contracts/product-v2'
import {
  canMoveOccurrence,
  isLateCorrectedWeek,
  moveRequest,
  occurrenceState,
  weekDates,
} from '../src/features/training/week-calendar/model.ts'
import { monday } from '../src/features/training/routine-history/model.ts'
import {
  enrollment,
  legacy,
  occurrence,
  scope,
  session,
  summary,
} from './routineHistoryFixtures.ts'

test('Monday to Sunday uses seven calendar days across short and long DST weeks', () => {
  for (const start of ['2026-03-02', '2026-10-26', '2026-12-28']) {
    const days = weekDates(start)
    assert.equal(days.length, 7)
    assert.equal(new Set(days).size, 7)
    assert.equal(monday(days[6]!), start)
  }
  assert.equal(monday('2027-01-03'), '2026-12-28')
})
test('same-week move sends only stable identity, CAS revision, operation and date', () => {
  const original = occurrence()
  const request = moveRequest(original, '2026-10-18', 'retry-id')
  assert.deepEqual(request, {
    id: original.id,
    expectedRevision: 1,
    operationId: 'retry-id',
    scheduledDate: '2026-10-18',
  })
  assert.equal(ProductEndpoints.moveOccurrence.input.safeParse(request).success, true)
  assert.throws(() => moveRequest(original, '2026-10-19', 'outside'), /misma semana/)
  assert.throws(() => moveRequest(original, '2026-10-11', 'outside'), /misma semana/)
  assert.equal(original.scheduledDate, '2026-10-12')
})
test('pending, partial, completed, missed and excluded remain distinct', () => {
  const o = occurrence(),
    plan = enrollment(),
    partial = session()
  assert.equal(occurrenceState(o, [], [plan], false), 'pending')
  assert.equal(occurrenceState(o, [], [plan], true), 'missed')
  assert.equal(occurrenceState(o, [partial], [plan], false), 'partial')
  assert.equal(occurrenceState(o, [partial], [plan], true), 'partial')
  const complete = {
    ...partial,
    content: { ...partial.content, status: 'completed' as const, explicitCompletion: true },
  }
  assert.equal(occurrenceState(o, [complete], [plan], true), 'completed')
  assert.equal(
    occurrenceState({ ...o, eligibility: 'cancelled' }, [complete], [plan], true),
    'excluded',
  )
  const corrected = {
    ...complete,
    revision: 2,
    content: { ...complete.content, status: 'partial' as const, explicitCompletion: false },
  }
  assert.equal(occurrenceState(o, [complete, corrected], [plan], true), 'partial')
})
test('two same-day slots remain independent; repeated completed records do not fill another occurrence', () => {
  const o1 = occurrence('one'),
    o2 = occurrence('two', { slotId: 'second', slotOrdinal: 1 })
  const completed = session('s1', {
    origin: { kind: 'occurrence', occurrenceId: 'one', routine: o1.routine },
  })
  completed.content.status = 'completed'
  completed.content.explicitCompletion = true
  const records = [completed, { ...completed, id: 's2' }, legacy()]
  assert.equal(occurrenceState(o1, records, [enrollment()], true), 'completed')
  assert.equal(occurrenceState(o2, records, [enrollment()], true), 'missed')
})
test('move controls exclude completed, cancelled, ended and foreign enrollment work', () => {
  assert.equal(canMoveOccurrence(occurrence(), [session()], enrollment()), true)
  const completed = session()
  completed.content.status = 'completed'
  completed.content.explicitCompletion = true
  assert.equal(canMoveOccurrence(occurrence(), [completed], enrollment()), false)
  assert.equal(
    canMoveOccurrence(occurrence('occurrence', { eligibility: 'cancelled' }), [], enrollment()),
    false,
  )
  assert.equal(canMoveOccurrence(occurrence(), [], { ...enrollment(), status: 'ended' }), false)
  assert.equal(
    canMoveOccurrence(occurrence(), [], {
      ...enrollment(),
      scope: { ...scope, branchId: 'foreign' },
    }),
    false,
  )
})
test('server four/three/one summary stays authoritative; a watermark alone does not claim late correction', () => {
  const closed = summary(true)
  assert.equal(closed.required, 4)
  assert.equal(closed.completed, 3)
  assert.equal(closed.missed, 1)
  assert.equal(isLateCorrectedWeek(closed, [session()]), false)
  const correction = session('session', {
    revision: 2,
    origin: { kind: 'occurrence', occurrenceId: 'o1', routine: occurrence().routine },
    acceptedAt: '2026-10-19T05:00:00Z',
  })
  assert.equal(isLateCorrectedWeek(closed, [correction]), true)
  assert.equal(isLateCorrectedWeek(summary(false), [correction]), false)
})
test('real product client preserves exact move payload and frozen structured conflict', async () => {
  const original = occurrence()
  const input = moveRequest(original, '2026-10-18', 'stable-op')
  let sent = 0
  const client = createProductV2Client('account', scope.organizationId, {
    branchId: scope.branchId,
    fetch: async (url, init) => {
      sent++
      assert.equal(
        url,
        `/api/b2b/orgs/${scope.organizationId}/product/v2/occurrences/occurrence/move`,
      )
      assert.equal(new Headers(init?.headers).get('X-Klisteni-B2B-Contract'), '2')
      assert.equal(new Headers(init?.headers).get('X-Klisteni-B2B-Branch'), scope.branchId)
      assert.equal(new Headers(init?.headers).get('Idempotency-Key'), 'stable-op')
      assert.deepEqual(JSON.parse(String(init?.body)), input)
      return new Response(
        JSON.stringify(
          ProductErrorSchema.parse({
            code: 'REVISION_CONFLICT',
            error: 'Refresh the schedule',
            issues: [
              {
                code: 'conflict',
                path: ['expectedRevision'],
                stepId: null,
                message: 'Reload the accepted revision',
              },
            ],
          }),
        ),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    },
  })
  await assert.rejects(client.call('moveOccurrence', input), {
    status: 409,
    code: 'REVISION_CONFLICT',
    issues: [
      {
        code: 'conflict',
        path: ['expectedRevision'],
        stepId: null,
        message: 'Reload the accepted revision',
      },
    ],
  })
  assert.equal(sent, 1)
  assert.equal(original.revision, 1)
})
