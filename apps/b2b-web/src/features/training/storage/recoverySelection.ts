import { IdSchema } from '@klisteniapp/b2b-contracts/common'
import { SessionOriginSchema } from '@klisteniapp/b2b-contracts/product-v2'
import { canonicalJson } from '@klisteniapp/b2b-domain/sessions'
import {
  LocalWorkoutConflict,
  unboundWorkoutScope,
  sameScope,
  sameWorkoutRealm,
  validWorkoutRealm,
  workoutKey,
  type WorkoutRealm,
  type WorkoutScope,
} from './workoutIdentity.ts'
import type { WorkoutDocument, WorkoutStore } from './workoutStore.ts'

export type WorkoutRecoveryOwner = {
  origin: string
  accountId: string
  organizationId: string
  realm: WorkoutRealm
}
export type WorkoutRecoveryPointer = {
  schemaVersion: 1
  owner: WorkoutRecoveryOwner
  generation: number
  scope: WorkoutScope
  id: string
  documentKey: string
  documentGeneration: number
  origin: WorkoutDocument['origin']
}
export type SelectedWorkoutRecovery = { pointer: WorkoutRecoveryPointer; document: WorkoutDocument }
export type CommitWorkoutSelection = {
  owner: WorkoutRecoveryOwner
  scope: WorkoutScope
  id: string
  expectedPointerGeneration: number | null
  expectedDocumentGeneration: number | null
  create?: WorkoutDocument
  /** Explicit adoption copies the exact unbound source; its original stays intact. */
  adoptUnbound?: { key: string; expectedGeneration: number }
}
export interface WorkoutRecoveryStore extends WorkoutStore {
  claim(key: string, signal: AbortSignal): Promise<WorkoutRecoveryOwner | null>
  selected(
    owner: WorkoutRecoveryOwner,
    signal: AbortSignal,
  ): Promise<SelectedWorkoutRecovery | null>
  commitSelection(
    input: CommitWorkoutSelection,
    signal: AbortSignal,
  ): Promise<SelectedWorkoutRecovery>
  list(scope: WorkoutScope, signal: AbortSignal): Promise<WorkoutDocument[]>
}
export function recoveryOwnerKey(owner: WorkoutRecoveryOwner): string {
  if (
    !validWorkoutRealm(owner.realm) ||
    !owner.origin ||
    !IdSchema.safeParse(owner.accountId).success ||
    !IdSchema.safeParse(owner.organizationId).success
  )
    throw new Error('Invalid workout recovery owner')
  return JSON.stringify([
    'selected-workout-v1',
    owner.origin,
    owner.realm.mode,
    owner.realm.key,
    owner.accountId,
    owner.organizationId,
  ])
}
export function assertRecoveryScope(owner: WorkoutRecoveryOwner, scope: WorkoutScope): void {
  recoveryOwnerKey(owner)
  if (!scope || typeof scope !== 'object') throw new Error('Invalid selected workout scope')
  if (
    scope.origin !== owner.origin ||
    scope.accountId !== owner.accountId ||
    scope.actorId !== owner.accountId ||
    scope.organizationId !== owner.organizationId ||
    !IdSchema.safeParse(scope.branchId).success ||
    !sameWorkoutRealm(scope.realm, owner.realm)
  )
    throw new Error('Workout selection is outside the authenticated owner realm')
}
export function parseRecoveryPointer(
  value: unknown,
  owner: WorkoutRecoveryOwner,
): WorkoutRecoveryPointer {
  if (!value || typeof value !== 'object') throw new Error('Invalid selected workout pointer')
  const pointer = value as WorkoutRecoveryPointer
  if (
    pointer.schemaVersion !== 1 ||
    !pointer.owner ||
    canonicalJson(pointer.owner) !== canonicalJson(owner) ||
    !Number.isSafeInteger(pointer.generation) ||
    pointer.generation < 0 ||
    !Number.isSafeInteger(pointer.documentGeneration) ||
    pointer.documentGeneration < 0 ||
    !IdSchema.safeParse(pointer.id).success
  )
    throw new Error('Invalid selected workout owner or version')
  assertRecoveryScope(owner, pointer.scope)
  if (pointer.documentKey !== workoutKey(pointer.scope, pointer.id))
    throw new Error('Invalid selected workout identity')
  SessionOriginSchema.parse(pointer.origin)
  return structuredClone(pointer)
}
export function assertSelectedDocument(
  pointer: WorkoutRecoveryPointer,
  document: WorkoutDocument,
): void {
  if (
    pointer.documentKey !== document.key ||
    pointer.id !== document.id ||
    !sameScope(pointer.scope, document.scope) ||
    document.generation < pointer.documentGeneration ||
    canonicalJson(pointer.origin) !== canonicalJson(document.origin)
  )
    throw new Error('Selected workout no longer matches the durable owner document')
}

/** Pure transition for the one atomic pointer/document transaction. No operation
 * payload is rewritten; adopting old work creates a separate realm-bound copy. */
export function prepareRecoverySelection(
  input: CommitWorkoutSelection,
  previous: WorkoutRecoveryPointer | null,
  target: WorkoutDocument | null,
  source: WorkoutDocument | null,
  sourceClaim: WorkoutRecoveryOwner | null = null,
): SelectedWorkoutRecovery {
  assertRecoveryScope(input.owner, input.scope)
  if (previous) parseRecoveryPointer(previous, input.owner)
  if (
    (previous?.generation ?? null) !== input.expectedPointerGeneration ||
    (target?.generation ?? null) !== input.expectedDocumentGeneration
  )
    throw new LocalWorkoutConflict()
  if (input.create && input.adoptUnbound) throw new Error('Choose new work or explicit adoption')
  const targetKey = workoutKey(input.scope, input.id)
  let document = target
  if (input.create) {
    if (
      target ||
      input.expectedDocumentGeneration !== null ||
      input.create.generation !== 0 ||
      input.create.key !== targetKey
    )
      throw new LocalWorkoutConflict()
    document = input.create
  } else if (input.adoptUnbound) {
    if (sourceClaim && canonicalJson(sourceClaim) !== canonicalJson(input.owner))
      throw new Error('Unbound work was already adopted in another authenticated realm')
    const unbound = unboundWorkoutScope(input.scope),
      key = workoutKey(unbound, input.id)
    if (
      target ||
      input.expectedDocumentGeneration !== null ||
      !source ||
      input.adoptUnbound.key !== key ||
      source.key !== key ||
      !sameScope(source.scope, unbound) ||
      source.generation !== input.adoptUnbound.expectedGeneration
    )
      throw new LocalWorkoutConflict()
    document = {
      ...structuredClone(source),
      scope: structuredClone(input.scope),
      key: targetKey,
      generation: 0,
    }
  }
  if (
    !document ||
    document.key !== targetKey ||
    document.id !== input.id ||
    !sameScope(document.scope, input.scope)
  )
    throw new Error('Select an existing durable owner document')
  const pointer: WorkoutRecoveryPointer = {
    schemaVersion: 1,
    owner: structuredClone(input.owner),
    generation: (previous?.generation ?? -1) + 1,
    scope: structuredClone(document.scope),
    id: document.id,
    documentKey: document.key,
    documentGeneration: document.generation,
    origin: structuredClone(document.origin),
  }
  assertSelectedDocument(parseRecoveryPointer(pointer, input.owner), document)
  return structuredClone({ pointer, document })
}
