import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ProductAccess, ProductOutput } from '@klisteniapp/b2b-contracts/product-v2'
import {
  canManagePerson,
  creatableRoles,
  productRoleLabels,
} from '../src/features/people/peopleCapabilities.ts'

const access: ProductAccess = {
  schemaVersion: 2,
  organizationId: 'atlas',
  userId: 'admin',
  role: 'admin',
  accessMode: 'active',
  accessRevision: 0,
  branches: [],
  capabilities: ['manage-people'],
}
const person = (role: ProductAccess['role']): ProductOutput<'people'>[number] => ({
  schemaVersion: 2,
  userId: 'person',
  name: 'Person',
  email: 'person@example.test',
  role,
  active: true,
  revision: 0,
  branchGrants: [],
  coachIds: [],
})
test('People actions mirror current server capabilities and keep admin hierarchy explicit', () => {
  assert.deepEqual(creatableRoles(access), ['member', 'coach'])
  assert.equal(canManagePerson(access, person('admin')), false)
  assert.equal(canManagePerson(access, person('superadmin')), false)
  assert.equal(canManagePerson(access, person('coach')), true)
  const superadmin: ProductAccess = {
    ...access,
    role: 'superadmin',
    capabilities: ['manage-people', 'manage-admins'],
  }
  assert.deepEqual(creatableRoles(superadmin), ['member', 'coach', 'admin', 'superadmin'])
  assert.equal(productRoleLabels.superadmin, 'Superadministrador')
})
test('trainers, members and export-only sessions have no permission mutation controls', () => {
  assert.deepEqual(
    creatableRoles({ ...access, role: 'coach', capabilities: ['edit-planning'] }),
    [],
  )
  assert.deepEqual(
    creatableRoles({ ...access, role: 'member', capabilities: ['edit-own-sessions'] }),
    [],
  )
  assert.deepEqual(
    creatableRoles({ ...access, accessMode: 'export-only', capabilities: ['export-own-records'] }),
    [],
  )
})
