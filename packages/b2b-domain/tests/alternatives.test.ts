import assert from 'node:assert/strict'
import test from 'node:test'
import {
  RoutineVersionV2Schema,
  ReviewedRelationSchema,
  type SessionContent,
} from '@klisteniapp/b2b-contracts/product-v2'
import { ExerciseInputSchema, ExerciseSchema } from '@klisteniapp/b2b-contracts'
import {
  reviewedAlternatives,
  createOriginalSegment,
  createReviewedSegment,
  selectEffectiveSegment,
  restoreEffectiveSegment,
  emptyPerformedSet,
  segmentCoverage,
  checkEffectiveSegments,
  checkNewSegmentSelections,
} from '../src/alternatives.ts'

const at = '2026-10-17T12:00:00Z'
const scope = { organizationId: 'atlas', branchId: 'east' }
const dose = {
  mode: 'repetitions',
  sets: { kind: 'fixed', value: 3 },
  repetitions: { kind: 'fixed', value: 10 },
  durationSeconds: null,
  load: { mode: 'external', kilograms: { kind: 'fixed', value: 20 } },
  restSeconds: { kind: 'fixed', value: 60 },
  laterality: 'bilateral',
  targetRpe: 7,
  notes: '',
}
const target = ExerciseSchema.parse({
  ...ExerciseInputSchema.parse({ name: 'Target', instructions: ['Control'], equipment: 'rings' }),
  id: 'target',
  scope: 'base',
  status: 'published',
  version: 1,
  revision: 0,
  name: 'Target',
  instructions: ['Control'],
  equipment: 'rings',
})
const relation = ReviewedRelationSchema.parse({
  id: 'relation',
  sourceExerciseId: 'source',
  targetExerciseId: 'target',
  type: 'progression',
  conditions: [
    'target-requirements-confirmed',
    'use-target-dose',
    'accept-higher-demand',
    'accept-different-laterality',
  ],
  rationale: 'Reviewed directed progression',
  catalogRevision: 'a'.repeat(64),
  sourceContentHash: 'b'.repeat(64),
  targetContentHash: 'c'.repeat(64),
  requirements: ['Balance'],
  target,
  targetDose: {
    ...dose,
    mode: 'duration',
    sets: { kind: 'range', min: 2, max: 4 },
    repetitions: null,
    durationSeconds: { kind: 'range', min: 20, max: 30 },
    load: { mode: 'bodyweight' },
    laterality: 'per-side',
    restSeconds: { kind: 'fixed', value: 90 },
    targetRpe: null,
  },
})
const routine = RoutineVersionV2Schema.parse({
  schemaVersion: 2,
  programId: 'routine',
  version: 1,
  scope,
  publishedAt: at,
  name: 'Routine',
  description: '',
  steps: [{ id: 'step', exerciseId: 'source', substitutionPolicy: 'reviewed', dose }],
  exercises: [target],
  machines: [],
  relations: [relation],
})
const step = routine.steps[0]
const environment = { activeMachineIds: new Set<string>(), confirmedEquipment: new Set(['rings']) }
const segment = () =>
  createReviewedSegment(
    step,
    routine.relations,
    relation.id,
    relation.conditions,
    environment,
    'target-segment',
    at,
  )
const original = createOriginalSegment(step, 'original', at)
const content: SessionContent = {
  status: 'partial',
  explicitCompletion: false,
  performedAt: at,
  notes: '',
  segments: [original],
  selectedSegments: [{ originalStepId: 'step', segmentId: 'original' }],
  sets: [
    { ...emptyPerformedSet(original, 'actual', 1, 'both'), repetitions: 5, loadKg: 15, rpe: 8 },
  ],
  correctionReason: '',
}

