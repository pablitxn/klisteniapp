import type { Assignment } from '@klisteniapp/b2b-contracts'
import { Field, Notice } from '@klisteniapp/b2b-ui'
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

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">TU SESIÓN · VERSIÓN {assignment.program.version}</p>
          <h1>{assignment.program.name}</h1>
          <p>Registrá lo que hiciste, a tu ritmo. El borrador se conserva en este dispositivo.</p>
        </div>
        <button className="button" onClick={onClose} disabled={busy}>
          Volver
        </button>
      </div>
      {recovered && (
        <Notice>Recuperamos el borrador de tu sesión. Podés continuar donde la dejaste.</Notice>
      )}
      <Notice error>{storageError || error}</Notice>
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
          locked={Boolean(pending)}
          onChangeSet={changeSet}
        />
      ))}
      <section className="card">
        <Field label="Notas de la sesión">
          <textarea
            value={draft.notes}
            maxLength={2000}
            disabled={Boolean(pending)}
            onChange={(event) => changeNotes(event.target.value)}
            placeholder="Cómo te sentiste, algo para conversar con tu entrenador…"
          />
        </Field>
      </section>
      <div className="session-footer">
        <span>
          <strong>
            {completed} / {draft.sets.length}
          </strong>{' '}
          series realizadas
        </span>
        <div className="row">
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
    </>
  )
}
