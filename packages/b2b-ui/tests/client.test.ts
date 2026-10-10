import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, createB2BClient } from '../src/client.ts'
import { ExerciseInputSchema } from '@klisteniapp/b2b-contracts'

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const exercise = {
  ...ExerciseInputSchema.parse({ name: 'Remo', instructions: ['Prepará la posición.'] }),
  id: 'exercise-1',
  scope: 'organization',
  status: 'draft',
  version: 0,
  revision: 1,
}
const apiError = (status: number, code: string) => (error: unknown) =>
  error instanceof ApiError && error.status === status && error.code === code

test('named reads validate responses and keep each originating account bound to the request', async () => {
  const requests: { path: string; init?: RequestInit }[] = []
  const fetcher: typeof fetch = async (path, init) => {
    requests.push({ path: String(path), init })
    return json({ assignments: [] })
  }
  const first = createB2BClient('first-account', { fetch: fetcher })
  const second = createB2BClient('second-account', { fetch: fetcher })
  assert.deepEqual(await first.assignments.list('gym-1', 'member&other=true'), { assignments: [] })
  await second.assignments.list('gym-2')
  await first.assignments.list('gym-1')
  assert.equal(requests[0].path, '/api/b2b/orgs/gym-1/assignments?memberId=member%26other%3Dtrue')
  assert.deepEqual(
    requests.map((request) => new Headers(request.init?.headers).get('X-Klisteni-B2B-Account')),
    ['first-account', 'second-account', 'first-account'],
  )
  for (const request of requests) {
    assert.equal(request.init?.credentials, 'same-origin')
    assert.equal(request.init?.cache, 'no-store')
    assert.equal(request.init?.method, 'GET')
  }
})

test('catalog response validation rejects nested invalid media and missing required response fields', async () => {
  const valid = createB2BClient('account', { fetch: async () => json({ exercises: [exercise] }) })
  assert.equal((await valid.catalog.listExercises('gym')).exercises[0].id, 'exercise-1')
  const malformed = [
    {
      ...exercise,
      assets: [
        { id: 'bad', kind: 'image', url: 'javascript:alert(1)', label: 'Photo', attribution: '' },
      ],
    },
    { ...exercise, status: 'invented' },
    { ...exercise, revision: '1' },
    Object.fromEntries(Object.entries(exercise).filter(([key]) => key !== 'assets')),
  ]
  for (const value of malformed) {
    const client = createB2BClient('account', { fetch: async () => json({ exercises: [value] }) })
    await assert.rejects(client.catalog.listExercises('gym'), apiError(502, 'INVALID_RESPONSE'))
  }
})

test('invalid JSON and unexpected empty successful responses are contract errors, not network errors', async () => {
  for (const response of [
    new Response('<html>proxy page</html>'),
    new Response(null, { status: 204 }),
  ]) {
    const client = createB2BClient('account', { fetch: async () => response })
    await assert.rejects(client.me(), apiError(502, 'INVALID_RESPONSE'))
  }
})

test('server conflict and session errors preserve status, code and safe message', async () => {
  for (const [status, code] of [
    [401, 'ACCOUNT_CHANGED'],
    [403, 'FORBIDDEN'],
    [409, 'REVISION_CONFLICT'],
  ] as const) {
    const client = createB2BClient('old-account', {
      fetch: async () => json({ error: 'Actualizá tu sesión.', code }, status),
    })
    await assert.rejects(
      client.members.update('gym', 'member', { active: false }),
      (error: unknown) =>
        apiError(status, code)(error) &&
        error instanceof Error &&
        error.message === 'Actualizá tu sesión.',
    )
  }
  const client = createB2BClient(undefined, {
    fetch: async () => new Response('unreadable failure', { status: 401 }),
  })
  await assert.rejects(
    client.me(),
    (error: unknown) =>
      apiError(401, 'REQUEST_FAILED')(error) &&
      error instanceof Error &&
      error.message.includes('Iniciá sesión'),
  )
})

test('writes use named route, validated input and the account guard', async () => {
  let calls = 0
  const client = createB2BClient('account-1', {
    fetch: async (path, init) => {
      calls++
      assert.equal(path, '/api/b2b/orgs/gym/exercises/exercise-1')
      assert.equal(init?.method, 'PUT')
      assert.equal(new Headers(init?.headers).get('X-Klisteni-B2B-Account'), 'account-1')
      assert.equal(new Headers(init?.headers).get('Content-Type'), 'application/json')
      assert.equal(JSON.parse(String(init?.body)).expectedRevision, 1)
      return json({ exercise: { ...exercise, revision: 2 } })
    },
  })
  assert.equal(
    (
      await client.catalog.updateExercise('gym', 'exercise-1', {
        name: 'Remo',
        instructions: ['Prepará la posición.'],
        expectedRevision: 1,
      })
    ).exercise.revision,
    2,
  )
  assert.throws(
    () =>
      client.catalog.updateExercise('gym', 'exercise-1', {
        name: 'Remo',
        instructions: [],
        expectedRevision: 1,
      }),
    apiError(400, 'INVALID_INPUT'),
  )
  assert.equal(calls, 1)
})

