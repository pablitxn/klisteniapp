import type { Assignment, ProgramStep } from '@klisteniapp/b2b-contracts'
import { Field, Notice } from '@klisteniapp/b2b-ui'
import { ExerciseDetails } from '../../components/ExerciseDetails'
import { exerciseAvailability, substituteExercise } from './sessionDraft'
import type { DraftSet } from './sessionDraft'

type SessionStepProps = {
  assignment: Assignment
  step: ProgramStep
  stepIndex: number
  sets: DraftSet[]
  locked: boolean
  onChangeSet: (index: number, patch: Partial<DraftSet>) => void
}

export function SessionStep({
  assignment,
  step,
  stepIndex,
  sets,
  locked,
  onChangeSet,
}: SessionStepProps) {
  const exercises = assignment.program.exercises
  const exercise = exercises.find((item) => item.id === step.exerciseId)
  const plannedAvailability = exerciseAvailability(assignment, step.id, step.exerciseId)
  const completed = sets.filter((set) => set.stepId === step.id && set.done).length

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <p className="eyebrow">MOVIMIENTO {stepIndex + 1}</p>
          <h2>{exercise?.name ?? step.exerciseId}</h2>
          <p className="muted">
            {step.sets} series × {step.reps} repeticiones
            {step.loadKg !== null ? ` · ${step.loadKg} kg` : ''} · {step.restSeconds} s de descanso
          </p>
          {step.notes && <p>{step.notes}</p>}
        </div>
        <span className="pill">
          {completed} / {step.sets}
        </span>
      </div>
      {exercise && <ExerciseDetails exercise={exercise} />}
      {plannedAvailability?.status === 'unavailable' && (
        <Notice>
          El equipo planificado no está disponible actualmente. Usá únicamente una alternativa
          autorizada por tu entrenador.
        </Notice>
      )}
      {plannedAvailability?.status === 'equipment-required' && (
        <p className="small muted">
          Equipamiento necesario: {plannedAvailability.equipment}. Confirmá que contás con ese
          recurso antes de empezar.
        </p>
      )}
      {sets.map((set, index) =>
        set.stepId !== step.id ? null : (
          <div
            className="subtle"
            style={{ padding: 12, borderRadius: 10, marginTop: 12 }}
            key={`${set.stepId}:${set.set}`}
          >
            <div className="set-row">
              <span>Serie {set.set}</span>
              <Field label={`Repeticiones · ${stepIndex + 1}/${set.set}`}>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={set.reps}
                  disabled={locked}
                  onChange={(event) => onChangeSet(index, { reps: Number(event.target.value) })}
                />
              </Field>
              <Field label={`Carga kg · ${stepIndex + 1}/${set.set}`}>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  step="0.5"
                  value={set.loadKg ?? ''}
                  placeholder="—"
                  disabled={locked}
                  onChange={(event) =>
                    onChangeSet(index, {
                      loadKg: event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                />
              </Field>
              <label className="check" style={{ paddingBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={set.done}
                  disabled={locked}
                  onChange={(event) => onChangeSet(index, { done: event.target.checked })}
                />
                Hecha
              </label>
            </div>
            {step.alternatives.length > 0 && (
              <div className="form-grid">
                <Field
                  label={`Ejercicio realizado · ${stepIndex + 1}/${set.set}`}
                  hint="Registrá la carga que usaste; no se traslada de un ejercicio a otro."
                >
                  <select
                    value={set.exerciseId}
                    disabled={locked}
                    onChange={(event) => onChangeSet(index, substituteExercise(event.target.value))}
                  >
                    {[step.exerciseId, ...step.alternatives].map((id) => (
                      <option
                        key={id}
                        value={id}
                        disabled={
                          exerciseAvailability(assignment, step.id, id)?.status === 'unavailable'
                        }
                      >
                        {exercises.find((item) => item.id === id)?.name ?? id}
                      </option>
                    ))}
                  </select>
                </Field>
                {set.exerciseId !== step.exerciseId && (
                  <Field label={`Motivo de sustitución · ${stepIndex + 1}/${set.set}`}>
                    <input
                      value={set.reason}
                      maxLength={1000}
                      required
                      disabled={locked}
                      placeholder="Ej.: equipo ocupado"
                      onChange={(event) => onChangeSet(index, { reason: event.target.value })}
                    />
                  </Field>
                )}
              </div>
            )}
          </div>
        ),
      )}
    </section>
  )
}
