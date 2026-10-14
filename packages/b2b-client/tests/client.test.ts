import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, createB2BClient, watchSessionChange } from '@klisteniapp/b2b-client'
import { ExerciseInputSchema, ProgramInputSchema } from '@klisteniapp/b2b-contracts'

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

test('routine retry keys are per request headers and never change content or account/context guards', async () => {
  const requests: RequestInit[] = []
  const input = ProgramInputSchema.parse({
    name: 'Retry',
    steps: [{ id: 'step', exerciseId: 'squat', sets: 1, reps: 8 }],
  })
  const client = createB2BClient('coach', {
    branchId: 'center',
    role: 'coach',
    fetch: async (_url, init) => {
      requests.push(init!)
      return json({
        program: {
          ...input,
          id: 'program',
          branchId: 'center',
          publishedVersion: null,
          revision: 0,
        },
      })
    },
  })
  const requestId = '763753ea-c66d-49ba-8a8e-50471ae7895e'
  await client.programs.create('gym', input, requestId)
  await client.programs.create('gym', input, requestId)
  await client.programs.create('gym', input)
  for (const init of requests) {
    assert.deepEqual(JSON.parse(String(init.body)), input)
    const headers = new Headers(init.headers)
    assert.equal(headers.get('X-Klisteni-B2B-Account'), 'coach')
    assert.equal(headers.get('X-Klisteni-B2B-Branch'), 'center')
    assert.equal(headers.get('X-Klisteni-B2B-Role'), 'coach')
  }
  assert.deepEqual(
    requests.map((init) => new Headers(init.headers).get('Idempotency-Key')),
    [requestId, requestId, null],
  )
})

test('the public client API works without a browser or cross-tab notification support', async () => {
  assert.equal(typeof window, 'undefined')
  const stop = watchSessionChange(() => assert.fail('No browser session events are registered'))
  stop()
  const originalChannel = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel')
  Object.defineProperty(globalThis, 'BroadcastChannel', {
    configurable: true,
    value: class {
      constructor() {
        throw new DOMException('Access denied', 'SecurityError')
      }
    },
  })
  try {
    const client = createB2BClient(undefined, { fetch: async () => json({ success: true }) })
    assert.deepEqual(await client.auth.signOut(), { success: true })
  } finally {
    if (originalChannel) Object.defineProperty(globalThis, 'BroadcastChannel', originalChannel)
    else Reflect.deleteProperty(globalThis, 'BroadcastChannel')
  }
})

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

test('WL client scopes branch and role immutably through account and abort binding', async () => {
  const calls: Array<{ branch: string | null; role: string | null; account: string | null }> = []
  const client = createB2BClient('first', {
    fetch: async (_path, init) => {
      const headers = new Headers(init?.headers)
      calls.push({
        branch: headers.get('X-Klisteni-B2B-Branch'),
        role: headers.get('X-Klisteni-B2B-Role'),
        account: headers.get('X-Klisteni-B2B-Account'),
      })
      return json({ assignments: [] })
    },
  })
  const central = client.withContext('central', 'coach')
  const north = central.withContext('north', 'member').forAccount('second')
  await central.withSignal(new AbortController().signal).assignments.list('atlas')
  await north.assignments.list('atlas')
  await client.assignments.list('atlas')
  assert.deepEqual(calls, [
    { branch: 'central', role: 'coach', account: 'first' },
    { branch: 'north', role: 'member', account: 'second' },
    { branch: null, role: null, account: 'first' },
  ])
})

test('WL departed context drops even a successful late response and refuses queued writes', async () => {
  const scope = new AbortController()
  let accept!: (response: Response) => void
  let calls = 0
  const client = createB2BClient('account', {
    branchId: 'central',
    role: 'coach',
    contextSignal: scope.signal,
    fetch: async () => {
      calls++
      return new Promise((resolve) => {
        accept = resolve
      })
    },
  })
  const pending = client.assignments.list('atlas')
  const rejected = assert.rejects(pending, apiError(0, 'ABORTED'))
  scope.abort()
  accept(json({ assignments: [] }))
  await rejected
  await assert.rejects(client.assignments.retire('atlas', 'assignment'), apiError(0, 'ABORTED'))
  assert.equal(calls, 1)
})

test('WL accepting an invitation through credentials announces the changed session', async () => {
  let changes = 0
  const client = createB2BClient(undefined, {
    fetch: async (path, init) => {
      assert.equal(path, '/api/b2b/invitations/sign-in')
      assert.equal(JSON.parse(String(init?.body)).consent, true)
      return json({
        redirect: false,
        token: 'session-token',
        user: { id: 'account', name: 'Person', email: 'person@example.test' },
      })
    },
    onAuthChange: () => {
      changes++
    },
  })
  await client.invitations.signIn({
    email: 'person@example.test',
    password: 'password',
    token: 'invitation-token',
    consent: true,
  })
  assert.equal(changes, 1)
})
