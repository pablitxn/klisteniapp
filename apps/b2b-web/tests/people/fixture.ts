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
