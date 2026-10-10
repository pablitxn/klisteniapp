import type { Exercise, ProgramStep } from '@klisteniapp/b2b-contracts'
import { Field } from '@klisteniapp/b2b-ui'

type ProgramStepEditorProps = {
  step: ProgramStep
  index: number
  stepCount: number
  exerciseName: string
  published: Exercise[]
  onMove: (delta: number) => void
  onRemove: () => void
  onChange: (patch: Partial<ProgramStep>) => void
}

export function ProgramStepEditor({
  step,
  index,
  stepCount,
  exerciseName,
  published,
  onMove,
  onRemove,
  onChange,
}: ProgramStepEditorProps) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <p className="eyebrow">MOVIMIENTO {index + 1}</p>
          <h2>{exerciseName}</h2>
        </div>
        <div className="row">
          <button
            type="button"
            className="button small"
            aria-label={`Subir movimiento ${index + 1}`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="button small"
            aria-label={`Bajar movimiento ${index + 1}`}
            disabled={index === stepCount - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
          <button type="button" className="text-button" onClick={() => onRemove()}>
            Quitar
          </button>
        </div>
      </div>
      <div className="form-grid">
        <Field label={`Series · movimiento ${index + 1}`}>
          <input
            type="number"
            min={1}
            max={30}
            required
            value={step.sets}
            onChange={(event) => onChange({ sets: Number(event.target.value) })}
          />
        </Field>
        <Field label={`Repeticiones · movimiento ${index + 1}`}>
          <input
            type="number"
            min={1}
            max={1000}
            required
            value={step.reps}
            onChange={(event) => onChange({ reps: Number(event.target.value) })}
          />
        </Field>
        <Field
          label={`Carga kg · movimiento ${index + 1}`}
          hint="Vacío para carga libre o peso corporal."
        >
          <input
            type="number"
            min={0}
            max={1000}
            step="0.5"
            value={step.loadKg ?? ''}
            onChange={(event) =>
              onChange({ loadKg: event.target.value === '' ? null : Number(event.target.value) })
            }
          />
        </Field>
        <Field label={`Descanso segundos · movimiento ${index + 1}`}>
          <input
            type="number"
            min={0}
            max={3600}
            required
            value={step.restSeconds}
            onChange={(event) => onChange({ restSeconds: Number(event.target.value) })}
          />
        </Field>
      </div>
      <Field label={`Indicaciones · movimiento ${index + 1}`}>
        <input
          value={step.notes}
          maxLength={1000}
          onChange={(event) => onChange({ notes: event.target.value })}
          placeholder="Ej.: mantené dos repeticiones en reserva"
        />
      </Field>
      <details style={{ marginTop: 18 }}>
        <summary>Alternativas autorizadas ({step.alternatives.length})</summary>
        <p className="small muted">
          El socio podrá elegir solamente estas alternativas y deberá registrar el motivo del
          cambio.
        </p>
        <div className="grid two">
          {published
            .filter((exercise) => exercise.id !== step.exerciseId)
            .map((exercise) => (
              <label className="check" key={exercise.id}>
                <input
                  type="checkbox"
                  checked={step.alternatives.includes(exercise.id)}
                  disabled={
                    step.alternatives.length >= 10 && !step.alternatives.includes(exercise.id)
                  }
                  onChange={(event) =>
                    onChange({
                      alternatives: event.target.checked
                        ? [...step.alternatives, exercise.id]
                        : step.alternatives.filter((id) => id !== exercise.id),
                    })
                  }
                />
                {exercise.name}
              </label>
            ))}
        </div>
      </details>
    </section>
  )
}
