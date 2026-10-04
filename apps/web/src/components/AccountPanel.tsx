import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { useState, type FormEvent } from 'react'
import {
  dateInTimeZone, nextPlanEffectiveDate, PersonalSettingsSchema,
  type PersonalSettings,
} from '@klisteniapp/scene-schema'
import { useAppStore } from '../lib/store'
import AdminAccounts from './AdminAccounts'
import BillingPanel, { FreeCloudComparison } from './BillingPanel'
import { cloudWriteAllowed } from '../lib/account-api'
import './account.css'

const calendarDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString(i18n.resolvedLanguage === 'fr' ? 'fr-FR' : i18n.resolvedLanguage === 'en' ? 'en-US' : 'es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const planningSnapshot = (settings: PersonalSettings) => JSON.stringify({
  profile: { displayName: settings.profile.displayName, timeZone: settings.profile.timeZone },
  routines: settings.routines, plans: settings.plans, activeRoutineId: settings.activeRoutineId,
})

export default function AccountPanel({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation('account')
  const user = useAppStore(s => s.user)
  const cloudBlocked = useAppStore(s => !cloudWriteAllowed(s.access))
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
    <p className="form-intro">{t("Tu rutina y tu progreso, también en tus otros dispositivos. El acceso es por invitación.")}</p>
    <label>{t("Email")}<input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
    <label>{t("Contraseña")}<input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>
    {(message || error) && <p role="alert" className="form-error">{t(message || error || '')}</p>}
    {error?.includes('cerrar la sesión') && <button type="button" className="secondary-button" onClick={async () => { setBusy(true); setMessage(await useAppStore.getState().signOut() ?? "Sesión cerrada."); setBusy(false) }} disabled={busy}>{t("Reintentar cierre de sesión")}</button>}
    <button className="primary-button full-width" disabled={busy || loading}>{busy ? t("Entrando…") : t("Entrar a mi cuenta")}</button>
    <a className="text-button account-forgot-password" href="/account/forgot-password">{t("Olvidé mi contraseña")}</a>
    <FreeCloudComparison />
    <p className="fine-print">{t("Para obtener acceso, pedí una invitación al administrador. Podés usar gratis el modo local sin una cuenta.")}</p>
  </form>
  return <div className="form-stack">
    <p className="form-intro">{t("Sesión de")} <strong>{user.email}</strong>{t(". Tu información personal se guarda en nuestro servidor.")}</p>
    <BillingPanel userId={user.id} />
    {loading && <p role="status">{t("Cargando tu práctica…")}</p>}
    {error && <p role="alert" className="form-error">{t(error)}</p>}
    {rejectedCount > 0 && <section className="account-section"><h3>{t("Registros para revisar")}</h3><p>{rejectedCount} {t("envíos no se pudieron incorporar. Conservamos el contenido original para que puedas recuperarlo.")}</p><button className="secondary-button" onClick={() => {
      const url = URL.createObjectURL(new Blob([useAppStore.getState().exportRejectedData()], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = 'klisteni-registros-para-revisar.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    }}>{t("Descargar registros para revisar")}</button></section>}
    {data && <PersonalSettingsForm key={user.id} userId={user.id} settings={data.settings} cloudBlocked={cloudBlocked} />}
    {local && (local.workouts > 0 || local.cardio > 0 || local.hasPreferences) && <section className="account-section">
      <h3>{t("Datos de este navegador")}</h3>
      <p>{t("Encontramos")} {local.workouts} {t("sesiones de fuerza y")} {local.cardio} {t("actividades de cardio del modo local. Incorporalos solamente si te pertenecen. La copia original seguirá disponible en modo local.")}</p>
      <label className="toggle-label"><span>{t("Incluir también la rutina local")}</span><input type="checkbox" checked={includeSettings} onChange={e => setIncludeSettings(e.target.checked)} /></label>
      <button className="secondary-button" disabled={busy || !data || cloudBlocked} onClick={async () => {
        setBusy(true)
        const failure = await useAppStore.getState().importLocalData(includeSettings)
        setMessage(failure ?? "Datos incorporados. Los registros repetidos no se duplicaron.")
        setBusy(false)
      }}>{t("Incorporar mis datos locales")}</button>
    </section>}
    <PasswordForm />
    {user.role === 'admin' && <AdminAccounts userId={user.id} />}
    {message && <p role="status">{t(message)}</p>}
    <button className="secondary-button" disabled={busy} onClick={async () => {
      setBusy(true)
      const failure = await useAppStore.getState().signOut()
      setMessage(failure ?? '')
      setBusy(false)
      if (!failure) onDone()
    }}>{cloudBlocked ? t("Cerrar sesión y seguir gratis en modo local") : t("Cerrar sesión")}</button>
    <p className="fine-print">{t("Los envíos pendientes quedan asociados a esta cuenta en este navegador. Volvé a entrar con la misma cuenta para reintentarlos.")}</p>
  </div>
}

function PersonalSettingsForm({ userId, settings, cloudBlocked }: { userId: string; settings: PersonalSettings; cloudBlocked: boolean }) {
  const { t } = useTranslation('account')
  const [baseline, setBaseline] = useState(() => planningSnapshot(settings))
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
  const planningChanged = baseline !== planningSnapshot(settings)
  const routineAvailable = settings.routines.some(routine => routine.id === activeRoutineId)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || cloudBlocked) return
    const current = useAppStore.getState()
    if (current.user?.id !== userId || !current.personalData) return
    if (baseline !== planningSnapshot(current.personalData.settings)) {
      setMessage('Tu planificación cambió. Revisá la versión actual antes de guardar tus cambios.'); return
    }
    if (!routineAvailable) { setMessage('La rutina elegida ya no está disponible. Elegí otra antes de guardar.'); return }
    const next = structuredClone(current.personalData.settings)
    next.profile = { ...next.profile, displayName: name.trim(), timeZone: timeZone.trim() }
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
    const saved = useAppStore.getState()
    if (saved.user?.id !== userId) return
    setMessage(failure ?? "Preferencias guardadas en tu cuenta.")
    if (!failure && saved.personalData) {
      setBaseline(planningSnapshot(saved.personalData.settings))
      setActiveRoutineId(saved.personalData.settings.activeRoutineId)
      setRoutineName('')
    }
    setBusy(false)
  }
  return <form className="form-stack account-section" onSubmit={save}>
    <h3>{t("Mi práctica")}</h3>
    {planningChanged && <section className="billing-notice" aria-label={t('Revisar planificación actual')}>
      <p role="status">{t('Tu planificación cambió mientras editabas. Tus campos se conservan. Revisá lo guardado antes de reemplazarlo con tus cambios.')}</p>
      <p>{t('Guardado ahora: {{name}} · {{zone}}', { name: settings.profile.displayName, zone: settings.profile.timeZone })}</p>
      <p>{t('Rutina actual: {{routine}}', { routine: settings.routines.find(routine => routine.id === settings.activeRoutineId)?.name ?? '' })}</p>
      {latestPlan && <p>{t('Días actuales: {{days}}', { days: latestPlan.weekdays.map(day => t(dayNames[day - 1]!)).join(', ') })}</p>}
      <button type="button" className="secondary-button" disabled={busy} onClick={() => { setBaseline(planningSnapshot(settings)); setMessage('') }}>{t('Revisé la planificación actual')}</button>
    </section>}
    <div className="form-grid">
      <label>{t("Nombre")}<input value={name} onChange={e => setName(e.target.value)} required maxLength={80} /></label>
      <label>{t("Zona horaria")}<input value={timeZone} onChange={e => setTimeZone(e.target.value)} required list="time-zones" placeholder="Europe/Paris" /><datalist id="time-zones">{Intl.supportedValuesOf('timeZone').map(zone => <option key={zone} value={zone} />)}</datalist></label>
    </div>
    <p className="fine-print">{t("Esta zona define hoy y tu semana en todos tus dispositivos. Tus fechas anteriores se conservan.")}</p>
    <label>{t("Rutina activa")}<select value={activeRoutineId} onChange={e => setActiveRoutineId(e.target.value)}>{!routineAvailable && <option value={activeRoutineId}>{t('La rutina elegida ya no está disponible')}</option>}{settings.routines.map(routine => <option value={routine.id} key={routine.id}>{routine.name}</option>)}</select></label>
    <label>{t("Guardar una copia de la rutina")} <small>{t("Opcional")}</small><input value={routineName} onChange={e => setRoutineName(e.target.value)} maxLength={80} placeholder={t("Por ejemplo, práctica corta")} /></label>
    <fieldset className="training-days"><legend>{t("Días para entrenar")}</legend>{dayNames.map((label, index) => <label key={label}><input type="checkbox" checked={weekdays.includes(index + 1)} onChange={e => setWeekdays(e.target.checked ? [...weekdays, index + 1].sort() : weekdays.filter(day => day !== index + 1))} /><span>{t(label)}</span></label>)}</fieldset>
    <p className="fine-print">{t("El plan empieza la semana del")} {calendarDate(effectiveFrom)}{t(". Un cambio de días se aplica a la próxima semana para conservar el cumplimiento anterior. Podés mover una práctica dentro de la misma semana.")}</p>
    {latestPlan && <p className="fine-print">{t("Último plan: desde")} {calendarDate(latestPlan.effectiveFrom)}, {latestPlan.weekdays.map(day => t(dayNames[day - 1]!)).join(', ')}.</p>}
    {message && <p role="status">{t(message)}</p>}
    <button className="primary-button full-width" disabled={busy || planningChanged || !routineAvailable || weekdays.length === 0 || cloudBlocked}>{busy ? t("Guardando…") : t("Guardar mi planificación")}</button>
  </form>
}

function PasswordForm() {
  const { t } = useTranslation('account')
  const userId = useAppStore(s => s.user?.id)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  return <details className="account-section"><summary>{t("Contraseña y otros dispositivos")}</summary>
    <form className="form-stack" onSubmit={async event => {
      event.preventDefault()
      const element = event.currentTarget
      const form = new FormData(element)
      setBusy(true)
      try {
        const response = await fetch('/api/auth/change-password', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Klisteni-Account': userId ?? '' }, body: JSON.stringify({ currentPassword: form.get('currentPassword'), newPassword: form.get('newPassword'), revokeOtherSessions: true }) })
        setMessage(response.ok ? "Contraseña actualizada. Cerramos tus otras sesiones." : "No se pudo cambiar. Revisá la contraseña actual y volvé a intentar.")
        if (response.ok) element.reset()
      } catch { setMessage('No pudimos conectar. Tu contraseña no se confirmó como cambiada.') }
      setBusy(false)
    }}>
      <label>{t("Contraseña actual")}<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} /></label>
      <label>{t("Nueva contraseña")}<input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
      <button className="secondary-button" disabled={busy}>{t("Cambiar contraseña")}</button>
      <button type="button" className="text-button" disabled={busy} onClick={async () => {
        setBusy(true)
        try {
          const response = await fetch('/api/auth/revoke-other-sessions', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Klisteni-Account': userId ?? '' }, body: '{}' })
          setMessage(response.ok ? "Las otras sesiones se cerraron." : "No pudimos cerrar las otras sesiones.")
        } catch { setMessage('No pudimos conectar. Volvé a intentarlo.') }
        setBusy(false)
      }}>{t("Cerrar sesiones de otros dispositivos")}</button>
      {message && <p role="status">{t(message)}</p>}
    </form>
  </details>
}
