import { createHash } from 'node:crypto'
import {
  api,
  expect,
  type Page,
  type Principal,
  type ProductFixture,
  type TestInfo,
} from './app-fixture'

function fixtureHash(value: unknown): string {
  const normalize = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(normalize)
      : item !== null && typeof item === 'object'
        ? Object.fromEntries(
            Object.entries(item)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, child]) => [key, normalize(child)]),
          )
        : item
  return createHash('sha256')
    .update(JSON.stringify(normalize(value)))
    .digest('hex')
}

/** Consume the parent's explicit test prescription without publishing catalog content. */
export async function reviewedDurationFixture(
  page: Page,
  staff: Principal,
  product: ProductFixture,
  info: TestInfo,
) {
  const manifests = (product.resources.reviewedDuration ?? []).filter(
    (item) => item.organizationId === staff.organization.id && item.branchId === staff.branchId,
  )
  expect(
    manifests,
    'One accepted synthetic duration fixture in the actual staff scope',
  ).toHaveLength(1)
  const manifest = manifests[0]!
  expect(manifest).toMatchObject({
    fixtureKey: 'b2bp-alternatives-011-duration-v1',
    kind: 'synthetic-contract-fixture',
    scenarioId: 'B2BP-ALTERNATIVES-011',
    version: 1,
    schemaVersion: 2,
    canonicalDirectedPair: {
      sourceExerciseId: 'calf-raise',
      targetExerciseId: 'single-leg-calf-raise',
    },
    syntheticTargetDose: {
      provenance: 'independent-synthetic-test-prescription',
      reviewScope: 'contract-and-ui-test-only',
    },
  })
  const stored = await api(page, staff, 'routineVersion', {
    id: manifest.programId,
    version: manifest.version,
  })
  expect(stored.schemaVersion).toBe(2)
  if (stored.schemaVersion !== 2)
    throw new Error('The accepted timed fixture must be a v2 snapshot')
  const routine = stored.snapshot
  expect(routine).toMatchObject({
    programId: manifest.programId,
    version: manifest.version,
    scope: { organizationId: staff.organization.id, branchId: staff.branchId },
  })
  expect(fixtureHash(routine)).toBe(manifest.routineHash)
  const relation = routine.relations.find((item) => item.id === manifest.relationId)
  expect(relation, 'The exact frozen synthetic relation is present').toBeTruthy()
  if (!relation) throw new Error('The accepted timed fixture relation is missing')
  expect(relation).toMatchObject({
    sourceExerciseId: manifest.canonicalDirectedPair.sourceExerciseId,
    targetExerciseId: manifest.canonicalDirectedPair.targetExerciseId,
    sourceContentHash: manifest.canonicalDirectedPair.sourceContentHash,
    targetContentHash: manifest.canonicalDirectedPair.targetContentHash,
    catalogRevision: manifest.canonicalDirectedPair.catalogRevision,
    target: { equipment: 'none', machineId: null },
    targetDose: {
      mode: 'duration',
      sets: { kind: 'fixed', value: 2 },
      durationSeconds: { kind: 'range', min: 20, max: 30 },
      repetitions: null,
      restSeconds: { kind: 'fixed', value: 90 },
      laterality: 'per-side',
      load: { mode: 'bodyweight' },
    },
  })
  expect(fixtureHash(relation.targetDose)).toBe(manifest.syntheticTargetDose.hash)
  expect(manifest.syntheticTargetDose.disclaimer).toContain('SYNTHETIC TEST ONLY')
  expect(routine.description).toBe(manifest.syntheticTargetDose.disclaimer)
  expect(relation.rationale).toBe(manifest.syntheticTargetDose.disclaimer)
  expect(relation.targetDose.notes).toBe(manifest.syntheticTargetDose.disclaimer)
  expect(relation.requirements).toEqual(
    expect.arrayContaining([
      `fixture:${manifest.fixtureKey}`,
      'dose-provenance:independent-synthetic-test-prescription',
      'review-scope:contract-and-ui-test-only',
    ]),
  )
  expect(
    relation.requirements.some(
      (item) => item.startsWith('source:') || item.startsWith('reviewed-on:'),
    ),
  ).toBe(false)
  expect(routine.steps.find((item) => item.id === manifest.stepId)).toMatchObject({
    exerciseId: manifest.canonicalDirectedPair.sourceExerciseId,
    dose: { mode: 'repetitions' },
  })
  await info.attach('synthetic-duration-fixture-provenance', {
    contentType: 'application/json',
    body: JSON.stringify({
      manifest,
      verifiedRoutineHash: fixtureHash(routine),
      verifiedTargetDoseHash: fixtureHash(relation.targetDose),
    }),
  })
  return { routine, relation }
}
