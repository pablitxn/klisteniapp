import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '@klisteniapp/b2b-client'
import { createProductV2Client } from '@klisteniapp/b2b-client'
import {
  canReadTrainerHealth,
  hasHealthCapability,
  healthAccessKey,
} from '../src/features/health/healthAccess.ts'
import { HealthController } from '../src/features/health/healthState.ts'
import { access, consent, deferred, fixture, projection } from './healthFixture.ts'

test('default private consent requires selected categories and separate explicit acknowledgement', async () => {
  const { controller, calls } = fixture()
  await controller.loadOwner()
  assert.equal(controller.selectedConsent(), undefined)
  await controller.grant(['sleep'], false)
  await controller.grant([], true)
  await controller.grant(['sleep', 'sleep'], true)
  assert.equal(calls.length, 2)
  await controller.grant(['sleep', 'activity'], true)
  const request = calls.find((c) => c.key === 'grantHealthConsent')?.input
  assert.deepEqual(request, {
    operationId: 'operation-1',
    expectedRevision: 0,
    id: 'operation-2',
    categories: ['sleep', 'activity'],
    audience: 'current-authorized-branch-trainers',
    disclosureVersion: 1,
  })
})

test('category replacement uses current scoped consent revision and fresh read', async () => {
  const { controller, calls } = fixture(false, { healthConsents: () => [consent] })
  await controller.loadOwner()
  await controller.grant(['activity'], true)
  assert.equal((calls[2].input as { expectedRevision: number }).expectedRevision, 2)
  assert.equal((calls[2].input as { id: string }).id, 'consent')
  assert.equal(calls.at(-1)?.key, 'healthConsents')
})

test('revoke invalidates mounted views before dispatch and after success without trusting a stale receipt', async () => {
  let active = true
  const { controller, calls, invalidations } = fixture(false, {
    healthConsents: () =>
      active
        ? [consent]
        : [{ ...consent, status: 'revoked', revokedAt: '2026-10-17T12:00:00.000Z', revision: 3 }],
    revokeHealthConsent: () => {
      active = false
      assert.equal(invalidations(), 1)
      return { ...consent, status: 'revoked', revokedAt: '2026-10-17T12:00:00.000Z', revision: 3 }
    },
  })
  await controller.loadOwner()
  await controller.revoke()
  assert.equal(controller.selectedConsent(), undefined)
  assert.equal(invalidations(), 2)
  assert.deepEqual(calls[2].input, {
    operationId: 'operation-1',
    expectedRevision: 2,
    id: 'consent',
  })
})

test('another branch consent is visible in settings but cannot be revoked in the selected branch', async () => {
  const { controller, calls } = fixture(false, {
    healthConsents: () => [{ ...consent, scope: { ...consent.scope, branchId: 'west' } }],
  })
  await controller.loadOwner()
  await controller.revoke()
  assert.equal(controller.getSnapshot().consents.length, 1)
  assert.equal(calls.length, 2)
})

test('failed revoke never claims success and clears old settings until refreshed', async () => {
  const { controller } = fixture(false, {
    healthConsents: () => [consent],
    revokeHealthConsent: () => {
      throw new ApiError('Offline', 0, 'NETWORK_ERROR')
    },
  })
  await controller.loadOwner()
  await controller.revoke()
  assert.equal(controller.getSnapshot().status, 'error')
  assert.match(controller.getSnapshot().message, /No se confirmó/)
  assert.equal(controller.selectedConsent(), undefined)
})

test('administrative capability alone and foreign branch never authorize a trainer health view', () => {
  const context = access(true)
  assert.equal(canReadTrainerHealth(context), true)
  for (const role of ['admin', 'superadmin', 'member'] as const) {
    assert.equal(canReadTrainerHealth({ ...context, access: { ...context.access!, role } }), false)
  }
  assert.equal(canReadTrainerHealth({ ...context, branchId: 'west' }), false)
  assert.equal(canReadTrainerHealth({ ...context, organizationId: 'sur' }), false)
})

test('inactive/export-only context cannot read or share health but keeps owner export affordance', async () => {
  const context = access()
  context.access = {
    ...context.access!,
    accessMode: 'export-only',
    capabilities: ['export-own-records'],
  }
  assert.equal(hasHealthCapability(context, 'manage-own-health'), false)
  assert.equal(hasHealthCapability(context, 'export-own-records'), true)
  const controller = new HealthController(context, {
    client: () => {
      throw new Error('Must never call')
    },
  })
  controller.setEnvironment(true, true)
  await controller.loadOwner()
  assert.equal(controller.getSnapshot().own, null)
})

