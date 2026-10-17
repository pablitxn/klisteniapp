import { useCallback, useMemo, useRef, useState } from 'react'
import type { ProductV2Client } from '@klisteniapp/b2b-client'
import { AssignmentSchema } from '@klisteniapp/b2b-contracts/training'
import { useLoad } from '@klisteniapp/b2b-react'
import type { HealthAccess } from '../features/health/healthAccess'
import { ProductHistoryPage } from '../features/training/HistoryPage'
import { ProductTrainingSession } from '../features/training/Session'
import type { FlushLocalWorkout } from '../features/training/sync/localWorkoutFlush'
import { createWorkoutClient } from '../features/training/sync/workoutClient'
import type { WorkoutScope, WorkoutDocument } from '../features/training/storage/workoutStore'
import type { WorkoutRecoveryStore } from '../features/training/storage/recoverySelection'
import type { RoutineReference, SessionRecord } from '../features/training/routine-history/model'

import {
  type LegacyWorkoutAssignment,
  type WorkoutRecoveryContext,
} from '../features/training/storage/selectedWorkoutRecovery'
import { LegacyWorkoutEntryChoice } from '../features/training/sync/LegacyWorkoutEntryChoice'
import { UnboundWorkoutRecoveryChoice } from '../features/training/sync/UnboundWorkoutRecoveryChoice'
import {
  loadSelectedWorkout,
  readIssuedWorkoutRoutine,
  type WorkoutSelection,
} from './workoutSelection'
export type SelectedRecovery = { scope: WorkoutScope; id: string }
export function ProductWorkoutHistory({
  context,
  createClient,
  store,
  onSelected,
  recoveryContext,
  recoverable,
  onOpenRoutine,
  registerLocalFlush,
}: {
  context: HealthAccess
  createClient: (signal?: AbortSignal) => ProductV2Client
  store: WorkoutRecoveryStore
  recoveryContext: WorkoutRecoveryContext
  recoverable: WorkoutDocument | null
  onSelected: (selection: SelectedRecovery) => void | Promise<void>
  onOpenRoutine: (r: RoutineReference) => void
  registerLocalFlush?: (flush: FlushLocalWorkout) => void | (() => void)
}) {
  const [selection, setSelection] = useState<WorkoutSelection | null>(null)
  const [visit, setVisit] = useState(0)
  const [legacyAssignment, setLegacyAssignment] = useState<LegacyWorkoutAssignment | null>(null)
  function edit(record: SessionRecord) {
    if (record.schemaVersion === 1) {
      setSelection({
        id: record.original.id,
        origin: {
          kind: 'legacy',
          assignmentId: record.original.assignmentId,
          executionId: record.original.id,
          routine: {
            programId: record.routine.programId,
            version: record.routine.version,
            schemaVersion: 1,
          },
        },
      })
      return
    }
    setSelection({ origin: record.origin, id: record.id, accepted: record })
  }
  return selection ? (
    <SelectedWorkout
      key={JSON.stringify([selection.origin, selection.id, visit])}
      context={context}
      createClient={createClient}
      store={store}
      selection={selection}
      onClose={() => setSelection(null)}
      onRestart={() => setVisit((value) => value + 1)}
      onSelected={onSelected}
      recoveryContext={recoveryContext}
      registerLocalFlush={registerLocalFlush}
    />
  ) : legacyAssignment ? (
    <LegacyEntry
      key={legacyAssignment.id}
      assignment={legacyAssignment}
      context={recoveryContext}
      createClient={createClient}
      store={store}
      onCancel={() => setLegacyAssignment(null)}
      onSelected={(document) => {
        setLegacyAssignment(null)
        setSelection({ id: document.id, origin: document.origin, accepted: document.accepted })
      }}
    />
  ) : (
    <>
      {recoverable && (
        <button
          className="button"
          onClick={() =>
            setSelection({
              id: recoverable.id,
              origin: recoverable.origin,
              accepted: recoverable.accepted,
            })
          }
        >
          Retomar trabajo guardado en este dispositivo
        </button>
      )}
      <ProductHistoryPage
        scope={{
          organizationId: context.organizationId,
          branchId: context.branchId,
          memberId: context.accountId,
        }}
        accessKey={context.generation}
        createClient={createClient}
        canReschedule
        onOpenRoutine={onOpenRoutine}
        onStartOccurrence={(occurrence) =>
          setSelection({
            origin: {
              kind: 'occurrence',
              occurrenceId: occurrence.id,
              routine: occurrence.routine,
            },
          })
        }
        onStartLegacy={setLegacyAssignment}
        onEditSession={edit}
      />
    </>
  )
}
function SelectedWorkout({
  context,
  createClient,
  store,
  selection,
  onClose,
  onRestart,
  onSelected,
  recoveryContext,
  registerLocalFlush,
}: {
  context: HealthAccess
  createClient: (signal?: AbortSignal) => ProductV2Client
  store: WorkoutRecoveryStore
  selection: WorkoutSelection
  onClose: () => void
  onRestart: () => void
  registerLocalFlush?: (flush: FlushLocalWorkout) => void | (() => void)
  recoveryContext: WorkoutRecoveryContext
  onSelected: (selection: SelectedRecovery) => void | Promise<void>
}) {
  const localFlush = useRef<FlushLocalWorkout | null>(null)
  const departure = useRef<Promise<void> | null>(null)
  const [departureError, setDepartureError] = useState('')
  const bindLocalFlush = useCallback(
    (flush: FlushLocalWorkout) => {
      localFlush.current = flush
      const unregister = registerLocalFlush?.(flush)
      return () => {
        if (localFlush.current === flush) localFlush.current = null
        unregister?.()
      }
    },
    [registerLocalFlush],
  )
  function restartAfterLocalFlush() {
    if (departure.current) return departure.current
    const flush = localFlush.current
    departure.current = (async () => {
      try {
        await flush?.()
        if (context.signal.aborted || localFlush.current !== flush) return
        onRestart()
      } catch {
        if (!context.signal.aborted)
          setDepartureError(
            'No pudimos conservar todos los cambios locales. Reintentá desde la sesión o exportá tu trabajo.',
          )
      } finally {
        departure.current = null
      }
    })()
    return departure.current
  }
  const io = useMemo(() => createWorkoutClient(createClient), [createClient])
  const [skipUnbound, setSkipUnbound] = useState(false)
  const loaded = useLoad(
    (signal) =>
      loadSelectedWorkout({
        context: recoveryContext,
        selection: { ...selection, skipUnbound },
        store,
        createClient,
        signal,
      }),
    JSON.stringify([context.generation, selection, skipUnbound]),
  )
  const workout = loaded.data?.kind === 'workout' ? loaded.data : null
  const [confirmed, setConfirmed] = useState<string[]>([])
  const environment = useMemo(
    () => ({
      activeMachineIds: new Set(workout?.equipment.activeMachineIds ?? []),
      confirmedEquipment: new Set(confirmed),
    }),
    [workout?.equipment, confirmed],
  )
  const labels = [
    ...new Set(
      (workout?.prescription.kind === 'reviewed' ? workout!.prescription.routine.relations : [])
        .map((r) => r.target.equipment)
        .filter((label) => label && label !== 'none') ?? [],
    ),
  ]
  return (
    <section>
      {departureError && <p role="alert">{departureError}</p>}
      {loaded.loading && <p role="status">Cargando tu prescripción emitida y acceso actual…</p>}
      {loaded.error && (
        <>
          <p role="alert">{loaded.error}</p>
          <button
            className="button"
            onClick={workout ? () => void restartAfterLocalFlush() : loaded.reload}
          >
            Volver a consultar
          </button>
          {!workout && (
            <button className="button" onClick={onClose}>
              Volver al historial
            </button>
          )}
        </>
      )}
      {loaded.data?.kind === 'unbound' && (
        <UnboundWorkoutRecoveryChoice
          store={store}
          context={recoveryContext}
          source={loaded.data.source}
          onAdopted={() => loaded.reload()}
          onOpenFresh={() => setSkipUnbound(true)}
        />
      )}
      {workout && (
        <>
          {workout.offline && (
            <p role="status">
              Abrimos la prescripción conservada en este dispositivo. Los envíos siguen suspendidos.
              <button className="button" onClick={() => void restartAfterLocalFlush()}>
                Volver a validar la conexión
              </button>
            </p>
          )}
          {!!labels.length && (
            <fieldset>
              <legend>Material disponible para alternativas</legend>
              {labels.map((label) => (
                <label key={label}>
                  <input
                    type="checkbox"
                    checked={confirmed.includes(label)}
                    onChange={(e) =>
                      setConfirmed((current) =>
                        e.target.checked ? [...current, label] : current.filter((x) => x !== label),
                      )
                    }
                  />
                  Confirmo que tengo {label} disponible
                </label>
              ))}
            </fieldset>
          )}
          <ProductTrainingSession
            initial={workout!.initial}
            prescription={workout!.prescription}
            store={store}
            access={context.access}
            transport={io.transport}
            environment={environment}
            integrationAccepted={
              !workout.offline && context.access?.accessMode === 'active' && !context.signal.aborted
            }
            onDocumentReady={(document) => onSelected({ scope: document.scope, id: document.id })}
            contextSignal={context.signal}
            registerLocalFlush={bindLocalFlush}
            onClose={onClose}
            loadRemote={async () => {
              const binding = await io.sessionBinding(workout!.initial.id, context.signal)
              if (!binding.accepted)
                throw new Error('Solo existe la revisión original; conservamos el trabajo local.')
              return binding.accepted
            }}
            loadRemoteBinding={() => io.sessionBinding(workout!.initial.id, context.signal)}
          />
        </>
      )}
    </section>
  )
}

