import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GoalProgramDraftContentSchema,
  GoalProgramContentSchema,
  ProductEndpoints,
  type ProductInput,
} from '@klisteniapp/b2b-contracts/product-v2'
import {
  goalContent,
  goalIssues,
  isGoalContent,
  localToday,
  referenceKey,
  stagePosition,
  mutationAttempt,
} from '../src/features/programs/product/programmingModel.ts'

type Content = ProductInput<'saveGoal'>['content']
function content(): Content {
  const routine = { programId: 'routine', version: 2, schemaVersion: 2 as const }
  return {
    name: 'Strength',
    goal: 'Steady practice',
    timeZone: 'America/New_York',
    stages: [
      {
        id: 'first',
        name: 'First',
        startDate: '2026-10-01',
        endDate: '2026-10-11',
        slots: [
          { id: 'a', weekday: 1, routine: { ...routine } },
          { id: 'b', weekday: 1, routine: { ...routine } },
        ],
      },
      {
        id: 'second',
        name: 'Second',
        startDate: '2026-10-15',
        endDate: '2026-11-01',
        slots: [{ id: 'c', weekday: 5, routine: { ...routine } }],
      },
    ],
  }
}
test('blank objectives/stages/dates/slots save as drafts while activation reports missing fields', () => {
  assert.deepEqual(GoalProgramDraftContentSchema.parse(goalContent()), goalContent())
  const draft = {
    ...goalContent(),
    stages: [
      {
        id: 'stage',
        name: '',
        startDate: null,
        endDate: null,
        slots: [{ id: 'slot', weekday: null, routine: null }],
      },
    ],
  }
  assert.equal(isGoalContent(draft), true)
  assert.ok(goalIssues(draft).some((i) => i.path.join('.') === 'stages.0.startDate'))
  assert.ok(goalIssues(draft).some((i) => i.path.join('.') === 'timeZone'))
  assert.equal(GoalProgramContentSchema.safeParse(draft).success, false)
})
test('ordered inclusive stages allow gaps, two same-day slots and identical immutable routine references', () => {
  const proposed = content()
  assert.deepEqual(goalIssues(proposed), [])
  assert.equal(proposed.stages[0].slots.length, 2)
  assert.equal(
    referenceKey(proposed.stages[0].slots[0].routine!),
    referenceKey(proposed.stages[1].slots[0].routine!),
  )
  const publishedBefore = structuredClone(proposed.stages[0].slots[0].routine)
  proposed.stages[1].startDate = '2026-10-16'
  assert.deepEqual(proposed.stages[0].slots[0].routine, publishedBefore)
  proposed.stages[1].startDate = '2026-10-11'
  assert.ok(goalIssues(proposed).some((i) => i.path.join('.') === 'stages.1.startDate'))
})
test('stage reordering/overlap and missing timezone are validation errors without implied device timezone', () => {
  const proposed = content()
  proposed.stages.reverse()
  assert.ok(goalIssues(proposed).length)
  proposed.stages.reverse()
  proposed.stages[0].endDate = '2026-09-30'
  assert.ok(goalIssues(proposed).some((i) => i.path.join('.') === 'stages.0.endDate'))
  proposed.timeZone = null
  assert.ok(goalIssues(proposed).some((i) => i.path.join('.') === 'timeZone'))
})
test('past/current/future stage preview uses enrollment calendar day across timezone and DST boundaries', () => {
  assert.equal(localToday('America/New_York', new Date('2026-10-17T02:00:00Z')), '2026-10-16')
  assert.equal(localToday('Pacific/Auckland', new Date('2026-10-17T12:00:00Z')), '2026-10-18')
  assert.equal(localToday('America/New_York', new Date('2026-11-01T06:30:00Z')), '2026-11-01')
  const stage = content().stages[0]
  assert.equal(stagePosition(stage, '2026-10-01'), 'Actual')
  assert.equal(stagePosition(stage, '2026-10-11'), 'Actual')
  assert.equal(stagePosition(stage, '2026-10-12'), 'Pasada')
  assert.equal(stagePosition(stage, '2026-09-30'), 'Futura')
  assert.equal(stagePosition({ ...stage, endDate: null }, '2026-10-01'), 'Sin fechas completas')
})
test('period apply preserves full proposal and server fingerprint; changing proposal creates a new operation', () => {
  const proposed = GoalProgramContentSchema.parse(content())
  const input = {
    enrollmentId: 'enrollment',
    expectedRevision: 3,
    previewHash: 'a'.repeat(64),
    proposed,
  }
  const before = structuredClone(input)
  assert.deepEqual(ProductEndpoints.applyPeriod.input.parse({ ...input, operationId: 'apply' }), {
    ...input,
    operationId: 'apply',
  })
  const attempt = mutationAttempt('applyPeriod', input, null, () => 'apply')
  assert.equal(mutationAttempt('applyPeriod', input, attempt).operationId, 'apply')
  assert.notEqual(
    mutationAttempt('applyPeriod', { ...input, previewHash: 'b'.repeat(64) }, attempt).operationId,
    'apply',
  )
  assert.deepEqual(input, before)
})
