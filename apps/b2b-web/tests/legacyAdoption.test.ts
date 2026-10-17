import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, createProductV2Client } from '@klisteniapp/b2b-client'
import { ProductEndpoints } from '@klisteniapp/b2b-contracts/product-v2'
import {
  adoptionFailure,
  adoptionMatchesPreview,
  canReviewLegacy,
  changeAdoptionSource,
  eligibleProposals,
  issuedDraftMatches,
  newAdoptionReview,
  prepareLegacyAdoption,
  previewMatchesAssignment,
  proposalKey,
} from '../src/features/programs/legacy-adoption/legacyAdoptionModel.ts'
import {
  confirmedLegacyReview,
  legacyAdoptionFixture,
  syntheticLegacySupplement,
} from './legacyAdoptionFixture.ts'

test('source review starts with unknown load, laterality and manual-list policy unconfirmed', () => {
  const { preview } = legacyAdoptionFixture()
  const review = newAdoptionReview(preview)
  assert.deepEqual(
    review.sources.map((s) => [s.load, s.laterality, s.policy]),
    [
      [null, null, null],
      [null, null, null],
    ],
  )
  assert.equal(prepareLegacyAdoption(preview, review, null).ok, false)
  assert.deepEqual(eligibleProposals(preview, review), [])
  assert.equal(
    prepareLegacyAdoption(
      preview,
      { ...review, sourceDosesConfirmed: true, sharedVersionConfirmed: true },
      null,
    ).ok,
    false,
  )
})
test('every eligible directed proposal requires the exact displayed hash, never just a relation ID', () => {
  const { preview } = legacyAdoptionFixture()
  const review = confirmedLegacyReview(preview)
  assert.equal(
    prepareLegacyAdoption(
      preview,
      { ...review, confirmedTargets: [preview.proposals[0].relation.id] },
      null,
    ).ok,
    false,
  )
  const prepared = prepareLegacyAdoption(preview, review, null, () => 'operation')
  assert.ok(prepared.ok)
  assert.deepEqual(
    prepared.attempt.input.targetConfirmations,
    preview.proposals.map(({ relation, hash }) => ({
      relationId: relation.id,
      relationHash: hash,
    })),
  )
  assert.equal('targetDose' in prepared.attempt.input, false)
  assert.equal(prepared.attempt.input.expectedRevision, 0)
})
test('a blocked step contributes no targets while raw snapshots and manual variants remain unchanged', () => {
  const { preview } = legacyAdoptionFixture()
  const before = structuredClone(preview)
  const review = confirmedLegacyReview(preview)
  review.sources.forEach((s) => {
    s.policy = 'blocked'
  })
  review.confirmedTargets = []
  const result = prepareLegacyAdoption(preview, review, null)
  assert.ok(result.ok)
  assert.deepEqual(result.attempt.input.targetConfirmations, [])
  assert.equal(result.attempt.input.sourceSteps[0].substitutionPolicy, 'blocked')
  assert.deepEqual(preview, before)
  assert.deepEqual(preview.original.steps[0].alternatives, ['manual-variant'])
})
test('known zero load and source scalar fields cannot be replaced by a source choice', () => {
  const { preview } = legacyAdoptionFixture()
  const result = prepareLegacyAdoption(preview, confirmedLegacyReview(preview), null)
  assert.ok(result.ok)
  const [unknown, known] = result.attempt.input.sourceSteps
  assert.deepEqual(unknown.dose.load, { mode: 'bodyweight' })
  assert.deepEqual(known.dose.load, { mode: 'external', kilograms: { kind: 'fixed', value: 0 } })
  assert.equal(known.dose.mode, 'duration')
  assert.deepEqual(known.dose.durationSeconds, { kind: 'fixed', value: 30 })
  assert.deepEqual(known.dose.restSeconds, { kind: 'fixed', value: 0 })
  assert.deepEqual(unknown.dose.repetitions, { kind: 'fixed', value: 8 })
  assert.equal(unknown.dose.notes, preview.original.steps[0].notes)
})
test('unknown external load requires an explicitly entered finite in-range value, including explicit zero', () => {
  const { preview } = legacyAdoptionFixture()
  for (const kilograms of ['', ' ', '-1', '1001', 'Infinity', 'NaN']) {
    const review = confirmedLegacyReview(preview)
    review.sources[0].load = { mode: 'external', kilograms }
    assert.equal(prepareLegacyAdoption(preview, review, null).ok, false)
  }
  const review = confirmedLegacyReview(preview)
  review.sources[0].load = { mode: 'external', kilograms: '0' }
  const result = prepareLegacyAdoption(preview, review, null)
  assert.ok(result.ok)
  assert.deepEqual(result.attempt.input.sourceSteps[0].dose.load, {
    mode: 'external',
    kilograms: { kind: 'fixed', value: 0 },
  })
})
test('source decisions and conflict refresh require renewed source/shared/target confirmations', () => {
  const { preview } = legacyAdoptionFixture()
  const changed = changeAdoptionSource(confirmedLegacyReview(preview), 'unknown', {
    laterality: 'per-side',
  })
  assert.equal(changed.sourceDosesConfirmed, false)
  assert.equal(changed.sharedVersionConfirmed, false)
  assert.deepEqual(changed.confirmedTargets, [])
  assert.equal(prepareLegacyAdoption(preview, changed, null).ok, false)
  const refreshed = newAdoptionReview(structuredClone(preview))
  assert.equal(refreshed.sourceDosesConfirmed, false)
  const changedPreview = structuredClone(preview)
  changedPreview.proposals[0].hash = '8'.repeat(64)
  changedPreview.proposals[0].relation.targetDose.durationSeconds = {
    kind: 'range',
    min: 20,
    max: 50,
  }
  assert.equal(
    prepareLegacyAdoption(changedPreview, confirmedLegacyReview(preview), null).ok,
    false,
  )
})
test('preview is bound to the actual member assignment, immutable version and original scalar projection', () => {
  const { preview, assignment } = legacyAdoptionFixture()
  assert.equal(previewMatchesAssignment(preview, assignment), true)
  for (const scope of [
    { ...assignment.scope, organizationId: 'other' },
    { ...assignment.scope, branchId: 'other' },
    { ...assignment.scope, memberId: 'other' },
  ])
    assert.equal(previewMatchesAssignment(preview, { ...assignment, scope }), false)
  assert.equal(previewMatchesAssignment(preview, { ...assignment, id: 'other' }), false)
  assert.equal(
    previewMatchesAssignment(preview, {
      ...assignment,
      routine: { ...assignment.routine, version: 2 },
    }),
    false,
  )
  const changed = structuredClone(preview)
  changed.draft.steps[0].dose.sets = { kind: 'fixed', value: 5 }
  assert.equal(issuedDraftMatches(changed), false)
  assert.equal(prepareLegacyAdoption(changed, confirmedLegacyReview(changed), null).ok, false)
})
test('staff capability, current account/branch and v1 assignment are required without granting member editing', () => {
  const { access, assignment } = legacyAdoptionFixture()
  assert.equal(canReviewLegacy(access, 'coach', assignment), true)
  assert.equal(canReviewLegacy(access, 'foreign', assignment), false)
  assert.equal(canReviewLegacy({ ...access, role: 'member' }, 'coach', assignment), false)
  assert.equal(canReviewLegacy({ ...access, capabilities: [] }, 'coach', assignment), false)
  assert.equal(
    canReviewLegacy(
      { ...access, accessMode: 'export-only', capabilities: ['export-own-records'] },
      'coach',
      assignment,
    ),
    false,
  )
  assert.equal(
    canReviewLegacy(access, 'coach', {
      ...assignment,
      scope: { ...assignment.scope, branchId: 'foreign' },
    }),
    false,
  )
  assert.equal(
    canReviewLegacy(access, 'coach', {
      ...assignment,
      routine: { ...assignment.routine, schemaVersion: 2 },
    }),
    false,
  )
})
test('network retry keeps its immutable operation identity; changing reviewed data creates a new operation', () => {
  const { preview } = legacyAdoptionFixture()
  const review = confirmedLegacyReview(preview)
  const first = prepareLegacyAdoption(preview, review, null, () => 'first')
  assert.ok(first.ok)
  const retry = prepareLegacyAdoption(preview, review, first.attempt, () => 'second')
  assert.ok(retry.ok)
  assert.deepEqual(retry.attempt.input, first.attempt.input)
  review.sources[0].load = { mode: 'external', kilograms: '10' }
  const changed = prepareLegacyAdoption(preview, review, first.attempt, () => 'second')
  assert.ok(changed.ok)
  assert.equal(changed.attempt.input.operationId, 'second')
})
test('saved supplement is displayed rather than readopted; mismatched accepted bindings fail closed', () => {
  const { preview } = legacyAdoptionFixture()
  const value = prepareLegacyAdoption(preview, confirmedLegacyReview(preview), null)
  assert.ok(value.ok)
  const adopted = syntheticLegacySupplement(preview, value.attempt.input)
  assert.equal(adoptionMatchesPreview(adopted, preview), true)
  assert.equal(
    adoptionMatchesPreview({ ...adopted, sourceSnapshotHash: '9'.repeat(64) }, preview),
    false,
  )
  assert.equal(
    adoptionMatchesPreview(
      { ...adopted, scope: { ...adopted.scope, memberId: 'foreign' } },
      preview,
    ),
    false,
  )
  assert.equal(
    prepareLegacyAdoption({ ...preview, supplement: adopted }, confirmedLegacyReview(preview), null)
      .ok,
    false,
  )
})
test('conflict refresh and revoked access differ from retryable server/network rejection', () => {
  assert.equal(adoptionFailure(new ApiError('changed', 409, 'REVISION_CONFLICT')), 'refresh')
  assert.equal(adoptionFailure(new ApiError('denied', 403, 'CONTEXT_REVOKED')), 'revoked')
  assert.equal(adoptionFailure(new ApiError('expired', 401)), 'revoked')
  assert.equal(adoptionFailure(new ApiError('lost', 0, 'NETWORK_ERROR')), 'retry')
  assert.equal(adoptionFailure(new ApiError('server', 500)), 'retry')
})
test('frozen client submits exact preview hash/target confirmations and current branch/version headers', async () => {
  const { preview } = legacyAdoptionFixture()
  const prepared = prepareLegacyAdoption(
    preview,
    confirmedLegacyReview(preview),
    null,
    () => 'operation',
  )
  assert.ok(prepared.ok)
  let sent: unknown
  let headers: Headers | undefined
  const client = createProductV2Client('coach', 'brand', {
    role: 'coach',
    branchId: 'center',
    fetch: async (_url, init) => {
      sent = JSON.parse(String(init?.body))
      headers = new Headers(init?.headers)
      return Response.json(syntheticLegacySupplement(preview, prepared.attempt.input))
    },
  })
  await client.call('adoptLegacySupplement', prepared.attempt.input)
  assert.deepEqual(ProductEndpoints.adoptLegacySupplement.input.parse(sent), prepared.attempt.input)
  assert.equal(headers!.get('X-Klisteni-B2B-Branch'), 'center')
  assert.equal(headers!.get('X-Klisteni-B2B-Contract'), '2')
  assert.equal(headers!.get('Idempotency-Key'), 'operation')
  assert.ok(
    preview.proposals.every((p) =>
      prepared.attempt.input.targetConfirmations.some((c) => c.relationHash === p.hash),
    ),
  )
  assert.equal(new Set(preview.proposals.map(proposalKey)).size, 2)
})
