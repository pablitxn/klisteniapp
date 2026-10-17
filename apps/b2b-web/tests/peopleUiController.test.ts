import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, type ProductV2Client } from '@klisteniapp/b2b-client'
import { PeopleController } from '../src/features/people/peopleController.ts'
import { invitationInput } from '../src/features/people/peopleModel.ts'
import { admin, member, context, deferred, branchOptions } from './people/fixture.ts'

test('response-loss retry retains exact permission bytes and revision and blocks a new competing action', async () => {
  const sent: unknown[] = [],
    updated = { ...member, revision: 4, active: false }
  const client = {
    call: async (key: string, input: unknown) => {
      if (key === 'people') return [member]
      sent.push(structuredClone(input))
      if (sent.length === 1) throw new ApiError('Lost response', 0, 'NETWORK_ERROR')
      return updated
    },
  } as ProductV2Client
  const controller = new PeopleController(context(), () => client)
  await controller.load()
  const input = { memberId: member.userId, expectedRevision: member.revision, active: false }
  assert.equal(await controller.update(input), null)
  input.active = true
  assert.equal(controller.getSnapshot().retry, true)
  assert.equal(await controller.update(input), null)
  assert.equal(sent.length, 1)
  assert.deepEqual(await controller.retry(), updated)
  assert.deepEqual(sent[0], sent[1])
  assert.equal((sent[1] as { active: boolean }).active, false)
  assert.equal(controller.getSnapshot().people[0].revision, 4)
  assert.equal(controller.getSnapshot().retry, false)
})
test('invitation retries reuse the original invitation and operation IDs, with no automatic retry', async () => {
  const sent: unknown[] = []
  const response = {
    schemaVersion: 2,
    id: 'invite',
    role: 'coach',
    invitationUrl: 'https://atlas.example.test/app/invite#token=synthetic',
    expiresAt: '2026-10-24T12:00:00Z',
  }
  const client = {
    call: async (key: string, input: unknown) => {
      if (key === 'people') return [member]
      sent.push(structuredClone(input))
      if (sent.length === 1) throw new ApiError('Timeout', 504, 'TIMEOUT')
      return response
    },
  } as ProductV2Client
  const controller = new PeopleController(context(), () => client)
  await controller.load()
  await controller.invite(
    invitationInput(
      admin,
      'atlas-principal',
      {
        name: 'Person',
        email: 'person@example.test',
        role: 'coach',
        branchGrants: [
          { branchId: 'atlas-principal', role: 'member', active: true },
          { branchId: 'atlas-north', role: 'coach', active: false },
        ],
      },
      { id: 'invite', operationId: 'operation' },
      branchOptions,
    ),
  )
  assert.equal(sent.length, 1)
  assert.equal(controller.getSnapshot().invitation, null)
  await controller.retry()
  assert.deepEqual(sent[0], sent[1])
  assert.deepEqual(controller.getSnapshot().invitation, response)
  assert.deepEqual(
    controller.getSnapshot().invitationGrants,
    (sent[0] as { branchGrants: unknown }).branchGrants,
  )
  controller.dismissInvitation()
  assert.equal(controller.getSnapshot().invitation, null)
})
test('known role/CAS rejection leaves the loaded person untouched and does not enable blind retry', async () => {
  const client = {
    call: async (key: string) => {
      if (key === 'people') return [member]
      throw new ApiError('Last superadmin', 409, 'LAST_SUPERADMIN')
    },
  } as ProductV2Client
  const controller = new PeopleController(context(), () => client)
  await controller.load()
  await controller.update({ memberId: member.userId, expectedRevision: 3, active: false })
  assert.deepEqual(controller.getSnapshot().people, [member])
  assert.match(controller.getSnapshot().error, /superadministrador activo/)
  assert.equal(controller.getSnapshot().retry, false)
  assert.equal(controller.getSnapshot().refresh, true)
})
test('departed scope clears invitations/roster and discards a late mutation acknowledgement even if transport ignores abort', async () => {
  const scope = new AbortController(),
    late = deferred<typeof member>()
  const client = {
    call: async (key: string) => (key === 'people' ? [member] : late.promise),
  } as ProductV2Client
  const controller = new PeopleController({ ...context(), signal: scope.signal }, () => client)
  const disconnect = controller.connect()
  await controller.load()
  const save = controller.update({ memberId: member.userId, expectedRevision: 3, active: false })
  scope.abort()
  late.resolve({ ...member, active: false, revision: 4 })
  await save
  assert.deepEqual(controller.getSnapshot().people, [])
  assert.equal(controller.getSnapshot().invitation, null)
  assert.equal(controller.getSnapshot().message, '')
  assert.equal(await controller.retry(), null)
  disconnect()
})
test('overlapping list reloads cannot restore a superseded roster', async () => {
  const old = deferred<(typeof member)[]>()
  let calls = 0
  const client = {
    call: async () => (++calls === 1 ? old.promise : [{ ...member, name: 'Current' }]),
  } as ProductV2Client
  const controller = new PeopleController(context(), () => client)
  const first = controller.load()
  await controller.load()
  old.resolve([member])
  await first
  assert.equal(controller.getSnapshot().people[0].name, 'Current')
})
test('temporary stream loss hides private projections and retains the exact pending operation for explicit revalidation/retry', async () => {
  const late = deferred<typeof member>()
  const sent: unknown[] = []
  const client = {
    call: async (key: string, input: unknown) => {
      if (key === 'people') return [member]
      sent.push(structuredClone(input))
      return sent.length === 1 ? late.promise : { ...member, revision: 4, active: false }
    },
  } as ProductV2Client
  const controller = new PeopleController(context(), () => client)
  await controller.load()
  const save = controller.update({ memberId: member.userId, expectedRevision: 3, active: false })
  controller.suspend()
  late.resolve({ ...member, revision: 4, active: false })
  await save
  assert.deepEqual(controller.getSnapshot().people, [])
  assert.equal(controller.getSnapshot().retry, true)
  await controller.load()
  await controller.retry()
  assert.deepEqual(sent[0], sent[1])
  assert.equal(controller.getSnapshot().retry, false)
})

test('current tenant or selected-role denial hides protected data until an explicit fresh load succeeds', async () => {
  let denied = true
  const client = {
    call: async (key: string) => {
      if (key === 'people') return [member]
      if (denied) throw new ApiError('Role denied', 403, 'FORBIDDEN')
      return { ...member, revision: 4 }
    },
  } as ProductV2Client
  const controller = new PeopleController(context(), () => client)
  await controller.load()
  await controller.update({ memberId: member.userId, expectedRevision: 3, active: false })
  assert.deepEqual(controller.getSnapshot().people, [])
  assert.equal(controller.getSnapshot().blocked, true)
  assert.equal(controller.getSnapshot().retry, false)
  denied = false
  await controller.load()
  assert.equal(controller.getSnapshot().blocked, false)
  assert.equal(controller.getSnapshot().people.length, 1)
})
