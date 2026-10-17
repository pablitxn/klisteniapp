import { ApiError, type ProductV2Client } from '@klisteniapp/b2b-client'
import { RoutineVersionV2Schema, type SessionRevision } from '@klisteniapp/b2b-contracts/product-v2'
import { canonicalJson } from '@klisteniapp/b2b-domain/sessions'
import { createWorkoutClient } from '../features/training/sync/workoutClient.ts'
import {
  createWorkoutDocument,
  occurrenceWorkoutId,
} from '../features/training/sync/workoutEdit.ts'
import { newWorkoutId } from '../features/training/sync/workoutCrypto.ts'
import {
  loadSessionWorkout,
  restoreOfflineSessionWorkout,
} from '../features/training/sync/sessionWorkoutBinding.ts'
import {
  findUnboundWorkout,
  recoveryWorkoutScope,
  type WorkoutRecoveryContext,
} from '../features/training/storage/selectedWorkoutRecovery.ts'
import { workoutKey, type WorkoutDocument } from '../features/training/storage/workoutStore.ts'
import type { WorkoutRecoveryStore } from '../features/training/storage/recoverySelection.ts'

export type WorkoutSelection = {
  origin: SessionRevision['origin']
  id?: string
  accepted?: SessionRevision | null
  skipUnbound?: boolean
}

function unavailable(error: unknown, signal: AbortSignal) {
  return (
    !signal.aborted &&
    (error instanceof TypeError ||
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof ApiError &&
        error.code !== 'INVALID_RESPONSE' &&
        (error.status >= 500 ||
          (error.status === 0 &&
            ['NETWORK_ERROR', 'TIMEOUT', 'ABORTED'].includes(error.code ?? '')))))
  )
}

/** Only a server-validated immutable version or supplement can start new work. */
export async function readIssuedWorkoutRoutine(
  context: WorkoutRecoveryContext,
  reference: SessionRevision['origin']['routine'],
  createClient: (signal?: AbortSignal) => ProductV2Client,
  signal: AbortSignal,
) {
  const stored = await createWorkoutClient(createClient).routineVersion(reference, signal)
  const raw =
    stored.schemaVersion === 2
      ? stored.snapshot
      : await createClient(signal).call('routineSupplement', {
          id: reference.programId,
          version: reference.version,
        })
  signal.throwIfAborted()
  const routine = raw ? RoutineVersionV2Schema.parse(raw) : null
  if (
    routine &&
    (routine.scope.organizationId !== context.access.organizationId ||
      routine.scope.branchId !== context.branchId ||
      routine.programId !== reference.programId ||
      routine.version !== reference.version)
  )
    throw new Error('La prescripción no corresponde a esta versión y sede.')
  return { stored, routine }
}

/** Root selection always checks the authoritative binding before allowing a
 * missing new session. Denial, corruption and known accepted identities never
 * fall through to today's supplement. */
export async function loadSelectedWorkout(options: {
  context: WorkoutRecoveryContext
  selection: WorkoutSelection
  store: WorkoutRecoveryStore
  createClient: (signal?: AbortSignal) => ProductV2Client
  signal: AbortSignal
}) {
  const { context, selection, store, createClient } = options
  const signal = AbortSignal.any([context.signal, options.signal])
  const scopedContext = { ...context, signal }
  const scope = recoveryWorkoutScope(scopedContext)
  const io = createWorkoutClient(createClient)
  let accepted = selection.accepted ?? null
  if (!selection.id && selection.origin.kind === 'occurrence') {
    const occurrenceId = selection.origin.occurrenceId
    try {
      const records = await createClient(signal).call('sessions', { memberId: scope.actorId })
      accepted =
        records
          .filter(
            (row): row is SessionRevision =>
              row.schemaVersion === 2 &&
              row.origin.kind === 'occurrence' &&
              row.origin.occurrenceId === occurrenceId,
          )
          .sort((a, b) => b.revision - a.revision)[0] ?? null
    } catch (error) {
      if (!unavailable(error, signal)) throw error
      // The deterministic identity can find a previously bound local document.
      // It cannot authorize creation without the subsequent actual 404.
    }
  }
  const origin = accepted?.origin ?? selection.origin
  const id =
    selection.id ??
    accepted?.id ??
    (origin.kind === 'occurrence' ? await occurrenceWorkoutId(scope, origin.occurrenceId) : null)
  if (!id)
    throw new Error(
      'Elegí retomar un borrador o empezar una sesión nueva con la asignación emitida.',
    )
  const local = await store.read(workoutKey(scope, id))
  signal.throwIfAborted()
  if (local && canonicalJson(local.origin) !== canonicalJson(origin))
    throw new Error('El borrador conserva otra identidad emitida; no lo reemplazamos.')
  if (!local && !selection.skipUnbound) {
    const source = await findUnboundWorkout(store, scopedContext, id, origin)
    if (source) return { kind: 'unbound' as const, source }
  }
  let bound: {
    initial: WorkoutDocument
    prescription: import('@klisteniapp/b2b-contracts/product-v2').SessionPrescriptionBinding
  }
  let offline = false
  try {
    bound = await loadSessionWorkout({
      scope,
      id,
      origin,
      store,
      signal,
      readBinding: io.sessionBinding,
      createId: newWorkoutId,
      now: new Date().toISOString(),
    })
  } catch (error) {
    if (unavailable(error, signal)) {
      bound = await restoreOfflineSessionWorkout(store, scopedContext, { scope, id, origin })
      offline = true
    } else if (
      error instanceof ApiError &&
      error.status === 404 &&
      !accepted &&
      !local?.accepted &&
      !local?.binding?.accepted &&
      !local?.binding?.original &&
      (origin.kind === 'occurrence' || (origin.executionId === null && local))
    ) {
      const { routine } = await readIssuedWorkoutRoutine(
        scopedContext,
        origin.routine,
        createClient,
        signal,
      )
      if (!routine)
        throw new Error('La prescripción de esta nueva sesión requiere revisión explícita.', {
          cause: error,
        })
      bound = {
        initial:
          local ??
          createWorkoutDocument(scope, id, origin, routine, newWorkoutId, new Date().toISOString()),
        prescription: { kind: 'reviewed', routine },
      }
    } else throw error
  }
  let equipment: { activeMachineIds: string[] } = { activeMachineIds: [] }
  if (!offline) {
    try {
      equipment = await createClient(signal).call('workoutEquipment', {})
    } catch (error) {
      if (!unavailable(error, signal) || !bound.initial.binding) throw error
      offline = true
    }
  }
  signal.throwIfAborted()
  return { kind: 'workout' as const, ...bound, equipment, offline }
}
