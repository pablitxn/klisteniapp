import assert from 'node:assert/strict';
import test from 'node:test';
import { ExercisePlanningSchema, validateExercisePlanningCatalog, type ExercisePlanning, type PlanningCatalogExercise } from '../src/index.ts';

const planning: ExercisePlanning = {
  movementFamily: 'horizontal-push', planningRoles: ['horizontal-push'], laterality: 'bilateral',
  requirements: { position: 'kneeling-plank', supports: ['palms', 'knees'], balance: 'stable-base', capabilities: [] },
  relations: [{
    targetId: 'full-pushup', type: 'progression', preservesRole: 'horizontal-push',
    conditions: ['target-requirements-confirmed', 'use-target-dose', 'accept-higher-demand', 'accept-different-supports'],
    rationale: 'La mayor palanca exige comprobar control y usar la dosis del destino.',
  }],
  review: {
    basis: 'editorial', reviewedOn: '2026-10-04',
    sourceUrls: ['https://www.acefitness.org/resources/everyone/exercise-library/13/bent-knee-push-up/'],
    scope: 'movement-classification-not-effect-equivalence',
  },
};

test('planning requires an explicit editorial review without claiming effect equivalence', () => {
  assert.deepEqual(ExercisePlanningSchema.parse(planning), planning);
  for (const review of [
    undefined,
    { ...planning.review, basis: 'clinically-validated' },
    { ...planning.review, reviewedOn: '2026-02-30' },
    { ...planning.review, sourceUrls: [] },
    { ...planning.review, sourceUrls: ['not-a-url'] },
    { ...planning.review, scope: 'equivalent-training-effect' },
  ]) assert.equal(ExercisePlanningSchema.safeParse({ ...planning, review }).success, false);
});

test('a relation cannot silently carry over dosage or skip target requirements and demand', () => {
  const relation = planning.relations[0];
  for (const required of ['target-requirements-confirmed', 'use-target-dose', 'accept-higher-demand']) {
    const conditions = relation.conditions.filter((condition) => condition !== required);
    assert.equal(ExercisePlanningSchema.safeParse({ ...planning, relations: [{ ...relation, conditions }] }).success, false, required);
  }
  assert.equal(ExercisePlanningSchema.safeParse({
    ...planning, relations: [{ ...relation, type: 'regression' }],
  }).success, false, 'progression consent is not regression consent');
  assert.equal(ExercisePlanningSchema.safeParse({
    ...planning, relations: [{ ...relation, conditions: [...relation.conditions, 'accept-lower-demand'] }],
  }).success, false, 'a progression cannot simultaneously claim lower demand');
});

test('relations resolve only canonical exercise IDs and are unambiguous per destination', () => {
  assert.equal(ExercisePlanningSchema.safeParse({
    ...planning, relations: [{ ...planning.relations[0], targetId: 'wall-pushup' }],
  }).success, false, 'a textual easier variant is not an available exercise ID');
  assert.equal(ExercisePlanningSchema.safeParse({
    ...planning, relations: [planning.relations[0], { ...planning.relations[0], type: 'alternative' }],
  }).success, false, 'conflicting relations to the same destination must be reviewed');
});

test('planning rejects incompatible roles and ambiguous requirement lists', () => {
  for (const patch of [
    { planningRoles: ['overhead-push'] },
    { planningRoles: ['horizontal-push', 'horizontal-push'] },
    { requirements: { ...planning.requirements, supports: [] } },
    { requirements: { ...planning.requirements, supports: ['palms', 'palms'] } },
    { requirements: { ...planning.requirements, capabilities: ['high-plank-control', 'high-plank-control'] } },
  ]) assert.equal(ExercisePlanningSchema.safeParse({ ...planning, ...patch }).success, false);
});

test('laterality distinguishes alternating repetitions from one side per series', () => {
  const alternating = ExercisePlanningSchema.parse({ ...planning, laterality: 'alternating', relations: [] });
  const unilateral = ExercisePlanningSchema.parse({ ...planning, laterality: 'unilateral', relations: [] });
  assert.equal(alternating.laterality, 'alternating');
  assert.equal(unilateral.laterality, 'unilateral');
});

function bridgeCatalog(): PlanningCatalogExercise[] {
  const shared: ExercisePlanning = {
    ...structuredClone(planning),
    movementFamily: 'supine-hip-extension', planningRoles: ['hip-extension'],
    requirements: { position: 'supine', supports: ['feet', 'upper-back'], balance: 'stable-base', capabilities: [] },
    relations: [],
  };
  return [{
    id: 'glute-bridge', reps: { perSide: false }, sources: [{ url: shared.review.sourceUrls[0] }],
    planning: {
      ...structuredClone(shared),
      relations: [{
        targetId: 'bridge-march', type: 'progression', preservesRole: 'hip-extension',
        conditions: ['target-requirements-confirmed', 'use-target-dose', 'accept-higher-demand'],
        rationale: 'Keep the bridge while progressively reducing support.',
      }],
    },
  }, {
    id: 'bridge-march', reps: { perSide: false }, sources: [{ url: shared.review.sourceUrls[0] }],
    planning: structuredClone(shared),
  }];
}

test('different balance demand needs explicit acceptance even when position and support names match', () => {
  const catalog = bridgeCatalog();
  catalog[1].planning.requirements.balance = 'reduced-support';
  assert.deepEqual(validateExercisePlanningCatalog(catalog).map(({ code }) => code), ['balance-condition']);
  catalog[0].planning.relations[0].conditions.push('accept-different-balance');
  assert.deepEqual(validateExercisePlanningCatalog(catalog), []);
});

test('alternating and unilateral doses need per-side counting and a swap cannot hide that change', () => {
  for (const laterality of ['alternating', 'unilateral'] as const) {
    const catalog = bridgeCatalog();
    catalog[1].planning.laterality = laterality;
    assert.ok(validateExercisePlanningCatalog(catalog).some(({ code }) => code === 'laterality'));
    catalog[1].reps.perSide = true;
    assert.deepEqual(validateExercisePlanningCatalog(catalog).map(({ code }) => code), ['laterality-condition']);
    catalog[0].planning.relations[0].conditions.push('accept-different-laterality');
    assert.deepEqual(validateExercisePlanningCatalog(catalog), []);
  }
});
