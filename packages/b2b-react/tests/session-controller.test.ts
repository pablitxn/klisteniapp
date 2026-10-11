import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Me } from '@klisteniapp/b2b-contracts'
import { BranchInputSchema } from '@klisteniapp/b2b-contracts'
import { createSessionController } from '../src/session-controller.ts'
import { ApiError } from '@klisteniapp/b2b-client'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}
const identity = (id: string): Me => ({
  user: { id, name: id, email: `${id}@example.test` },
  memberships: [],
})

test('latest session refresh wins and aborts the superseded probe', async () => {
  const probes: Array<{ signal: AbortSignal; result: ReturnType<typeof deferred<Me>> }> = []
  const session = createSessionController({
    me: (signal) => {
      const result = deferred<Me>()
      probes.push({ signal, result })
      return result.promise
    },
    signOut: async () => {},
  })
  const initial = session.start()
  const current = session.refresh()
  assert.equal(probes[0].signal.aborted, true)
  probes[1].result.resolve(identity('new-account'))
  await current
  probes[0].result.resolve(identity('old-account'))
  await initial
  assert.equal(session.getSnapshot().me?.user.id, 'new-account')
  assert.equal(session.getSnapshot().dataRefresh, 1)
  session.stop()
})

test('signout suppresses refresh and a delayed session probe cannot restore identity', async () => {
  const probe = deferred<Me>(),
    logout = deferred<void>()
  let probes = 0
  const session = createSessionController({
    me: async () => {
      probes++
      return probe.promise
    },
    signOut: () => logout.promise,
  })
  const initial = session.start()
  const leaving = session.signOut()
  await session.refresh(false)
  assert.equal(probes, 1)
  logout.resolve()
  await leaving
  probe.resolve(identity('old-account'))
  await initial
  assert.equal(session.getSnapshot().me, null)
  assert.equal(session.getSnapshot().loading, false)
  session.stop()
})

test('focus revalidation preserves organization selection, while authentication loss clears it', async () => {
  let reject = false
  const session = createSessionController({
    me: async () => {
      if (reject) throw new ApiError('Expired', 401)
      return identity('account')
    },
    signOut: async () => {},
  })
  await session.start()
  session.setOrgId('gym-selected')
  await session.refresh(false)
  assert.equal(session.getSnapshot().orgId, 'gym-selected')
  reject = true
  await session.refresh(false)
  assert.equal(session.getSnapshot().orgId, '')
  assert.equal(session.getSnapshot().me, null)
  assert.equal(session.getSnapshot().error, '')
  session.stop()
})

test('stopping cancels in-flight reads and ignores all subsequent state updates from them', async () => {
  const probe = deferred<Me>()
  let signal: AbortSignal | undefined
  const session = createSessionController({
    me: (candidate) => {
      signal = candidate
      return probe.promise
    },
    signOut: async () => {},
  })
  const initial = session.start()
  session.stop()
  const state = session.getSnapshot()
  assert.equal(signal?.aborted, true)
  probe.reject(new Error('late network failure'))
  await initial
  assert.equal(session.getSnapshot(), state)
})

test('failed signout preserves identity and a restart is independent of the old logout', async () => {
  const logout = deferred<void>()
  let fail = true
  const session = createSessionController({
    me: async () => identity('account'),
    signOut: async () => {
      if (fail) throw new Error('Offline')
      return logout.promise
    },
  })
  await session.start()
  await session.signOut()
  assert.equal(session.getSnapshot().me?.user.id, 'account')
  assert.equal(session.getSnapshot().loading, false)
  assert.equal(session.getSnapshot().error, 'Offline')
  fail = false
  const oldLogout = session.signOut()
  session.stop()
  await session.start()
  logout.resolve()
  await oldLogout
  assert.equal(session.getSnapshot().me?.user.id, 'account')
  session.stop()
})

const wlIdentity = (): Me => ({
  ...identity('account'),
  whiteLabel: {
    organizationId: 'atlas',
    brandAdmin: false,
    branches: [
      {
        branch: {
          ...BranchInputSchema.parse({ slug: 'central', name: 'Central' }),
          id: 'central',
          organizationId: 'atlas',
          revision: 0,
        },
        roles: ['coach'],
      },
      {
        branch: {
          ...BranchInputSchema.parse({ slug: 'north', name: 'North' }),
          id: 'north',
          organizationId: 'atlas',
          revision: 0,
        },
        roles: ['member'],
      },
    ],
  },
})

