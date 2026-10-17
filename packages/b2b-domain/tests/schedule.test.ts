import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EnrollmentSchema, SessionRevisionSchema } from '@klisteniapp/b2b-contracts/product-v2'
import {
  addDays,
  deriveWeek,
  isCompletionEligible,
  localDate,
  moveWithinWeek,
  reconcileOccurrences,
  weekBounds,
  weekStart,
} from '../src/schedule.ts'

const scope = { organizationId: 'atlas', branchId: 'principal', memberId: 'member' }
const routine = { programId: 'routine', version: 1, schemaVersion: 2 as const }
function enrollment(startDate = '2026-10-19', endDate = '2026-10-25') {
  return EnrollmentSchema.parse({
    schemaVersion: 2,
    id: 'enrollment',
    scope,
    goalProgramId: 'goal',
    issuedGoalRevision: 1,
    revision: 1,
    status: 'active',
    createdAt: '2026-10-01T10:00:00Z',
    content: {
      name: 'Goal',
      goal: '',
      timeZone: 'America/New_York',
      stages: [
        {
          id: 'stage',
          name: 'Stage',
          startDate,
          endDate,
          slots: [1, 2, 3, 4].map((weekday) => ({ id: `slot-${weekday}`, weekday, routine })),
        },
      ],
    },
  })
}
const ids = () => {
  let n = 0
  return () => `occurrence-${n++}`
}
function session(
  id: string,
  occurrenceId: string,
  status: 'partial' | 'completed' | 'void' = 'completed',
  revision = 1,
) {
  return SessionRevisionSchema.parse({
    schemaVersion: 2,
    id,
    scope,
    origin: { kind: 'occurrence', occurrenceId, routine },
    revision,
    operationId: `operation-${id}-${revision}`,
    actorId: 'member',
    acceptedAt: '2026-10-26T10:00:00Z',
    content: {
      status,
      explicitCompletion: status === 'completed',
      performedAt: '2026-10-22T14:00:00Z',
      notes: '',
      segments: [],
      selectedSegments: [],
      sets: [],
      correctionReason: '',
    },
  })
}
test('Monday–Sunday calendar boundaries use enrollment timezone across spring and autumn DST', () => {
  assert.equal(weekStart('2026-10-25'), '2026-10-19')
  assert.equal(weekStart('2026-10-26'), '2026-10-26')
  assert.equal(addDays('2026-03-08', 1), '2026-03-09')
  const spring = weekBounds({ startDate: '2026-03-02', timeZone: 'America/New_York' })
  const autumn = weekBounds({ startDate: '2026-10-26', timeZone: 'America/New_York' })
  assert.equal((Date.parse(spring.end) - Date.parse(spring.start)) / 3600000, 167)
  assert.equal((Date.parse(autumn.end) - Date.parse(autumn.start)) / 3600000, 169)
  assert.equal(localDate('2026-10-26T03:59:59Z', 'America/New_York'), '2026-10-25')
  assert.equal(localDate('2026-10-26T04:00:00Z', 'America/New_York'), '2026-10-26')
})
test('generation is stable on retry, two slots on one day stay separate and gaps invent no obligations', () => {
  const current = enrollment()
  current.content.stages[0]!.slots[1]!.weekday = 1
  const initial = reconcileOccurrences(null, current, [], ids())
  assert.equal(initial.length, 4)
  assert.equal(initial.filter((o) => o.originalDate === '2026-10-19').length, 2)
  assert.deepEqual(
    reconcileOccurrences(current, current, initial, () => {
      throw new Error('unexpected addition')
    }),
    initial,
  )
  const gap = enrollment('2026-10-23', '2026-10-25')
  assert.equal(reconcileOccurrences(null, gap, [], ids()).length, 0)
})
test('same-week move retains stage and routine and explicitly permits a date across a midweek stage edge', () => {
  const current = enrollment('2026-10-21', '2026-10-25')
  const initial = reconcileOccurrences(null, current, [], ids())[0]!
  const moved = moveWithinWeek(initial, current, '2026-10-19', false)
  assert.equal(moved.permittedDateOverride, '2026-10-19')
  assert.equal(moved.originalDate, initial.originalDate)
  assert.deepEqual(moved.routine, initial.routine)
  assert.ok(isCompletionEligible(moved, current, '2026-10-19T15:00:00Z'))
  assert.throws(
    () => moveWithinWeek(initial, current, '2026-10-26', false),
    /OUTSIDE_PRESCRIBED_WEEK/,
  )
  assert.throws(() => moveWithinWeek(initial, current, '2026-10-22', true), /NOT_MOVABLE/)
  assert.deepEqual(
    reconcileOccurrences(current, current, [moved], ids()).find((o) => o.id === moved.id),
    moved,
  )
})
test('period translations preserve identity and original links and extensions never renumber ordinals', () => {
  const initialEnrollment = enrollment()
  const initial = reconcileOccurrences(null, initialEnrollment, [], ids())
  const shifted = enrollment('2026-10-26', '2026-11-01')
  shifted.revision = 2
  const moved = reconcileOccurrences(initialEnrollment, shifted, initial, ids())
  assert.equal(moved.length, 4)
  for (const original of initial) {
    const after = moved.find((o) => o.id === original.id)!
    assert.equal(after.originalDate, original.originalDate)
    assert.equal(after.scheduledDate, addDays(original.scheduledDate, 7))
    assert.equal(after.slotOrdinal, original.slotOrdinal)
    assert.deepEqual(after.routine, original.routine)
    assert.ok(!isCompletionEligible(after, shifted, '2026-10-22T14:00:00Z'))
  }
  const extended = enrollment('2026-10-12', '2026-10-25')
  extended.revision = 2
  let newId = 0
  const expanded = reconcileOccurrences(
    initialEnrollment,
    extended,
    initial,
    () => `new-${newId++}`,
  )
  for (const original of initial)
    assert.equal(expanded.find((o) => o.id === original.id)!.slotOrdinal, original.slotOrdinal)
  assert.ok(
    expanded.filter((o) => !initial.some((p) => p.id === o.id)).every((o) => o.slotOrdinal === 1),
  )
})
test('weekday edits preserve occurrence identity and a later period includes an accepted user move override', () => {
  const before = enrollment(),
    original = reconcileOccurrences(null, before, [], ids())
  const after = structuredClone(before)
  after.revision++
  after.content.stages[0]!.slots[0]!.weekday = 7
  const revised = reconcileOccurrences(before, after, original, ids())
  assert.equal(revised.length, 4)
  assert.equal(revised.find((o) => o.id === original[0]!.id)!.scheduledDate, '2026-10-25')
  const moved = moveWithinWeek(original[0]!, before, '2026-10-25', false)
  const shortened = structuredClone(before)
  shortened.revision++
  shortened.content.stages[0]!.endDate = '2026-10-22'
  const retained = reconcileOccurrences(
    before,
    shortened,
    [moved, ...original.slice(1)],
    ids(),
  ).find((o) => o.id === moved.id)!
  assert.equal(retained.permittedDateOverride, '2026-10-25')
  assert.ok(isCompletionEligible(retained, shortened, '2026-10-25T14:00:00Z'))
})
test('four/three/one, partial-only, repeated work, late correction and void derive once per occurrence', () => {
  const current = enrollment(),
    occurrences = reconcileOccurrences(null, current, [], ids())
  const sessions = occurrences.slice(0, 3).map((o, i) => session(`session-${i}`, o.id))
  const base = {
    scope,
    week: occurrences[0]!.currentWeek,
    revision: 1,
    occurrences,
    enrollments: [current],
  }
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(deriveWeek({ ...base, sessions, asOf: '2026-10-26T04:00:00Z' })).filter(
        ([k]) => ['required', 'completed', 'missed', 'partial', 'pending'].includes(k),
      ),
    ),
    { required: 4, completed: 3, partial: 0, missed: 1, pending: 0 },
  )
  assert.equal(
    deriveWeek({
      ...base,
      sessions: [...sessions, session('extra', occurrences[0]!.id)],
      asOf: '2026-10-24T10:00:00Z',
    }).completed,
    3,
  )
  const partials = [session('partial', occurrences[0]!.id, 'partial')]
  assert.equal(deriveWeek({ ...base, sessions: partials, asOf: '2026-10-24T10:00:00Z' }).pending, 4)
  const corrected = [...sessions, session('session-0', occurrences[0]!.id, 'void', 2)]
  assert.equal(deriveWeek({ ...base, sessions: corrected, asOf: '2026-10-26T04:00:00Z' }).missed, 2)
  const next = enrollment('2026-10-26', '2026-11-01')
  next.revision = 2
  const moved = reconcileOccurrences(current, next, occurrences, ids())
  assert.equal(
    deriveWeek({
      ...base,
      occurrences: moved,
      sessions,
      enrollments: [next],
      asOf: '2026-11-02T05:00:00Z',
    }).required,
    0,
  )
  assert.equal(
    deriveWeek({
      ...base,
      occurrences: moved,
      sessions,
      enrollments: [next],
      week: moved[0]!.currentWeek,
      asOf: '2026-11-02T05:00:00Z',
    }).completed,
    0,
  )
})
