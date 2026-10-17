import {
  workoutPrescription,
  prescriptionDisplay,
  unsupportedLegacySets,
  legacySetKey,
  hasExplicitLegacyEntry,
  type WorkoutBinding,
} from './workoutPrescription'
import { canonicalJson } from '@klisteniapp/b2b-domain/sessions'
import { useRef, useState } from 'react'
import type { SessionRevision } from '@klisteniapp/b2b-contracts/product-v2'
import type { AlternativeEnvironment } from '@klisteniapp/b2b-domain/alternatives'
import { Field, Notice } from '@klisteniapp/b2b-ui'
import { ProductSessionStep } from '../SessionStep'
import { useProductTrainingSession, type ProductWorkoutOptions } from './useProductTrainingSession'
import './workout.css'
export type ProductTrainingSessionProps = ProductWorkoutOptions & {
  environment: AlternativeEnvironment
  onClose: () => void
  /** Authorized latest revision query; no reconstruction from mutable catalog. */
  loadRemote: () => Promise<SessionRevision>
  /** Root binds accepted-session conflict reads to the authoritative prescription. */
  loadRemoteBinding?: () => Promise<WorkoutBinding>
}
export function ProductTrainingSession(props: ProductTrainingSessionProps) {
  return <WorkoutForm key={props.initial.key} {...props} />
}
function WorkoutForm(props: ProductTrainingSessionProps) {
  const session = useProductTrainingSession(props)
  const [remote, setRemote] = useState<SessionRevision | null>(null)
  const [remoteBinding, setRemoteBinding] = useState<WorkoutBinding | undefined>(undefined)
  const [recoveryError, setRecoveryError] = useState('')
  const closeRequest = useRef<Promise<void> | null>(null)
  function requestClose() {
    if (closeRequest.current) return closeRequest.current
    closeRequest.current = session
      .requestClose(props.onClose, { retry: Boolean(session.closeError) })
      .catch(() => {
        // The hook keeps captured values and exposes the local durability failure.
        closeRequest.current = null
      })
    return closeRequest.current
  }
  const d = session.document
  const prescription = d?.binding?.prescription ?? workoutPrescription(props)
  const display = prescriptionDisplay(prescription)
  function download() {
    try {
      const url = URL.createObjectURL(
        new Blob([session.exportLocal()], { type: 'application/json' }),
      )
      const a = document.createElement('a')
      a.href = url
      a.download = 'klisteni-local-workout.json'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setRecoveryError(String(e))
    }
  }
  if (!d)
    return <div role="status">{session.storageError || 'Cargando el borrador de esta cuenta…'}</div>
  if (!session.editable)
    return (
      <section className="card workout-session">
        <h1>Recuperar trabajo local</h1>
        <p role="status">
          El acceso a la sesión está bloqueado. Conservamos el trabajo propio para exportarlo por
          separado.
        </p>
        <Notice error>{session.storageError || recoveryError}</Notice>
        <button className="button" onClick={download}>
          Exportar trabajo local sin confirmar
        </button>
        <button className="button" onClick={props.onClose}>
          Volver
        </button>
      </section>
    )
  const state =
    d.problem?.kind ??
    (session.error
      ? 'failed'
      : session.storageError
        ? 'storage-error'
        : !props.integrationAccepted
          ? 'integration-pending'
          : !session.online
            ? 'offline'
            : session.busy
              ? 'sending'
              : d.operations.some(
                    (op) =>
                      !d.supersededOperationIds.includes(op.operationId) && op.state !== 'accepted',
                  )
                ? 'pending'
                : d.accepted && canonicalJson(d.accepted.content) === canonicalJson(d.content)
                  ? 'synced'
                  : 'local')
  const labels = {
    failed: 'Falló la sincronización. Conservamos la operación para reintentar.',
    conflict: 'Conflicto: elegí cómo recuperar tu trabajo.',
    blocked: 'Acceso bloqueado: el trabajo local está conservado.',
    invalid: 'El servidor rechazó estos datos. Revisá y creá un nuevo envío.',
    unavailable: 'Un ejercicio ya no está disponible. Tu trabajo sigue guardado.',
    'storage-error': 'No se pudo guardar en este dispositivo. Exportá el trabajo antes de salir.',
    'integration-pending': 'Sincronización pendiente de la validación de acceso integrada.',
    offline: 'Sin conexión: borrador conservado en este dispositivo.',
    sending: 'Enviando una operación inmutable…',
    pending: 'Envío pendiente: reintento con la misma identidad.',
    synced: 'Sincronizado. Guardar no completa la sesión.',
    local: 'Borrador local guardado; pendiente de sincronización.',
  }
  return (
    <div className="workout-session">
      <div className="page-heading">
        <div>
          <h1>{display.name}</h1>
          <p>Registrá valores reales. Cada ejercicio usa su propia dosis y carga.</p>
        </div>
        <button className="button" disabled={session.closing} onClick={() => void requestClose()}>
          {session.closing
            ? 'Guardando en este dispositivo…'
            : session.closeError
              ? 'Reintentar guardado local y volver'
              : 'Volver'}
        </button>
      </div>
      <p role="status" aria-live="polite">
        {session.closing
          ? 'Guardando cambios locales antes de salir. No esperamos la sincronización con el servidor.'
          : labels[state]}
      </p>
      {session.recovered && <Notice>Recuperamos tu borrador local.</Notice>}
      {!session.editable && (
        <Notice>
          Este acceso permite recuperar el trabajo propio. La edición y el envío están bloqueados.
        </Notice>
      )}
      <Notice error>
        {session.closeError || session.error || session.storageError || recoveryError}
      </Notice>
      {session.storageError && (
        <button className="button" onClick={() => void session.reloadLocal()}>
          Recargar copia local y archivar cambios de esta pantalla
        </button>
      )}
      {d.problem && <Notice error>{d.problem.message}</Notice>}
      <button className="button" onClick={download}>
        Exportar trabajo local sin confirmar
      </button>
      {d.problem?.kind === 'blocked' && (
        <button className="button" onClick={() => void session.resume()}>
          Revisar acceso y reintentar
        </button>
      )}
      {(d.problem?.kind === 'invalid' || d.problem?.kind === 'unavailable') && (
        <button
          className="button"
          disabled={!session.editable || session.closing}
          onClick={() => void session.reviseRejected()}
        >
          Reenviar datos corregidos con nueva operación
        </button>
      )}
      {session.correctionProblem && <Notice>{session.correctionProblem}</Notice>}
      {d.binding?.original && (
        <details>
          <summary>Registro original conservado · revisión cero</summary>
          <pre>{JSON.stringify(d.binding.original, null, 2)}</pre>
        </details>
      )}
      {!d.accepted &&
        d.binding &&
        unsupportedLegacySets(d.binding).map((set) => {
          const key = legacySetKey(set)
          const confirmed =
            d.legacyConfirmedSetKeys?.includes(key) && hasExplicitLegacyEntry(d, key)
          return (
            <section className="card" key={key}>
              <h2>Serie original sin vínculo compatible</h2>
              <p>
                Ejercicio {set.exerciseId} · paso {set.stepId} · serie {set.set}. Conservamos sus
                valores originales; registrá una corrección explícita en el paso correspondiente.
              </p>
              <pre>{JSON.stringify(set, null, 2)}</pre>
              <button
                className="button"
                disabled={
                  !session.editable || !hasExplicitLegacyEntry(d, key) || Boolean(confirmed)
                }
                onClick={() => void session.confirmLegacyCorrection(key)}
              >
                {confirmed
                  ? 'Corrección explícita confirmada'
                  : 'Confirmar los valores corregidos que registré para esta serie'}
              </button>
            </section>
          )
        })}
      {d.legacyDraft && (
        <details>
          <summary>Borrador original conservado</summary>
          <pre>{d.legacyDraft.bytes}</pre>
        </details>
      )}
      {d.problem && d.problem.kind !== 'blocked' && (
        <section className="card">
          <p>
            Compará la revisión del servidor con tu trabajo. Ninguna opción combina datos
            automáticamente.
          </p>
          <button
            className="button"
            disabled={!session.editable || session.closing}
            onClick={() => {
              setRemote(null)
              setRemoteBinding(undefined)
              void (
                props.loadRemoteBinding
                  ? props.loadRemoteBinding().then((binding) => {
                      if (!binding.accepted)
                        throw new Error(
                          'El servidor todavía conserva solo la revisión original. Tu trabajo local no se reemplazó.',
                        )
                      setRemoteBinding(binding)
                      setRemote(binding.accepted)
                    })
                  : props.loadRemote().then(setRemote)
              ).catch((e) => setRecoveryError(String(e)))
            }}
          >
            Cargar revisión del servidor
          </button>
          {remote && (
            <>
              <details>
                <summary>Comparar registros</summary>
                <pre>{JSON.stringify({ local: d.content, server: remote.content }, null, 2)}</pre>
              </details>
              <button
                className="button"
                onClick={() => void session.recover(remote, 'server', remoteBinding)}
              >
                Usar servidor y archivar copia local
              </button>
              <button
                className="button"
                onClick={() => void session.recover(remote, 'local', remoteBinding)}
              >
                Reaplicar mi trabajo como nueva revisión
              </button>
            </>
          )}
        </section>
      )}
      <Field label="Fecha y hora realizada (ISO con zona)">
        <input
          value={d.content.performedAt}
          disabled={!session.editable || session.closing}
          onChange={(e) => {
            const value = e.currentTarget.value
            void session.edit((c) => ({ ...c, performedAt: value }))
          }}
        />
      </Field>
      {display.steps.map((step) => (
        <ProductSessionStep
          key={step.id}
          prescription={prescription}
          step={step}
          content={d.content}
          environment={props.environment}
          disabled={!session.editable || session.closing}
          acceptedSegmentIds={new Set(d.accepted?.content.segments.map((s) => s.segmentId) ?? [])}
          onArchiveTarget={(id) => {
            void session.archiveTarget(id)
          }}
          onEdit={(change) => {
            void session.edit(change)
          }}
        />
      ))}
      <Field label="Notas de la sesión">
        <textarea
          maxLength={2000}
          value={d.content.notes}
          disabled={!session.editable || session.closing}
          onChange={(e) => {
            const value = e.currentTarget.value
            void session.edit((c) => ({ ...c, notes: value }))
          }}
        />
      </Field>
      <Field label="Motivo de corrección">
        <textarea
          maxLength={1000}
          value={d.content.correctionReason}
          disabled={!session.editable || session.closing}
          onChange={(e) => {
            const value = e.currentTarget.value
            void session.edit((c) => ({ ...c, correctionReason: value }))
          }}
        />
      </Field>
      <p>
        Estado del trabajo: {d.content.status}. Autoguardar y sincronizar conservan el estado;
        completar requiere tu acción.
      </p>
      <div className="workout-actions">
        <button
          className="button"
          disabled={!session.editable || session.closing}
          onClick={() => void session.save('void')}
        >
          Anular registro con motivo
        </button>
        <button
          className="button"
          disabled={!session.editable || session.closing}
          onClick={() => void session.save(false)}
        >
          Guardar parcial
        </button>
        <button
          className="button primary"
          disabled={!session.editable || session.closing}
          onClick={() => void session.save(true)}
        >
          Completar sesión explícitamente
        </button>
        <button
          className="button"
          disabled={
            !session.editable ||
            session.closing ||
            session.busy ||
            !session.online ||
            !props.integrationAccepted ||
            Boolean(session.storageError) ||
            Boolean(session.correctionProblem)
          }
          onClick={() => void session.synchronize()}
        >
          Reintentar sincronización
        </button>
      </div>
    </div>
  )
}
