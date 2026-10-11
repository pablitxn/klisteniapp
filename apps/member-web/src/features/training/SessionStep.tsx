import type { Assignment, ProgramStep } from '@klisteniapp/b2b-contracts'
import { Field, Notice, prescriptionStepLabel } from '@klisteniapp/b2b-ui'
import { ExerciseDetails } from '../../components/ExerciseDetails'
import { exerciseAvailability, substituteExercise } from './sessionDraft'
import type { DraftSet } from './sessionDraft'
import { RestTimer } from './RestTimer'

const rpeValues = Array.from({ length: 19 }, (_, index) => 1 + index / 2)

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
  const selectedAlternatives = [
    ...new Set(
      sets
        .filter((set) => set.stepId === step.id && set.exerciseId !== step.exerciseId)
        .map((set) => set.exerciseId),
    ),
  ]

  return (
    <section className="card session-step" aria-labelledby={`movement-${step.id}`}>
      <div className="card-head">
        <div>
          <p className="eyebrow">MOVIMIENTO {stepIndex + 1}</p>
          <h2 id={`movement-${step.id}`}>{exercise?.name ?? step.exerciseId}</h2>
          <p className="muted">{prescriptionStepLabel(step)}</p>
          {step.notes && <p>{step.notes}</p>}
        </div>
        <span className="pill">
          {completed} / {step.sets}
        </span>
      </div>
      {exercise && <ExerciseDetails exercise={exercise} />}
      {selectedAlternatives.map((id) => {
        const alternative = exercises.find((item) => item.id === id)
        return alternative ? <ExerciseDetails key={id} exercise={alternative} /> : null
      })}
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
          <fieldset
            className="subtle session-set"
            key={`${set.stepId}:${set.set}`}
            disabled={locked}
          >
            <legend>Serie {set.set}</legend>
            <div className="set-row">
              {step.durationSeconds != null ? (
                <Field label={`Duración segundos · ${stepIndex + 1}/${set.set}`}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={86400}
                    value={set.durationSeconds ?? ''}
                    disabled={locked}
                    onChange={(event) =>
                      onChangeSet(index, { durationSeconds: Number(event.target.value) })
                    }
                  />
                </Field>
              ) : (
                <Field label={`Repeticiones · ${stepIndex + 1}/${set.set}`}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={1000}
                    value={set.reps ?? ''}
                    disabled={locked}
                    onChange={(event) => onChangeSet(index, { reps: Number(event.target.value) })}
                  />
                </Field>
              )}
              <Field label={`Carga kg · ${stepIndex + 1}/${set.set}`}>
                <input
                  type="number"
                  inputMode="decimal"
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
              <label className="check set-completed">
                <input
                  type="checkbox"
                  checked={set.done}
                  disabled={locked}
                  onChange={(event) => onChangeSet(index, { done: event.target.checked })}
                />
                Hecha
              </label>
            </div>
            <Field
              label={`Esfuerzo percibido · ${stepIndex + 1}/${set.set}`}
              hint="Opcional: de 1 (muy suave) a 10 (máximo)."
            >
              <select
                value={set.rpe ?? ''}
                disabled={locked}
                onChange={(event) =>
                  onChangeSet(index, {
                    rpe: event.target.value ? Number(event.target.value) : null,
                  })
                }
              >
                <option value="">Sin registrar</option>
                {set.rpe != null &&
                  Number.isFinite(set.rpe) &&
                  set.rpe >= 1 &&
                  set.rpe <= 10 &&
                  !rpeValues.includes(set.rpe) && <option value={set.rpe}>{set.rpe} / 10</option>}
                {rpeValues.map((value) => (
                  <option value={value} key={value}>
                    {value} / 10
                  </option>
                ))}
              </select>
            </Field>
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
          </fieldset>
        ),
      )}
      <RestTimer seconds={step.restSeconds} movement={exercise?.name ?? step.exerciseId} />
    </section>
  )
}
