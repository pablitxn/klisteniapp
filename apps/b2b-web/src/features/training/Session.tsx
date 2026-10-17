import type { Assignment } from '@klisteniapp/b2b-contracts'
import { Field, Notice } from '@klisteniapp/b2b-ui'
import { useEffect, useRef, useState } from 'react'
import { SessionStep } from './SessionStep'
import { useTrainingSession } from './useTrainingSession'

type SessionProps = {
  assignment: Assignment
  orgId: string
  userId: string
  active: boolean
  onSaved: () => void
  onClose: () => void
}

export function Session({ assignment, orgId, userId, active, onSaved, onClose }: SessionProps) {
  const { draft, recovered, busy, error, storageError, changeSet, changeNotes, save } =
    useTrainingSession(assignment, orgId, userId, onSaved)
  const completed = draft.sets.filter((set) => set.done).length
  const pending = draft.pending
  const heading = useRef<HTMLHeadingElement>(null)
  const errorSummary = useRef<HTMLDivElement>(null)
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    heading.current?.focus()
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    if (error) errorSummary.current?.focus()
  }, [error])

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">TU SESIÓN · VERSIÓN {assignment.program.version}</p>
          <h1 ref={heading} tabIndex={-1} className="session-heading">
            {assignment.program.name}
          </h1>
          <p>Registrá lo que hiciste, a tu ritmo. El borrador se conserva en este dispositivo.</p>
        </div>
        <button className="button" onClick={onClose} disabled={busy}>
          Volver
        </button>
      </div>
      {recovered && (
        <Notice>Recuperamos el borrador de tu sesión. Podés continuar donde la dejaste.</Notice>
      )}
      <p className="small muted session-draft-status" role="status">
        {storageError
          ? 'Borrador sin respaldo local.'
          : pending
            ? 'Envío pendiente de confirmación.'
            : 'Borrador guardado en este dispositivo. Todavía no está en tu historial.'}
      </p>
      {!online && (
        <Notice>
          {storageError
            ? 'Estás sin conexión y el almacenamiento local no está disponible. Mantené esta pantalla abierta hasta confirmar el envío.'
            : 'Estás sin conexión. Conservamos el borrador en este dispositivo; podés continuar y guardar cuando vuelva la conexión.'}
        </Notice>
      )}
      <Notice error>{storageError}</Notice>
      <div ref={errorSummary} tabIndex={-1}>
        <Notice error>{error}</Notice>
      </div>
      {pending && (
        <Notice>
          Hay un envío por confirmar. Conservamos exactamente la sesión enviada para evitar
          duplicados; reintentá la confirmación.
        </Notice>
      )}
      {assignment.program.steps.map((step, stepIndex) => (
        <SessionStep
          key={step.id}
          assignment={assignment}
          step={step}
          stepIndex={stepIndex}
          sets={draft.sets}
          locked={Boolean(pending) || !active}
          onChangeSet={changeSet}
        />
      ))}
      <section className="card session-notes">
        <Field label="Notas de la sesión">
          <textarea
            value={draft.notes}
            maxLength={2000}
            disabled={Boolean(pending) || !active}
            onChange={(event) => changeNotes(event.target.value)}
            placeholder="Cómo te sentiste, algo para conversar con tu entrenador…"
          />
        </Field>
      </section>
      <div className="session-footer" aria-busy={busy}>
        <div>
          <span aria-live="polite" aria-atomic="true">
            <strong>
              {completed} / {draft.sets.length}
            </strong>{' '}
            series realizadas
          </span>
          <progress
            className="session-progress"
            aria-label="Series realizadas"
            max={draft.sets.length}
            value={completed}
          />
        </div>
        <div className="row session-save-actions" aria-describedby="session-save-help">
          {pending ? (
            <button
              className="button primary"
              disabled={busy || !active}
              onClick={() => void save(pending.status)}
            >
              {busy ? 'Confirmando…' : 'Confirmar envío pendiente'}
            </button>
          ) : (
            <>
              <button
                className="button"
                disabled={busy || !active}
                onClick={() => void save('partial')}
              >
                Guardar parcial
              </button>
              <button
                className="button primary"
                disabled={busy || !active}
                onClick={() => void save('completed')}
              >
                {busy ? 'Guardando…' : 'Completar sesión'}
              </button>
            </>
          )}
        </div>
      </div>
      <p className="small muted session-save-help" id="session-save-help">
        Guardar parcial cierra esta sesión con las series marcadas. Para continuar más tarde, volvé
        sin guardar: conservamos tu borrador. Los registros guardados no se editan.
      </p>
    </>
  )
}

export { ProductTrainingSession } from './sync/ProductTrainingSession'
