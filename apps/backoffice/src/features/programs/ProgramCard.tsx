import type { Exercise, Program } from '@klisteniapp/b2b-contracts'
import { prescriptionStepLabel } from '@klisteniapp/b2b-ui'

type ProgramCardProps = {
  program: Program
  exercises: Exercise[]
  active: boolean
  busy: boolean
  onEdit: () => void
  onPublish: () => void
  onAssign: () => void
}

export function ProgramCard({
  program,
  exercises,
  active,
  busy,
  onEdit,
  onPublish,
  onAssign,
}: ProgramCardProps) {
  return (
    <article className="card">
      <div className="card-head">
        <span className={`pill ${program.publishedVersion ? '' : 'warning'}`}>
          {program.publishedVersion
            ? `ÚLTIMA PUBLICACIÓN · V${program.publishedVersion}`
            : 'BORRADOR'}
        </span>
        <span className="small muted">{program.steps.length} movimientos</span>
      </div>
      <h2>{program.name}</h2>
      <p className="eyebrow">BORRADOR ACTUAL</p>
      <p className="muted">{program.description}</p>
      <div className="list">
        {program.steps.slice(0, 4).map((step) => (
          <div className="list-row" key={step.id}>
            <div>
              <strong>
                {exercises.find((exercise) => exercise.id === step.exerciseId)?.name ??
                  step.exerciseId}
              </strong>
              <p>{prescriptionStepLabel(step)}</p>
            </div>
          </div>
        ))}
      </div>
      {program.steps.length > 4 && (
        <p className="small muted">+ {program.steps.length - 4} movimientos</p>
      )}
      <div className="row" style={{ marginTop: 22 }}>
        <button className="button small" disabled={!active || busy} onClick={() => onEdit()}>
          Editar borrador
        </button>
        <button className="button small" disabled={!active || busy} onClick={() => onPublish()}>
          Publicar versión
        </button>
        {program.publishedVersion && (
          <button
            className="button primary small"
            disabled={!active || busy}
            onClick={() => onAssign()}
          >
            Asignar a socio
          </button>
        )}
      </div>
    </article>
  )
}
