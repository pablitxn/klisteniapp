import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSessionController } from '../src/session-controller.ts'
import type { ProductAccess, ProductBootstrap } from '@klisteniapp/b2b-contracts/product-v2'
import { ApiError } from '@klisteniapp/b2b-client'
const bootstrap: ProductBootstrap = {
  schemaVersion: 2,
  user: { id: 'actor', name: 'Actor', email: 'actor@example.test' },
  realm: { mode: 'unified', key: 'realm' },
  memberships: [
    {
      organizationId: 'gym',
      name: 'Gym',
      role: 'superadmin',
      activated: true,
      accessMode: 'active',
      accessRevision: 0,
      choices: [
        { branchId: 'one', name: 'One', role: 'superadmin' },
        { branchId: 'two', name: 'Two', role: 'coach' },
      ],
    },
  ],
}
test('focus and stream readiness share one in-flight same-context verification without aborting it', async () => {
  let delayed = false,
    calls = 0,
    release!: () => void,
    signal: AbortSignal | undefined
  const barrier = new Promise<void>((resolve) => {
    release = resolve
  })
  const controller = createSessionController({
    bootstrap: async (request) => {
      calls++
      if (delayed) {
        signal = request
        await barrier
      }
      return bootstrap
    },
    productAccess: async () => access('one', 'superadmin'),
    me: async () => {
      throw new Error('Unexpected legacy read')
    },
    signOut: async () => {},
  })
  await controller.start()
  await controller.setProductWorkContext('gym', 'one', 'superadmin')
  delayed = true
  const before = controller.getSnapshot(),
    initialCalls = calls
  const ready = controller.revalidateProduct(),
    focus = controller.refresh(false)
  assert.equal(calls, initialCalls + 1)
  assert.equal(signal?.aborted, false)
  release()
  assert.equal(await ready, true)
  await focus
  assert.equal(controller.getSnapshot(), before)
  assert.equal(before.contextSignal.aborted, false)
  controller.stop()
})
function access(branch: string, role: 'superadmin' | 'coach'): ProductAccess {
  return {
    schemaVersion: 2,
    userId: 'actor',
    organizationId: 'gym',
    role,
    accessMode: 'active',
    accessRevision: 0,
    branches: role === 'coach' ? [{ branchId: branch, role: 'coach' }] : [],
    capabilities: ['edit-planning', 'read-training-history', 'export-own-records'],
  }
}
test('product controller requires actual choices, preserves superadmin role and synchronously revokes departed authority', async () => {
  let release: ((value: ProductAccess) => void) | undefined, signal: AbortSignal | undefined
  const controller = createSessionController({
    bootstrap: async () => bootstrap,
    me: async () => {
      throw new Error('Legacy me must not run')
    },
    signOut: async () => {},
    productAccess: async (_actor, _org, branch, role, request) => {
      if (branch === 'two') {
        signal = request
        return new Promise((resolve) => (release = resolve))
      }
      return access(branch, role as 'superadmin')
    },
  })
  await controller.start()
  assert.equal(controller.getSnapshot().productAccess, null)
  assert.equal(await controller.setProductWorkContext('gym', 'foreign', 'superadmin'), false)
  assert.equal(await controller.setProductWorkContext('gym', 'one', 'superadmin'), true)
  const original = controller.getSnapshot().contextSignal
  assert.equal(original.aborted, false)
  assert.equal(controller.getSnapshot().productRole, 'superadmin')
  const pending = controller.setProductWorkContext('gym', 'two', 'coach')
  assert.equal(original.aborted, true)
  assert.equal(controller.getSnapshot().productAccess, null)
  await controller.signOut()
  assert.equal(signal?.aborted, true)
  release!(access('two', 'coach'))
  assert.equal(await pending, false)
  assert.equal(controller.getSnapshot().bootstrap, null)
  assert.equal(controller.getSnapshot().productAccess, null)
  controller.stop()
})
test('inactive product bootstrap obtains branchless export access without legacy membership or synthetic grants', async () => {
  const inactive: ProductBootstrap = {
    ...bootstrap,
    memberships: [{ ...bootstrap.memberships[0], accessMode: 'export-only', choices: [] }],
  }
  const controller = createSessionController({
    bootstrap: async () => inactive,
    me: async () => {
      throw new Error('Inactive identity cannot use legacy me')
    },
    signOut: async () => {},
    productAccess: async (actor, org, branch, role) => {
      assert.equal(branch, '')
      assert.equal(role, '')
      return {
        schemaVersion: 2,
        userId: actor,
        organizationId: org,
        role: 'superadmin',
        accessMode: 'export-only',
        accessRevision: 1,
        branches: [],
        capabilities: ['export-own-records'],
      }
    },
  })
  await controller.start()
  assert.equal(controller.getSnapshot().me, null)
  assert.equal(controller.getSnapshot().productAccess?.accessMode, 'export-only')
  assert.equal(controller.getSnapshot().contextSignal.aborted, false)
  controller.stop()
  assert.equal(controller.getSnapshot().contextSignal.aborted, true)
})

