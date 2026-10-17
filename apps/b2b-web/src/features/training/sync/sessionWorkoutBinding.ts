import {
  SessionContentSchema,
  type ProductInput,
  type SessionPrescriptionBinding,
} from '@klisteniapp/b2b-contracts/product-v2'
import { createOriginalSegment } from '@klisteniapp/b2b-domain/alternatives'
import { canonicalJson, sessionIssues } from '@klisteniapp/b2b-domain/sessions'
import { canEditWorkout } from './workoutSync.ts'
import {
  parseWorkoutDocument,
  workoutKey,
  sameScope,
  type WorkoutDocument,
  type WorkoutScope,
  type WorkoutStore,
} from '../storage/workoutStore.ts'
import {
  validateWorkoutBinding,
  prescriptionContent,
  projectLegacyActuals,
  type WorkoutBinding,
} from './workoutPrescription.ts'
import type { WorkoutRecoveryContext } from '../storage/selectedWorkoutRecovery.ts'
import { recoveryWorkoutScope } from '../storage/selectedWorkoutRecovery.ts'

type BoundSelection = {
  scope: WorkoutScope
  id: string
  origin: ProductInput<'saveSession'>['origin']
}
export function createBoundWorkoutDocument(
  selection: BoundSelection,
  raw: WorkoutBinding,
  createId: () => string,
  now: string,
): WorkoutDocument {
  const binding = validateWorkoutBinding(selection, raw)
  const segments = prescriptionContent(binding.prescription).steps.map((step) =>
    createOriginalSegment(step, createId(), now),
  )
  const sets = projectLegacyActuals(binding, segments, createId)
  const content =
    binding.accepted?.content ??
    SessionContentSchema.parse({
      status: sets.length ? 'partial' : 'draft',
      explicitCompletion: false,
      performedAt: binding.original?.original.completedAt ?? now,
      notes: binding.original?.original.notes ?? '',
      correctionReason: '',
      segments,
      selectedSegments: segments.map((s) => ({
        originalStepId: s.originalStepId,
        segmentId: s.segmentId,
      })),
      sets,
    })
  return parseWorkoutDocument({
    schemaVersion: 2,
    key: workoutKey(selection.scope, selection.id),
    scope: structuredClone(selection.scope),
    id: selection.id,
    origin: structuredClone(selection.origin),
    generation: 0,
    content,
    accepted: binding.accepted,
    binding,
    legacyConfirmedSetKeys: [],
    operations: [],
    legacyDraft: null,
    supersededOperationIds: [],
    recovery: [],
    problem: null,
    replayAccessRevision: null,
  })
}
/** Every accepted/edit/resume route calls the authoritative reader. Only binding
 * metadata is refreshed; pending bytes, original IDs and local actuals survive. */
export async function loadSessionWorkout(
  options: BoundSelection & {
    store: WorkoutStore
    readBinding: (id: string, signal: AbortSignal) => Promise<WorkoutBinding>
    signal: AbortSignal
    createId: () => string
    now: string
  },
): Promise<{ initial: WorkoutDocument; prescription: SessionPrescriptionBinding }> {
  const { store, signal } = options
  signal.throwIfAborted()
  const key = workoutKey(options.scope, options.id)
  const local = await store.read(key)
  signal.throwIfAborted()
  if (
    local &&
    (!sameScope(local.scope, options.scope) ||
      canonicalJson(local.origin) !== canonicalJson(options.origin))
  )
    throw new Error('Stored session has another issued identity; original bytes are preserved')
  const binding = validateWorkoutBinding(options, await options.readBinding(options.id, signal))
  signal.throwIfAborted()
  if (!local)
    return {
      initial: createBoundWorkoutDocument(options, binding, options.createId, options.now),
      prescription: binding.prescription,
    }
  if (
    local.binding?.original &&
    canonicalJson(local.binding.original) !== canonicalJson(binding.original)
  )
    throw new Error('The original legacy evidence changed; local work is preserved')
  if (local.accepted && (!binding.accepted || binding.accepted.revision < local.accepted.revision))
    throw new Error('The accepted binding moved backwards; local work is preserved')
  if (
    local.accepted &&
    sessionIssues(local.accepted.content, prescriptionContent(binding.prescription)).length
  )
    throw new Error('The server binding does not retain the local accepted prescription')
  const exactPending = local.operations.some(
    (op) =>
      op.operationId === binding.accepted?.operationId &&
      op.payload.expectedRevision + 1 === binding.accepted.revision &&
      canonicalJson(op.payload.content) === canonicalJson(binding.accepted.content),
  )
  const conflict =
    binding.accepted && binding.accepted.revision > (local.accepted?.revision ?? 0) && !exactPending
  const next = parseWorkoutDocument({
    ...local,
    binding,
    generation: local.generation + 1,
    problem: conflict
      ? {
          kind: 'conflict',
          message: 'El servidor tiene otra revisión. Compará y elegí cómo recuperar tu trabajo.',
        }
      : local.problem,
  })
  if (canonicalJson({ ...next, generation: local.generation }) === canonicalJson(local))
    return { initial: local, prescription: binding.prescription }
  await store.compareAndSet(next, local.generation, signal)
  signal.throwIfAborted()
  return { initial: next, prescription: binding.prescription }
}
/** Offline editing may reuse only a previously persisted server binding. This
 * does not refresh authority or enable replay; parent keeps its network gate. */
export async function restoreOfflineSessionWorkout(
  store: WorkoutStore,
  context: WorkoutRecoveryContext,
  selection: BoundSelection,
) {
  context.signal.throwIfAborted()
  const scope = recoveryWorkoutScope(context)
  if (!sameScope(scope, selection.scope) || !canEditWorkout(scope, context.access))
    throw new Error('Current owner context does not permit offline session editing')
  const initial = await store.read(workoutKey(scope, selection.id))
  context.signal.throwIfAborted()
  if (!initial?.binding || canonicalJson(initial.origin) !== canonicalJson(selection.origin))
    throw new Error('No retained session binding is available offline; local work is preserved')
  const binding = validateWorkoutBinding(initial, initial.binding)
  return { initial, prescription: binding.prescription }
}