test('media sends raw bytes with encoded metadata and validates the stored asset', async () => {
  const file = new Blob(['image-bytes'], { type: 'image/png' })
  const media = {
    id: 'media-1',
    kind: 'image',
    label: 'Banco & apoyo',
    attribution: '',
    url: '/api/b2b/media/media-1',
    mime: 'image/png',
    bytes: file.size,
    sha256: 'a'.repeat(64),
    createdAt: '2026-10-10T10:00:00.000Z',
  }
  const client = createB2BClient('account', {
    timeoutMs: 1,
    uploadTimeoutMs: 1000,
    fetch: async (path, init) => {
      const url = new URL(String(path), 'https://gym.test')
      assert.equal(url.searchParams.get('label'), media.label)
      assert.equal(url.searchParams.get('kind'), 'image')
      assert.equal(init?.body, file)
      assert.equal(new Headers(init?.headers).get('Content-Type'), 'image/png')
      await new Promise((resolve) => setTimeout(resolve, 10))
      assert.equal(init?.signal?.aborted, false)
      return json({ media }, 201)
    },
  })
  assert.deepEqual(await client.media.upload('gym', { kind: 'image', label: media.label }, file), {
    media,
  })
})

test('transport distinguishes failed connections from aborted deadlines', async () => {
  const disconnected = createB2BClient(undefined, {
    fetch: async () => {
      throw new TypeError('Failed to fetch')
    },
  })
  await assert.rejects(disconnected.me(), apiError(0, 'NETWORK_ERROR'))
  const timedOut = createB2BClient(undefined, {
    timeoutMs: 5,
    fetch: async (_path, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
      }),
  })
  await assert.rejects(timedOut.me(), apiError(0, 'TIMEOUT'))
})

test('authentication notifies other tabs only when the server changed the session', async () => {
  let changes = 0
  const success = createB2BClient(undefined, {
    fetch: async () => json({ success: true }),
    onAuthChange: () => {
      changes++
    },
  })
  await success.auth.signOut()
  assert.equal(changes, 1)
  const failed = createB2BClient(undefined, {
    fetch: async () => json({ message: 'Invalid credentials', code: 'INVALID_PASSWORD' }, 401),
    onAuthChange: () => {
      changes++
    },
  })
  await assert.rejects(
    failed.auth.signIn({ email: 'member@example.test', password: 'password' }),
    apiError(401, 'INVALID_PASSWORD'),
  )
  assert.equal(changes, 1)
  // Cookies have changed even if an upgraded server returns an incompatible payload.
  const malformed = createB2BClient(undefined, {
    fetch: async () => json({ incompatible: true }),
    onAuthChange: () => {
      changes++
    },
  })
  await assert.rejects(malformed.auth.signOut(), apiError(502, 'INVALID_RESPONSE'))
  assert.equal(changes, 2)
})

test('an interrupted response body preserves timeout and connection errors after headers arrive', async () => {
  const timedOut = createB2BClient(undefined, {
    timeoutMs: 5,
    fetch: async (_path, init) =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{'))
            init?.signal?.addEventListener(
              'abort',
              () => controller.error(new DOMException('Aborted body', 'AbortError')),
              { once: true },
            )
          },
        }),
      ),
  })
  await assert.rejects(timedOut.me(), apiError(0, 'TIMEOUT'))
  const disconnected = createB2BClient(undefined, {
    fetch: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new TypeError('Connection closed while reading body'))
          },
        }),
      ),
  })
  await assert.rejects(disconnected.me(), apiError(0, 'NETWORK_ERROR'))
})

test('401 and 403 still revoke protected views when their response body is interrupted', async () => {
  for (const status of [401, 403]) {
    const timedOut = createB2BClient('account', {
      timeoutMs: 5,
      fetch: async (_path, init) =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{'))
              init?.signal?.addEventListener(
                'abort',
                () => controller.error(new DOMException('Aborted body', 'AbortError')),
                { once: true },
              )
            },
          }),
          { status },
        ),
    })
    await assert.rejects(timedOut.members.list('gym'), apiError(status, 'REQUEST_FAILED'))
    const disconnected = createB2BClient('account', {
      fetch: async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new TypeError('Connection reset after rejection'))
            },
          }),
          { status },
        ),
    })
    await assert.rejects(disconnected.members.list('gym'), apiError(status, 'REQUEST_FAILED'))
  }
})

test('cancelling a scoped read preserves sibling requests and account binding', async () => {
  const controller = new AbortController()
  const client = createB2BClient('account-1', {
    fetch: async (_path, init) => {
      assert.equal(new Headers(init?.headers).get('X-Klisteni-B2B-Account'), 'account-1')
      return new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Cancelled', 'AbortError')),
          { once: true },
        )
        if (_path === '/api/b2b/orgs/other/exercises') resolve(json({ exercises: [] }))
      })
    },
  })
  const scoped = client.withSignal(controller.signal).catalog.listExercises('gym')
  const cancelled = assert.rejects(scoped, apiError(0, 'ABORTED'))
  controller.abort()
  await cancelled
  assert.deepEqual(await client.catalog.listExercises('other'), { exercises: [] })
})

test('an already cancelled scope never sends a request', async () => {
  let calls = 0
  const client = createB2BClient('account', {
    fetch: async () => {
      calls++
      return json({ exercises: [] })
    },
  })
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    client.withSignal(controller.signal).catalog.listExercises('gym'),
    apiError(0, 'ABORTED'),
  )
  assert.equal(calls, 0)
})
