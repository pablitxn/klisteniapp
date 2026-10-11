import type { Member, ProgramVersion } from '@klisteniapp/b2b-contracts'
import { Empty, Field, prescriptionStepLabel } from '@klisteniapp/b2b-ui'
import type { FormEvent } from 'react'

type ProgramAssignmentFormProps = {
  version: ProgramVersion
  members: Member[]
  active: boolean
  busy: boolean
  onAssign: (memberId: string) => void
  onClose: () => void
}

export function ProgramAssignmentForm({
  version,
  members,
  active,
  busy,
  onAssign,
  onClose,
}: ProgramAssignmentFormProps) {
  const recipients = members.filter((member) => member.role === 'member' && member.active)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const memberId = new FormData(event.currentTarget).get('memberId')
    if (typeof memberId === 'string' && memberId) onAssign(memberId)
  }
  return (
    <form className="card form-stack" style={{ marginBottom: 22 }} onSubmit={submit}>
      <div className="card-head">
        <div>
          <p className="eyebrow">VERSIÓN PUBLICADA {version.version}</p>
          <h2>Asignar {version.name}</h2>
        </div>
        <button type="button" className="text-button" disabled={busy} onClick={() => onClose()}>
          Cerrar
        </button>
      </div>
      <div className="list">
        {version.steps.map((step) => (
          <div className="list-row" key={step.id}>
            <div>
              <strong>
                {version.exercises.find((exercise) => exercise.id === step.exerciseId)?.name ??
                  step.exerciseId}
              </strong>
              <p>{prescriptionStepLabel(step)}</p>
              {step.notes && <p className="small">{step.notes}</p>}
              {step.alternatives.length > 0 && (
                <p className="small muted">
                  Alternativas:{' '}
                  {step.alternatives
                    .map(
                      (id) => version.exercises.find((exercise) => exercise.id === id)?.name ?? id,
                    )
                    .join(', ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <Field label="Socio destinatario">
        <select name="memberId" required disabled={!active || busy || !recipients.length}>
          <option value="">Elegí una persona</option>
          {recipients.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name} · {member.email}
            </option>
          ))}
        </select>
      </Field>
      {!recipients.length && (
        <Empty title="Todavía no hay socios disponibles">
          Pedí a la administración que habilite un socio y lo asigne a tu acompañamiento desde
          Personas.
        </Empty>
      )}
      <p className="small muted">
        El socio recibe una copia de esta versión. Los cambios futuros se publican y asignan por
        separado.
      </p>
      <button className="button primary" disabled={!active || busy || !recipients.length}>
        {busy ? 'Asignando…' : 'Confirmar asignación'}
      </button>
    </form>
  )
}
