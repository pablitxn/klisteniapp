import { canonicalJson } from '@klisteniapp/b2b-domain/sessions'
import { useState } from 'react'
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
}
export function ProductTrainingSession(props: ProductTrainingSessionProps) {
  return <WorkoutForm key={props.initial.key} {...props} />
}
function WorkoutForm(props: ProductTrainingSessionProps) {
  const session = useProductTrainingSession(props)
  const [remote, setRemote] = useState<SessionRevision | null>(null)
  const [recoveryError, setRecoveryError] = useState('')
  const d = session.document
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
          <h1>{props.routine.name}</h1>
          <p>Registrá valores reales. Cada ejercicio usa su propia dosis y carga.</p>
        </div>
        <button className="button" onClick={props.onClose}>
          Volver
        </button>
      </div>
      <p role="status" aria-live="polite">
        {labels[state]}
      </p>
      {session.recovered && <Notice>Recuperamos tu borrador local.</Notice>}
      {!session.editable && (
        <Notice>
          Este acceso permite recuperar el trabajo propio. La edición y el envío están bloqueados.
        </Notice>
      )}
      <Notice error>{session.error || session.storageError || recoveryError}</Notice>
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
          disabled={!session.editable}
          onClick={() => void session.reviseRejected()}
        >
          Reenviar datos corregidos con nueva operación
        </button>
      )}
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
            disabled={!session.editable}
            onClick={() => {
              void props
                .loadRemote()
                .then(setRemote)
                .catch((e) => setRecoveryError(String(e)))
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
              <button className="button" onClick={() => void session.recover(remote, 'server')}>
                Usar servidor y archivar copia local
              </button>
              <button className="button" onClick={() => void session.recover(remote, 'local')}>
                Reaplicar mi trabajo como nueva revisión
              </button>
            </>
          )}
        </section>
      )}
      <Field label="Fecha y hora realizada (ISO con zona)">
        <input
          value={d.content.performedAt}
          disabled={!session.editable}
          onChange={(e) => {
            const value = e.currentTarget.value
            void session.edit((c) => ({ ...c, performedAt: value }))
          }}
        />
      </Field>
      {props.routine.steps.map((step) => (
        <ProductSessionStep
          key={step.id}
          routine={props.routine}
          step={step}
          content={d.content}
          environment={props.environment}
          disabled={!session.editable}
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
          disabled={!session.editable}
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
          disabled={!session.editable}
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
          disabled={!session.editable}
          onClick={() => void session.save('void')}
        >
          Anular registro con motivo
        </button>
        <button
          className="button"
          disabled={!session.editable}
          onClick={() => void session.save(false)}
        >
          Guardar parcial
        </button>
        <button
          className="button primary"
          disabled={!session.editable}
          onClick={() => void session.save(true)}
        >
          Completar sesión explícitamente
        </button>
        <button
          className="button"
          disabled={
            !session.editable ||
            session.busy ||
            !session.online ||
            !props.integrationAccepted ||
            Boolean(session.storageError)
          }
          onClick={() => void session.synchronize()}
        >
          Reintentar sincronización
        </button>
      </div>
    </div>
  )
}
