import type { ProductAccess } from '@klisteniapp/b2b-contracts/product-v2'
import type { PeopleContext, Person } from '../../src/features/people/peopleModel.ts'
export const admin: ProductAccess = {
  schemaVersion: 2,
  organizationId: 'atlas',
  userId: 'admin',
  role: 'admin',
  accessMode: 'active',
  accessRevision: 0,
  branches: [],
  capabilities: ['manage-people', 'edit-planning', 'read-training-history'],
}
export const superadmin: ProductAccess = {
  ...admin,
  role: 'superadmin',
  capabilities: [...admin.capabilities, 'manage-admins'],
}
export const member: Person = {
  schemaVersion: 2,
  userId: 'member',
  name: 'Member with a long name',
  email: 'member@example.test',
  role: 'member',
  active: true,
  revision: 3,
  branchGrants: [
    { branchId: 'atlas-principal', role: 'member', active: true },
    { branchId: 'atlas-north', role: 'coach', active: false },
    { branchId: 'atlas-east', role: 'member', active: true },
  ],
  coachIds: [],
}
export function context(access = admin): PeopleContext {
  return {
    accountId: access.userId,
    organizationId: access.organizationId,
    branchId: 'atlas-principal',
    hostBinding: 'realm-atlas',
    generation: 'scope-1',
    access,
    signal: new AbortController().signal,
  }
}
export function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

export const branchOptions: import('../../src/features/people/invitationGrants.ts').InvitationBranch[] =
  [
    { organizationId: 'atlas', branchId: 'atlas-principal', name: 'Principal', status: 'active' },
    { organizationId: 'atlas', branchId: 'atlas-north', name: 'North', status: 'active' },
    { organizationId: 'atlas', branchId: 'atlas-east', name: 'East', status: 'active' },
  ]
export function bootstrapFor(
  scope = context(),
): import('@klisteniapp/b2b-contracts/product-v2').ProductBootstrap {
  return {
    schemaVersion: 2,
    user: { id: scope.accountId, name: 'Admin', email: 'admin@example.test' },
    realm: { mode: 'unified', key: scope.hostBinding },
    memberships: [
      {
        organizationId: scope.organizationId,
        name: 'Atlas',
        role: scope.access!.role,
        activated: true,
        accessMode: 'active',
        accessRevision: scope.access!.accessRevision,
        choices: branchOptions.map((branch) => ({
          branchId: branch.branchId,
          name: branch.name,
          role: scope.access!.role,
        })),
      },
      {
        organizationId: 'sur',
        name: 'Foreign',
        role: 'superadmin',
        activated: true,
        accessMode: 'active',
        accessRevision: 0,
        choices: [{ branchId: 'sur-principal', name: 'Foreign branch', role: 'superadmin' }],
      },
    ],
  }
}
