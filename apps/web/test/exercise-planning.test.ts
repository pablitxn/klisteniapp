import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ExerciseIdSchema,
  ExercisePlanningSchema,
  ExerciseSchema,
  validateExercisePlanningCatalog,
  type ExerciseId,
  type ExercisePlanning,
} from '@klisteniapp/scene-schema'
import { exercisePlanning } from '../src/data/exercise-planning.ts'
import { exercises } from '../src/data/exercises.ts'
import { parseProgress, serializeProgress } from '../src/lib/progress.ts'

function exercise(id: ExerciseId) {
  const result = exercises.find((item) => item.id === id)
  assert.ok(result, `missing ${id}`)
  return result
}

test('every available exercise has complete reviewed planning metadata and resolvable relations', () => {
  assert.equal(exercises.length, 37)
  assert.deepEqual(new Set(Object.keys(exercisePlanning)), new Set(ExerciseIdSchema.options))
  assert.deepEqual(validateExercisePlanningCatalog(exercises), [])
  for (const item of exercises) {
    assert.deepEqual(ExercisePlanningSchema.parse(item.planning), exercisePlanning[item.id])
    assert.equal(ExerciseSchema.safeParse({ ...item, planning: undefined }).success, false)
    assert.equal(item.reps.perSide, item.planning.laterality !== 'bilateral', `${item.id}: the dose counts each side`)
    for (const relation of item.planning.relations) assert.ok(exercise(relation.targetId))
  }
})

test('similar muscles and broad patterns do not imply interchangeable exercises', () => {
  const cases = [
    ['prone-w', 'row', 'scapular-accessory', 'horizontal-pull'],
    ['prone-t-raise', 'row', 'scapular-accessory', 'horizontal-pull'],
    ['prone-y-raise', 'row', 'scapular-accessory', 'horizontal-pull'],
    ['pike-pushup', 'full-pushup', 'overhead-push', 'horizontal-push'],
    ['crunch', 'dead-bug', 'trunk-flexion', 'trunk-stability'],
  ] as const
  for (const [sourceId, targetId, sourceRole, targetRole] of cases) {
    const source = exercise(sourceId)
    const target = exercise(targetId)
    assert.ok(source.planning.planningRoles.includes(sourceRole))
    assert.ok(target.planning.planningRoles.includes(targetRole))
    assert.notEqual(source.planning.movementFamily, target.planning.movementFamily)
    assert.ok(!source.planning.relations.some(({ targetId: id }) => id === targetId))
    assert.ok(!target.planning.relations.some(({ targetId: id }) => id === sourceId))
    const invalid = structuredClone(exercises)
    invalid.find(({ id }) => id === sourceId)!.planning.relations = [{
      targetId, type: 'alternative', preservesRole: sourceRole,
      conditions: ['target-requirements-confirmed', 'use-target-dose', 'accept-different-supports'],
      rationale: 'Fixture: sharing muscles does not preserve the exercise role.',
    }]
    const issues = validateExercisePlanningCatalog(invalid)
    assert.ok(issues.some(({ exerciseId, code }) => exerciseId === sourceId && code === 'role-mismatch'))
    assert.ok(issues.some(({ exerciseId, code }) => exerciseId === sourceId && code === 'family-mismatch'))
  }
})

