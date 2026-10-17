import { Field } from '@klisteniapp/b2b-ui'
import { TimeZoneInput } from './EditorFeedback'
import {
  localToday,
  referenceKey,
  stagePosition,
  type GoalContent,
  type RoutineReference,
} from './programmingModel'

export type RoutineChoice = { reference: RoutineReference; name: string }
const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export function StageScheduleEditor({
  content,
  choices,
  onChange,
}: {
  content: GoalContent
  choices: RoutineChoice[]
  onChange: (value: GoalContent) => void
}) {
  const today = content.timeZone ? localToday(content.timeZone) : null
  function stageChange(id: string, patch: Partial<GoalContent['stages'][number]>) {
    onChange({
      ...content,
      stages: content.stages.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })
  }
  return (
    <>
      <Field label="Nombre del programa">
        <input
          maxLength={150}
          value={content.name}
          onChange={(e) => onChange({ ...content, name: e.target.value })}
        />
      </Field>
      <Field label="Objetivo del programa">
        <textarea
          maxLength={2000}
          value={content.goal}
          onChange={(e) => onChange({ ...content, goal: e.target.value })}
        />
      </Field>
      <TimeZoneInput
        key={content.timeZone ?? 'unconfirmed'}
        value={content.timeZone}
        onChange={(timeZone) => onChange({ ...content, timeZone })}
      />
      <p>
        Etapas en orden, con fechas inclusivas y sin superponerse. Los intervalos sin etapa quedan
        sin prescripción. Cada espacio semanal representa una sesión, incluso si hay dos el mismo
        día.
      </p>
      {today && (
        <p role="status">
          Vista del {today} en {content.timeZone}
        </p>
      )}
      {content.stages.map((stage, index) => (
        <section key={stage.id} className="card form-stack" aria-label={`Etapa ${index + 1}`}>
          <h3>
            Etapa {index + 1} ·{' '}
            {today ? stagePosition(stage, today) : 'Confirmá la zona para ver el período'}
          </h3>
          <div className="row">
            {[-1, 1].map((delta) => (
              <button
                type="button"
                key={delta}
                className="button"
                aria-label={`${delta < 0 ? 'Subir' : 'Bajar'} etapa ${index + 1}`}
                disabled={!content.stages[index + delta]}
                onClick={() => {
                  const stages = [...content.stages]
                  ;[stages[index], stages[index + delta]] = [stages[index + delta], stages[index]]
                  onChange({ ...content, stages })
                }}
              >
                {delta < 0 ? '↑' : '↓'}
              </button>
            ))}
            <button
              type="button"
              className="button"
              onClick={() =>
                onChange({ ...content, stages: content.stages.filter((s) => s.id !== stage.id) })
              }
            >
              Quitar etapa {index + 1}
            </button>
          </div>
          <Field label={`Nombre · etapa ${index + 1}`}>
            <input
              maxLength={150}
              value={stage.name}
              onChange={(e) => stageChange(stage.id, { name: e.target.value })}
            />
          </Field>
          <div className="programming-grid">
            <Field label={`Inicio · etapa ${index + 1}`}>
              <input
                type="date"
                value={stage.startDate ?? ''}
                onChange={(e) => stageChange(stage.id, { startDate: e.target.value || null })}
              />
            </Field>
            <Field label={`Fin inclusive · etapa ${index + 1}`}>
              <input
                type="date"
                value={stage.endDate ?? ''}
                onChange={(e) => stageChange(stage.id, { endDate: e.target.value || null })}
              />
            </Field>
          </div>
          {stage.slots.map((slot, slotIndex) => (
            <div key={slot.id} className="programming-grid">
              <Field label={`Día · etapa ${index + 1}, sesión ${slotIndex + 1}`}>
                <select
                  value={slot.weekday ?? ''}
                  onChange={(e) =>
                    stageChange(stage.id, {
                      slots: stage.slots.map((s) =>
                        s.id === slot.id
                          ? { ...s, weekday: e.target.value ? Number(e.target.value) : null }
                          : s,
                      ),
                    })
                  }
                >
                  <option value="">Sin elegir</option>
                  {weekdays.map((day, i) => (
                    <option key={day} value={i + 1}>
                      {day}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Rutina publicada · etapa ${index + 1}, sesión ${slotIndex + 1}`}>
                <select
                  value={slot.routine ? referenceKey(slot.routine) : ''}
                  onChange={(e) => {
                    const choice = choices.find((c) => referenceKey(c.reference) === e.target.value)
                    stageChange(stage.id, {
                      slots: stage.slots.map((s) =>
                        s.id === slot.id
                          ? { ...s, routine: choice ? { ...choice.reference } : null }
                          : s,
                      ),
                    })
                  }}
                >
                  <option value="">Sin elegir</option>
                  {slot.routine &&
                    !choices.some(
                      (c) => referenceKey(c.reference) === referenceKey(slot.routine!),
                    ) && (
                      <option value={referenceKey(slot.routine)}>
                        Versión conservada: {slot.routine.programId} v{slot.routine.version}
                      </option>
                    )}
                  {choices.map((choice) => (
                    <option
                      key={referenceKey(choice.reference)}
                      value={referenceKey(choice.reference)}
                    >
                      {choice.name} · v{choice.reference.version}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="button"
                className="button"
                onClick={() =>
                  stageChange(stage.id, { slots: stage.slots.filter((s) => s.id !== slot.id) })
                }
              >
                Quitar sesión {slotIndex + 1} de etapa {index + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button"
            disabled={stage.slots.length >= 100}
            onClick={() =>
              stageChange(stage.id, {
                slots: [...stage.slots, { id: crypto.randomUUID(), weekday: null, routine: null }],
              })
            }
          >
            Agregar sesión semanal a etapa {index + 1}
          </button>
        </section>
      ))}
      <button
        type="button"
        className="button"
        disabled={content.stages.length >= 100}
        onClick={() =>
          onChange({
            ...content,
            stages: [
              ...content.stages,
              { id: crypto.randomUUID(), name: '', startDate: null, endDate: null, slots: [] },
            ],
          })
        }
      >
        Agregar etapa
      </button>
    </>
  )
}
