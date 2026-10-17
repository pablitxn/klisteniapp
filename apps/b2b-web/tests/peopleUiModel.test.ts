import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '@klisteniapp/b2b-client'
import { creatableRoles } from '../src/features/people/peopleCapabilities.ts'
import {
  peopleContextAllowed,
  peopleContextKey,
  replaceCurrentBranchGrants,
  invitationInput,
  lastVisibleSuperadmin,
  peopleError,
} from '../src/features/people/peopleModel.ts'
import { admin, superadmin, member, context } from './people/fixture.ts'

test('selected-role restrictions remain exact even when broader capabilities are supplied', () => {
  assert.deepEqual(
    creatableRoles({ ...admin, capabilities: [...admin.capabilities, 'manage-admins'] }),
    ['member', 'coach'],
  )
  assert.deepEqual(creatableRoles({ ...superadmin, role: 'coach' }), [])
  assert.deepEqual(creatableRoles({ ...superadmin, role: 'member' }), [])
  assert.equal(peopleContextAllowed(context({ ...admin, userId: 'another' })), true)
  assert.equal(peopleContextAllowed({ ...context(), accountId: 'another' }), false)
  assert.equal(peopleContextAllowed({ ...context(), organizationId: 'foreign' }), false)
  assert.equal(peopleContextAllowed({ ...context(), branchId: '' }), false)
  assert.equal(peopleContextAllowed(context({ ...admin, accessMode: 'export-only' })), false)
  const scope = context()
  for (const patch of [
    { accountId: 'other' },
    { organizationId: 'sur' },
    { branchId: 'north' },
    { hostBinding: 'other-realm' },
    { generation: 'next' },
    { access: superadmin },
  ])
    assert.notEqual(peopleContextKey(scope), peopleContextKey({ ...scope, ...patch }))
})
test('selected-branch edits preserve every other active and revoked grant without mutating the source', () => {
  const original = structuredClone(member)
  const result = replaceCurrentBranchGrants(member, 'atlas-principal', {
    coach: true,
    member: false,
  })
  assert.deepEqual(
    result.filter((g) => g.branchId !== 'atlas-principal'),
    [...member.branchGrants.filter((g) => g.branchId !== 'atlas-principal')].sort((a, b) =>
      a.branchId.localeCompare(b.branchId),
    ),
  )
  assert.deepEqual(
    result.filter((g) => g.branchId === 'atlas-principal'),
    [
      { branchId: 'atlas-principal', role: 'coach', active: true },
      { branchId: 'atlas-principal', role: 'member', active: false },
    ],
  )
  assert.deepEqual(member, original)
  assert.throws(() => replaceCurrentBranchGrants(member, '', { coach: false, member: false }))
})
test('invitations emit only supported single-branch roles or privileged roles with no extra grants', () => {
  const ids = { id: 'invite', operationId: 'operation' }
  const input = invitationInput(
    admin,
    'atlas-principal',
    { name: ' Person ', email: 'USER@example.test', role: 'coach' },
    ids,
  )
  assert.equal(input.email, 'user@example.test')
  assert.equal(input.name, 'Person')
  assert.deepEqual(input.branchGrants, [
    { branchId: 'atlas-principal', role: 'coach', active: true },
  ])
  assert.deepEqual(
    invitationInput(
      superadmin,
      'atlas-principal',
      { name: 'Admin', email: 'admin@example.test', role: 'admin' },
      ids,
    ).branchGrants,
    [],
  )
  assert.throws(() =>
    invitationInput(
      admin,
      'atlas-principal',
      { name: 'Admin', email: 'admin@example.test', role: 'admin' },
      ids,
    ),
  )
  assert.throws(() =>
    invitationInput(
      superadmin,
      '',
      { name: 'Admin', email: 'admin@example.test', role: 'admin' },
      ids,
    ),
  )
})
test('last-superadmin and tenant/CAS denials have recoverable messages distinct from ambiguous transport', () => {
  const last = { ...member, role: 'superadmin' as const }
  assert.equal(lastVisibleSuperadmin(last, [last]), true)
  assert.equal(lastVisibleSuperadmin(last, [last, { ...last, userId: 'second' }]), false)
  for (const code of ['LAST_SUPERADMIN', 'FORBIDDEN', 'NOT_FOUND', 'REVISION_CONFLICT']) {
    const failure = peopleError(
      new ApiError('Server rejection', code === 'FORBIDDEN' ? 403 : 409, code),
    )
    assert.equal(failure.uncertain, false)
    assert.notEqual(failure.message, 'Server rejection')
  }
  assert.equal(peopleError(new ApiError('Response lost', 0, 'NETWORK_ERROR')).uncertain, true)
})