for (const reason of ['revoke', 'offline', 'hidden', 'context abort', 'unmount']) {
  test(`late trainer response cannot remount after ${reason}`, async () => {
    const response = deferred<typeof projection>()
    const { controller, calls, context } = fixture(true, {
      consentedHealth: () => response.promise,
    })
    const contextAbort = new AbortController()
    // This separate controller uses an explicitly abortable context.
    const target =
      reason === 'context abort'
        ? new HealthController(
            { ...context, signal: contextAbort.signal },
            { client: () => ({ call: async () => response.promise }) as never },
          )
        : controller
    target.start()
    target.setEnvironment(true, true)
    const pending = target.loadTrainer('owner')
    if (reason === 'offline') target.setEnvironment(false, true)
    else if (reason === 'hidden') target.setEnvironment(true, false)
    else if (reason === 'context abort') contextAbort.abort()
    else if (reason === 'unmount') target.stop()
    else target.hide()
    response.resolve(projection)
    await pending
    assert.equal(target.getSnapshot().trainer, null)
    if (reason !== 'context abort') assert.equal(calls[0].signal.aborted, true)
  })
}

test('reconnect requires a fresh authorization request and denial leaves no old projection', async () => {
  const { controller, handlers, calls } = fixture(true)
  await controller.loadTrainer('owner')
  assert.ok(controller.getSnapshot().trainer)
  controller.setEnvironment(false, true)
  assert.equal(controller.getSnapshot().trainer, null)
  await controller.loadTrainer('owner')
  assert.equal(calls.length, 1)
  controller.setEnvironment(true, true)
  assert.equal(controller.getSnapshot().trainer, null)
  handlers.consentedHealth = () => {
    throw new ApiError('Revoked', 403, 'CONSENT_REQUIRED')
  }
  await controller.loadTrainer('owner')
  assert.equal(controller.getSnapshot().trainer, null)
  assert.equal(controller.getSnapshot().status, 'error')
})

test('revoke and regrant cannot be overwritten by an older category response', async () => {
  const old = deferred<typeof projection>()
  let count = 0
  const { controller } = fixture(true, {
    consentedHealth: () =>
      ++count === 1
        ? old.promise
        : {
            ...projection,
            consentRevision: 4,
            categories: [{ category: 'activity', records: [] }],
          },
  })
  const pending = controller.loadTrainer('owner')
  controller.hide()
  await controller.loadTrainer('owner')
  old.resolve(projection)
  await pending
  assert.equal(controller.getSnapshot().trainer?.consentRevision, 4)
  assert.deepEqual(
    controller.getSnapshot().trainer?.categories.map((c) => c.category),
    ['activity'],
  )
})

test('trainer revalidation clears already mounted data before waiting for the server', async () => {
  const pending = deferred<typeof projection>()
  const { controller, handlers } = fixture(true)
  await controller.loadTrainer('owner')
  handlers.consentedHealth = () => pending.promise
  const refresh = controller.loadTrainer('owner')
  assert.equal(controller.getSnapshot().trainer, null)
  pending.resolve(projection)
  await refresh
  assert.ok(controller.getSnapshot().trainer)
})

for (const change of ['owner', 'organization', 'branch']) {
  test(`trainer rejects compatible DTO with a foreign ${change}`, async () => {
    const foreign = structuredClone(projection)
    if (change === 'owner') foreign.ownerId = 'other'
    else if (change === 'organization') foreign.scope.organizationId = 'sur'
    else foreign.scope.branchId = 'west'
    const { controller } = fixture(true, { consentedHealth: () => foreign })
    await controller.loadTrainer('owner')
    assert.equal(controller.getSnapshot().trainer, null)
  })
}

test('scope identity changes with account, host, branch, role, access revision and consent generation', () => {
  const original = access(true)
  const key = healthAccessKey(original)
  for (const changed of [
    { ...original, accountId: 'other' },
    { ...original, hostBinding: 'sur.example.test:g2' },
    { ...original, branchId: 'west' },
    { ...original, generation: 'revoked-2' },
    { ...original, access: { ...original.access!, role: 'admin' as const } },
    { ...original, access: { ...original.access!, accessRevision: 2 } },
  ])
    assert.notEqual(healthAccessKey(changed), key)
})

test('frozen client carries no-store, v2 header, selected branch, cancellation and strict decoding', async () => {
  const abort = new AbortController()
  const calls: RequestInit[] = []
  const client = createProductV2Client('trainer', 'atlas', {
    branchId: 'east',
    role: 'coach',
    signal: abort.signal,
    fetch: async (_url, init) => {
      calls.push(init!)
      return Response.json(projection)
    },
  })
  await client.call('consentedHealth', { memberId: 'owner' })
  assert.equal(calls[0].cache, 'no-store')
  const headers = new Headers(calls[0].headers)
  assert.equal(headers.get('X-Klisteni-B2B-Contract'), '2')
  assert.equal(headers.get('X-Klisteni-B2B-Branch'), 'east')
  assert.equal(headers.get('X-Klisteni-B2B-Role'), 'coach')
  assert.ok(calls[0].signal)
  abort.abort()
  await assert.rejects(
    client.call('consentedHealth', { memberId: 'owner' }),
    (error: unknown) => error instanceof ApiError && error.code === 'ABORTED',
  )
  assert.equal(calls.length, 1)
  const legacy = createProductV2Client('trainer', 'atlas', {
    fetch: async () => Response.json({ ...projection, schemaVersion: 1 }),
  })
  await assert.rejects(
    legacy.call('consentedHealth', { memberId: 'owner' }),
    (error: unknown) => error instanceof ApiError && error.code === 'INVALID_RESPONSE',
  )
})