test('WL multiple branch-role contexts require explicit choice and never inherit another role', async () => {
  const session = createSessionController({ me: async () => wlIdentity(), signOut: async () => {} })
  await session.start()
  assert.equal(session.getSnapshot().orgId, 'atlas')
  assert.equal(session.getSnapshot().branchId, '')
  assert.equal(session.getSnapshot().workRole, '')
  assert.equal(session.setWorkContext('north', 'coach'), false)
  assert.equal(session.setWorkContext('sur-central', 'member'), false)
  assert.equal(session.setWorkContext('central', 'coach'), true)
  const centralKey = session.getSnapshot().workContextKey
  await session.refresh(false)
  assert.equal(session.getSnapshot().workContextKey, centralKey)
  assert.equal(session.setWorkContext('north', 'member'), true)
  assert.notEqual(session.getSnapshot().workContextKey, centralKey)
  assert.equal(session.getSnapshot().workRole, 'member')
  session.stop()
})

test('WL revoked and archived branches invalidate selection while a single valid pair opens automatically', async () => {
  let me = wlIdentity()
  const session = createSessionController({ me: async () => me, signOut: async () => {} })
  await session.start()
  session.setWorkContext('central', 'coach')
  me = wlIdentity()
  me.whiteLabel!.branches = [me.whiteLabel!.branches[1]]
  await session.refresh(false)
  assert.equal(session.getSnapshot().branchId, 'north')
  assert.equal(session.getSnapshot().workRole, 'member')
  me = wlIdentity()
  me.whiteLabel!.branches.forEach(({ branch }) => {
    branch.status = 'archived'
  })
  await session.refresh(false)
  assert.equal(session.getSnapshot().branchId, '')
  assert.equal(session.getSnapshot().workRole, '')
  session.stop()
})

test('WL a late session probe cannot undo an explicit context switch', async () => {
  const delayed = deferred<Me>()
  let calls = 0
  const session = createSessionController({
    me: async () => (++calls === 1 ? wlIdentity() : delayed.promise),
    signOut: async () => {},
  })
  await session.start()
  session.setWorkContext('central', 'coach')
  const probe = session.refresh(false)
  session.setWorkContext('north', 'member')
  delayed.resolve(wlIdentity())
  await probe
  assert.equal(session.getSnapshot().branchId, 'north')
  assert.equal(session.getSnapshot().workRole, 'member')
  session.stop()
})

test('WL explicit selection survives navigation only while the new session still authorizes the exact pair', async () => {
  let saved: { branchId: string; role: 'admin' | 'coach' | 'member' } | null = null
  const storage = {
    readWorkContext: (organizationId: string, userId: string) => {
      assert.equal(organizationId, 'atlas')
      assert.equal(userId, 'account')
      return saved
    },
    writeWorkContext: (_organizationId: string, _userId: string, value: typeof saved) => {
      saved = value
    },
  }
  const first = createSessionController({
    me: async () => wlIdentity(),
    signOut: async () => {},
    ...storage,
  })
  await first.start()
  first.setWorkContext('central', 'coach')
  first.stop()
  assert.deepEqual(saved, { branchId: 'central', role: 'coach' })
  const second = createSessionController({
    me: async () => wlIdentity(),
    signOut: async () => {},
    ...storage,
  })
  await second.start()
  assert.equal(second.getSnapshot().branchId, 'central')
  assert.equal(second.getSnapshot().workRole, 'coach')
  await second.signOut()
  assert.equal(saved, null)
  second.stop()
  saved = { branchId: 'central', role: 'admin' }
  const tampered = createSessionController({
    me: async () => wlIdentity(),
    signOut: async () => {},
    ...storage,
  })
  await tampered.start()
  assert.equal(tampered.getSnapshot().branchId, '')
  assert.equal(tampered.getSnapshot().workRole, '')
  assert.equal(saved, null)
  tampered.stop()
})
