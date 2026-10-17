import { useMemo, useState } from 'react'
import type { ProductV2Client } from '@klisteniapp/b2b-client'
import type { ProductOutput, SessionRevision } from '@klisteniapp/b2b-contracts/product-v2'
import { useLoad } from '@klisteniapp/b2b-react'
import type { HealthAccess } from '../features/health/healthAccess'
import { ProductHistoryPage } from '../features/training/HistoryPage'
import { ProductTrainingSession } from '../features/training/Session'
import { createWorkoutDocument, occurrenceWorkoutId } from '../features/training/sync/workoutEdit'
import { createWorkoutClient } from '../features/training/sync/workoutClient'
import type { WorkoutStore, WorkoutScope } from '../features/training/storage/workoutStore'
import type { RoutineReference, SessionRecord } from '../features/training/routine-history/model'

type Selection = {
  origin: SessionRevision['origin']
  id?: string
  accepted?: SessionRevision | null
}
export type SelectedRecovery = { scope: WorkoutScope; id: string }
export function ProductWorkoutHistory({
  context,
  createClient,
  store,
  onSelected,
  onOpenRoutine,
}: {
  context: HealthAccess
  createClient: (signal?: AbortSignal) => ProductV2Client
  store: WorkoutStore
  onSelected: (selection: SelectedRecovery) => void
  onOpenRoutine: (r: RoutineReference) => void
}) {
  const [selection, setSelection] = useState<Selection | null>(null),
    [message, setMessage] = useState('')
  function edit(record: SessionRecord) {
    if (record.schemaVersion === 1) {
      setMessage(
        'El registro original se conserva. Para corregirlo necesitás la prescripción completa revisada por tu entrenador.',
      )
      return
    }
    setSelection({ origin: record.origin, id: record.id, accepted: record })
  }
  return selection ? (
    <SelectedWorkout
      key={JSON.stringify([selection.origin, selection.id])}
      context={context}
      createClient={createClient}
      store={store}
      selection={selection}
      onClose={() => setSelection(null)}
      onSelected={onSelected}
    />
  ) : (
    <>
      {message && <p role="status">{message}</p>}
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
        onStartLegacy={(assignment) =>
          setSelection({
            origin: {
              kind: 'legacy',
              assignmentId: assignment.id,
              executionId: null,
              routine: assignment.routine,
            },
          })
        }
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
  onSelected,
}: {
  context: HealthAccess
  createClient: (signal?: AbortSignal) => ProductV2Client
  store: WorkoutStore
  selection: Selection
  onClose: () => void
  onSelected: (selection: SelectedRecovery) => void
}) {
  const io = useMemo(() => createWorkoutClient(createClient), [createClient])
  const loaded = useLoad(
    async (signal) => {
      const stored = await io.routineVersion(selection.origin.routine, signal)
      const routine =
        stored.schemaVersion === 2
          ? stored.snapshot
          : await createClient(signal).call('routineSupplement', {
              id: selection.origin.routine.programId,
              version: selection.origin.routine.version,
            })
      if (!routine)
        throw new Error(
          'La rutina original sigue disponible en el historial. Tu entrenador debe completar su prescripción antes de usar el nuevo registro.',
        )
      const scope: WorkoutScope = {
        origin: location.origin,
        accountId: context.accountId,
        actorId: context.accountId,
        organizationId: context.organizationId,
        branchId: context.branchId,
      }
      let accepted = selection.accepted ?? null
      if (!selection.id && selection.origin.kind === 'occurrence') {
        const occurrenceId = selection.origin.occurrenceId
        const records = await createClient(signal).call('sessions', { memberId: context.accountId })
        accepted =
          records
            .filter(
              (record): record is SessionRevision =>
                record.schemaVersion === 2 &&
                record.origin.kind === 'occurrence' &&
                record.origin.occurrenceId === occurrenceId,
            )
            .sort((a, b) => b.revision - a.revision)[0] ?? null
      }
      const id =
        selection.id ??
        accepted?.id ??
        (selection.origin.kind === 'occurrence'
          ? await occurrenceWorkoutId(scope, selection.origin.occurrenceId)
          : crypto.randomUUID())
      const equipment = await createClient(signal).call('workoutEquipment', {})
      const relations = (
        await Promise.all(
          routine.steps.map((step) =>
            createClient(signal).call('alternatives', {
              id: routine.programId,
              version: routine.version,
              stepId: step.id,
            }),
          ),
        )
      ).flat()
      const initial = createWorkoutDocument(
        scope,
        id,
        selection.origin,
        routine,
        () => crypto.randomUUID(),
        new Date().toISOString(),
        accepted,
      )
      signal.throwIfAborted()
      context.signal.throwIfAborted()
      onSelected({ scope, id })
      return {
        initial,
        routine: { ...routine, relations: [...new Map(relations.map((r) => [r.id, r])).values()] },
        equipment,
      }
    },
    JSON.stringify([context.generation, selection]),
  )
  const [confirmed, setConfirmed] = useState<string[]>([])
  const environment = useMemo(
    () => ({
      activeMachineIds: new Set(loaded.data?.equipment.activeMachineIds ?? []),
      confirmedEquipment: new Set(confirmed),
    }),
    [loaded.data?.equipment, confirmed],
  )
  const labels = [
    ...new Set(
      loaded.data?.routine.relations
        .map((r) => r.target.equipment)
        .filter((label) => label && label !== 'none') ?? [],
    ),
  ]
  return (
    <section>
      {loaded.loading && <p role="status">Cargando tu prescripción emitida y acceso actual…</p>}
      {loaded.error && (
        <>
          <p role="alert">{loaded.error}</p>
          <button className="button" onClick={onClose}>
            Volver al historial
          </button>
        </>
      )}
      {loaded.data && (
        <>
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
            initial={loaded.data.initial}
            routine={loaded.data.routine}
            store={store}
            access={context.access}
            transport={io.transport}
            environment={environment}
            integrationAccepted={context.access?.accessMode === 'active' && !context.signal.aborted}
            onClose={onClose}
            loadRemote={() => io.latestRevision(loaded.data!.initial.id, context.signal)}
          />
        </>
      )}
    </section>
  )
}
export type LegacyWorkoutAssignment = ProductOutput<'legacyAssignments'>[number]
