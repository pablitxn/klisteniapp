import { ProductAccessSchema, type ProductAccess } from '@klisteniapp/b2b-contracts/product-v2'
import { canonicalJson } from '@klisteniapp/b2b-domain/sessions'
import { sameScope, workoutKey, type WorkoutScope, type WorkoutStore } from './workoutStore.ts'

/** Read-only WP11 seam. The caller supplies the current authenticated identity
 * and discovery result; this never grants operational access or starts replay. */
export async function exportOwnerLocalWorkout(
  store: WorkoutStore,
  context: { scope: WorkoutScope; access: ProductAccess; signal: AbortSignal },
  sessionId: string,
): Promise<string | null> {
  context.signal.throwIfAborted()
  const access = ProductAccessSchema.parse(context.access)
  const { scope } = context
  if (
    access.userId !== scope.accountId ||
    access.userId !== scope.actorId ||
    access.organizationId !== scope.organizationId ||
    !access.capabilities.includes('export-own-records')
  )
    throw new Error('Current authenticated owner export access is required')
  const document = await store.read(workoutKey(scope, sessionId))
  context.signal.throwIfAborted()
  if (!document) return null
  if (!sameScope(document.scope, scope) || document.id !== sessionId)
    throw new Error('Local workout does not belong to the selected owner context')
  const operations = document.operations.filter((operation) => operation.state !== 'accepted')
  const changed =
    !document.accepted ||
    canonicalJson(document.content) !== canonicalJson(document.accepted.content)
  if (!changed && !operations.length && !document.recovery.length && !document.legacyDraft)
    return null
  return JSON.stringify(
    {
      format: 'klisteniapp.local-workout-recovery',
      version: 2,
      serverConfirmed: false,
      warning:
        'Unsynchronized local work; separate from accepted server records and server export.',
      owner: {
        accountId: scope.accountId,
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        memberId: scope.actorId,
      },
      sessionId,
      origin: document.origin,
      acceptedRevision: document.accepted?.revision ?? null,
      localContent: changed ? document.content : null,
      operations,
      supersededOperationIds: document.supersededOperationIds,
      recovery: document.recovery,
      legacyDraft: document.legacyDraft,
      originalLegacy: document.binding?.original ?? null,
      retainedPrescription: document.binding?.prescription ?? null,
      legacyConfirmedSetKeys: document.legacyConfirmedSetKeys ?? [],
      problem: document.problem,
    },
    null,
    2,
  )
}
