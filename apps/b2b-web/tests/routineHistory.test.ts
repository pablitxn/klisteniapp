import assert from 'node:assert/strict'
import test from 'node:test'
import {
  actualEligibility,
  dateInZone,
  doseText,
  latestSessions,
  routineAnchor,
  routineReference,
  sessionAnchor,
  stagePosition,
} from '../src/features/training/routine-history/model.ts'
import { enrollment, legacy, occurrence, scope, session } from './routineHistoryFixtures.ts'

test('today follows each enrollment timezone across device day and DST boundaries', () => {
  assert.equal(dateInZone('2026-10-12T02:00:00Z', 'America/New_York'), '2026-10-11')
  assert.equal(dateInZone('2026-10-12T02:00:00Z', 'Asia/Tokyo'), '2026-10-12')
  assert.equal(dateInZone('2026-11-01T05:30:00Z', 'America/New_York'), '2026-11-01')
  assert.equal(dateInZone('2026-11-01T06:30:00Z', 'America/New_York'), '2026-11-01')
})
test('inclusive past, current, future and gap states preserve stage order', () => {
  const stages = enrollment().content.stages
  assert.equal(stagePosition(stages[0]!, '2026-10-01'), 'current')
  assert.equal(stagePosition(stages[0]!, '2026-10-14'), 'current')
  assert.equal(stagePosition(stages[0]!, '2026-10-15'), 'past')
  assert.equal(stagePosition(stages[1]!, '2026-10-15'), 'future')
  assert.equal(
    stages.some((stage) => stagePosition(stage, '2026-10-15') === 'current'),
    false,
  )
})
test('latest corrections replace legacy projections without changing original IDs or version links', () => {
  const old = legacy()
  const fixed = session('corrected', {
    origin: {
      kind: 'legacy',
      executionId: old.original.id,
      assignmentId: old.original.assignmentId,
      routine: routineReference(old),
    },
    revision: 1,
  })
  const next = { ...fixed, revision: 2 }
  const before = JSON.stringify([old, fixed, next])
  assert.deepEqual(latestSessions([old, next, fixed], scope), [next])
  assert.equal(JSON.stringify([old, fixed, next]), before)
  assert.equal(sessionAnchor(old), 'actual-session-old-log')
  assert.equal(routineAnchor(routineReference(next)), routineAnchor(routineReference(old)))
})
test('foreign tenant, branch and member records never enter history, including duplicate IDs', () => {
  const own = session()
  const foreign = ['organizationId', 'branchId', 'memberId'].map((key) =>
    session('session', { scope: { ...scope, [key]: 'foreign' }, revision: 99 }),
  )
  assert.deepEqual(latestSessions([...foreign, own], scope), [own])
})
test('period moves retain actual work and original lineage while excluding its former week', () => {
  const record = session()
  const moved = occurrence('occurrence', {
    scheduledDate: '2026-10-19',
    currentWeek: { startDate: '2026-10-19', timeZone: 'America/New_York' },
  })
  assert.equal(actualEligibility(record, [moved], [enrollment()]), 'excluded')
  assert.equal(record.content.sets[0]!.repetitions, 4)
  assert.equal(record.origin.routine.version, 2)
})
test('cancelled work stays excluded and an unloaded occurrence is unknown rather than missed', () => {
  assert.equal(
    actualEligibility(
      session(),
      [occurrence('occurrence', { eligibility: 'cancelled', cancellationReason: 'Period moved' })],
      [enrollment()],
    ),
    'excluded',
  )
  assert.equal(actualEligibility(session(), [], [enrollment()]), 'unknown')
  assert.equal(actualEligibility(legacy(), [], []), 'unplanned')
})
test('an accepted same-week override remains eligible beyond the original midweek stage end', () => {
  const record = session()
  record.content.performedAt = '2026-10-17T15:00:00Z'
  assert.equal(actualEligibility(record, [occurrence()], [enrollment()]), 'excluded')
  assert.equal(
    actualEligibility(
      record,
      [
        occurrence('occurrence', {
          scheduledDate: '2026-10-17',
          permittedDateOverride: '2026-10-17',
        }),
      ],
      [enrollment()],
    ),
    'eligible',
  )
})
test('range prescription and actual scalar values are displayed independently with explicit units', () => {
  const record = session()
  assert.match(doseText(record.content.segments[0]!.dose), /1–3 series · 5–8 rep · peso corporal/)
  assert.equal(record.content.sets[0]!.repetitions, 4)
})
