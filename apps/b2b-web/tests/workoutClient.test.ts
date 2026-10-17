import assert from 'node:assert/strict'
import test from 'node:test'
import { createProductV2Client } from '@klisteniapp/b2b-client/product-v2'
import { createWorkoutClient } from '../src/features/training/sync/workoutClient.ts'
import { routine, access, draft, receipt } from './fixtures/workout.ts'

function client(response: unknown) {
  const requests: { url: string; headers: Headers; signal: AbortSignal | null | undefined }[] = []
  const api = createWorkoutClient((signal) =>
    createProductV2Client('member', 'gym', {
      role: 'member',
      branchId: 'east',
      signal,
      fetch: async (url, options) => {
        requests.push({
          url: String(url),
          headers: new Headers(options?.headers),
          signal: options?.signal,
        })
        return Response.json(response)
      },
    }),
  )
  return { api, requests }
}
test('workout immutable reader uses amendment 003 named client endpoint and exact selected context', async () => {
  const { api, requests } = client({ schemaVersion: 2, snapshot: routine })
  const signal = new AbortController().signal
  const stored = await api.routineVersion(
    { programId: routine.programId, version: routine.version, schemaVersion: 2 },
    signal,
  )
  assert.deepEqual(stored, { schemaVersion: 2, snapshot: routine })
  assert.equal(requests[0].url, '/api/b2b/orgs/gym/product/v2/routines/routine/versions/1')
  assert.equal(requests[0].headers.get('X-Klisteni-B2B-Contract'), '2')
  assert.equal(requests[0].headers.get('X-Klisteni-B2B-Branch'), 'east')
  assert.equal(requests[0].headers.get('X-Klisteni-B2B-Account'), 'member')
  assert.equal(requests[0].headers.get('X-Klisteni-B2B-Role'), 'member')
})
test('workout reader refuses incompatible discriminator and aborts before any departed-context read', async () => {
  const { api, requests } = client({ schemaVersion: 2, snapshot: routine })
  await assert.rejects(
    api.routineVersion(
      { programId: routine.programId, version: routine.version, schemaVersion: 1 },
      new AbortController().signal,
    ),
    /discriminator/,
  )
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    api.routineVersion(
      { programId: routine.programId, version: routine.version, schemaVersion: 2 },
      controller.signal,
    ),
    (error) => error instanceof DOMException && error.name === 'AbortError',
  )
  assert.equal(requests.length, 1)
})
test('conflict recovery loads latest actual revision from sessionRevisions, never routine choices', async () => {
  const d = draft()
  const first = (
    await receipt({
      id: d.id,
      operationId: 'first',
      expectedRevision: 0,
      origin: d.origin,
      content: d.content,
    })
  ).session
  const second = { ...first, revision: 2, operationId: 'second' }
  const { api, requests } = client([second, first])
  assert.equal((await api.latestRevision(d.id, new AbortController().signal)).revision, 2)
  assert.equal(requests[0].url, '/api/b2b/orgs/gym/product/v2/sessions/session/revisions')
})
test('access and save adapter call the real typed product client with each operation signal', async () => {
  const accessClient = client(access)
  assert.deepEqual(await accessClient.api.transport.access(new AbortController().signal), access)
  const d = draft()
  const input = {
    id: d.id,
    operationId: 'save',
    expectedRevision: 0,
    origin: d.origin,
    content: d.content,
  }
  const saved = await receipt(input)
  const saveClient = client(saved)
  assert.deepEqual(await saveClient.api.transport.save(input, new AbortController().signal), saved)
  assert.equal(
    saveClient.requests[0].url,
    '/api/b2b/orgs/gym/product/v2/sessions/session/revisions',
  )
})

test('legacy immutable routine reader keeps its discriminator and does not invent missing dose fields', async () => {
  const { readFileSync } = await import('node:fs')
  const fixture = JSON.parse(
    readFileSync(
      new URL('../../../packages/b2b-contracts/tests/fixtures/product-v2.json', import.meta.url),
      'utf8',
    ),
  )
  const snapshot = fixture.legacyRoutine
  const before = JSON.stringify(snapshot)
  const { api } = client({ schemaVersion: 1, snapshot })
  const stored = await api.routineVersion(
    { programId: snapshot.programId, version: snapshot.version, schemaVersion: 1 },
    new AbortController().signal,
  )
  assert.equal(stored.schemaVersion, 1)
  assert.equal(JSON.stringify(snapshot), before)
  assert.deepEqual(stored.snapshot, snapshot)
})
