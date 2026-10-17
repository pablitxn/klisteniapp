import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSessionController } from '../src/session-controller.ts'
import type { ProductAccess, ProductBootstrap } from '@klisteniapp/b2b-contracts/product-v2'
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
