import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createProductV2Client } from '../src/index.ts'
const fixture = JSON.parse(
  readFileSync(
    new URL('../../b2b-contracts/tests/fixtures/product-v2.json', import.meta.url),
    'utf8',
  ),
)

test('immutable publication reads retain the actual legacy discriminator through the public client', async () => {
  const stored = { schemaVersion: 1, snapshot: fixture.legacyRoutine }
  const client = createProductV2Client('member', 'atlas', {
    branchId: 'atlas-principal',
    role: 'member',
    fetch: async (url, init) => {
      assert.equal(String(url), '/api/b2b/orgs/atlas/product/v2/routines/routine/versions/1')
      assert.equal(new Headers(init?.headers).get('x-klisteni-b2b-contract'), '2')
      assert.equal(new Headers(init?.headers).get('x-klisteni-b2b-branch'), 'atlas-principal')
      return new Response(JSON.stringify(stored), { status: 200 })
    },
  })
  assert.deepEqual(await client.call('routineVersion', { id: 'routine', version: 1 }), stored)
})

test('publication choice responses remain strict and cannot invent a v2 reference from a projected draft', async () => {
  const choices = [
    { name: 'Original', reference: { programId: 'routine', version: 1, schemaVersion: 1 } },
  ]
  let invalid = false
  const client = createProductV2Client('coach', 'atlas', {
    branchId: 'atlas-principal',
    role: 'coach',
    fetch: async () =>
      new Response(JSON.stringify(invalid ? [{ ...choices[0], unreviewed: true }] : choices), {
        status: 200,
      }),
  })
  assert.deepEqual(await client.call('routinePublications', {}), choices)
  invalid = true
  await assert.rejects(client.call('routinePublications', {}))
})
