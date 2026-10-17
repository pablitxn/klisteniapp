import assert from 'node:assert/strict'
import {
  DoseSchema,
  ReviewedRelationSchema,
  RoutineDraftContentSchema,
  RoutineVersionV2Schema,
} from '../packages/b2b-contracts/src/product-v2.ts'
import {
  canonicalExercises,
  contentHash,
  projectReviewedRelations,
} from '../apps/b2b-api/src/catalog/reviewed-projection.ts'

export const REVIEWED_DURATION_FIXTURE_KEY = 'b2bp-alternatives-011-duration-v1'
export const SYNTHETIC_DURATION_DISCLAIMER =
  'SYNTHETIC TEST ONLY: the directed exercise pair and exercise identity come from the canonical catalog. ' +
  'The timed target dose is an independent contract/UI test prescription, without catalog, editorial or clinical dose review. ' +
  'It is not derived from source repetitions and asserts no real-world dose equivalence.'

/** Pure synthetic fixture construction, for the fresh activated test seed only.
 * The canonical revision binds exercise identity; it does not review this dose.
 * Never insert this relation into the canonical catalog or production projector. */
export function buildReviewedDurationFixture({ organizationId, branchId, programId, publishedAt }) {
  const catalog = canonicalExercises()
  const source = catalog.find((exercise) => exercise.id === 'calf-raise')
  assert.ok(source, 'The canonical synthetic-fixture source must exist')
  const canonicalRelation = projectReviewedRelations(source, catalog).find(
    (relation) => relation.targetExerciseId === 'single-leg-calf-raise',
  )
  assert.ok(
    canonicalRelation,
    'The synthetic fixture requires the existing canonical directed pair',
  )

  const sourceDose = DoseSchema.parse({
    mode: 'repetitions',
    sets: { kind: 'fixed', value: 1 },
    repetitions: { kind: 'fixed', value: 5 },
    durationSeconds: null,
    load: { mode: 'bodyweight' },
    restSeconds: { kind: 'fixed', value: 60 },
    laterality: 'bilateral',
    targetRpe: null,
    notes: 'SYNTHETIC TEST ONLY: independent source prescription for unit-switch coverage.',
  })
  const targetDose = DoseSchema.parse({
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
  const relation = ReviewedRelationSchema.parse({
    ...canonicalRelation,
    id: `synthetic-${REVIEWED_DURATION_FIXTURE_KEY}`,
    rationale: SYNTHETIC_DURATION_DISCLAIMER,
    requirements: [
      ...canonicalRelation.requirements.filter(
        (requirement) =>
          !requirement.startsWith('reviewed-on:') && !requirement.startsWith('source:'),
      ),
      `fixture:${REVIEWED_DURATION_FIXTURE_KEY}`,
      'dose-provenance:independent-synthetic-test-prescription',
      'review-scope:contract-and-ui-test-only',
    ],
    targetDose,
  })
  const content = RoutineDraftContentSchema.parse({
    name: 'SYNTHETIC TEST ONLY: repetitions-to-duration prescription',
    description: SYNTHETIC_DURATION_DISCLAIMER,
    steps: [
      {
        id: 'synthetic-repetitions-source',
        exerciseId: source.id,
        dose: sourceDose,
        substitutionPolicy: 'reviewed',
      },
    ],
  })
  const snapshot = RoutineVersionV2Schema.parse({
    ...content,
    schemaVersion: 2,
    programId,
    version: 1,
    scope: { organizationId, branchId },
    publishedAt,
    exercises: [source, relation.target],
    machines: [],
    relations: [relation],
  })
  const manifest = {
    fixtureKey: REVIEWED_DURATION_FIXTURE_KEY,
    kind: 'synthetic-contract-fixture',
    scenarioId: 'B2BP-ALTERNATIVES-011',
    organizationId: snapshot.scope.organizationId,
    branchId: snapshot.scope.branchId,
    programId: snapshot.programId,
    version: snapshot.version,
    schemaVersion: snapshot.schemaVersion,
    stepId: snapshot.steps[0].id,
    relationId: relation.id,
    canonicalDirectedPair: {
      relationId: canonicalRelation.id,
      relationHash: contentHash(canonicalRelation),
      catalogRevision: canonicalRelation.catalogRevision,
      sourceExerciseId: canonicalRelation.sourceExerciseId,
      targetExerciseId: canonicalRelation.targetExerciseId,
      sourceContentHash: canonicalRelation.sourceContentHash,
      targetContentHash: canonicalRelation.targetContentHash,
    },
    syntheticTargetDose: {
      provenance: 'independent-synthetic-test-prescription',
      reviewScope: 'contract-and-ui-test-only',
      disclaimer: SYNTHETIC_DURATION_DISCLAIMER,
      hash: contentHash(targetDose),
    },
    routineHash: contentHash(snapshot),
  }
  return { content, snapshot, manifest }
}