test('directed reviewed options distinguish explicit per-step block and honest empty', () => {
  assert.equal(reviewedAlternatives(step, [relation]).kind, 'reviewed')
  assert.equal(
    reviewedAlternatives({ ...step, substitutionPolicy: 'blocked' }, [relation]).kind,
    'blocked',
  )
  assert.equal(reviewedAlternatives({ ...step, exerciseId: 'target' }, [relation]).kind, 'empty')
  assert.equal(
    reviewedAlternatives({ ...step, exerciseId: 'other' }, [relation]).relations.length,
    0,
  )
  assert.equal(reviewedAlternatives(step, []).kind, 'empty')
})
test('all relation kinds require every frozen condition and available target equipment', () => {
  for (const type of ['alternative', 'progression', 'regression'] as const) {
    const conditions: typeof relation.conditions = [
      'target-requirements-confirmed',
      'use-target-dose',
    ]
    if (type === 'progression') conditions.push('accept-higher-demand')
    if (type === 'regression') conditions.push('accept-lower-demand')
    const r = { ...relation, type, conditions }
    assert.equal(
      createReviewedSegment(step, [r], r.id, conditions, environment, type, at).relation?.type,
      type,
    )
    assert.throws(
      () => createReviewedSegment(step, [r], r.id, [], environment, type, at),
      /UNCONFIRMED/,
    )
    assert.throws(
      () =>
        createReviewedSegment(
          step,
          [r],
          r.id,
          conditions,
          { ...environment, confirmedEquipment: new Set() },
          type,
          at,
        ),
      /EQUIPMENT/,
    )
  }
  assert.throws(
    () =>
      createReviewedSegment(
        { ...step, substitutionPolicy: 'blocked' },
        [relation],
        relation.id,
        relation.conditions,
        environment,
        'id',
        at,
      ),
    /UNAVAILABLE/,
  )
})
test('machine compatibility needs an active inventory model even with generic confirmation', () => {
  const r = { ...relation, target: { ...target, machineId: 'machine' } }
  assert.throws(
    () => createReviewedSegment(step, [r], r.id, r.conditions, environment, 'id', at),
    /EQUIPMENT/,
  )
  assert.ok(
    createReviewedSegment(
      step,
      [r],
      r.id,
      r.conditions,
      { ...environment, activeMachineIds: new Set(['machine']) },
      'id',
      at,
    ),
  )
})
test('switching reps to timed/per-side uses target sets/rest/load and retains original actuals', () => {
  const selected = segment()
  const next = selectEffectiveSegment(content, selected)
  assert.deepEqual(next.sets, content.sets)
  assert.equal(next.segments.length, 2)
  assert.deepEqual(selected.dose, relation.targetDose)
  assert.deepEqual(emptyPerformedSet(selected, 'new', 1, 'left'), {
    performedSetId: 'new',
    segmentId: selected.segmentId,
    ordinal: 1,
    side: 'left',
    repetitions: null,
    durationSeconds: 0,
    loadKg: null,
    rpe: null,
    notes: '',
  })
  assert.equal(segmentCoverage(selected, next.sets), false)
  assert.deepEqual(content.selectedSegments, [{ originalStepId: 'step', segmentId: 'original' }])
})
test('explicit restore requires exact frozen prescription and cannot reuse segment identity for changed dose', () => {
  const next = selectEffectiveSegment(content, segment())
  assert.equal(
    restoreEffectiveSegment(next, structuredClone(original)).selectedSegments[0].segmentId,
    'original',
  )
  const changed = { ...original, dose: { ...original.dose, targetRpe: 9 } }
  assert.throws(() => restoreEffectiveSegment(next, changed), /MISMATCH/)
  assert.throws(() => selectEffectiveSegment(next, changed), /CONFLICT/)
  assert.throws(
    () => restoreEffectiveSegment(next, { ...original, segmentId: 'missing' }),
    /MISMATCH/,
  )
})
test('target minimum sets require each side, accept truthful below-target duration and reject source credit', () => {
  const selected = segment()
  const sets = [1, 2].flatMap((ordinal) =>
    (['left', 'right'] as const).map((side) => ({
      ...emptyPerformedSet(selected, `set-${ordinal}-${side}`, ordinal, side),
      durationSeconds: 1,
    })),
  )
  assert.equal(segmentCoverage(selected, sets), true)
  assert.equal(segmentCoverage(selected, sets.slice(1)), false)
  assert.equal(
    segmentCoverage({ ...selected, dose: { ...selected.dose, laterality: 'alternating' } }, sets),
    true,
  )
  const next = selectEffectiveSegment(content, selected)
  const completed = {
    ...next,
    status: 'completed' as const,
    explicitCompletion: true,
    sets: [...next.sets, ...sets],
  }
  assert.deepEqual(checkEffectiveSegments(routine, completed), { ok: true })
  assert.deepEqual(checkEffectiveSegments(routine, { ...completed, sets: next.sets }), {
    ok: false,
    code: 'INCOMPLETE_SEGMENT',
  })
  assert.equal(selectEffectiveSegment(completed, original).explicitCompletion, false)
})
test('forged relation/dose, changed block, wrong side, missing selection and duplicate set identity fail', () => {
  const selected = segment()
  const next = selectEffectiveSegment(content, selected)
  assert.equal(checkEffectiveSegments({ ...routine, relations: [] }, next).ok, false)
  assert.equal(
    checkEffectiveSegments(
      { ...routine, steps: [{ ...step, substitutionPolicy: 'blocked' }] },
      next,
    ).ok,
    false,
  )
  assert.equal(checkEffectiveSegments(routine, { ...next, selectedSegments: [] }).ok, false)
  assert.equal(
    checkEffectiveSegments(routine, { ...next, sets: [...next.sets, next.sets[0]] }).ok,
    false,
  )
  assert.equal(
    checkEffectiveSegments(routine, {
      ...next,
      sets: [...next.sets, { ...emptyPerformedSet(selected, 'bad', 1, 'both') }],
    }).ok,
    false,
  )
  assert.equal(
    checkEffectiveSegments(routine, {
      ...next,
      segments: [original, { ...selected, dose: { ...selected.dose, targetRpe: 8 } }],
    }).ok,
    false,
  )
})
test('timed source to reps target resets measurements; external target actual load must be independently entered', () => {
  const source = { ...step, dose: relation.targetDose }
  const repsRelation = {
    ...relation,
    targetDose: { ...step.dose, laterality: 'bilateral' as const },
  }
  const selected = createReviewedSegment(
    source,
    [repsRelation],
    relation.id,
    relation.conditions,
    environment,
    'reps',
    at,
  )
  assert.equal(emptyPerformedSet(selected, 'set', 1, 'both').durationSeconds, null)
  assert.equal(emptyPerformedSet(selected, 'set', 1, 'both').loadKg, null)
  const sets = [1, 2, 3].map((ordinal) => ({
    ...emptyPerformedSet(selected, `r-${ordinal}`, ordinal, 'both'),
    repetitions: 1,
    loadKg: 0,
  }))
  assert.equal(segmentCoverage(selected, sets), true)
  assert.equal(
    segmentCoverage(
      selected,
      sets.map((set) => ({ ...set, loadKg: null })),
    ),
    false,
  )
})

test('server selection checks current equipment for new segments while retaining historical work', () => {
  const selected = segment()
  const next = selectEffectiveSegment(content, selected)
  const absent = { activeMachineIds: new Set<string>(), confirmedEquipment: new Set<string>() }
  assert.deepEqual(checkNewSegmentSelections(routine, next, content, absent), {
    ok: false,
    code: 'TARGET_EQUIPMENT_UNAVAILABLE',
  })
  assert.deepEqual(checkNewSegmentSelections(routine, next, content, environment), { ok: true })
  assert.deepEqual(checkNewSegmentSelections(routine, next, next, absent), { ok: true })
  assert.equal(
    checkNewSegmentSelections(
      routine,
      { ...next, segments: [selected], sets: [] },
      content,
      environment,
    ).ok,
    false,
  )
})
