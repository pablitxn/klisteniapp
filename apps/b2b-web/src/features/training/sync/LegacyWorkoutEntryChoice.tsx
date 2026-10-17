import { newWorkoutId } from './workoutCrypto'
import { useEffect, useRef, useState } from 'react'
import type { Assignment } from '@klisteniapp/b2b-contracts/training'
import type { RoutineVersionV2 } from '@klisteniapp/b2b-contracts/product-v2'
import { Notice } from '@klisteniapp/b2b-ui'
import { sessionDraftKey, type SessionStorage } from '../sessionDraft'
import { preserveLegacyWorkout } from '../storage/legacyMigration'
import { recoveryOwnerKey, type WorkoutRecoveryStore } from '../storage/recoverySelection'
import {
  authenticatedRecoveryOwner,
  legacyWorkoutChoices,
  resumeLegacyWorkout,
  startNewLegacyWorkout,
  type LegacyWorkoutAssignment,
  type LegacyWorkoutChoice,
  type WorkoutRecoveryContext,
} from '../storage/selectedWorkoutRecovery'
import type { WorkoutDocument } from '../storage/workoutStore'

export function LegacyWorkoutEntryChoice({
  store,
  context,
  assignment,
  routine,
  legacySource,
  onSelected,
  onCancel,
}: {
  store: WorkoutRecoveryStore
  context: WorkoutRecoveryContext
  assignment: LegacyWorkoutAssignment
  /** A real immutable v2 version or verified server supplement; never a draft projection. */
  routine: RoutineVersionV2 | null
  legacySource?: { assignment: Assignment; storage: Pick<SessionStorage, 'getItem'> }
  onSelected: (document: WorkoutDocument) => void
  onCancel: () => void
}) {
  let key = ''
  try {
    if (!context.signal.aborted)
      key = JSON.stringify([
        recoveryOwnerKey(authenticatedRecoveryOwner(context)),
        context.branchId,
        assignment.id,
        assignment.routine,
      ])
  } catch {
    /* Await fresh authenticated discovery. */
  }
  const [state, setState] = useState<{
    key: string
    choices: LegacyWorkoutChoice[]
    canStartNew: boolean
    legacyBytes: string | null
    error: string
  }>({ key: '', choices: [], canStartNew: false, legacyBytes: null, error: '' })
  const activeKey = useRef(key),
    actions = useRef<AbortController | null>(null)
  activeKey.current = key
  useEffect(() => {
    const controller = new AbortController()
    actions.current = controller
    return () => controller.abort()
  }, [key, context.signal])
  const [busy, setBusy] = useState(false),
    [acknowledged, setAcknowledged] = useState(false)
  useEffect(() => {
    if (!key) return
    const controller = new AbortController(),
      scoped = { ...context, signal: AbortSignal.any([context.signal, controller.signal]) }
    setAcknowledged(false)
    void (async () => {
      let legacyBytes: string | null = null
      try {
        const result = await legacyWorkoutChoices(store, scoped, assignment)
        if (legacySource) {
          const old = legacySource.assignment
          if (
            old.memberId !== context.bootstrap.user.id ||
            old.id !== assignment.id ||
            (old.branchId && old.branchId !== assignment.scope.branchId) ||
            old.program.programId !== assignment.routine.programId ||
            old.program.version !== assignment.routine.version
          )
            throw new Error('El borrador anterior no pertenece a esta asignación.')
          const sourceKey = sessionDraftKey(
            assignment.scope.organizationId,
            old.memberId,
            old.id,
            assignment.scope.branchId,
          )
          legacyBytes = legacySource.storage.getItem(sourceKey)
          const source = await preserveLegacyWorkout(store, legacySource.storage, sourceKey, old)
          legacyBytes = source?.bytes ?? null
        }
        scoped.signal.throwIfAborted()
        setState({ key, ...result, legacyBytes, error: '' })
      } catch (error) {
        if (!scoped.signal.aborted)
          setState({
            key,
            choices: [],
            canStartNew: false,
            legacyBytes,
            error: String(error),
          })
      }
    })()
    return () => controller.abort()
  }, [store, key, context.signal, legacySource])
  async function choose(choice?: LegacyWorkoutChoice) {
    if (busy || !key || context.signal.aborted) return
    const expectedKey = key
    const scoped = {
      ...context,
      signal: AbortSignal.any([context.signal, actions.current?.signal ?? AbortSignal.abort()]),
    }
    if (scoped.signal.aborted) return
    setBusy(true)
    try {
      const selected = choice
        ? await resumeLegacyWorkout(store, scoped, assignment, choice)
        : routine
          ? await startNewLegacyWorkout(
              store,
              scoped,
              assignment,
              routine,
              () => newWorkoutId(),
              new Date().toISOString(),
            )
          : null
      scoped.signal.throwIfAborted()
      if (selected && expectedKey === activeKey.current) onSelected(selected.document)
    } catch (error) {
      if (!scoped.signal.aborted && expectedKey === activeKey.current)
        setState((previous) => ({ ...previous, error: String(error) }))
    } finally {
      if (!scoped.signal.aborted && expectedKey === activeKey.current) setBusy(false)
    }
  }
  function exportLegacyBytes() {
    if (!key || context.signal.aborted) return
    authenticatedRecoveryOwner(context)
    if (!state.legacyBytes || state.key !== key) return
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              format: 'klisteniapp.legacy-local-recovery',
              version: 1,
              serverConfirmed: false,
              originalBytes: state.legacyBytes,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'klisteni-legacy-local-recovery.json'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  if (!key || context.signal.aborted || state.key !== key)
    return <p role="status">Verificando los borradores de esta cuenta y contexto…</p>
  const hasPrevious = state.choices.length > 0 || state.legacyBytes !== null
  return (
    <section className="card" aria-label="Elegir sesión anterior o nueva">
      <h2>¿Retomar o empezar una sesión nueva?</h2>
      <p>Elegí qué trabajo querés abrir. No enviamos ni completamos una sesión por entrar aquí.</p>
      <Notice error>{state.error}</Notice>
      {!hasPrevious && <p>No encontramos borradores en esta asignación y contexto.</p>}
      {state.choices.map((choice) => (
        <section className="subtle" key={choice.key}>
          <p>
            {choice.performedAt} · {choice.status} · {choice.pendingOperations} envíos por confirmar
          </p>
          {choice.requiresRealmAdoption && (
            <p>
              Este borrador anterior todavía no tiene contexto autenticado. Retomarlo conserva la
              copia original y vincula una copia a tu contexto actual.
            </p>
          )}
          {!choice.canResume && (
            <p role="status">
              {choice.reason === 'RETIRED_NEW_SESSION'
                ? 'La asignación se retiró antes del primer envío. Conservamos el borrador; no puede crear una sesión nueva.'
                : 'El envío anterior requiere compatibilidad explícita. No lo reintentamos automáticamente.'}
            </p>
          )}
          <button
            className="button"
            disabled={busy || !choice.canResume}
            onClick={() => void choose(choice)}
          >
            Retomar este borrador
          </button>
        </section>
      ))}
      {state.legacyBytes && (
        <Notice>
          Conservamos un borrador del formato anterior. Su envío puede no estar confirmado; no se
          reintenta ni se convierte automáticamente.{' '}
          <button className="button" onClick={exportLegacyBytes}>
            Exportar copia anterior sin confirmar
          </button>
        </Notice>
      )}
      {!routine && (
        <Notice>
          Hace falta una prescripción emitida completa o su suplemento verificado para empezar una
          sesión nueva. No completamos dosis faltantes.
        </Notice>
      )}
      {hasPrevious && (
        <label className="check">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          Entiendo que la sesión nueva será independiente y que las copias y envíos anteriores se
          conservarán.
        </label>
      )}
      <div className="row">
        <button
          className="button primary"
          disabled={busy || !state.canStartNew || !routine || (hasPrevious && !acknowledged)}
          onClick={() => void choose()}
        >
          Empezar una sesión nueva
        </button>
        <button
          className="button"
          onClick={() => {
            actions.current?.abort()
            onCancel()
          }}
        >
          Volver
        </button>
      </div>
    </section>
  )
}
