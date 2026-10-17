import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, createB2BClient, createProductV2Client } from '../src/index.ts'
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
const capabilities = {
  schemaVersion: 2,
  minimumClientVersion: 2,
  activated: false,
  migration: '006-product-foundation',
}
test('product client explicitly binds identity, organization, branch and contract version', async () => {
  const requests: { path: string; init?: RequestInit }[] = []
  const client = createProductV2Client('actor', 'atlas', {
    branchId: 'east',
    role: 'coach',
    fetch: async (url, init) => {
      requests.push({ path: String(url), init })
      return json(capabilities)
    },
  })
  assert.deepEqual(await client.call('capabilities', {}), capabilities)
  assert.equal(requests[0]!.path, '/api/b2b/orgs/atlas/product/v2/capabilities')
  const init = requests[0]!.init!
  const headers = new Headers(init.headers)
  assert.equal(headers.get('X-Klisteni-B2B-Contract'), '2')
  assert.equal(headers.get('X-Klisteni-B2B-Account'), 'actor')
  assert.equal(headers.get('X-Klisteni-B2B-Branch'), 'east')
  assert.equal(init.cache, 'no-store')
  assert.equal(init.credentials, 'same-origin')
})
test('routine mutations preserve immutable retry payload and operation key and validate response', async () => {
  const requests: RequestInit[] = []
  const input = {
    id: 'routine',
    operationId: 'operation',
    expectedRevision: 0,
    content: { name: '', description: '', steps: [] },
  }
  const client = createProductV2Client('actor', 'atlas', {
    fetch: async (_url, init) => {
      requests.push(init!)
      return json({
        ...input.content,
        schemaVersion: 2,
        id: 'routine',
        scope: { organizationId: 'atlas', branchId: 'east' },
        revision: 1,
        publishedVersion: null,
        archivedAt: null,
      })
    },
  })
  await client.call('saveRoutine', input)
  await client.call('saveRoutine', input)
  for (const request of requests) {
    assert.deepEqual(JSON.parse(String(request.body)), input)
    assert.equal(new Headers(request.headers).get('Idempotency-Key'), 'operation')
  }
  assert.equal(requests[0]!.body, requests[1]!.body)
})
test('invalid product responses and old-tab upgrade responses fail explicitly without losing input', async () => {
  const client = createProductV2Client('actor', 'atlas', {
    fetch: async () => json({ ...capabilities, surprise: true }),
  })
  await assert.rejects(
    client.call('capabilities', {}),
    (e) => e instanceof ApiError && e.code === 'INVALID_RESPONSE',
  )
  const old = createProductV2Client('actor', 'atlas', {
    fetch: async () => json({ error: 'Upgrade', code: 'UPGRADE_REQUIRED' }, 426),
  })
  await assert.rejects(
    old.call('capabilities', {}),
    (e) => e instanceof ApiError && e.status === 426 && e.code === 'UPGRADE_REQUIRED',
  )
})
test('inactive export uses the restricted self namespace with selected organization', async () => {
  let path = ''
  const client = createProductV2Client('actor', 'atlas', {
    fetch: async (url) => {
      path = String(url)
      return json({ separateProduct: true, paid: true, automaticConversion: false, url: null })
    },
  })
  assert.equal((await client.call('b2cInvitation', {})).automaticConversion, false)
  assert.equal(path, '/api/b2b/self/b2c-invitation?organizationId=atlas')
})
test('legacy clients retain their existing headers and strict schemas', async () => {
  let headers = new Headers()
  const client = createB2BClient('actor', {
    fetch: async (_url, init) => {
      headers = new Headers(init?.headers)
      return json({ assignments: [] })
    },
  })
  assert.deepEqual(await client.assignments.list('atlas'), { assignments: [] })
  assert.equal(headers.get('X-Klisteni-B2B-Contract'), null)
})
test('structured activation issues survive transport with exact step and field paths', async () => {
  const issues = [
    {
      code: 'required',
      path: ['steps', 0, 'exerciseId'],
      stepId: 'step',
      message: 'Choose an exercise',
    },
  ]
  const client = createProductV2Client('actor', 'atlas', {
    fetch: async () => json({ error: 'Incomplete', code: 'INCOMPLETE_PRESCRIPTION', issues }, 422),
  })
  await assert.rejects(
    client.call('publishRoutine', { id: 'routine', operationId: 'operation', expectedRevision: 0 }),
    (error) => {
      assert.ok(error instanceof ApiError)
      assert.deepEqual(error.issues, issues)
      return true
    },
  )
})
test('v2 role selection carries organization superadmin without changing the legacy role enum', async () => {
  let role = ''
  const client = createProductV2Client('actor', 'atlas', {
    role: 'superadmin',
    fetch: async (_url, init) => {
      role = new Headers(init?.headers).get('X-Klisteni-B2B-Role')!
      return json(capabilities)
    },
  })
  await client.call('capabilities', {})
  assert.equal(role, 'superadmin')
})