function LegacyEntry({
  assignment,
  context,
  createClient,
  store,
  onSelected,
  onCancel,
}: {
  assignment: LegacyWorkoutAssignment
  context: WorkoutRecoveryContext
  createClient: (signal?: AbortSignal) => ProductV2Client
  store: WorkoutRecoveryStore
  onSelected: (document: WorkoutDocument) => void
  onCancel: () => void
}) {
  const loaded = useLoad(
    async (requestSignal) => {
      const signal = AbortSignal.any([context.signal, requestSignal])
      const result = await readIssuedWorkoutRoutine(
        context,
        assignment.routine,
        createClient,
        signal,
      )
      // This historical shape only validates and preserves the original localStorage
      // bytes. Empty availability grants no current exercise permission or replay.
      const original =
        result.stored.schemaVersion === 1
          ? AssignmentSchema.parse({
              id: assignment.id,
              branchId: assignment.scope.branchId,
              active: assignment.active,
              memberId: assignment.scope.memberId,
              memberName: context.bootstrap.user.name,
              assignedBy: assignment.assignedBy,
              createdAt: assignment.createdAt,
              program: result.stored.snapshot,
              availability: [],
            })
          : null
      return {
        ...result,
        legacySource: original
          ? {
              assignment: original,
              storage: { getItem: (key: string) => localStorage.getItem(key) },
            }
          : undefined,
      }
    },
    JSON.stringify([context.bootstrap.realm, context.access.accessRevision, assignment]),
  )
  return (
    <section>
      {loaded.loading && <p role="status">Consultando la asignación y su versión emitida…</p>}
      {loaded.error && (
        <>
          <p role="alert">{loaded.error}</p>
          <button className="button" onClick={loaded.reload}>
            Volver a consultar
          </button>
        </>
      )}
      {loaded.data ? (
        <LegacyWorkoutEntryChoice
          store={store}
          context={context}
          assignment={assignment}
          routine={loaded.data.routine}
          legacySource={loaded.data.legacySource}
          onSelected={onSelected}
          onCancel={onCancel}
        />
      ) : (
        <button className="button" onClick={onCancel}>
          Volver al historial
        </button>
      )}
    </section>
  )
}
