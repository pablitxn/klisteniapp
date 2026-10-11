import { Suspense, useState } from 'react'
import type { Exercise, Machine } from '@klisteniapp/b2b-contracts'
import { Field } from '@klisteniapp/b2b-ui'
import { AssetEditor } from '../../shared'
import type { ExerciseDraft } from './exerciseDraft'
import { MovementViewer } from '@klisteniapp/b2b-ui/content'

type ExerciseFieldsProps = {
  orgId: string
  draft: ExerciseDraft
  machines: Machine[]
  exercises: Exercise[]
  disabled: boolean
  onChange: (patch: Partial<ExerciseDraft>) => void
}

export function ExerciseFields({
  orgId,
  draft,
  machines,
  exercises,
  disabled,
  onChange,
}: ExerciseFieldsProps) {
  const [showMotion, setShowMotion] = useState(false)
  const animations = exercises.filter((item) => item.scope === 'base' && item.animationId)
  return (
    <>
      <div className="form-grid">
        <Field label="Nombre del ejercicio">
          <input
            name="name"
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value })}
            required
            maxLength={150}
          />
        </Field>
        <Field label="Patrón de movimiento">
          <input
            name="pattern"
            value={draft.pattern}
            onChange={(event) => onChange({ pattern: event.target.value })}
            maxLength={150}
            placeholder="Ej.: empuje horizontal"
          />
        </Field>
        <Field label="Equipamiento">
          <input
            name="equipment"
            value={draft.equipment}
            onChange={(event) => onChange({ equipment: event.target.value })}
            maxLength={150}
            placeholder="Ej.: máquina de poleas"
          />
        </Field>
        <Field label="Músculos" hint="Separados por comas.">
          <input
            name="muscles"
            value={draft.muscles}
            onChange={(event) => onChange({ muscles: event.target.value })}
            maxLength={1000}
          />
        </Field>
        <Field label="Modelo de máquina principal">
          <select
            name="machineId"
            value={draft.machineId}
            onChange={(event) => onChange({ machineId: event.target.value })}
          >
            <option value="">Sin máquina específica</option>
            {machines.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machine.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Animación existente compatible"
          hint="Dejá sin animación si el movimiento no corresponde exactamente al ejemplo."
        >
          <select
            value={draft.animationId}
            onChange={(event) => onChange({ animationId: event.target.value })}
          >
            <option value="">Sin animación · usar instrucciones y multimedia</option>
            {animations.map((item) => (
              <option key={item.id} value={item.animationId ?? ''}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Descripción">
        <textarea
          name="description"
          value={draft.description}
          onChange={(event) => onChange({ description: event.target.value })}
          maxLength={3000}
        />
      </Field>
      <Field label="Instrucciones paso a paso" hint="Un paso por línea.">
        <textarea
          name="instructions"
          value={draft.instructions}
          onChange={(event) => onChange({ instructions: event.target.value })}
          required
          maxLength={12000}
          rows={5}
        />
      </Field>
      <details style={{ margin: '20px 0' }}>
        <summary>Otros modelos de máquina compatibles</summary>
        <div className="grid two" style={{ marginTop: 15 }}>
          {machines.map((machine) => (
            <label className="check" key={machine.id}>
              <input
                type="checkbox"
                checked={draft.machineIds.includes(machine.id)}
                onChange={(event) =>
                  onChange({
                    machineIds: event.target.checked
                      ? [...draft.machineIds, machine.id]
                      : draft.machineIds.filter((id) => id !== machine.id),
                  })
                }
              />
              {machine.name}
            </label>
          ))}
        </div>
      </details>
      <AssetEditor
        orgId={orgId}
        value={draft.assets}
        onChange={(assets) => onChange({ assets })}
        disabled={disabled}
      />
      {draft.animationId && (
        <>
          <button
            type="button"
            className="text-button"
            onClick={() => setShowMotion((value) => !value)}
          >
            Previsualizar animación
          </button>
          {showMotion && (
            <Suspense fallback={<p role="status">Preparando visor…</p>}>
              <MovementViewer exerciseId={draft.animationId} height={280} />
            </Suspense>
          )}
        </>
      )}
    </>
  )
}
