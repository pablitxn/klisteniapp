import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import {
  createActionScope,
  invitationDestination,
  membershipMode,
} from '../src/features/membership/restrictedAccess.ts'
import { ownerLocalDownload } from '../src/features/membership/localExport.ts'
import { identity, inactive } from './membership/fixture.ts'

test('inactive, missing, refreshing and foreign memberships never unlock gym children', () => {
  assert.equal(membershipMode(identity, inactive), 'restricted')
  assert.equal(membershipMode(identity, null), 'checking')
  assert.equal(membershipMode(identity, inactive, true), 'checking')
  assert.equal(membershipMode(identity, { ...inactive, accessMode: 'active' }), 'active')
  assert.equal(
    membershipMode(identity, { ...inactive, organizationId: 'sur', accessMode: 'active' }),
    'denied',
  )
  assert.equal(membershipMode(identity, { ...inactive, userId: 'other' }), 'denied')
  assert.equal(
    membershipMode(identity, { ...inactive, branches: [{ branchId: 'old', role: 'member' }] }),
    'denied',
  )
  assert.equal(
    membershipMode(identity, { ...inactive, capabilities: ['edit-own-sessions'] }),
    'denied',
  )
  assert.equal(membershipMode(identity, { ...inactive, schemaVersion: 1 }), 'denied')
})

test('reactivation consumes only current access and never manufactures branch grants or consent', () => {
  const current = { ...inactive, accessMode: 'active', accessRevision: 5, branches: [] }
  assert.equal(membershipMode(identity, current), 'active')
  assert.deepEqual(current.branches, [])
  assert.deepEqual(current.capabilities, ['export-own-records'])
  assert.equal(membershipMode({ ...identity, organizationId: 'sur' }, current), 'denied')
})

test('invitation supports configured/unconfigured separate HTTPS only, without transfer parameters', () => {
  const invitation = {
    separateProduct: true,
    paid: true,
    automaticConversion: false,
    url: null as string | null,
  }
  const origin = 'https://gym.example.test'
  assert.equal(invitationDestination(invitation, origin), null)
  assert.equal(
    invitationDestination({ ...invitation, url: 'https://personal.example.test/start' }, origin),
    'https://personal.example.test/start',
  )
  for (const url of [
    'http://personal.example.test/start',
    'javascript:alert(1)',
    `${origin}/member`,
    'https://name:password@personal.example.test/start',
    'https://personal.example.test/start?transfer=member',
    'https://personal.example.test/start#token',
  ])
    assert.throws(() => invitationDestination({ ...invitation, url }, origin))
  assert.throws(() => invitationDestination({ ...invitation, automaticConversion: true }, origin))
})

test('late download responses after logout, tenant change, revocation or unmount cannot publish', async () => {
  for (const cause of ['logout', 'tenant', 'revoked', 'unmount']) {
    const controller = new AbortController()
    const scope = createActionScope(controller.signal)
    let finish!: (value: string) => void
    const published: string[] = []
    const request = scope.run(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
      (v) => published.push(v),
    )
    if (cause === 'unmount') scope.dispose()
    else controller.abort(cause)
    finish('private history')
    assert.equal(await request, false)
    assert.deepEqual(published, [])
  }
})

test('download deduplicates repeated clicks and permits retry after a transport failure', async () => {
  const scope = createActionScope(new AbortController().signal)
  let finish!: (value: string) => void
  const first = scope.run(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve
      }),
    () => undefined,
  )
  assert.equal(
    await scope.run(
      async () => assert.fail('Duplicate request'),
      () => undefined,
    ),
    false,
  )
  finish('accepted')
  assert.equal(await first, true)
  await assert.rejects(
    scope.run(
      async () => {
        throw new Error('Offline')
      },
      () => undefined,
    ),
    /Offline/,
  )
  assert.equal(
    await scope.run(
      async () => 'retry',
      (v) => assert.equal(v, 'retry'),
    ),
    true,
  )
})

