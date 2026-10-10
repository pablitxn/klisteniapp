import type { FormEvent } from 'react'
import type { Member, ProgramVersion } from '@klisteniapp/b2b-contracts'
import { Field } from '@klisteniapp/b2b-ui'

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
        <button type="button" className="text-button" onClick={() => onClose()}>
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
              <p>
                {step.sets} × {step.reps} repeticiones
                {step.loadKg !== null ? ` · ${step.loadKg} kg` : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
      <Field label="Socio destinatario">
        <select name="memberId" required>
          <option value="">Elegí una persona</option>
          {members
            .filter((member) => member.role === 'member' && member.active)
            .map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name} · {member.email}
              </option>
            ))}
        </select>
      </Field>
      <p className="small muted">
        El socio recibe una copia de esta versión. Los cambios futuros se publican y asignan por
        separado.
      </p>
      <button className="button primary" disabled={!active || busy}>
        {busy ? 'Asignando…' : 'Confirmar asignación'}
      </button>
    </form>
  )
}
