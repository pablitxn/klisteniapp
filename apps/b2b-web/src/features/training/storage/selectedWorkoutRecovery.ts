import {
  ProductAccessSchema,
  ProductBootstrapSchema,
  ProductEndpoints,
  RoutineVersionV2Schema,
  type ProductAccess,
  type ProductBootstrap,
  type ProductOutput,
  type RoutineVersionV2,
} from '@klisteniapp/b2b-contracts/product-v2'
import { canonicalJson } from '@klisteniapp/b2b-domain/sessions'
import { canEditWorkout } from '../sync/workoutSync.ts'
import { createWorkoutDocument } from '../sync/workoutEdit.ts'
import { exportOwnerLocalWorkout } from './ownerRecoveryExport.ts'
import { workoutKey, sameScope, unboundWorkoutScope, type WorkoutScope } from './workoutIdentity.ts'
import {
  recoveryOwnerKey,
  assertRecoveryScope,
  type WorkoutRecoveryOwner,
  type WorkoutRecoveryStore,
  type SelectedWorkoutRecovery,
} from './recoverySelection.ts'
import type { WorkoutDocument } from './workoutStore.ts'

export type WorkoutRecoveryContext = {
  origin: string
  bootstrap: ProductBootstrap
  access: ProductAccess
  branchId: string
  signal: AbortSignal
}
export type LegacyWorkoutAssignment = ProductOutput<'legacyAssignments'>[number]
export type LegacyWorkoutChoice = {
  id: string
  key: string
  generation: number
  scope: WorkoutScope
  performedAt: string
  status: WorkoutDocument['content']['status']
  pendingOperations: number
  requiresRealmAdoption: boolean
  canResume: boolean
  reason: string | null
}
export function authenticatedRecoveryOwner(context: WorkoutRecoveryContext): WorkoutRecoveryOwner {
  context.signal.throwIfAborted()
  const bootstrap = ProductBootstrapSchema.parse(context.bootstrap),
    access = ProductAccessSchema.parse(context.access)
  const membership = bootstrap.memberships.find((m) => m.organizationId === access.organizationId)
  const origin = new URL(context.origin)
  if (
    !['https:', 'http:'].includes(origin.protocol) ||
    origin.origin !== context.origin ||
    bootstrap.user.id !== access.userId ||
    !membership ||
    membership.accessMode !== access.accessMode ||
    membership.accessRevision !== access.accessRevision ||
    !access.capabilities.includes('export-own-records')
  )
    throw new Error('Current authenticated owner discovery is required for local recovery')
  const owner = {
    origin: context.origin,
    accountId: bootstrap.user.id,
    organizationId: access.organizationId,
    realm: bootstrap.realm,
  }
  // The stored realm contains only mode/key, never bootstrap identity or memberships.
  recoveryOwnerKey(owner)
  return owner
}
export function recoveryWorkoutScope(
  context: WorkoutRecoveryContext,
  branchId = context.branchId,
): WorkoutScope {
  const owner = authenticatedRecoveryOwner(context)
  const scope = {
    origin: owner.origin,
    accountId: owner.accountId,
    actorId: owner.accountId,
    organizationId: owner.organizationId,
    branchId,
    realm: { mode: owner.realm.mode, key: owner.realm.key },
  }
  assertRecoveryScope(owner, scope)
  return scope
}
function mayResumeScope(context: WorkoutRecoveryContext, scope: WorkoutScope): boolean {
  const owner = authenticatedRecoveryOwner(context)
  const membership = context.bootstrap.memberships.find(
    (m) => m.organizationId === owner.organizationId,
  )!
  return (
    sameScope(scope, recoveryWorkoutScope(context, scope.branchId)) &&
    context.branchId === scope.branchId &&
    context.access.accessMode === 'active' &&
    context.access.role === 'member' &&
    membership.choices.some((c) => c.branchId === scope.branchId && c.role === 'member') &&
    canEditWorkout(scope, context.access)
  )
}
export function mayResumeSelectedWorkout(
  context: WorkoutRecoveryContext,
  document: WorkoutDocument,
): boolean {
  return mayResumeScope(context, document.scope) && !hasBlockedLegacyPayload(document)
}
export async function restoreSelectedWorkout(
  store: WorkoutRecoveryStore,
  context: WorkoutRecoveryContext,
): Promise<SelectedWorkoutRecovery | null> {
  const owner = authenticatedRecoveryOwner(context)
  const selected = await store.selected(owner, context.signal)
  context.signal.throwIfAborted()
  return selected
}
export async function rememberSelectedWorkout(
  store: WorkoutRecoveryStore,
  context: WorkoutRecoveryContext,
  selection: { scope: WorkoutScope; id: string },
): Promise<SelectedWorkoutRecovery> {
  const owner = authenticatedRecoveryOwner(context)
  assertRecoveryScope(owner, selection.scope)
  const document = await store.read(workoutKey(selection.scope, selection.id))
  context.signal.throwIfAborted()
  if (
    !document ||
    !sameScope(selection.scope, document.scope) ||
    !mayResumeSelectedWorkout(context, document)
  )
    throw new Error('Select a durable workout in the current member context')
  const previous = await store.selected(owner, context.signal)
  context.signal.throwIfAborted()
  if (previous?.document.key === document.key) return previous
  return store.commitSelection(
    {
      owner,
      scope: document.scope,
      id: document.id,
      expectedPointerGeneration: previous?.pointer.generation ?? null,
      expectedDocumentGeneration: document.generation,
    },
    context.signal,
  )
}
export async function exportSelectedOwnerWorkout(
  store: WorkoutRecoveryStore,
  context: WorkoutRecoveryContext,
): Promise<string | null> {
  const selected = await restoreSelectedWorkout(store, context)
  if (!selected) return null
  return exportOwnerLocalWorkout(
    store,
    { scope: selected.document.scope, access: context.access, signal: context.signal },
    selected.document.id,
  )
}
export function hasBlockedLegacyPayload(document: WorkoutDocument): boolean {
  if (!document.legacyDraft) return false
  try {
    const value: unknown = JSON.parse(document.legacyDraft.bytes)
    return (
      !value || typeof value !== 'object' || ('pending' in value && value.pending !== undefined)
    )
  } catch {
    return true
  }
}
function verifiedLegacyAssignment(context: WorkoutRecoveryContext, raw: LegacyWorkoutAssignment) {
  const assignment = ProductEndpoints.legacyAssignments.output.parse([raw])[0]
  const scope = recoveryWorkoutScope(context)
  if (
    assignment.scope.organizationId !== scope.organizationId ||
    assignment.scope.branchId !== scope.branchId ||
    assignment.scope.memberId !== scope.actorId ||
    !mayResumeScope(context, scope)
  )
    throw new Error('Legacy entry requires the current own issued branch context')
  return { assignment, scope }
}
function matchesLegacyDocument(
  document: WorkoutDocument,
  scope: WorkoutScope,
  assignment: LegacyWorkoutAssignment,
): boolean {
  return (
    sameScope(document.scope, scope) &&
    document.origin.kind === 'legacy' &&
    document.origin.assignmentId === assignment.id &&
    document.origin.executionId === null &&
    canonicalJson(document.origin.routine) === canonicalJson(assignment.routine)
  )
}
function resumeReason(
  document: WorkoutDocument,
  assignment: LegacyWorkoutAssignment,
): string | null {
  if (hasBlockedLegacyPayload(document)) return 'LEGACY_POST_REQUIRES_EXPLICIT_COMPATIBILITY'
  if (
    (!assignment.active || assignment.archivedAt !== null) &&
    !document.accepted &&
    !document.operations.some((op) => op.state === 'sending')
  )
    return 'RETIRED_NEW_SESSION'
  return null
}
export async function legacyWorkoutChoices(
  store: WorkoutRecoveryStore,
  context: WorkoutRecoveryContext,
  raw: LegacyWorkoutAssignment,
): Promise<{ choices: LegacyWorkoutChoice[]; canStartNew: boolean }> {
  const { assignment, scope } = verifiedLegacyAssignment(context, raw)
  const [bound, unbound] = await Promise.all([
    store.list(scope, context.signal),
    store.list(unboundWorkoutScope(scope), context.signal),
  ])
  context.signal.throwIfAborted()
  const availableUnbound: WorkoutDocument[] = []
  for (const document of unbound) {
    const claim = await store.claim(document.key, context.signal)
    if (!claim) availableUnbound.push(document)
  }
  context.signal.throwIfAborted()
  const choices = [...bound, ...availableUnbound]
    .filter((document) =>
      matchesLegacyDocument(
        document,
        document.scope.realm ? scope : unboundWorkoutScope(scope),
        assignment,
      ),
    )
    .filter(
      (document) =>
        document.content.status === 'draft' ||
        document.content.status === 'partial' ||
        document.operations.some(
          (op) =>
            op.state !== 'accepted' && !document.supersededOperationIds.includes(op.operationId),
        ) ||
        document.legacyDraft !== null,
    )
    .map((document) => ({
      id: document.id,
      key: document.key,
      generation: document.generation,
      scope: document.scope,
      performedAt: document.content.performedAt,
      status: document.content.status,
      pendingOperations: document.operations.filter(
        (op) =>
          op.state !== 'accepted' && !document.supersededOperationIds.includes(op.operationId),
      ).length,
      requiresRealmAdoption: document.scope.realm === undefined,
      canResume: resumeReason(document, assignment) === null,
      reason: resumeReason(document, assignment),
    }))
  return { choices, canStartNew: assignment.active && assignment.archivedAt === null }
}
export async function resumeLegacyWorkout(
  store: WorkoutRecoveryStore,
  context: WorkoutRecoveryContext,
  raw: LegacyWorkoutAssignment,
  choice: LegacyWorkoutChoice,
): Promise<SelectedWorkoutRecovery> {
  const { assignment, scope } = verifiedLegacyAssignment(context, raw)
  const owner = authenticatedRecoveryOwner(context)
  const document = await store.read(choice.key)
  context.signal.throwIfAborted()
  if (
    !document ||
    document.generation !== choice.generation ||
    document.key !== workoutKey(document.scope, choice.id) ||
    !matchesLegacyDocument(
      document,
      document.scope.realm ? scope : unboundWorkoutScope(scope),
      assignment,
    )
  )
    throw new Error('The chosen legacy draft changed; refresh the choices')
  const reason = resumeReason(document, assignment)
  if (reason) throw new Error(reason)
  const previous = await store.selected(owner, context.signal)
  context.signal.throwIfAborted()
  return store.commitSelection(
    {
      owner,
      scope,
      id: document.id,
      expectedPointerGeneration: previous?.pointer.generation ?? null,
      expectedDocumentGeneration: document.scope.realm ? document.generation : null,
      ...(document.scope.realm
        ? {}
        : { adoptUnbound: { key: document.key, expectedGeneration: document.generation } }),
    },
    context.signal,
  )
}
export async function startNewLegacyWorkout(
  store: WorkoutRecoveryStore,
  context: WorkoutRecoveryContext,
  raw: LegacyWorkoutAssignment,
  routine: RoutineVersionV2,
  createId: () => string,
  now: string,
): Promise<SelectedWorkoutRecovery> {
  const { assignment, scope } = verifiedLegacyAssignment(context, raw)
  if (!assignment.active || assignment.archivedAt !== null) throw new Error('RETIRED_NEW_SESSION')
  const prescription = RoutineVersionV2Schema.parse(routine)
  const document = createWorkoutDocument(
    scope,
    createId(),
    { kind: 'legacy', assignmentId: assignment.id, executionId: null, routine: assignment.routine },
    prescription,
    createId,
    now,
  )
  const owner = authenticatedRecoveryOwner(context),
    previous = await store.selected(owner, context.signal)
  context.signal.throwIfAborted()
  return store.commitSelection(
    {
      owner,
      scope,
      id: document.id,
      expectedPointerGeneration: previous?.pointer.generation ?? null,
      expectedDocumentGeneration: null,
      create: document,
    },
    context.signal,
  )
}