test('WP09 injected recovery bytes remain separate, owner checked and unchanged; null means no local work', async () => {
  let reads = 0
  const envelope = {
    format: 'klisteniapp.local-workout-recovery',
    version: 2,
    serverConfirmed: false,
    owner: {
      accountId: 'member',
      memberId: 'member',
      organizationId: 'atlas',
      branchId: 'atlas-principal',
    },
    sessionId: 'session',
    localContent: { opaqueOwnerPayload: true },
    operations: [],
  }
  const json = JSON.stringify(envelope, null, 2)
  const adapter = {
    async exportOwnPending(context: { access: typeof inactive; signal: AbortSignal }) {
      reads++
      assert.equal(context.access.accessMode, 'export-only')
      assert.equal(context.signal.aborted, false)
      return json
    },
  }
  assert.equal(reads, 0)
  const file = await ownerLocalDownload(adapter, identity, inactive, new AbortController().signal)
  assert.ok(file)
  assert.equal(file.json, json)
  assert.equal(reads, 1)
  assert.equal(JSON.parse(file.json).serverConfirmed, false)
  await assert.rejects(
    ownerLocalDownload(
      adapter,
      { ...identity, userId: 'other' },
      inactive,
      new AbortController().signal,
    ),
    /context/,
  )
  const foreign = {
    exportOwnPending: async () =>
      JSON.stringify({ ...envelope, owner: { ...envelope.owner, organizationId: 'sur' } }),
  }
  await assert.rejects(
    ownerLocalDownload(foreign, identity, inactive, new AbortController().signal),
    /identity/,
  )
  assert.equal(
    await ownerLocalDownload(
      { exportOwnPending: async () => null },
      identity,
      inactive,
      new AbortController().signal,
    ),
    null,
  )
  const controller = new AbortController()
  const cancelled = {
    exportOwnPending: async () => {
      controller.abort()
      return json
    },
  }
  await assert.rejects(
    ownerLocalDownload(cancelled, identity, inactive, controller.signal),
    /context/,
  )
  const before = reads
  await assert.rejects(
    ownerLocalDownload(adapter, identity, inactive, controller.signal),
    /context/,
  )
  assert.equal(reads, before)
})

test('owned UI renders labeled actions, coverage and status/error regions, with no gym children or render-time requests', async () => {
  const vite = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom',
    plugins: [react()],
    logLevel: 'error',
  })
  try {
    const { MembershipAccessBoundary } = (await vite.ssrLoadModule(
      '/src/features/membership/RestrictedMembership.tsx',
    )) as typeof import('../src/features/membership/RestrictedMembership.tsx')
    const props = {
      identity,
      access: inactive,
      client: { call: async () => assert.fail('No request on render') },
      contextSignal: new AbortController().signal,
      currentOrigin: 'https://gym.example.test',
      refreshAccess: async () => assert.fail('No refresh on render'),
      children: createElement('div', null, 'PRIVATE GYM CONTENT'),
    }
    const html = renderToStaticMarkup(createElement(MembershipAccessBoundary, props))
    assert.match(html, /<main[^>]+aria-labelledby="membership-title"/)
    for (const label of [
      'Qué incluye',
      'Qué queda fuera',
      'Descargar mis registros',
      'Consultar invitación B2C',
      'Actualizar mi acceso',
    ])
      assert.ok(html.includes(label))
    assert.match(html, /role="status"/)
    assert.doesNotMatch(html, /PRIVATE GYM CONTENT|href=|Descargar trabajo local/)
    const localHtml = renderToStaticMarkup(
      createElement(MembershipAccessBoundary, {
        ...props,
        localExport: { exportOwnPending: async () => assert.fail('No device reads on render') },
      }),
    )
    assert.match(localHtml, /Descargar trabajo local/)
    assert.match(localHtml, /No está confirmado por el servidor/)
    const active = renderToStaticMarkup(
      createElement(MembershipAccessBoundary, {
        ...props,
        access: { ...inactive, accessMode: 'active' },
      }),
    )
    assert.match(active, /PRIVATE GYM CONTENT/)
    const checking = renderToStaticMarkup(
      createElement(MembershipAccessBoundary, { ...props, revalidating: true }),
    )
    assert.doesNotMatch(checking, /PRIVATE GYM CONTENT|Descargar/)
    const denied = renderToStaticMarkup(
      createElement(MembershipAccessBoundary, {
        ...props,
        access: { ...inactive, userId: 'foreign' },
      }),
    )
    assert.match(denied, /role="alert"/)
    assert.doesNotMatch(denied, /PRIVATE GYM CONTENT/)
  } finally {
    await vite.close()
  }
})
