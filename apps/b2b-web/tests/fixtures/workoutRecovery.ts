import type { ProductBootstrap } from '@klisteniapp/b2b-contracts/product-v2'
import { createWorkoutDocument } from '../../src/features/training/sync/workoutEdit.ts'
import { parseWorkoutDocument } from '../../src/features/training/storage/workoutStore.ts'
import { workoutKey, sameScope } from '../../src/features/training/storage/workoutIdentity.ts'
import {
  recoveryOwnerKey,
  prepareRecoverySelection,
  parseRecoveryPointer,
  assertSelectedDocument,
  type WorkoutRecoveryStore,
  type WorkoutRecoveryOwner,
  type WorkoutRecoveryPointer,
  type CommitWorkoutSelection,
} from '../../src/features/training/storage/recoverySelection.ts'
import {
  recoveryWorkoutScope,
  type WorkoutRecoveryContext,
  type LegacyWorkoutAssignment,
} from '../../src/features/training/storage/selectedWorkoutRecovery.ts'
import { MemoryWorkoutStore, access, scope, routine, now } from './workout.ts'
export function recoveryContext(realmKey = 'realm-a'): WorkoutRecoveryContext {
  const bootstrap: ProductBootstrap = {
    schemaVersion: 2,
    user: { id: 'member', name: 'Member', email: 'member@example.test' },
    realm: { mode: 'white-label', key: realmKey },
    memberships: [
      {
        organizationId: 'gym',
        name: 'Gym',
        role: 'member',
        activated: true,
        accessMode: 'active',
        accessRevision: 1,
        choices: [{ branchId: 'east', name: 'East', role: 'member' }],
      },
    ],
  }
  return {
    origin: scope.origin,
    bootstrap,
    access: structuredClone(access),
    branchId: 'east',
    signal: new AbortController().signal,
  }
}
export const legacyAssignment: LegacyWorkoutAssignment = {
  schemaVersion: 2,
  id: 'assignment',
  scope: { organizationId: 'gym', branchId: 'east', memberId: 'member' },
  active: true,
  assignedBy: 'coach',
  createdAt: now,
  routine: { programId: routine.programId, version: routine.version, schemaVersion: 2 },
  name: 'Issued legacy routine',
  archivedAt: null,
}
export function legacyRecoveryDraft(context = recoveryContext(), id = 'legacy-session') {
  let ordinal = 0
  return createWorkoutDocument(
    recoveryWorkoutScope(context),
    id,
    {
      kind: 'legacy',
      assignmentId: legacyAssignment.id,
      executionId: null,
      routine: legacyAssignment.routine,
    },
    routine,
    () => `segment-${++ordinal}`,
    now,
  )
}
/** Only the pure transition is shared; native IndexedDB transaction behavior is
 * independently exercised by the browser storage probe. */
export class MemoryRecoveryStore extends MemoryWorkoutStore implements WorkoutRecoveryStore {
  pointers = new Map<string, WorkoutRecoveryPointer>()
  claims = new Map<string, WorkoutRecoveryOwner>()
  commits = 0
  async claim(key: string, signal: AbortSignal) {
    signal.throwIfAborted()
    return structuredClone(this.claims.get(key) ?? null)
  }
  async selected(owner: WorkoutRecoveryOwner, signal: AbortSignal) {
    signal.throwIfAborted()
    const pointer = this.pointers.get(recoveryOwnerKey(owner))
    if (!pointer) return null
    const checked = parseRecoveryPointer(pointer, owner)
    const raw = this.documents.get(checked.documentKey)
    if (!raw) throw new Error('Selected local workout is missing; the pointer is preserved')
    const document = parseWorkoutDocument(raw)
    assertSelectedDocument(checked, document)
    return structuredClone({ pointer: checked, document })
  }
  async list(selectedScope: typeof scope, signal: AbortSignal) {
    signal.throwIfAborted()
    return [...this.documents.values()]
      .filter((document) => sameScope(document.scope, selectedScope))
      .map(parseWorkoutDocument)
  }
  async commitSelection(input: CommitWorkoutSelection, signal: AbortSignal) {
    signal.throwIfAborted()
    if (this.fail) throw new DOMException('Synthetic quota exhausted', 'QuotaExceededError')
    const key = recoveryOwnerKey(input.owner),
      target = this.documents.get(workoutKey(input.scope, input.id)) ?? null
    const source = input.adoptUnbound ? (this.documents.get(input.adoptUnbound.key) ?? null) : null
    const selected = prepareRecoverySelection(
      input,
      this.pointers.get(key) ?? null,
      target,
      source,
      input.adoptUnbound ? (this.claims.get(input.adoptUnbound.key) ?? null) : null,
    )
    if (input.create || input.adoptUnbound)
      this.documents.set(selected.document.key, parseWorkoutDocument(selected.document))
    if (input.adoptUnbound) this.claims.set(input.adoptUnbound.key, structuredClone(input.owner))
    this.pointers.set(key, selected.pointer)
    this.commits++
    return structuredClone(selected)
  }
}
