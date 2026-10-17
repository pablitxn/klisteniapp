export type WorkoutRealm = { mode: 'unified' | 'white-label' | 'legacy'; key: string }
export type WorkoutScope = {
  origin: string
  accountId: string
  organizationId: string
  branchId: string
  actorId: string
  /** Optional only for preserved records predating authenticated realm binding. */
  realm?: WorkoutRealm
}
export function validWorkoutRealm(value: unknown): value is WorkoutRealm {
  if (!value || typeof value !== 'object') return false
  const realm = value as WorkoutRealm
  return (
    Object.keys(realm).length === 2 &&
    ['unified', 'white-label', 'legacy'].includes(realm.mode) &&
    typeof realm.key === 'string' &&
    realm.key.length > 0 &&
    realm.key.length <= 2048
  )
}
export function sameWorkoutRealm(a: WorkoutRealm | undefined, b: WorkoutRealm | undefined) {
  return a === undefined || b === undefined ? a === b : a.mode === b.mode && a.key === b.key
}
export function workoutKey(scope: WorkoutScope, id: string): string {
  const identity = [
    scope.origin,
    scope.accountId,
    scope.organizationId,
    scope.branchId,
    scope.actorId,
  ]
  if (scope.realm) identity.push('realm-v1', scope.realm.mode, scope.realm.key)
  return JSON.stringify([...identity, id])
}
export function workoutScopePrefix(scope: WorkoutScope): string {
  return workoutKey(scope, '').slice(0, -3)
}
export function sameScope(a: WorkoutScope, b: WorkoutScope): boolean {
  return (
    a.origin === b.origin &&
    a.accountId === b.accountId &&
    a.organizationId === b.organizationId &&
    a.branchId === b.branchId &&
    a.actorId === b.actorId &&
    sameWorkoutRealm(a.realm, b.realm)
  )
}
export function unboundWorkoutScope(scope: WorkoutScope): WorkoutScope {
  return {
    origin: scope.origin,
    accountId: scope.accountId,
    organizationId: scope.organizationId,
    branchId: scope.branchId,
    actorId: scope.actorId,
  }
}

export class LocalWorkoutConflict extends Error {
  constructor() {
    super('This workout changed in another tab. Reload the local copy before editing.')
    this.name = 'LocalWorkoutConflict'
  }
}
