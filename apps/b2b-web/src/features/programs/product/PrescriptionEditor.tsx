import { Field } from '@klisteniapp/b2b-ui'
import type { Exercise } from '@klisteniapp/b2b-contracts'
import { NumericTargetEditor } from './NumericTargetEditor'
import { setDoseMode, type Step } from './programmingModel'

export function PrescriptionEditor({
  step,
  index,
  exercises,
  onChange,
  onRemove,
  onMove,
  count,
}: {
  step: Step
  index: number
  exercises: Exercise[]
  count: number
  onChange: (value: Step) => void
  onRemove: () => void
  onMove: (delta: number) => void
}) {
  const dose = step.dose
  const patch = (change: Partial<Step['dose']>) =>
    onChange({ ...step, dose: { ...dose, ...change } })
  const suffix = ` · movimiento ${index + 1}`
  return (
    <section
      className="card form-stack"
      aria-label={`Movimiento ${index + 1}`}
      id={`step-${step.id}`}
    >
      <h2>Movimiento {index + 1}</h2>
      <div className="row">
        <button
          type="button"
          className="button"
          aria-label={`Subir movimiento ${index + 1}`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="button"
          aria-label={`Bajar movimiento ${index + 1}`}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          ↓
        </button>
        <button type="button" className="button" onClick={onRemove}>
          Quitar movimiento {index + 1}
        </button>
      </div>
      <Field label={`Ejercicio${suffix}`}>
        <select
          value={step.exerciseId ?? ''}
          onChange={(e) => onChange({ ...step, exerciseId: e.target.value || null })}
        >
          <option value="">Sin elegir</option>
          {exercises
            .filter((e) => e.status === 'published')
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label={`Medición${suffix}`}>
        <select
          value={dose.mode ?? ''}
          onChange={(e) =>
            onChange({
              ...step,
              dose: setDoseMode(dose, (e.target.value || null) as Step['dose']['mode']),
            })
          }
        >
          <option value="">Sin definir</option>
          <option value="repetitions">Repeticiones</option>
          <option value="duration">Duración</option>
        </select>
      </Field>
      <div className="programming-grid">
        <NumericTargetEditor
          label={`Series${suffix}`}
          value={dose.sets}
          min={1}
          max={30}
          integer
          onChange={(sets) => patch({ sets })}
        />
        {dose.mode === 'repetitions' && (
          <NumericTargetEditor
            label={`Repeticiones${suffix}`}
            value={dose.repetitions}
            min={1}
            max={1000}
            integer
            onChange={(repetitions) => patch({ repetitions })}
          />
        )}
        {dose.mode === 'duration' && (
          <NumericTargetEditor
            label={`Duración (segundos)${suffix}`}
            value={dose.durationSeconds}
            min={1}
            max={86400}
            onChange={(durationSeconds) => patch({ durationSeconds })}
          />
        )}
        <NumericTargetEditor
          label={`Descanso (segundos)${suffix}`}
          value={dose.restSeconds}
          min={0}
          max={3600}
          onChange={(restSeconds) => patch({ restSeconds })}
        />
      </div>
      <Field label={`Carga${suffix}`}>
        <select
          value={dose.load?.mode ?? ''}
          onChange={(e) =>
            patch({
              load:
                e.target.value === 'external'
                  ? { mode: 'external', kilograms: { kind: 'fixed', value: 0 } }
                  : e.target.value === 'bodyweight'
                    ? { mode: 'bodyweight' }
                    : null,
            })
          }
        >
          <option value="">Sin confirmar</option>
          <option value="bodyweight">Peso corporal</option>
          <option value="external">Carga externa (kg)</option>
        </select>
      </Field>
      {dose.load?.mode === 'external' && (
        <NumericTargetEditor
          label={`Carga externa (kg)${suffix}`}
          value={dose.load.kilograms}
          min={0}
          max={1000}
          onChange={(kilograms) =>
            patch({ load: kilograms ? { mode: 'external', kilograms } : { mode: 'unspecified' } })
          }
        />
      )}
      <Field label={`Lados y conteo${suffix}`}>
        <select
          value={dose.laterality ?? ''}
          onChange={(e) =>
            patch({ laterality: (e.target.value || null) as Step['dose']['laterality'] })
          }
        >
          <option value="">Sin confirmar</option>
          <option value="bilateral">Ambos lados juntos</option>
          <option value="alternating">Por lado, alternando</option>
          <option value="per-side">Por cada lado</option>
        </select>
      </Field>
      <Field label={`Esfuerzo RPE (opcional, 1–10)${suffix}`}>
        <input
          type="number"
          min={1}
          max={10}
          step="any"
          value={dose.targetRpe ?? ''}
          onChange={(e) => patch({ targetRpe: e.target.value ? Number(e.target.value) : null })}
        />
      </Field>
      <Field label={`Indicaciones${suffix}`}>
        <textarea
          maxLength={1000}
          value={dose.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </Field>
      <label className="check">
        <input
          type="checkbox"
          checked={step.substitutionPolicy === 'blocked'}
          onChange={(e) =>
            onChange({ ...step, substitutionPolicy: e.target.checked ? 'blocked' : 'reviewed' })
          }
        />
        Bloquear alternativas en este movimiento
      </label>
      <p role="status">
        {step.substitutionPolicy === 'blocked'
          ? 'Las alternativas están bloqueadas para este ejercicio en esta rutina.'
          : 'Se ofrecerán las relaciones revisadas disponibles, con los requisitos y la dosis propios del ejercicio elegido.'}
      </p>
    </section>
  )
}
