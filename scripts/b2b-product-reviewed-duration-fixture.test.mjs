import assert from 'node:assert/strict'
import test from 'node:test'
import { exercises } from '../packages/catalog-base/src/index.ts'
import {
  canonicalExerciseInput,
  canonicalExercises,
  contentHash,
  isUnchangedCanonical,
  projectReviewedRelations,
  REVIEWED_CATALOG_REVISION,
} from '../apps/b2b-api/src/catalog/reviewed-projection.ts'
import { assertNewReviewedCatalogEligibility } from '../apps/b2b-api/src/catalog/reviewed-alternatives.ts'
import {
  checkEffectiveSegments,
  checkNewSegmentSelections,
  createOriginalSegment,
  createReviewedSegment,
  emptyPerformedSet,
  selectEffectiveSegment,
} from '../packages/b2b-domain/src/alternatives.ts'
import {
  buildReviewedDurationFixture,
  REVIEWED_DURATION_FIXTURE_KEY,
  SYNTHETIC_DURATION_DISCLAIMER,
} from './b2b-product-reviewed-duration-fixture.mjs'

const at = '2026-10-17T12:00:00Z'
const input = {
  organizationId: 'synthetic-org',
  branchId: 'synthetic-main',
  programId: 'synthetic-duration-routine',
  publishedAt: at,
}
const environment = { activeMachineIds: new Set(), confirmedEquipment: new Set() }

function selection({ externalSource = false } = {}) {
  const { snapshot } = buildReviewedDurationFixture(input)
  if (externalSource)
    snapshot.steps[0].dose.load = { mode: 'external', kilograms: { kind: 'fixed', value: 15 } }
  const step = snapshot.steps[0]
  const relation = snapshot.relations[0]
  const original = createOriginalSegment(step, 'source-segment', at)
  const previous = {
    status: 'partial',
    explicitCompletion: false,
    performedAt: at,
    notes: '',
    correctionReason: '',
    segments: [original],
    selectedSegments: [{ originalStepId: step.id, segmentId: original.segmentId }],
    sets: [
      {
        ...emptyPerformedSet(original, 'source-actual', 1, 'both'),
        repetitions: 3,
        loadKg: externalSource ? 15 : null,
      },
    ],
  }
  const target = createReviewedSegment(
    step,
    snapshot.relations,
    relation.id,
    relation.conditions,
    environment,
    'target-segment',
    at,
  )
  const selected = selectEffectiveSegment(previous, target)
  return { snapshot, step, relation, previous, target, selected }
}

function targetActuals(target) {
  return [1, 2].flatMap((ordinal) =>
    ['left', 'right'].map((side) => ({
      ...emptyPerformedSet(target, `target-${ordinal}-${side}`, ordinal, side),
      durationSeconds: 1,
    })),
  )
}

test('synthetic fixture leaves the canonical 37 exercises and 42 repetition-target directions unchanged', () => {
  const before = contentHash(exercises)
  const catalog = canonicalExercises()
  const relations = catalog.flatMap((exercise) => projectReviewedRelations(exercise, catalog))
  const relationHash = contentHash(relations)
  buildReviewedDurationFixture(input)
  assert.equal(contentHash(exercises), before)
  assert.equal(catalog.length, 37)
  assert.equal(relations.length, 42)
  assert.deepEqual(
    ['alternative', 'progression', 'regression'].map(
      (kind) => relations.filter((relation) => relation.type === kind).length,
    ),
    [8, 17, 17],
  )
  assert.equal(relations.filter((relation) => relation.targetDose.mode === 'duration').length, 0)
  assert.equal(
    contentHash(
      canonicalExercises().flatMap((exercise) => projectReviewedRelations(exercise, catalog)),
    ),
    relationHash,
  )
})

test('fixture distinguishes real canonical pair identity from its independent synthetic timed dose', () => {
  const { content, snapshot, manifest } = buildReviewedDurationFixture(input)
  const catalog = canonicalExercises()
  const source = catalog.find((exercise) => exercise.id === 'calf-raise')
  const canonical = projectReviewedRelations(source, catalog).find(
    (relation) => relation.targetExerciseId === 'single-leg-calf-raise',
  )
  const relation = snapshot.relations[0]
  assert.notEqual(relation.id, canonical.id)
  for (const field of [
    'sourceExerciseId',
    'targetExerciseId',
    'type',
    'catalogRevision',
    'sourceContentHash',
    'targetContentHash',
    'conditions',
    'target',
  ])
    assert.deepEqual(relation[field], canonical[field])
  assert.ok(snapshot.exercises.every(isUnchangedCanonical))
  assert.equal(relation.target.equipment, 'none')
  assert.equal(relation.target.machineId, null)
  assert.deepEqual(relation.target.compatibleMachineIds, [])
  assert.equal(content.steps[0].dose.mode, 'repetitions')
  assert.deepEqual(content.steps[0].dose.repetitions, { kind: 'fixed', value: 5 })
  assert.deepEqual(relation.targetDose, {
    mode: 'duration',
    sets: { kind: 'fixed', value: 2 },
    repetitions: null,
    durationSeconds: { kind: 'range', min: 20, max: 30 },
    load: { mode: 'bodyweight' },
    restSeconds: { kind: 'fixed', value: 90 },
    laterality: 'per-side',
    targetRpe: null,
    notes: SYNTHETIC_DURATION_DISCLAIMER,
  })
  assert.equal(relation.rationale, SYNTHETIC_DURATION_DISCLAIMER)
  assert.ok(relation.requirements.includes(`fixture:${REVIEWED_DURATION_FIXTURE_KEY}`))
  assert.ok(!relation.requirements.some((value) => /^(source|reviewed-on):/.test(value)))
  assert.equal(manifest.kind, 'synthetic-contract-fixture')
  assert.equal(manifest.organizationId, input.organizationId)
  assert.equal(manifest.branchId, input.branchId)
  assert.equal(manifest.programId, input.programId)
  assert.equal(manifest.canonicalDirectedPair.relationId, canonical.id)
  assert.equal(manifest.canonicalDirectedPair.relationHash, contentHash(canonical))
  assert.equal(manifest.syntheticTargetDose.hash, contentHash(relation.targetDose))
  assert.equal(manifest.routineHash, contentHash(snapshot))
  assert.deepEqual(buildReviewedDurationFixture(input), { content, snapshot, manifest })
})

