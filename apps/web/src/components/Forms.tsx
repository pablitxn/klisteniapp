import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  CardioLogSchema,
  type CardioActivity,
  type CompletedExercise,
} from '@klisteniapp/scene-schema'
import { exercises, getExercise } from '../data/exercises'
import { localDateKey, serializeProgress } from '../lib/progress'
import { useAppStore } from '../lib/store'
import Icon, { type IconName } from './Icon'

const activities: { id: CardioActivity; name: string; icon: IconName }[] = [
  { id: 'walk', name: 'Caminata', icon: 'walk' },
  { id: 'run', name: 'Trote', icon: 'run' },
  { id: 'bike', name: 'Bici', icon: 'bike' },
  { id: 'other', name: 'Otra', icon: 'spark' },
]
export function CardioForm({ onDone }: { onDone: () => void }) {
  const [activity, setActivity] = useState<CardioActivity>('walk'),
    [error, setError] = useState('')
  const add = useAppStore((s) => s.addCardio)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = CardioLogSchema.safeParse({
      id: crypto.randomUUID(),
      date: form.get('date'),
      activity,
      minutes: Number(form.get('minutes')),
      ...(form.get('distance')
        ? { distanceKm: Number(form.get('distance')) }
        : {}),
    })
    if (!parsed.success || parsed.data.date > localDateKey(new Date())) {
      setError(
        'Revisá la fecha, los minutos y la distancia. Registrá una actividad que ya hiciste.',
      )
      return
    }
    add(parsed.data)
    onDone()
  }
  return (
    <form onSubmit={submit} className="form-stack">
      <p className="form-intro">
        Registrá lo que hiciste, desde una caminata corta hasta una salida en
        bici.
      </p>
      <div className="activity-options" aria-label="Tipo de actividad">
        {activities.map((a) => (
          <button
            type="button"
            aria-pressed={activity === a.id}
            className={activity === a.id ? 'selected' : ''}
            key={a.id}
            onClick={() => setActivity(a.id)}
          >
            <Icon name={a.icon} size={24} />
            {a.name}
          </button>
        ))}
      </div>
      <label>
        ¿Cuándo?
        <input
          type="date"
          name="date"
          required
          defaultValue={localDateKey(new Date())}
          max={localDateKey(new Date())}
        />
      </label>
      <div className="form-grid">
        <label>
          Duración (minutos)
          <input
            type="number"
            name="minutes"
            placeholder="20"
            min="1"
            max="1440"
            step="1"
            required
          />
        </label>
        <label>
          Distancia (km) <small>Opcional</small>
          <input
            type="number"
            name="distance"
            placeholder="2,5"
            min="0.01"
            max="2000"
            step="0.01"
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="primary-button full-width" type="submit">
        <Icon name="check" size={18} /> Guardar actividad
      </button>
      <p className="fine-print">
        Sin estimaciones de calorías. Registramos tus minutos y tu constancia.
      </p>
    </form>
  )
}
export function PreferencesForm() {
  const preferences = useAppStore((s) => s.preferences),
    update = useAppStore((s) => s.updatePreferences),
    progress = useAppStore((s) => s.progress),
    importProgress = useAppStore((s) => s.importProgress)
  const recoveryRaw = useAppStore((s) => s.recoveryRaw)
  const [message, setMessage] = useState(''),
    [importText, setImportText] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  function download() {
    const blob = new Blob([serializeProgress(progress)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `klisteni-progreso-${localDateKey(new Date())}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="form-stack">
      <p className="form-intro">Una base sencilla que podés ir ajustando.</p>
      <label>
        Objetivo semanal de fuerza
        <select
          value={preferences.weeklyGoal}
          onChange={(e) => update({ weeklyGoal: Number(e.target.value) })}
        >
          <option value={2}>2 sesiones · para empezar</option>
          <option value={3}>3 sesiones</option>
          <option value={4}>4 sesiones</option>
        </select>
      </label>
      <p className="fine-print">
        El objetivo es una preferencia de seguimiento. Alterná trabajo y
        descanso; no hace falta entrenar todos los días.
      </p>
      <label className="toggle-label">
        <span>
          <strong>Reducir movimiento</strong>
          <small>Las demostraciones empiezan en pausa.</small>
        </span>
        <input
          type="checkbox"
          checked={preferences.reducedMotion}
          onChange={(e) => update({ reducedMotion: e.target.checked })}
        />
      </label>
      <div className="settings-data">
        <h3>Tus datos son tuyos.</h3>
        <p>
          El historial se guarda solo en este navegador. No hay cuenta ni
          sincronización. Exportalo para conservarlo si cambiás de dispositivo.
        </p>
        <button className="secondary-button" onClick={download}>
          <Icon name="download" size={18} /> Exportar progreso
        </button>
        <button className="text-button" onClick={() => file.current?.click()}>
          Importar una copia
        </button>
        {recoveryRaw && (
          <div className="recovery-panel">
            <p>
              Conservamos una copia de los datos que no se pudieron leer, para
              que no se pierdan al seguir usando la app.
            </p>
            <button
              className="text-button"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([recoveryRaw], { type: 'text/plain' }),
                )
                const a = document.createElement('a')
                a.href = url
                a.download = 'klisteni-recuperacion.txt'
                a.click()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
              }}
            >
              Descargar original para recuperar
            </button>
          </div>
        )}
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            if (f.size > 5_000_000) {
              setMessage('El archivo es demasiado grande. Máximo: 5 MB.')
              return
            }
            setImportText(await f.text())
            e.target.value = ''
          }}
        />
        {importText && (
          <div className="import-confirm">
            <p>
              Esta copia reemplazará el historial de este navegador. Exportá el
              actual si querés conservarlo.
            </p>
            <button
              className="secondary-button"
              onClick={() => {
                const error = importProgress(importText)
                setMessage(
                  error ?? 'Copia importada. Tu progreso ya está disponible.',
                )
                setImportText(null)
              }}
            >
              Reemplazar historial
            </button>
            <button className="text-button" onClick={() => setImportText(null)}>
              Cancelar
            </button>
          </div>
        )}
        {message && <p role="status">{message}</p>}
      </div>
      <div className="fine-print">
        Klisteni · Primera versión educativa · Español
        <br />
        Anatomía simplificada. No mide esfuerzo ni activación muscular.
      </div>
    </div>
  )
}
export function RoutineEditor({ onDone }: { onDone: () => void }) {
  const prefs = useAppStore((s) => s.preferences),
    update = useAppStore((s) => s.updatePreferences)
  const [ids, setIds] = useState(prefs.exerciseIds),
    [sets, setSets] = useState(prefs.sets)
  function move(index: number, offset: number) {
    const next = [...ids]
    ;[next[index], next[index + offset]] = [next[index + offset]!, next[index]!]
    setIds(next)
  }
  return (
    <div className="form-stack">
      <p className="form-intro">
        Elegí tus movimientos y el orden. Para una base variada, conservá los
        seis patrones.
      </p>
      <label>
        Series por ejercicio
        <select value={sets} onChange={(e) => setSets(Number(e.target.value))}>
          <option value={1}>1 serie · familiarizarme</option>
          <option value={2}>2 series · punto de partida</option>
          <option value={3}>3 series</option>
        </select>
      </label>
      <div className="routine-edit-list">
        {ids.map((id, index) => (
          <div key={id}>
            <span>
              <small>{index + 1}.</small> {getExercise(id)?.shortName}
            </span>
            <button
              className="icon-button"
              disabled={index === 0}
              aria-label={`Subir ${getExercise(id)?.shortName}`}
              onClick={() => move(index, -1)}
            >
              <Icon name="up" size={16} />
            </button>
            <button
              className="icon-button"
              disabled={index === ids.length - 1}
              aria-label={`Bajar ${getExercise(id)?.shortName}`}
              onClick={() => move(index, 1)}
            >
              <Icon name="down" size={16} />
            </button>
            <button
              className="icon-button"
              aria-label={`Quitar ${getExercise(id)?.shortName}`}
              disabled={ids.length === 1}
              onClick={() => setIds(ids.filter((x) => x !== id))}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
      {exercises
        .filter((e) => e.equipment === 'none' && !ids.includes(e.id))
        .map((e) => (
          <button
            className="text-button"
            key={e.id}
            onClick={() => setIds([...ids, e.id])}
          >
            <Icon name="plus" size={16} /> Agregar {e.shortName}
          </button>
        ))}
      <button
        className="primary-button full-width"
        onClick={() => {
          update({ exerciseIds: ids, sets })
          onDone()
        }}
      >
        Guardar mi rutina <Icon name="check" size={17} />
      </button>
    </div>
  )
}
export function WorkoutSession({
  plan,
  onSelect,
  onClose,
  onComplete,
}: {
  plan: { ids: string[]; sets: number }
  onSelect: (id: string) => void
  onClose: () => void
  onComplete: () => void
}) {
  const [index, setIndex] = useState(0),
    [completedSets, setCompletedSets] = useState(0),
    [entries, setEntries] = useState<CompletedExercise[]>([])
  const exercise = getExercise(plan.ids[index]!)!
  const [reps, setReps] = useState(exercise.reps.min),
    [restUntil, setRestUntil] = useState<number | null>(null),
    [now, setNow] = useState(Date.now()),
    [confirmExit, setConfirmExit] = useState(false)
  const started = useRef(Date.now()),
    submitted = useRef(false),
    add = useAppStore((s) => s.addWorkout)
  const rest = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0
  const complete = entries.length === plan.ids.length * plan.sets
  useEffect(() => {
    if (!restUntil) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [restUntil])
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', prevent)
    return () => window.removeEventListener('beforeunload', prevent)
  }, [])
  function record() {
    if (
      rest > 0 ||
      complete ||
      !Number.isInteger(reps) ||
      reps < 1 ||
      reps > 1000
    )
      return
    setEntries([...entries, { exerciseId: exercise.id, sets: 1, reps }])
    const last = completedSets + 1 === plan.sets
    if (last && index + 1 < plan.ids.length) {
      const next = index + 1
      setIndex(next)
      setCompletedSets(0)
      setReps(getExercise(plan.ids[next]!)!.reps.min)
      onSelect(plan.ids[next]!)
    } else setCompletedSets(completedSets + 1)
    setNow(Date.now())
    setRestUntil(Date.now() + exercise.restSeconds * 1000)
  }
  function finish() {
    if (submitted.current) return
    submitted.current = true
    const end = new Date()
    add({
      id: crypto.randomUUID(),
      date: localDateKey(end),
      completedAt: end.toISOString(),
      durationMinutes: Math.max(
        0.01,
        (end.getTime() - started.current) / 60000,
      ),
      exercises: entries,
    })
    onComplete()
  }
  return (
    <section className="workout-dock" aria-label="Sesión en curso">
      <div className="workout-progress">
        <span
          style={{
            width: `${(entries.length / (plan.ids.length * plan.sets)) * 100}%`,
          }}
        />
      </div>
      <div className="workout-dock-inner">
        {complete ? (
          <>
            <div>
              <span className="eyebrow">PRÁCTICA COMPLETADA</span>
              <h3>Le dedicaste tiempo a tu cuerpo.</h3>
              <p>
                {entries.length} series registradas. Guardá tu sesión para sumar
                al historial.
              </p>
            </div>
            <button className="primary-button" onClick={finish}>
              Guardar sesión <Icon name="check" size={18} />
            </button>
          </>
        ) : (
          <>
            <div className="workout-current">
              <span className="eyebrow">
                SESIÓN EN CURSO · {index + 1}/{plan.ids.length}
              </span>
              <h3>{exercise.shortName}</h3>
              <p>
                Serie {completedSets + 1} de {plan.sets}
                {exercise.reps.perSide ? ' · repeticiones por lado' : ''}
              </p>
              <button
                className="session-show-exercise"
                onClick={() => onSelect(exercise.id)}
              >
                Ver este movimiento ↗
              </button>
            </div>
            {rest > 0 ? (
              <div className="rest-controls">
                <strong>
                  {rest} <small>s de descanso</small>
                </strong>
                <button
                  className="text-button"
                  onClick={() => setRestUntil(null)}
                >
                  Omitir descanso
                </button>
              </div>
            ) : (
              <div className="set-controls">
                <label>
                  Repeticiones
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    value={reps}
                    onChange={(e) => setReps(Number(e.target.value))}
                  />
                </label>
                <button
                  className="primary-button"
                  disabled={!Number.isInteger(reps) || reps < 1 || reps > 1000}
                  onClick={record}
                >
                  Registrar serie <Icon name="check" size={18} />
                </button>
              </div>
            )}
          </>
        )}
        <button
          className="icon-button session-exit"
          aria-label="Salir de la sesión"
          onClick={() => setConfirmExit(!confirmExit)}
        >
          <Icon name="close" />
        </button>
      </div>
      {confirmExit && (
        <div className="exit-confirm">
          <p>¿Salir sin guardar? Las series de esta sesión se descartarán.</p>
          <button className="secondary-button" onClick={onClose}>
            Salir sin guardar
          </button>
          <button className="text-button" onClick={() => setConfirmExit(false)}>
            Seguir entrenando
          </button>
        </div>
      )}
      <p className="session-local-note">
        Sesión en curso en esta pestaña. Guardala al terminar; recargar descarta
        las series.
      </p>
    </section>
  )
}