test('unchanged background validation and offline failures preserve editor authority; explicit revocation does not', async () => {
  let failure: Error | null = null
  const controller = createSessionController({
    bootstrap: async () => {
      if (failure) throw failure
      return bootstrap
    },
    productAccess: async () => access('one', 'superadmin'),
    me: async () => {
      throw new Error('Unexpected legacy read')
    },
    signOut: async () => {},
  })
  await controller.start()
  await controller.setProductWorkContext('gym', 'one', 'superadmin')
  const before = controller.getSnapshot()
  assert.equal(await controller.revalidateProduct(), true)
  await controller.refresh(false)
  assert.equal(controller.getSnapshot(), before)
  failure = new TypeError('Synthetic offline transport')
  assert.equal(await controller.revalidateProduct(), false)
  await controller.refresh(false)
  assert.equal(controller.getSnapshot(), before)
  assert.equal(before.contextSignal.aborted, false)
  failure = new ApiError('Unavailable', 500, 'INTERNAL_ERROR')
  assert.equal(await controller.revalidateProduct(), false)
  assert.equal(controller.getSnapshot(), before)
  failure = new ApiError('Access revoked', 403, 'CONTEXT_REVOKED')
  await controller.refresh(false)
  assert.equal(before.contextSignal.aborted, true)
  assert.equal(controller.getSnapshot().productAccess, null)
  controller.stop()
})
test('late background validation cannot restore a departed actor or selected scope', async () => {
  let release: ((value: ProductBootstrap) => void) | null = null
  let delay = false
  const controller = createSessionController({
    bootstrap: async () =>
      delay
        ? new Promise((resolve) => {
            release = resolve
          })
        : bootstrap,
    productAccess: async (_actor, _org, branch, role) =>
      access(branch, role as 'superadmin' | 'coach'),
    me: async () => {
      throw new Error('Unexpected legacy read')
    },
    signOut: async () => {},
  })
  await controller.start()
  await controller.setProductWorkContext('gym', 'one', 'superadmin')
  delay = true
  const pending = controller.refresh(false)
  await controller.setProductWorkContext('gym', 'two', 'coach')
  release!(bootstrap)
  await pending
  assert.equal(controller.getSnapshot().branchId, 'two')
  assert.equal(controller.getSnapshot().productRole, 'coach')
  await controller.signOut()
  assert.equal(controller.getSnapshot().bootstrap, null)
  controller.stop()
})
test('validated legacy fallback clears old product identity and selections', async () => {
  let active = true
  const controller = createSessionController({
    bootstrap: async () =>
      active
        ? bootstrap
        : {
            ...bootstrap,
            user: { ...bootstrap.user, id: 'legacy-actor' },
            realm: { mode: 'legacy', key: 'legacy' },
            memberships: [{ ...bootstrap.memberships[0], activated: false }],
          },
    productAccess: async () => access('one', 'superadmin'),
    me: async () => ({
      user: { id: 'legacy-actor', name: 'Legacy', email: 'legacy@example.test' },
      memberships: [],
    }),
    signOut: async () => {},
  })
  await controller.start()
  await controller.setProductWorkContext('gym', 'one', 'superadmin')
  const old = controller.getSnapshot().contextSignal
  active = false
  await controller.refresh(false)
  const current = controller.getSnapshot()
  assert.equal(old.aborted, true)
  assert.equal(current.bootstrap, null)
  assert.equal(current.productAccess, null)
  assert.equal(current.productRole, '')
  assert.equal(current.me?.user.id, 'legacy-actor')
  assert.equal(current.orgId, '')
  assert.equal(current.branchId, '')
  controller.stop()
})

test('reload restores only a stored product choice present in fresh server authority', async () => {
  let selection: {
    organizationId: string
    branchId: string
    role: 'coach' | 'superadmin' | ''
  } | null = { organizationId: 'gym', branchId: 'two', role: 'coach' }
  const controller = createSessionController({
    bootstrap: async () => bootstrap,
    readProductWorkContext: () => selection,
    writeProductWorkContext: (_boot, next) => {
      selection = next as typeof selection
    },
    productAccess: async (_actor, _org, branch, role) =>
      access(branch, role as 'coach' | 'superadmin'),
    me: async () => {
      throw new Error('Unexpected legacy read')
    },
    signOut: async () => {},
  })
  await controller.start()
  assert.equal(controller.getSnapshot().branchId, 'two')
  assert.equal(controller.getSnapshot().productRole, 'coach')
  await controller.signOut()
  assert.equal(selection, null)
  controller.stop()
  selection = { organizationId: 'gym', branchId: 'foreign', role: 'superadmin' }
  await controller.start()
  assert.equal(controller.getSnapshot().productAccess, null)
  assert.equal(selection, null)
  controller.stop()
})