test('target selection retains source actuals and never inherits source load or repetition units', () => {
  const { snapshot, relation, previous, target, selected } = selection({ externalSource: true })
  assert.deepEqual(selected.sets, previous.sets)
  assert.deepEqual(selected.segments[0], previous.segments[0])
  assert.deepEqual(target.dose, relation.targetDose)
  assert.deepEqual(target.dose.load, { mode: 'bodyweight' })
  assert.equal(selected.explicitCompletion, false)
  assert.deepEqual(emptyPerformedSet(target, 'new-target-actual', 1, 'left'), {
    performedSetId: 'new-target-actual',
    segmentId: target.segmentId,
    ordinal: 1,
    side: 'left',
    repetitions: null,
    durationSeconds: 0,
    loadKg: null,
    rpe: null,
    notes: '',
  })
  assert.deepEqual(checkNewSegmentSelections(snapshot, selected, previous, environment), {
    ok: true,
  })
})

test('selected duration requires two sets on each side and permits truthful below-target actuals', () => {
  const { snapshot, previous, target, selected } = selection()
  const content = { ...selected, sets: [...selected.sets, ...targetActuals(target)] }
  assert.deepEqual(checkNewSegmentSelections(snapshot, content, previous, environment), {
    ok: true,
  })
  const completed = { ...content, status: 'completed', explicitCompletion: true }
  assert.deepEqual(checkEffectiveSegments(snapshot, completed), { ok: true })
  assert.deepEqual(
    checkEffectiveSegments(snapshot, {
      ...completed,
      sets: completed.sets.filter((set) => set.side !== 'right'),
    }),
    { ok: false, code: 'INCOMPLETE_SEGMENT' },
  )
  assert.deepEqual(checkEffectiveSegments(snapshot, { ...completed, sets: previous.sets }), {
    ok: false,
    code: 'INCOMPLETE_SEGMENT',
  })
})

test('unchanged validators reject forged dose, relation, conditions and source-load credit', () => {
  const { snapshot, step, relation, target, selected } = selection()
  const replaceTarget = (changed) => ({
    ...selected,
    segments: selected.segments.map((segment) =>
      segment.segmentId === target.segmentId ? changed : segment,
    ),
  })
  for (const changed of [
    { ...target, dose: { ...target.dose, restSeconds: { kind: 'fixed', value: 60 } } },
    { ...target, relation: { ...relation, rationale: 'Forged canonical review' } },
    { ...target, confirmedConditions: relation.conditions.slice(1) },
  ])
    assert.deepEqual(checkEffectiveSegments(snapshot, replaceTarget(changed)), {
      ok: false,
      code: 'INVALID_SEGMENT',
    })
  assert.throws(
    () =>
      createReviewedSegment(
        step,
        snapshot.relations,
        relation.id,
        [],
        environment,
        'unconfirmed',
        at,
      ),
    /TARGET_CONDITIONS_UNCONFIRMED/,
  )
  assert.deepEqual(
    checkEffectiveSegments(snapshot, {
      ...selected,
      sets: [...selected.sets, { ...targetActuals(target)[0], loadKg: 15 }],
    }),
    { ok: false, code: 'INVALID_ACTUAL' },
  )
})

test('actual catalog eligibility accepts only an available unchanged canonical target and real revision', async () => {
  const { target, selected, previous } = selection()
  const canonicalTarget = exercises.find((exercise) => exercise.id === target.exerciseId)
  const row = {
    id: canonicalTarget.id,
    data: canonicalExerciseInput(canonicalTarget),
    status: 'published',
    version: 1,
    revision: 0,
  }
  // Read-only database stand-in: runtime authorization/eligibility code is used
  // unchanged. Live branch filtering is covered by the composed harness owner.
  const context = (rows, accessMode = 'active') => ({
    ...input,
    accessMode,
    db: {
      async query(_sql, values) {
        assert.deepEqual(values, [[target.exerciseId], input.organizationId, input.branchId])
        return { rows }
      },
    },
  })
  await assertNewReviewedCatalogEligibility(context([row]), selected, previous)
  for (const rows of [
    [],
    [{ ...row, revision: 1 }],
    [{ ...row, status: 'archived' }],
    [{ ...row, data: { ...row.data, instructions: ['Changed local content'] } }],
  ])
    await assert.rejects(
      assertNewReviewedCatalogEligibility(context(rows), selected, previous),
      (error) => error.code === 'REVIEWED_TARGET_UNAVAILABLE',
    )
  const forged = structuredClone(selected)
  forged.segments.find((segment) => segment.relation).relation.catalogRevision = '0'.repeat(64)
  assert.notEqual('0'.repeat(64), REVIEWED_CATALOG_REVISION)
  await assert.rejects(
    assertNewReviewedCatalogEligibility(context([row]), forged, previous),
    (error) => error.code === 'REVIEWED_TARGET_UNAVAILABLE',
  )
  await assert.rejects(
    assertNewReviewedCatalogEligibility(context([row], 'export-only'), selected, previous),
    (error) => error.code === 'FORBIDDEN',
  )
})
