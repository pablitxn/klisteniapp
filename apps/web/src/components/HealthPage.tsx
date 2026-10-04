import { instanceMode } from '../lib/deployment'
import { cloudWriteAllowed } from '../lib/cloud-access'
import { useState, type FormEvent, type ReactNode } from 'react'
import { createEmptyHealthData, HealthDataSchema, computeHealthGoalProgress, summarizeSleepDays, dateInTimeZone, type HealthData, type MeasurementKey } from '@klisteniapp/scene-schema'
import { useAppStore } from '../lib/store'
import { getExercise } from '../data/exercises'
import { createHealthImportTemplate, previewHealthImport, HEALTH_IMPORT_MAX_BYTES } from '../lib/health-import'
import HealthDashboard from './HealthDashboard'
import './health.css'

type Collection = 'measurements' | 'sleep' | 'activity' | 'nutrition' | 'supplements' | 'goals'
type Tab = 'overview' | 'body' | 'recovery' | 'food' | 'goals' | 'import'
type Values = Record<string, unknown>
type Draft = { collection: Collection | 'profile'; values: Values; base: HealthData; revision: number; id: string }
type Field = { key: string; label: string; unit?: string; min?: number; max?: number; step?: number; required?: boolean; type?: 'text' | 'date' | 'datetime-local'; hint?: string }
const bodyFields: Field[] = [
  { key: 'weightKg', label: 'Peso', unit: 'kg', min: 1, max: 700 },
  { key: 'waistCm', label: 'Cintura', unit: 'cm', min: 1, max: 400 },
  { key: 'bodyFatPercent', label: 'Grasa corporal estimada', unit: '%', min: 0, max: 100 },
  { key: 'skeletalMuscleKg', label: 'Músculo esquelético estimado', unit: 'kg', min: 0, max: 300 },
  { key: 'fatMassKg', label: 'Masa grasa estimada', unit: 'kg', min: 0, max: 500 },
  { key: 'bodyWaterPercent', label: 'Agua corporal estimada', unit: '%', min: 0, max: 100 },
  { key: 'hipsCm', label: 'Cadera', unit: 'cm', min: 1, max: 400 },
  { key: 'chestCm', label: 'Pecho', unit: 'cm', min: 1, max: 400 },
  { key: 'neckCm', label: 'Cuello', unit: 'cm', min: 1, max: 150 },
  { key: 'leftArmCm', label: 'Brazo izquierdo', unit: 'cm', min: 1, max: 200 },
  { key: 'rightArmCm', label: 'Brazo derecho', unit: 'cm', min: 1, max: 200 },
  { key: 'leftThighCm', label: 'Muslo izquierdo', unit: 'cm', min: 1, max: 250 },
  { key: 'rightThighCm', label: 'Muslo derecho', unit: 'cm', min: 1, max: 250 },
  { key: 'leftCalfCm', label: 'Pantorrilla izquierda', unit: 'cm', min: 1, max: 200 },
  { key: 'rightCalfCm', label: 'Pantorrilla derecha', unit: 'cm', min: 1, max: 200 },
]
const fields: Record<Exclude<Collection, 'goals'>, Field[]> = {
  measurements: bodyFields,
  sleep: [
    { key: 'durationMinutes', label: 'Tiempo dormido', unit: 'min', min: 1, max: 1440, required: true },
    { key: 'deepMinutes', label: 'Sueño profundo', unit: 'min', min: 0, max: 1440 },
    { key: 'remMinutes', label: 'Sueño REM', unit: 'min', min: 0, max: 1440 },
    { key: 'awakeMinutes', label: 'Tiempo despierto', unit: 'min', min: 0, max: 1440 },
    { key: 'score', label: 'Puntuación del dispositivo', unit: '/100', min: 0, max: 100 },
    { key: 'startAt', label: 'Inicio (hora de este dispositivo)', type: 'datetime-local' },
    { key: 'endAt', label: 'Fin (hora de este dispositivo)', type: 'datetime-local' },
  ],
  activity: [
    { key: 'steps', label: 'Pasos', min: 0, max: 200000, step: 1 },
    { key: 'activeMinutes', label: 'Minutos activos', unit: 'min', min: 0, max: 1440 },
    { key: 'activeEnergyKcal', label: 'Energía activa estimada', unit: 'kcal', min: 0, max: 20000 },
    { key: 'restingHeartRateBpm', label: 'Frecuencia cardíaca en reposo', unit: 'lpm', min: 20, max: 250 },
    { key: 'averageHeartRateBpm', label: 'Frecuencia cardíaca media', unit: 'lpm', min: 20, max: 300 },
    { key: 'maxHeartRateBpm', label: 'Frecuencia cardíaca máxima', unit: 'lpm', min: 20, max: 300 },
  ],
  nutrition: [
    { key: 'meal', label: 'Comida o detalle', type: 'text', hint: 'Por ejemplo, almuerzo o merienda' },
    { key: 'energyKcal', label: 'Energía registrada', unit: 'kcal', min: 0, max: 20000 },
    { key: 'proteinG', label: 'Proteínas', unit: 'g', min: 0, max: 2000 },
    { key: 'carbsG', label: 'Carbohidratos', unit: 'g', min: 0, max: 3000 },
    { key: 'fatG', label: 'Grasas', unit: 'g', min: 0, max: 2000 },
    { key: 'fiberG', label: 'Fibra', unit: 'g', min: 0, max: 1000 },
  ],
  supplements: [
    { key: 'name', label: 'Suplemento', type: 'text', required: true, hint: 'Creatina, multivitamínico…' },
    { key: 'dose', label: 'Cantidad registrada', min: 0.0001, max: 100000 },
    { key: 'unit', label: 'Unidad de la cantidad', type: 'text', hint: 'g, mg, cápsulas…' },
  ],
}
const titles: Record<Collection | 'profile', string> = { profile: 'Perfil corporal', measurements: 'Medición corporal', sleep: 'Registro de sueño', activity: 'Registro de actividad', nutrition: 'Registro de comida', supplements: 'Registro de suplemento', goals: 'Objetivo personal' }
const sourceLabels: Record<string, string> = { manual: 'Registro manual', 'samsung-health': 'Samsung Health', 'health-connect': 'Health Connect' }
const tabs: { key: Tab; label: string }[] = [{ key: 'overview', label: 'Resumen' }, { key: 'body', label: 'Cuerpo' }, { key: 'recovery', label: 'Sueño y actividad' }, { key: 'food', label: 'Alimentación' }, { key: 'goals', label: 'Objetivos' }, { key: 'import', label: 'Importar' }]
const goalMetrics: Field[] = [...bodyFields, { key: 'sleepMinutes', label: 'Tiempo dormido', unit: 'min', min: 1, max: 1440 }, { key: 'weeklyTrainingDays', label: 'Días de fuerza por semana', unit: 'días', min: 1, max: 7, step: 1 }]
const number = (value: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value)
const asValues = (value: unknown) => value as Values
const text = (value: unknown) => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
function dateLabel(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) }
function dateOf(value: Values) { return text(value.date || value.startDate) }
function timestampLabel(value: unknown) { return new Date(text(value)).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) }
function duration(value: number) { const minutes = Math.round(value); return `${Math.floor(minutes / 60)} h ${minutes % 60} min` }
function download(content: string, name: string) { const url = URL.createObjectURL(new Blob([content], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
function localInputTime(value: unknown) { if (!value) return ''; const date = new Date(String(value)); if (Number.isNaN(date.getTime())) return ''; return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
function categoryValues(health: HealthData, collection: Collection) { return health[collection].map(asValues) }

export default function HealthPage({ onSignIn }: { onSignIn: () => void }) {
  const userState = useAppStore(s => s.user)
  const user = instanceMode ? userState : null
  const data = useAppStore(s => s.user ? s.personalData : s.localPersonalData)
  const revision = useAppStore(s => s.user ? s.revision : s.localRevision)
  const cloudUnavailable = useAppStore(s => instanceMode && Boolean(s.user && !cloudWriteAllowed(s.access)))
  const cloudBlocked = instanceMode && cloudUnavailable
  const loading = useAppStore(s => s.accountLoading || s.authStatus === 'loading')
  const accountError = useAppStore(s => s.accountError)
  const [tab, setTab] = useState<Tab>('overview')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<{ collection: Collection; id: string; base: HealthData; revision: number } | null>(null)
  const health = data?.settings.health ?? createEmptyHealthData()
  const today = dateInTimeZone(new Date(), data?.settings.profile.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
  function edit(collection: Collection | 'profile', values?: Values) {
    if (revision === null || cloudBlocked) return
    setError(''); setMessage(''); setDeleting(null)
    setDraft({ collection, values: values ?? (collection === 'profile' ? asValues(health.profile) : {}), base: structuredClone(health), revision, id: values ? text(values.id) : crypto.randomUUID() })
  }
  async function save(candidate: unknown, expectedRevision: number, removalOnly = false) {
    const parsed = HealthDataSchema.safeParse(candidate)
    if (!parsed.success) { setError(`Revisá los datos: ${parsed.error.issues[0]?.message ?? 'hay un valor inválido'}.`); return false }
    setBusy(true); setError(''); setMessage('')
    try {
      const failure = await useAppStore.getState().saveHealth(parsed.data, expectedRevision, removalOnly)
      if (failure) { setError(failure); return false }
      setMessage(user ? 'Guardado en tu cuenta.' : 'Guardado en este dispositivo.'); return true
    } catch { setError('No pudimos confirmar el guardado. Conservamos tus campos para que puedas reintentar.'); return false }
    finally { setBusy(false) }
  }
  async function submitDraft(values: Values) {
    if (!draft) return
    const candidate = structuredClone(draft.base)
    if (draft.collection === 'profile') candidate.profile = values as HealthData['profile']
    else {
      const records = categoryValues(candidate, draft.collection).filter(record => record.id !== values.id)
      Object.assign(candidate, { [draft.collection]: [...records, values] })
    }
    if (await save(candidate, draft.revision)) setDraft(null)
  }
  async function remove() {
    if (!deleting) return
    const candidate = { ...deleting.base, [deleting.collection]: categoryValues(deleting.base, deleting.collection).filter(record => record.id !== deleting.id) }
    if (await save(candidate, deleting.revision, true)) setDeleting(null)
  }
  function history(collection: Exclude<Collection, 'goals'>, description: string) {
    return <History collection={collection} health={health} description={description} busy={busy} readOnly={cloudBlocked} onEdit={values => edit(collection, values)} onAdd={() => edit(collection)} onDelete={id => { if (revision !== null) { setError(''); setDeleting({ collection, id, base: structuredClone(health), revision }) } }} deletingId={deleting?.collection === collection ? deleting.id : undefined} onConfirmDelete={remove} onCancelDelete={() => setDeleting(null)} />
  }
  if (loading && !data) return <section className="health-card"><p role="status">Cargando tu información personal…</p></section>

  if (!data || revision === null) return <section className="health-card"><p role="alert">{accountError || (user ? 'Todavía no pudimos cargar tu cuenta.' : 'No podemos leer la copia local. Exportala para recuperarla.')}</p>{user ? <button className="secondary-button" onClick={() => { void useAppStore.getState().refreshState() }}>Volver a cargar</button> : <button className="secondary-button" onClick={() => download(useAppStore.getState().exportData(), 'klisteni-recuperar-copia-local.json')}>Exportar copia local</button>}</section>
  return <section className="health-page" aria-label="Mi salud">
    <div className="health-heading"><div><span className="eyebrow">MI SALUD</span><h2>Tu panorama personal</h2><p>Registrá tu punto de partida, observá cómo cambia y elegí un próximo paso posible.</p></div><button className="secondary-button" onClick={() => download(useAppStore.getState().exportData(), `klisteni-mi-cuenta-${today}.json`)}>{user ? 'Exportar mi cuenta' : 'Exportar mis datos'}</button></div>
    {!user && <p className="health-callout">Modo local gratuito: estos datos se guardan solamente en este navegador. Exportá una copia para conservarlos. {instanceMode && <button className="text-button" onClick={onSignIn}>Guardar entre dispositivos con una cuenta</button>}</p>}
    {instanceMode && cloudBlocked && <p className="health-callout">El guardado en la nube está pausado. Tu dashboard y tus datos siguen disponibles para consultar y exportar. <button className="text-button" onClick={onSignIn}>Ver acceso y modo local</button></p>}
    <nav className="health-tabs" aria-label="Secciones de mi salud">{tabs.map(item => <button key={item.key} aria-current={tab === item.key ? 'page' : undefined} disabled={busy || !!draft} onClick={() => { setTab(item.key); setError(''); setMessage(''); setDeleting(null) }}>{item.label}</button>)}</nav>
    {error && <p className="health-error" role="alert">{error}</p>}
    {message && <p className="health-success" role="status">{message}</p>}
    {draft ? <><RevisionReview draft={draft} health={health} revision={revision} busy={busy} onReview={() => { setDraft({ ...draft, base: structuredClone(health), revision }); setError('') }} onCancel={() => { setDraft(null); setError('') }} /><RecordEditor key={draft.id} draft={draft} today={today} busy={busy || cloudBlocked} stale={draft.revision !== revision} onSubmit={submitDraft} onCancel={() => { setDraft(null); setError('') }} /></> : <>
      {tab === 'overview' && <Overview health={health} today={today} onSelect={setTab} />}
      {tab === 'body' && <div className="health-stack"><div className="health-card"><div className="health-card-heading"><div><h3>Tu perfil corporal</h3><p>Completá únicamente lo que quieras registrar. Todos los campos son opcionales.</p></div><button className="secondary-button" disabled={cloudBlocked} onClick={() => edit('profile')}>Editar perfil</button></div><dl className="health-profile-values"><div><dt>Altura</dt><dd>{health.profile.heightCm ? `${number(health.profile.heightCm)} cm` : 'Sin registrar'}</dd></div><div><dt>Fecha de nacimiento</dt><dd>{health.profile.birthDate ? dateLabel(health.profile.birthDate) : 'Sin registrar'}</dd></div><div><dt>Sexo registrado</dt><dd>{({ female: 'Femenino', male: 'Masculino', intersex: 'Intersexual', 'prefer-not-to-say': 'Prefiero no indicarlo' } as Record<string, string>)[health.profile.sex ?? ''] ?? 'Sin registrar'}</dd></div></dl>{health.profile.context && <p className="health-note">{health.profile.context}</p>}</div><p className="health-callout"><strong>El reloj aporta estimaciones.</strong>La composición corporal puede variar con la hidratación y las condiciones de medición. Compará registros tomados de forma similar; un cambio aislado no demuestra pérdida de grasa o ganancia de músculo.</p>{history('measurements', 'Peso, composición corporal y contornos. Una fecha por medición, con unidades y origen visibles.')}</div>}
      {tab === 'recovery' && <div className="health-stack">{history('sleep', 'Usá la fecha en que te despertaste. Podés transcribir el resumen de tu reloj y, si los tenés, sus horarios y etapas.')}{history('activity', 'Registrá un resumen o una sesión e indicá el ejercicio en las notas. Estos datos complementan tus entrenamientos, sin sumarlos dos veces.')}<p className="health-callout">La frecuencia cardíaca, las calorías activas y las etapas de sueño son registros del dispositivo. Verlos juntos ayuda a observar tu historia; no demuestra qué ejercicio causó un cambio ni calcula tu recuperación médica.</p></div>}
      {tab === 'food' && <div className="health-stack">{history('nutrition', 'Anotá comidas, porciones o nutrientes que conozcas. Los campos numéricos son opcionales.')}{history('supplements', 'Registrá lo que tomaste y su cantidad, o indicá que no lo tomaste ese día. Las cantidades las definís vos.')}<p className="health-callout"><strong>Un registro para entender hábitos.</strong>Las calorías anotadas pueden representar solo parte del día. No calculamos un déficit ni descontamos automáticamente lo que estima el reloj. Registrar creatina o un multivitamínico no indica que necesites tomarlos ni establece una dosis.</p></div>}
      {tab === 'goals' && <Goals health={health} today={today} busy={busy} readOnly={cloudBlocked} onAdd={() => edit('goals')} onEdit={goal => edit('goals', asValues(goal))} onDelete={id => setDeleting({ collection: 'goals', id, base: structuredClone(health), revision })} deletingId={deleting?.collection === 'goals' ? deleting.id : undefined} onConfirmDelete={remove} onCancelDelete={() => setDeleting(null)} />}
      {tab === 'import' && <ImportPanel health={health} revision={revision} today={today} timeZone={data.settings.profile.timeZone} busy={busy || cloudBlocked} onSave={save} />}
    </>}
    <p className="fine-print">{user ? 'Al guardar, enviás estos datos personales a tu cuenta en el servidor.' : 'Tus datos personales se guardan en este navegador y no se suben al servidor.'} Podés corregirlos, eliminar registros o exportar una copia. Se usan en tu dashboard personal. {instanceMode ? 'No se envían al servicio de estadísticas de visitas.' : 'Esta demo no utiliza analytics.'} <a href="/privacy">Privacidad y datos</a>.</p>
  </section>
}

function Overview({ health, today, onSelect }: { health: HealthData; today: string; onSelect: (tab: Tab) => void }) {
  const workouts = useAppStore(s => s.progress.workouts)
  const total = health.measurements.length + health.sleep.length + health.activity.length + health.nutrition.length + health.supplements.length
  const recent = (['measurements', 'sleep', 'activity', 'nutrition', 'supplements'] as const).flatMap(collection => categoryValues(health, collection).map(record => ({ collection, record }))).sort((a, b) => dateOf(b.record).localeCompare(dateOf(a.record)) || Date.parse(text(b.record.recordedAt)) - Date.parse(text(a.record.recordedAt))).slice(0, 5)
  return <div className="health-stack">
    {total === 0 && <div className="health-card health-empty"><h3>Tu punto de partida empieza con un dato.</h3><p>Una medida de cintura, una noche de sueño o cómo te sentiste al entrenar.<br />No necesitás completar todo para empezar.</p><button className="primary-button" onClick={() => onSelect('body')}>Registrar mi punto de partida</button></div>}
    <HealthDashboard health={health} workouts={workouts} today={today} metrics={bodyFields.map(field => ({ key: field.key as MeasurementKey, label: field.label, unit: field.unit! }))} onSelect={onSelect} goals={
      <section className="health-card" aria-label="Mis objetivos"><div className="health-card-heading"><div><h3>Lo que querés construir</h3><p>Desde el inicio de cada objetivo, independientemente del período del dashboard.</p></div><button className="text-button" onClick={() => onSelect('goals')}>Ver objetivos</button></div>{health.goals.length ? <div className="health-dashboard-goals">{health.goals.slice(0, 3).map(goal => <GoalCard key={goal.id} goal={goal} health={health} workouts={workouts} today={today} />)}</div> : <p>Todavía no hay objetivos. Podés empezar por sostener tus días de entrenamiento.</p>}</section>
    } />
    <details className="health-card health-recent"><summary>Últimos registros</summary><p className="fine-print">Los cinco más recientes de todo tu historial.</p>{recent.length ? <div className="health-history">{recent.map(({ collection, record }) => <div className="health-row" key={`${collection}:${text(record.id)}`}><div className="health-row-top"><strong>{titles[collection]}</strong><span className="fine-print">{dateLabel(dateOf(record))}</span></div><RecordValues collection={collection} record={record} /><RecordSource record={record} /></div>)}</div> : <p className="health-empty">Acá vas a ver tu historia a medida que la registres.</p>}</details>
  </div>
}

function RecordSource({ record }: { record: Values }) { const source = record.source as { kind?: string; device?: string } | undefined; return <p className="health-row-meta">{sourceLabels[source?.kind ?? ''] ?? 'Sin origen'}{source?.device ? ` · ${source.device}` : ''}{record.modifiedAt ? ' · Editado manualmente' : ''}</p> }
function RecordValues({ collection, record }: { collection: Exclude<Collection, 'goals'>; record: Values }) {
  return <div className="health-values">{fields[collection].filter(field => record[field.key] !== undefined && record[field.key] !== '' && field.type !== 'datetime-local').map(field => <span key={field.key}>{field.label}: <strong>{typeof record[field.key] === 'number' ? number(record[field.key] as number) : text(record[field.key])}{field.unit ? ` ${field.unit}` : ''}</strong></span>)}{collection === 'supplements' && <span>{record.taken ? 'Toma registrada' : 'No tomado ese día'}</span>}{collection === 'activity' && <WorkoutAssociation record={record} />}{collection === 'sleep' && record.startAt && record.endAt ? <><span>Inicio: {timestampLabel(record.startAt)}</span><span>Fin: {timestampLabel(record.endAt)}</span></> : null}</div>
}

function WorkoutAssociation({ record }: { record: Values }) {
  const workouts = useAppStore(state => state.progress.workouts)
  const workout = workouts.find(item => item.id === record.workoutId)
  return <>{record.activityLabel ? <span>Actividad: <strong>{text(record.activityLabel)}</strong></span> : null}{record.workoutId ? <span>Entrenamiento asociado: <strong>{workout ? `${dateLabel(workout.date)} · ${workout.exercises.map(exercise => getExercise(exercise.exerciseId)?.shortName ?? exercise.exerciseId).join(', ')}` : 'Eliminado del historial'}</strong></span> : null}</>
}

function DeletePrompt({ busy, onConfirm, onCancel }: { busy: boolean; onConfirm: () => void; onCancel: () => void }) { return <div className="health-delete"><span>¿Eliminar este registro?</span><button className="text-button" disabled={busy} onClick={onConfirm}>{busy ? 'Eliminando…' : 'Sí, eliminar'}</button><button className="text-button" disabled={busy} onClick={onCancel}>Cancelar</button></div> }
function History({ collection, health, description, busy, readOnly, onEdit, onAdd, onDelete, deletingId, onConfirmDelete, onCancelDelete }: { collection: Exclude<Collection, 'goals'>; health: HealthData; description: string; busy: boolean; readOnly?: boolean; onEdit: (values: Values) => void; onAdd: () => void; onDelete: (id: string) => void; deletingId?: string; onConfirmDelete: () => void; onCancelDelete: () => void }) {
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [limit, setLimit] = useState(15)
  const ambiguousDates = collection === 'sleep' ? new Set(summarizeSleepDays(health.sleep).filter(day => day.durationMinutes === null).map(day => day.date)) : new Set<string>()
  const records = categoryValues(health, collection).filter(record => (!from || dateOf(record) >= from) && (!to || dateOf(record) <= to)).sort((a, b) => dateOf(b).localeCompare(dateOf(a)) || Date.parse(text(b.recordedAt)) - Date.parse(text(a.recordedAt)))
  return <section className="health-card"><div className="health-card-heading"><div><h3>{({ measurements: 'Mediciones', sleep: 'Tu descanso', activity: 'Movimiento y pulso', nutrition: 'Tus comidas', supplements: 'Tus suplementos' })[collection]}</h3><p>{description}</p></div><button className="secondary-button" disabled={busy || readOnly} onClick={onAdd}>Agregar registro</button></div>{health[collection].length > 0 && <div className="health-filters"><label>Desde<input type="date" value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setLimit(15) }} /></label><label>Hasta<input type="date" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setLimit(15) }} /></label><span className="fine-print">{records.length} registros</span></div>}{records.length ? <div className="health-history">{records.slice(0, limit).map(record => <article className="health-row" key={text(record.id)}><div className="health-row-top"><div><strong>{dateLabel(dateOf(record))}</strong><RecordSource record={record} /></div><div className="health-actions"><button className="text-button" disabled={busy || readOnly} onClick={() => onEdit(record)} aria-label={`Editar ${titles[collection].toLowerCase()} del ${dateLabel(dateOf(record))}`}>Editar</button><button className="text-button" disabled={busy} onClick={() => onDelete(text(record.id))} aria-label={`Eliminar ${titles[collection].toLowerCase()} del ${dateLabel(dateOf(record))}`}>Eliminar</button></div></div><RecordValues collection={collection} record={record} />{ambiguousDates.has(dateOf(record)) && <p className="health-note">Esta fecha necesita revisión: hay registros superpuestos o faltan horarios para distinguirlos. No la incluimos en los promedios.</p>}{record.notes ? <p className="health-note">{text(record.notes)}</p> : null}{deletingId === record.id && <DeletePrompt busy={busy} onConfirm={onConfirmDelete} onCancel={onCancelDelete} />}</article>)}</div> : <p className="health-empty">{from || to ? 'No hay registros en estas fechas.' : 'Todavía no hay registros. Agregá el primero cuando quieras.'}</p>}{records.length > limit && <button className="text-button" onClick={() => setLimit(limit + 15)}>Mostrar más registros</button>}</section>
}


function RevisionReview({ draft, health, revision, busy, onReview, onCancel }: { draft: Draft; health: HealthData; revision: number; busy: boolean; onReview: () => void; onCancel: () => void }) {
  if (revision === draft.revision) return null
  const current = draft.collection === 'profile' ? asValues(health.profile) : categoryValues(health, draft.collection).find(record => record.id === draft.id)
  const wasExisting = draft.collection !== 'profile' && !!draft.values.id
  const deleted = wasExisting && !current
  return <section className="health-card health-revision" aria-label="Revisar cambios en tu cuenta"><h3>Tu cuenta cambió mientras editabas</h3>{deleted ? <><p>Este registro fue eliminado desde otra vista o dispositivo. Tus campos siguen abajo, pero no lo vamos a recrear al guardar. Copiá lo que quieras conservar antes de cancelar.</p><button className="secondary-button" disabled={busy} onClick={onCancel}>Cancelar edición</button></> : <><p>Estos son los datos guardados ahora. Revisalos antes de continuar: tu formulario reemplazará este registro y conservará el resto de los cambios de tu cuenta.</p>{draft.collection === 'profile' ? <div className="health-values"><span>Altura: {health.profile.heightCm === undefined ? 'Sin registrar' : `${number(health.profile.heightCm)} cm`}</span><span>Nacimiento: {health.profile.birthDate ? dateLabel(health.profile.birthDate) : 'Sin registrar'}</span><span>Sexo: {({ female: 'Femenino', male: 'Masculino', intersex: 'Intersexual', 'prefer-not-to-say': 'Prefiero no indicarlo' } as Record<string, string>)[health.profile.sex ?? ''] ?? 'Sin registrar'}</span>{health.profile.context && <p className="health-note">{health.profile.context}</p>}</div> : current ? <div className="health-row"><strong>{draft.collection === 'goals' ? text(current.title) : dateLabel(dateOf(current))}</strong>{draft.collection === 'goals' ? <p>{goalMetrics.find(metric => metric.key === current.metric)?.label}: {text(current.target)} {goalMetrics.find(metric => metric.key === current.metric)?.unit} · Desde {dateLabel(text(current.startDate))}{current.targetDate ? ` · Hasta ${dateLabel(text(current.targetDate))}` : ''}</p> : <><RecordValues collection={draft.collection} record={current} /><RecordSource record={current} /></>}{current.notes ? <p className="health-note">{text(current.notes)}</p> : null}</div> : <p className="health-note">Tu registro es nuevo. Se agregará al historial actual sin quitar los registros guardados desde que abriste este formulario.</p>}<div className="health-actions" style={{ marginTop: 16 }}><button className="secondary-button" disabled={busy} onClick={onReview}>Revisé la versión actual</button><button className="text-button" disabled={busy} onClick={onCancel}>Cancelar edición</button></div><p className="fine-print">Revisar no guarda todavía. Los campos del formulario conservan tus cambios.</p></>}</section>
}

function InputField({ field, values }: { field: Field; values: Values }) {
  return <label>{field.label}{field.unit ? ` (${field.unit})` : ''}{field.required ? ' *' : ''}<input name={field.key} type={field.type ?? 'number'} inputMode={!field.type ? 'decimal' : undefined} defaultValue={field.type === 'datetime-local' ? localInputTime(values[field.key]) : text(values[field.key])} min={field.min} max={field.max} step={field.step ?? (field.type ? undefined : 'any')} required={field.required} maxLength={field.type === 'text' ? (field.key === 'unit' ? 40 : field.key === 'meal' ? 300 : 150) : undefined} placeholder={field.hint} /></label>
}
function RecordEditor({ draft, today, busy, stale, onSubmit, onCancel }: { draft: Draft; today: string; busy: boolean; stale: boolean; onSubmit: (values: Values) => Promise<void>; onCancel: () => void }) {
  const accountPresent = useAppStore(s => instanceMode && Boolean(s.user))
  const hasAccount = instanceMode && accountPresent
  const { collection, values } = draft
  const workouts = useAppStore(s => s.progress.workouts)
  const accountZone = useAppStore(s => s.personalData?.settings.profile.timeZone)
  const [metric, setMetric] = useState(text(values.metric) || 'waistCm')
  const [startDate, setStartDate] = useState(text(values.startDate) || today)
  const [formError, setFormError] = useState('')
  const selectedMetric = goalMetrics.find(item => item.key === metric)!
  const recordToday = dateInTimeZone(new Date(), text(values.timeZone) || accountZone || Intl.DateTimeFormat().resolvedOptions().timeZone)
  const source = values.source as { kind?: string; device?: string; externalId?: string } | undefined
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError('')
    const form = new FormData(event.currentTarget)
    const read = (key: string) => String(form.get(key) ?? '').trim()
    const optional = (key: string) => read(key) || undefined
    if (collection === 'profile') {
      await onSubmit({ birthDate: optional('birthDate'), heightCm: read('heightCm') ? Number(read('heightCm')) : undefined, sex: optional('sex'), context: optional('context') }); return
    }
    if (collection === 'goals') { await onSubmit({ id: draft.id, title: read('title'), metric: read('metric'), target: Number(read('target')), startDate: read('startDate'), targetDate: optional('targetDate'), notes: optional('notes') }); return }
    const next: Values = { id: draft.id, date: read('date'), recordedAt: values.recordedAt ?? new Date().toISOString(), ...(values.recordedAt ? { modifiedAt: new Date().toISOString() } : {}), timeZone: values.timeZone ?? accountZone, source: { kind: source?.externalId ? source.kind : read('source'), ...(optional('device') ? { device: read('device') } : {}), ...(source?.externalId ? { externalId: source.externalId } : {}) }, notes: optional('notes') }
    for (const field of fields[collection]) {
      if (!read(field.key)) continue
      if (field.type === 'datetime-local') {
        const date = new Date(read(field.key))
        if (Number.isNaN(date.getTime())) { setFormError('Revisá el horario de inicio y fin.'); return }
        next[field.key] = read(field.key) === localInputTime(values[field.key]) ? values[field.key] : date.toISOString()
      } else next[field.key] = field.type ? read(field.key) : Number(read(field.key))
    }
    if (collection === 'supplements') next.taken = form.get('taken') === 'on'
    if (collection === 'activity') { next.workoutId = optional('workoutId'); next.activityLabel = optional('activityLabel') }
    await onSubmit(next)
  }
  let content: ReactNode
  if (collection === 'profile') content = <><div className="health-form-grid"><label>Altura (cm)<input name="heightCm" type="number" min={30} max={300} step="any" defaultValue={text(values.heightCm)} /></label><label>Fecha de nacimiento<input name="birthDate" type="date" max={today} defaultValue={text(values.birthDate)} /></label><label>Sexo registrado<select name="sex" defaultValue={text(values.sex)}><option value="">Sin registrar</option><option value="female">Femenino</option><option value="male">Masculino</option><option value="intersex">Intersexual</option><option value="prefer-not-to-say">Prefiero no indicarlo</option></select></label></div><label className="health-field">Mi contexto<textarea name="context" maxLength={2000} defaultValue={text(values.context)} placeholder="Qué querés trabajar, qué te ayuda a sostener la práctica, qué querés observar…" /></label><p className="fine-print">No calculamos una dieta a partir de estos datos. Podés vaciar un campo para quitarlo de tu perfil.</p></>
  else if (collection === 'goals') content = <><label className="health-field">Nombre del objetivo *<input name="title" required maxLength={150} defaultValue={text(values.title)} placeholder="Por ejemplo, sostener mi práctica semanal" /></label><div className="health-form-grid"><label>Qué quiero observar<select name="metric" value={metric} onChange={event => setMetric(event.target.value)}>{goalMetrics.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label>Mi objetivo ({selectedMetric.unit}) *<input name="target" type="number" required min={selectedMetric.min} max={selectedMetric.max} step={selectedMetric.step ?? 'any'} defaultValue={text(values.target)} /></label><label>Fecha de inicio *<input name="startDate" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} required /></label><label>Fecha objetivo (opcional)<input name="targetDate" type="date" min={startDate} defaultValue={text(values.targetDate)} /></label></div><p className="health-callout">Elegí un objetivo que tenga sentido para vos. La primera medición desde la fecha de inicio será tu referencia; no proyectamos una fecha de resultado. Los días de fuerza cuentan los días distintos con sesiones registradas en la semana actual.</p></>
  else content = <><div className="health-form-grid"><label>{collection === 'sleep' ? 'Fecha al despertar' : 'Fecha del registro'} *<input name="date" type="date" required max={recordToday} defaultValue={text(values.date) || today} /></label><label>Origen<select name="source" disabled={!!source?.externalId} defaultValue={source?.kind ?? 'manual'}><option value="manual">Registro manual</option><option value="samsung-health">Samsung Health · transcripción</option><option value="health-connect">Health Connect · transcripción</option></select></label><label>Dispositivo (opcional)<input name="device" maxLength={200} defaultValue={source?.device ?? ''} placeholder="Por ejemplo, Galaxy Watch8" /></label></div>{collection === 'measurements' ? <><div className="health-form-grid">{bodyFields.slice(0, 4).map(field => <InputField key={field.key} field={field} values={values} />)}</div><details className="health-optional" open={bodyFields.slice(4).some(field => values[field.key] !== undefined) || undefined}><summary>Más contornos y composición corporal</summary><div className="health-form-grid">{bodyFields.slice(4).map(field => <InputField key={field.key} field={field} values={values} />)}</div></details><p className="fine-print">Completá al menos una medida. Usá centímetros para contornos; compará el mismo punto de medición y condiciones similares.</p></> : <div className="health-form-grid">{fields[collection].map(field => <InputField key={field.key} field={field} values={values} />)}</div>}{collection === 'sleep' && <p className="fine-print">Los horarios son opcionales; si completás uno, completá ambos. Se muestran en la zona horaria de este dispositivo. Las etapas y la puntuación son estimaciones del reloj.</p>}{collection === 'supplements' && <><label className="health-toggle"><input name="taken" type="checkbox" defaultChecked={values.taken !== false} />Lo tomé ese día</label><p className="fine-print">Cantidad y unidad se completan juntas, o se dejan vacías. Anotá la cantidad que usaste; la aplicación no sugiere una dosis.</p></>}{collection === 'activity' && <div className="health-form-grid"><label>Actividad o ejercicio (opcional)<input name="activityLabel" maxLength={150} defaultValue={text(values.activityLabel)} placeholder="Fuerza, caminata, sentadillas…" /></label><label>Asociar con mi entrenamiento<select name="workoutId" defaultValue={text(values.workoutId)}><option value="">Sin asociar</option>{values.workoutId && !workouts.some(workout => workout.id === values.workoutId) ? <option value={text(values.workoutId)}>Entrenamiento anterior eliminado</option> : null}{[...workouts].sort((a, b) => b.date.localeCompare(a.date)).map(workout => <option key={workout.id} value={workout.id}>{dateLabel(workout.date)} · {workout.exercises.map(exercise => getExercise(exercise.exerciseId)?.shortName ?? exercise.exerciseId).join(', ')} · {number(workout.durationMinutes)} min</option>)}</select></label></div>}</>
  return <form className="health-card health-editor" onSubmit={submit}><fieldset disabled={busy}><div className="health-card-heading"><div><h3>{Object.keys(values).length ? 'Editar' : 'Agregar'} · {titles[collection]}</h3><p>{collection === 'profile' ? 'Tu contexto, sin campos obligatorios.' : 'Dejá vacíos los datos que no conocés.'}</p></div><button type="button" className="text-button" onClick={onCancel}>Cancelar</button></div>{content}{collection !== 'profile' && <label className="health-field">Notas (opcional)<textarea name="notes" maxLength={2000} defaultValue={text(values.notes)} placeholder={collection === 'activity' ? 'Qué hiciste, cuándo registraste el pulso y cómo te sentiste.' : 'Condiciones de medición, contexto o una corrección.'} /></label>}{source?.externalId && <p className="fine-print">Estás corrigiendo un registro importado. Conservaremos su identificador de origen para no duplicarlo; una próxima importación con datos distintos requerirá revisión.</p>}{formError && <p className="health-error" role="alert">{formError}</p>}<div className="health-actions"><button className="primary-button" type="submit" disabled={stale}>{busy ? 'Guardando…' : hasAccount ? 'Guardar en mi cuenta' : 'Guardar en este dispositivo'}</button><button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button></div><p className="fine-print">Se guarda al confirmar. Si falla la conexión, los campos se conservan mientras mantengas esta vista abierta.</p></fieldset></form>
}

