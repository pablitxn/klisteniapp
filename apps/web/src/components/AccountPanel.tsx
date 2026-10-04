import { useState, type FormEvent } from 'react'
import {
  dateInTimeZone, nextPlanEffectiveDate, PersonalSettingsSchema,
  type PersonalSettings,
} from '@klisteniapp/scene-schema'
import { useAppStore } from '../lib/store'
import AdminAccounts from './AdminAccounts'
import './account.css'

const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default function AccountPanel({ onDone }: { onDone: () => void }) {
  const user = useAppStore(s => s.user)
  const loading = useAppStore(s => s.accountLoading)
  const error = useAppStore(s => s.accountError)
  const data = useAppStore(s => s.personalData)
  const local = useAppStore(s => s.localDataAvailable)
  const rejectedCount = useAppStore(s => s.rejectedCount)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [includeSettings, setIncludeSettings] = useState(false)
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    const failure = await useAppStore.getState().signIn(String(form.get('email')), String(form.get('password')))
    setBusy(false)
    setMessage(failure ?? '')
    if (!failure) onDone()
  }
  if (!user) return <form className="form-stack" onSubmit={login}>
    <p className="form-intro">Tu rutina y tu progreso, también en tus otros dispositivos. El acceso es por invitación.</p>
    <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
    <label>Contraseña<input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>
    {(message || error) && <p role="alert" className="form-error">{message || error}</p>}
    {error?.includes('cerrar la sesión') && <button type="button" className="secondary-button" onClick={async () => { setBusy(true); setMessage(await useAppStore.getState().signOut() ?? 'Sesión cerrada.'); setBusy(false) }} disabled={busy}>Reintentar cierre de sesión</button>}
    <button className="primary-button full-width" disabled={busy || loading}>{busy ? 'Entrando…' : 'Entrar a mi cuenta'}</button>
    <p className="fine-print">Para obtener acceso o recuperar tu contraseña, pedí un enlace personal al administrador. Podés seguir explorando la demo sin una cuenta.</p>
  </form>
  return <div className="form-stack">
    <p className="form-intro">Sesión de <strong>{user.email}</strong>. Tu información personal se guarda en nuestro servidor.</p>
    {loading && <p role="status">Cargando tu práctica…</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {rejectedCount > 0 && <section className="account-section"><h3>Registros para revisar</h3><p>{rejectedCount} envíos no se pudieron incorporar. Conservamos el contenido original para que puedas recuperarlo.</p><button className="secondary-button" onClick={() => {
      const url = URL.createObjectURL(new Blob([useAppStore.getState().exportRejectedData()], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = 'klisteni-registros-para-revisar.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    }}>Descargar registros para revisar</button></section>}
    {data && <PersonalSettingsForm key={`${user.id}:${useAppStore.getState().revision}`} settings={data.settings} />}
    {local && (local.workouts > 0 || local.cardio > 0 || local.hasPreferences) && <section className="account-section">
      <h3>Datos de este navegador</h3>
      <p>Encontramos {local.workouts} sesiones de fuerza y {local.cardio} actividades de cardio del modo local. Incorporalos solamente si te pertenecen. La copia original seguirá disponible en la demo.</p>
      <label className="toggle-label"><span>Incluir también la rutina local</span><input type="checkbox" checked={includeSettings} onChange={e => setIncludeSettings(e.target.checked)} /></label>
      <button className="secondary-button" disabled={busy || !data} onClick={async () => {
        setBusy(true)
        const failure = await useAppStore.getState().importLocalData(includeSettings)
        setMessage(failure ?? 'Datos incorporados. Los registros repetidos no se duplicaron.')
        setBusy(false)
      }}>Incorporar mis datos locales</button>
    </section>}
    <PasswordForm />
    {user.role === 'admin' && <AdminAccounts userId={user.id} />}
    {message && <p role="status">{message}</p>}
    <button className="secondary-button" disabled={busy} onClick={async () => {
      setBusy(true)
      const failure = await useAppStore.getState().signOut()
      setMessage(failure ?? '')
      setBusy(false)
      if (!failure) onDone()
    }}>Cerrar sesión</button>
    <p className="fine-print">Los envíos pendientes quedan asociados a esta cuenta en este navegador. Volvé a entrar con la misma cuenta para reintentarlos.</p>
  </div>
}

function PersonalSettingsForm({ settings }: { settings: PersonalSettings }) {
  const [name, setName] = useState(settings.profile.displayName)
  const [timeZone, setTimeZone] = useState(settings.profile.timeZone)
  const latestPlan = [...settings.plans].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).at(-1)
  const [weekdays, setWeekdays] = useState<number[]>(latestPlan?.weekdays ?? [1, 3, 5])
  const [activeRoutineId, setActiveRoutineId] = useState(settings.activeRoutineId)
  const [routineName, setRoutineName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const today = dateInTimeZone(new Date(), settings.profile.timeZone)
  const effectiveFrom = nextPlanEffectiveDate(settings.plans, today)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = structuredClone(settings)
    next.profile = { displayName: name.trim(), timeZone: timeZone.trim() }
    next.activeRoutineId = activeRoutineId
    if (routineName.trim()) {
      const source = next.routines.find(routine => routine.id === activeRoutineId)!
      const copy = { ...source, id: crypto.randomUUID(), name: routineName.trim() }
      next.routines.push(copy)
      next.activeRoutineId = copy.id
    }
    const planChanged = !latestPlan || latestPlan.routineId !== next.activeRoutineId || latestPlan.weekdays.join(',') !== [...weekdays].sort().join(',')
    if (planChanged) {
      next.plans = next.plans.filter(plan => plan.effectiveFrom !== effectiveFrom)
      next.plans.push({ id: crypto.randomUUID(), effectiveFrom, weekdays: [...weekdays].sort() as (1 | 2 | 3 | 4 | 5 | 6 | 7)[], routineId: next.activeRoutineId })
    }
    const parsed = PersonalSettingsSchema.safeParse(next)
    if (!parsed.success) { setMessage('Revisá el nombre, la zona horaria y al menos un día de entrenamiento.'); return }
    setBusy(true)
    const failure = await useAppStore.getState().saveSettings(parsed.data)
    setMessage(failure ?? 'Preferencias guardadas en tu cuenta.')
    setBusy(false)
  }
  return <form className="form-stack account-section" onSubmit={save}>
    <h3>Mi práctica</h3>
    <div className="form-grid">
      <label>Nombre<input value={name} onChange={e => setName(e.target.value)} required maxLength={80} /></label>
      <label>Zona horaria<input value={timeZone} onChange={e => setTimeZone(e.target.value)} required list="time-zones" placeholder="Europe/Paris" /><datalist id="time-zones">{Intl.supportedValuesOf('timeZone').map(zone => <option key={zone} value={zone} />)}</datalist></label>
    </div>
    <p className="fine-print">Esta zona define hoy y tu semana en todos tus dispositivos. Tus fechas anteriores se conservan.</p>
    <label>Rutina activa<select value={activeRoutineId} onChange={e => setActiveRoutineId(e.target.value)}>{settings.routines.map(routine => <option value={routine.id} key={routine.id}>{routine.name}</option>)}</select></label>
    <label>Guardar una copia de la rutina <small>Opcional</small><input value={routineName} onChange={e => setRoutineName(e.target.value)} maxLength={80} placeholder="Por ejemplo, práctica corta" /></label>
    <fieldset className="training-days"><legend>Días para entrenar</legend>{dayNames.map((label, index) => <label key={label}><input type="checkbox" checked={weekdays.includes(index + 1)} onChange={e => setWeekdays(e.target.checked ? [...weekdays, index + 1].sort() : weekdays.filter(day => day !== index + 1))} /><span>{label}</span></label>)}</fieldset>
    <p className="fine-print">El plan empieza la semana del {effectiveFrom}. Un cambio de días se aplica a la próxima semana para conservar el cumplimiento anterior. Podés mover una práctica dentro de la misma semana.</p>
    {latestPlan && <p className="fine-print">Último plan: desde {latestPlan.effectiveFrom}, {latestPlan.weekdays.map(day => dayNames[day - 1]).join(', ')}.</p>}
    {message && <p role="status">{message}</p>}
    <button className="primary-button full-width" disabled={busy || weekdays.length === 0}>{busy ? 'Guardando…' : 'Guardar mi planificación'}</button>
  </form>
}

function PasswordForm() {
  const userId = useAppStore(s => s.user?.id)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  return <details className="account-section"><summary>Contraseña y otros dispositivos</summary>
    <form className="form-stack" onSubmit={async event => {
      event.preventDefault()
      const element = event.currentTarget
      const form = new FormData(element)
      setBusy(true)
      try {
        const response = await fetch('/api/auth/change-password', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Klisteni-Account': userId ?? '' }, body: JSON.stringify({ currentPassword: form.get('currentPassword'), newPassword: form.get('newPassword'), revokeOtherSessions: true }) })
        setMessage(response.ok ? 'Contraseña actualizada. Cerramos tus otras sesiones.' : 'No se pudo cambiar. Revisá la contraseña actual y volvé a intentar.')
        if (response.ok) element.reset()
      } catch { setMessage('No pudimos conectar. Tu contraseña no se confirmó como cambiada.') }
      setBusy(false)
    }}>
      <label>Contraseña actual<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} /></label>
      <label>Nueva contraseña<input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
      <button className="secondary-button" disabled={busy}>Cambiar contraseña</button>
      <button type="button" className="text-button" disabled={busy} onClick={async () => {
        setBusy(true)
        try {
          const response = await fetch('/api/auth/revoke-other-sessions', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Klisteni-Account': userId ?? '' }, body: '{}' })
          setMessage(response.ok ? 'Las otras sesiones se cerraron.' : 'No pudimos cerrar las otras sesiones.')
        } catch { setMessage('No pudimos conectar. Volvé a intentarlo.') }
        setBusy(false)
      }}>Cerrar sesiones de otros dispositivos</button>
      {message && <p role="status">{message}</p>}
    </form>
  </details>
}