/** Inspect the exact old key for an issued occurrence/session; never guess a
 * different account, realm or document identity from selection memory. */
export async function findUnboundWorkout(
  store: WorkoutRecoveryStore,
  context: WorkoutRecoveryContext,
  id: string,
  origin: WorkoutDocument['origin'],
): Promise<WorkoutDocument | null> {
  const scope = recoveryWorkoutScope(context)
  if (!mayResumeScope(context, scope)) throw new Error('Current own member context is required')
  const unbound = unboundWorkoutScope(scope),
    key = workoutKey(unbound, id)
  const document = await store.read(key)
  context.signal.throwIfAborted()
  if (!document) return null
  if (
    !sameScope(document.scope, unbound) ||
    document.id !== id ||
    canonicalJson(document.origin) !== canonicalJson(origin)
  )
    throw new Error('Unbound workout does not match its issued identity')
  const claim = await store.claim(key, context.signal)
  context.signal.throwIfAborted()
  if (claim) return null
  return document
}
export async function adoptUnboundWorkout(
  store: WorkoutRecoveryStore,
  context: WorkoutRecoveryContext,
  source: WorkoutDocument,
): Promise<SelectedWorkoutRecovery> {
  const current = await findUnboundWorkout(store, context, source.id, source.origin)
  if (!current || current.generation !== source.generation || current.key !== source.key)
    throw new Error('The unbound workout changed or was already adopted')
  if (hasBlockedLegacyPayload(current))
    throw new Error('LEGACY_POST_REQUIRES_EXPLICIT_COMPATIBILITY')
  if (current.origin.kind === 'legacy' && !current.accepted)
    throw new Error(
      'Use the explicit issued-assignment resume/new choice for unaccepted legacy work',
    )
  const owner = authenticatedRecoveryOwner(context),
    scope = recoveryWorkoutScope(context),
    previous = await store.selected(owner, context.signal)
  context.signal.throwIfAborted()
  return store.commitSelection(
    {
      owner,
      scope,
      id: current.id,
      expectedPointerGeneration: previous?.pointer.generation ?? null,
      expectedDocumentGeneration: null,
      adoptUnbound: { key: current.key, expectedGeneration: current.generation },
    },
    context.signal,
  )
}