function GoalCard({ goal, health, workouts, today, children }: { goal: HealthData['goals'][number]; health: HealthData; workouts: ReturnType<typeof useAppStore.getState>['progress']['workouts']; today: string; children?: ReactNode }) {
  const metric = goalMetrics.find(item => item.key === goal.metric)!
  const result = computeHealthGoalProgress(goal, health, workouts, today)
  const latestSleepDay = goal.metric === 'sleepMinutes' ? summarizeSleepDays(health.sleep).filter(day => day.date >= goal.startDate && day.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0] : undefined
  const ambiguousSleep = latestSleepDay?.durationMinutes === null
  const labelValue = (value: number) => goal.metric === 'sleepMinutes' ? duration(value) : `${number(value)} ${metric.unit}`
  const expired = goal.targetDate && goal.targetDate < today
  return <article className="health-goal"><div className="health-row-top"><h4>{goal.title}</h4><span className="pill">{ambiguousSleep ? 'Revisar registros' : result.achieved ? goal.metric === 'weeklyTrainingDays' ? 'Cumplido esta semana' : 'Objetivo observado' : goal.startDate > today ? 'Próximamente' : expired ? 'Revisar plazo' : 'En camino'}</span></div><p>{metric.label} · Objetivo: <strong>{labelValue(goal.target)}</strong></p><p className="health-row-meta">Desde {dateLabel(goal.startDate)}{goal.targetDate ? ` · Hasta ${dateLabel(goal.targetDate)}` : ' · Sin fecha límite'}</p>{ambiguousSleep ? <p className="health-note">La última fecha tiene registros superpuestos o sin horarios suficientes para distinguirlos. Revisalos en Sueño y actividad antes de comparar el objetivo.</p> : result.current === null ? <p className="health-note">Todavía no hay registros desde el inicio para comparar.</p> : <><div className="health-goal-track" role="progressbar" aria-label={`Avance de ${goal.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(result.percent ?? 0)}><span style={{ width: `${result.percent ?? 0}%` }} /></div><p><strong>{labelValue(result.current)}</strong> {goal.metric === 'weeklyTrainingDays' ? 'esta semana' : `al ${dateLabel(result.observationDate!)}`}</p>{goal.metric !== 'weeklyTrainingDays' && result.baseline !== null && <p className="health-row-meta">Referencia inicial: {labelValue(result.baseline)} · Cambio: {result.change !== null && result.change > 0 ? '+' : ''}{number(result.change ?? 0)} {metric.unit === '%' ? 'puntos porcentuales' : metric.unit}</p>}{goal.metric === 'sleepMinutes' && <p className="health-row-meta">Suma del sueño registrado en la última fecha, incluidas siestas.</p>}</>}{goal.notes && <p className="health-note">{goal.notes}</p>}{children}</article>
}
function Goals({ health, today, busy, readOnly, onAdd, onEdit, onDelete, deletingId, onConfirmDelete, onCancelDelete }: { health: HealthData; today: string; busy: boolean; readOnly?: boolean; onAdd: () => void; onEdit: (goal: HealthData['goals'][number]) => void; onDelete: (id: string) => void; deletingId?: string; onConfirmDelete: () => void; onCancelDelete: () => void }) {
  const workouts = useAppStore(s => s.progress.workouts)
  return <section className="health-card"><div className="health-card-heading"><div><h3>Un objetivo, un próximo paso</h3><p>Definí qué querés observar y en qué plazo. El avance usa tus registros; no predice resultados.</p></div><button className="secondary-button" disabled={busy || readOnly} onClick={onAdd}>Crear objetivo</button></div>{health.goals.length ? <div className="health-grid">{[...health.goals].sort((a, b) => b.startDate.localeCompare(a.startDate)).map(goal => <GoalCard key={goal.id} goal={goal} health={health} workouts={workouts} today={today}><div className="health-actions" style={{ marginTop: 14 }}><button className="text-button" disabled={busy || readOnly} onClick={() => onEdit(goal)}>Editar objetivo</button><button className="text-button" disabled={busy} onClick={() => onDelete(goal.id)}>Eliminar</button></div>{deletingId === goal.id && <DeletePrompt busy={busy} onConfirm={onConfirmDelete} onCancel={onCancelDelete} />}</GoalCard>)}</div> : <div className="health-empty"><h3>Que el objetivo también se adapte a vos.</h3><p>Podés seguir tu cintura, una medida de composición corporal, el sueño o tus días de fuerza. Elegís el valor y el plazo.</p></div>}</section>
}

function ImportPanel({ health, revision, timeZone, busy, onSave }: { health: HealthData; revision: number; today: string; timeZone: string; busy: boolean; onSave: (candidate: unknown, revision: number) => Promise<boolean> }) {
  const accountPresent = useAppStore(s => instanceMode && Boolean(s.user))
  const hasAccount = instanceMode && accountPresent
  const [raw, setRaw] = useState('')
  const [fileName, setFileName] = useState('')
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ result: Extract<ReturnType<typeof previewHealthImport>, { ok: true }>; revision: number } | null>(null)
  function analyze(content: string) {
    const result = previewHealthImport(content, health)
    if (!result.ok) { setError(result.error); setPreview(null); return }
    setError(''); setPreview({ result, revision })
  }
  return <div className="health-stack"><section className="health-card"><h3>De tu reloj a tu historia</h3><p>Ya podés registrar datos a mano o importar un archivo JSON preparado en el formato de Klisteni. Una vista previa te permite revisar qué se incorporará.</p><div className="health-callout" style={{ marginTop: 18 }}><strong>La sincronización directa todavía no está conectada.</strong>Health Connect necesita un puente en Android con permisos de lectura. Esta web no accede al reloj ni a Samsung Health. Los CSV originales de Samsung y los ZIP de Health Connect todavía no se pueden importar directamente.</div><div className="health-actions" style={{ marginTop: 18 }}><button className="secondary-button" onClick={() => download(createHealthImportTemplate(new Date(), timeZone), 'klisteni-plantilla-salud.json')}>Descargar plantilla JSON</button></div><p className="fine-print" style={{ marginTop: 12 }}>La plantilla está vacía: no inventa mediciones. Conservá los identificadores de origen para que una segunda importación no duplique datos.</p></section><section className="health-card"><h3>Revisar un archivo</h3><label className="health-file">Archivo JSON de salud · máximo 2 MiB<input type="file" accept=".json,application/json" disabled={busy || reading} onChange={async event => { const file = event.target.files?.[0]; event.target.value = ''; setPreview(null); setError(''); setRaw(''); if (!file) { setFileName(''); return } setFileName(file.name); if (file.size > HEALTH_IMPORT_MAX_BYTES) { setError('El archivo supera 2 MiB. Dividilo por fechas antes de importarlo.'); return } setReading(true); try { const content = await file.text(); setRaw(content); analyze(content) } catch { setError('No pudimos leer el archivo. Seleccionalo otra vez.') } finally { setReading(false) } }} /></label>{reading && <p role="status">Leyendo el archivo en este dispositivo…</p>}{error && <p className="health-error" role="alert">{error}</p>}{preview && <div><h4>Vista previa · {fileName}</h4><p className="fine-print">{dateLabel(preview.result.range.from)} al {dateLabel(preview.result.range.to)} · {preview.result.sources.map(source => sourceLabels[source] ?? source).join(', ')}</p><div className="health-import-counts"><span><strong>{preview.result.counts.added}</strong> nuevos</span><span><strong>{preview.result.counts.duplicates}</strong> ya registrados</span><span><strong>{preview.result.counts.total}</strong> en el archivo</span></div><div className="health-values">{Object.entries(preview.result.byCategory).filter(([, count]) => count.added + count.duplicates > 0).map(([category, count]) => <span key={category}>{titles[category as Collection]}: {count.added} nuevos</span>)}</div>{preview.revision !== revision && <p className="health-error" role="alert" style={{ marginTop: 14 }}>Tu cuenta cambió desde esta vista previa. Volvé a revisarla antes de confirmar.</p>}<p className="fine-print" style={{ margin: '16px 0' }}>Hasta confirmar, el contenido se revisa en este navegador. {hasAccount ? 'Se agregarán registros a tu cuenta' : 'Se agregarán registros en este dispositivo'}; los duplicados idénticos se omiten. Tu perfil y tus objetivos se conservan.</p><div className="health-actions"><button className="primary-button" disabled={busy || preview.revision !== revision || preview.result.counts.added === 0} onClick={async () => { if (await onSave(preview.result.health, preview.revision)) { setPreview(null); setRaw(''); setFileName('') } }}>{busy ? 'Importando…' : 'Confirmar importación'}</button><button className="secondary-button" disabled={busy} onClick={() => analyze(raw)}>Volver a revisar</button><button className="text-button" disabled={busy} onClick={() => { setPreview(null); setRaw(''); setFileName('') }}>Descartar</button></div></div>}<p className="fine-print" style={{ marginTop: 16 }}>Para restaurar una exportación completa, usá Importar en Ajustes.</p></section></div>
}