test('available support requirements describe the demonstrated body position and equipment', () => {
  for (const id of ['pushup', 'bird-dog'] as const) {
    assert.ok(exercise(id).planning.requirements.supports.includes('knees'))
    assert.ok(exercise(id).planning.requirements.supports.includes('palms'))
  }
  for (const id of ['full-pushup', 'pike-pushup', 'mountain-climber'] as const) {
    assert.ok(exercise(id).planning.requirements.supports.includes('palms'))
    assert.ok(exercise(id).planning.requirements.supports.includes('forefeet'))
    assert.ok(!exercise(id).planning.requirements.supports.includes('knees'))
  }
  for (const id of ['squat', 'reverse-lunge', 'lateral-lunge', 'good-morning', 'calf-raise'] as const) {
    assert.equal(exercise(id).planning.requirements.position, 'standing')
  }
  for (const id of ['glute-bridge', 'dead-bug', 'crunch'] as const) {
    assert.equal(exercise(id).planning.requirements.position, 'supine')
  }
  assert.equal(exercise('prone-w').planning.requirements.position, 'prone')
  assert.equal(exercise('row').equipment, 'bar-or-rings')
  assert.ok(exercise('row').planning.requirements.supports.includes('grip'))
  assert.ok(exercise('row').planning.requirements.capabilities.includes('secure-bodyweight-grip'))
  assert.ok(exercises.filter(({ equipment }) => equipment === 'none').every(({ planning }) => !planning.requirements.supports.includes('grip')))
  assert.ok(exercises.filter(({ equipment }) => equipment === 'none').every(({ planning }) => !planning.planningRoles.includes('horizontal-pull')),
    'the equipment-free catalog still has no reviewed horizontal pulling exercise')
})

test('a push-up progression cannot hide the support change or point outside the available catalog', () => {
  const invalid = structuredClone(exercises)
  const knee = invalid.find(({ id }) => id === 'pushup')!
  const relation = knee.planning.relations.find(({ targetId }) => targetId === 'full-pushup')!
  assert.ok(relation)
  relation.conditions = relation.conditions.filter((condition) => condition !== 'accept-different-supports')
  assert.ok(validateExercisePlanningCatalog(invalid).some(({ code }) => code === 'support-condition'))
  assert.ok(validateExercisePlanningCatalog(exercises.filter(({ id }) => id !== 'full-pushup')).some(({ code }) => code === 'missing-target'))
  relation.targetId = 'pushup'
  assert.ok(validateExercisePlanningCatalog(invalid).some(({ code }) => code === 'self-relation'))
  assert.ok(validateExercisePlanningCatalog([...exercises, exercises[0]]).some(({ code }) => code === 'duplicate-id'))
})

test('catalog validation detects changed per-side dosage and invalid metadata without throwing', () => {
  const invalid = structuredClone(exercises)
  invalid.find(({ id }) => id === 'bird-dog')!.reps.perSide = false
  invalid.find(({ id }) => id === 'row')!.planning = { ...exercise('row').planning, review: undefined } as unknown as ExercisePlanning
  const issues = validateExercisePlanningCatalog(invalid)
  assert.ok(issues.some(({ exerciseId, code }) => exerciseId === 'bird-dog' && code === 'laterality'))
  assert.ok(issues.some(({ exerciseId, code }) => exerciseId === 'row' && code === 'invalid-metadata'))
})

test('planning provenance stays visible in the exercise sources and documents adapted demonstrations', () => {
  const invalid = structuredClone(exercises)
  invalid[0].planning.review.sourceUrls = ['https://example.org/unreviewed-source']
  assert.ok(validateExercisePlanningCatalog(invalid).some(({ code }) => code === 'unlisted-source'))
  for (const id of ['calf-raise', 'lateral-lunge', 'good-morning', 'mountain-climber', 'crunch'] as const) {
    assert.ok(exercise(id).planning.review.adaptationNote?.trim(), `${id}: the demonstrated adaptation needs an explicit evidence boundary`)
  }
})

test('editorial metadata neither becomes mandatory in old workout exports nor changes saved IDs or doses', () => {
  const data = {
    version: 1 as const,
    workouts: [{
      id: 'catalog-history', date: '2026-10-04', completedAt: '2026-10-04T12:00:00Z', durationMinutes: 30,
      exercises: exercises.map(({ id }, index) => ({ exerciseId: id, sets: 2, reps: index + 3 })),
    }],
    cardio: [],
  }
  const serialized = serializeProgress(data)
  assert.ok(!serialized.includes('planning'))
  assert.deepEqual(parseProgress(serialized), { data, error: null })
})
