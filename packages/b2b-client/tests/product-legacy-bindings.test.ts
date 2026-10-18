import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  projectLegacyRoutine,
  AdoptLegacySupplementSchema,
} from '@klisteniapp/b2b-contracts/product-v2'
import { createProductV2Client } from '../src/index.ts'
const fixture = JSON.parse(
  readFileSync(
    new URL('../../b2b-contracts/tests/fixtures/product-v2.json', import.meta.url),
    'utf8',
  ),
)
const original = {
  schemaVersion: 1,
  revision: 0,
  scope: fixture.scope,
  original: fixture.legacyRetry,
  routine: fixture.legacyRoutine,
  createdAt: '2026-10-02T10:00:00Z',
}
const compatibility = {
  kind: 'legacy-compatibility',
  original: fixture.legacyRoutine,
  steps: projectLegacyRoutine(fixture.legacyRoutine).steps.map((s) => ({
    ...s,
    dose: { ...s.dose, laterality: 'bilateral' },
  })),
  relations: [],
}

test('named correction binding keeps revision zero separate from accepted state and retains unspecified load', async () => {
  const result = { original, accepted: null, prescription: compatibility }
  const client = createProductV2Client('member', 'atlas', {
    branchId: 'atlas-principal',
    role: 'member',
    fetch: async (url) => {
      assert.equal(String(url), '/api/b2b/orgs/atlas/product/v2/sessions/execution/binding')
      return new Response(JSON.stringify(result))
    },
  })
  assert.deepEqual(await client.call('sessionBinding', { id: 'execution' }), result)
})

test('adoption contract requires explicit source/shared confirmations and rejects ambiguous or duplicate targets', () => {
  const input = {
    id: 'assignment',
    operationId: 'adopt',
    expectedRevision: 0,
    sourceSnapshotHash: 'a'.repeat(64),
    sourceSteps: [
      { id: 'step', exerciseId: 'exercise', dose: fixture.dose, substitutionPolicy: 'reviewed' },
    ],
    sourceDosesConfirmed: true,
    sharedVersionConfirmed: true,
    targetConfirmations: [],
  }
  assert.equal(AdoptLegacySupplementSchema.safeParse(input).success, true)
  for (const change of [
    { sourceDosesConfirmed: false },
    { sharedVersionConfirmed: false },
    { expectedRevision: 1 },
    {
      sourceSteps: [
        { ...input.sourceSteps[0], dose: { ...fixture.dose, load: { mode: 'unspecified' } } },
      ],
    },
    {
      targetConfirmations: [
        { relationId: 'link', relationHash: 'b'.repeat(64) },
        { relationId: 'link', relationHash: 'b'.repeat(64) },
      ],
    },
  ])
    assert.equal(AdoptLegacySupplementSchema.safeParse({ ...input, ...change }).success, false)
})
