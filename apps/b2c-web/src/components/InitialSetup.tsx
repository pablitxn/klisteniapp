import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { createEmptyHealthData, dateInTimeZone, HealthDataSchema, type HealthData } from '@klisteniapp/scene-schema'
import { useAppStore } from '../lib/store'
import { cloudWriteAllowed } from '../lib/cloud-access'
import { RecordEditor, RevisionReview } from './HealthPage'
import './health.css'

type Step = 'intro' | 'profile' | 'measurement' | 'done'
type Draft = ComponentProps<typeof RecordEditor>['draft']
type Values = Draft['values']

export default function InitialSetup({ onDone }: { onDone: () => void }) {
  const scope = useAppStore(state => state.user ? `account:${state.user.id}` : 'local')
  return <SetupFlow key={scope} scope={scope} onDone={onDone} />
}

function SetupFlow({ scope, onDone }: { scope: string; onDone: () => void }) {
  const { t } = useTranslation('health')
  const user = useAppStore(state => state.user)
  const data = useAppStore(state => state.user ? state.personalData : state.localPersonalData)
  const revision = useAppStore(state => state.user ? state.revision : state.localRevision)
  const loading = useAppStore(state => state.accountLoading || state.authStatus === 'loading')
  const cloudBlocked = useAppStore(state => Boolean(state.user && !cloudWriteAllowed(state.access)))
  const accountError = useAppStore(state => state.accountError)
  const [step, setStep] = useState<Step>('intro')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedProfile, setSavedProfile] = useState(false)
  const [savedMeasurement, setSavedMeasurement] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { if (step !== 'intro') heading.current?.focus() }, [step])
  const health = data ? data.settings.health ?? createEmptyHealthData() : undefined
  const today = dateInTimeZone(new Date(), data?.settings.profile.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
  const unavailable = loading || !health || revision === null || cloudBlocked

  function currentSnapshot() {
    const state = useAppStore.getState()
    if ((state.user ? `account:${state.user.id}` : 'local') !== scope) return null
    const currentData = state.user ? state.personalData : state.localPersonalData
    const currentRevision = state.user ? state.revision : state.localRevision
    if (!currentData || currentRevision === null) return null
    return { health: currentData.settings.health ?? createEmptyHealthData(), revision: currentRevision }
  }

  function begin() {
    if (unavailable || inFlight.current) return
    const snapshot = currentSnapshot()
    if (!snapshot) return
    setSavedProfile(false); setSavedMeasurement(false); setError('')
    setDraft({ collection: 'profile', values: { ...snapshot.health.profile }, base: structuredClone(snapshot.health), revision: snapshot.revision, id: crypto.randomUUID() })
    setStep('profile')
  }

  function measurement() {
    if (inFlight.current) return
    const snapshot = currentSnapshot()
    if (!snapshot) return
    setError('')
    setDraft({ collection: 'measurements', values: {}, base: structuredClone(snapshot.health), revision: snapshot.revision, id: crypto.randomUUID() })
    setStep('measurement')
  }

  function backToIntro() {
    if (inFlight.current) return
    setDraft(null); setError(''); setStep('intro')
  }

  function finish() {
    if (inFlight.current) return
    setDraft(null); setError(''); setStep('done')
  }

  async function save(values: Values) {
    if (!draft || unavailable || inFlight.current || draft.revision !== revision || !currentSnapshot()) return
    const candidate = structuredClone(draft.base)
    if (draft.collection === 'profile') candidate.profile = values as HealthData['profile']
    else candidate.measurements = [...candidate.measurements.filter(record => record.id !== values.id), values as HealthData['measurements'][number]]
    const parsed = HealthDataSchema.safeParse(candidate)
    if (!parsed.success) {
      setError(t('Revisá los datos: {{value0}}.', { value0: parsed.error.issues[0]?.message ?? t('hay un valor inválido') }))
      return
    }
    inFlight.current = true; setBusy(true); setError('')
    try {
      const failure = await useAppStore.getState().saveHealth(parsed.data, draft.revision)
      if (!mounted.current || !currentSnapshot()) return
      if (failure) { setError(failure); return }
      if (draft.collection === 'profile') {
        setSavedProfile(true)
        // Refresh the snapshot after the confirmed profile save, before the next step.
        const snapshot = currentSnapshot()!
        setDraft({ collection: 'measurements', values: {}, base: structuredClone(snapshot.health), revision: snapshot.revision, id: crypto.randomUUID() })
        setStep('measurement')
      } else {
        setSavedMeasurement(true); setDraft(null); setStep('done')
      }
    } catch {
      if (mounted.current && currentSnapshot()) setError('No pudimos confirmar el guardado. Conservamos tus campos para que puedas reintentar.')
    } finally {
      inFlight.current = false
      if (mounted.current && currentSnapshot()) setBusy(false)
    }
  }

  const records = health ? health.measurements.length + health.sleep.length + health.activity.length + health.nutrition.length + health.supplements.length : 0
  const stepNumber = step === 'intro' ? 1 : step === 'profile' ? 2 : 3
  return <section className="initial-setup health-stack" aria-labelledby="initial-setup-heading">
    <div className="initial-setup-heading">
      <span className="eyebrow">{t('TU PUNTO DE PARTIDA')}</span>
      <h3 id="initial-setup-heading" ref={heading} tabIndex={-1}>{step === 'done' ? t('Configuración revisada') : t('Configuración inicial')}</h3>
      {step !== 'done' && <p className="fine-print">{t('Paso {{step}} de 3', { step: stepNumber })}</p>}
    </div>
    {loading && <p role="status">{t('Cargando tu información personal…')}</p>}
    {!loading && (!health || revision === null) && <div className="health-callout"><p role="alert">{t(accountError || '') || (user ? t('Todavía no pudimos cargar tu cuenta.') : t('No podemos leer la copia local. Exportala para recuperarla.'))}</p>{user && <button className="text-button" onClick={() => void useAppStore.getState().refreshState()}>{t('Volver a cargar')}</button>}</div>}
    {cloudBlocked && <p className="health-callout">{t('El guardado en la nube está pausado. Revisá el acceso en tu cuenta para guardar la configuración inicial.')}</p>}
    {error && <p className="health-error" role="alert">{t(error)}</p>}
    {step === 'intro' && <div className="health-card initial-setup-intro">
      <h4>{t('Tu punto de partida empieza con un dato.')}</h4>
      <p>{t('Una medida de cintura, una noche de sueño o cómo te sentiste al entrenar.')}</p>
      <p>{t('No necesitás completar todo para empezar.')}</p>
      <ol className="initial-setup-steps"><li>{t('Revisá tu perfil corporal.')}</li><li>{t('Agregá una medida si querés.')}</li><li>{t('Seguí con tu práctica.')}</li></ol>
      {records > 0 && <p className="fine-print">{t('Ya tenés {{count}} registros de salud. Esta configuración conserva tu historial.', { count: records })}</p>}
      <p className="fine-print">{t('Podés volver a esta sección cuando quieras. Volver a empezar reinicia los pasos; tus datos guardados se conservan.')}</p>
      <div className="health-actions"><button className="primary-button" disabled={unavailable} onClick={begin}>{t('Comenzar configuración')}</button></div>
    </div>}
    {(step === 'profile' || step === 'measurement') && draft && health && revision !== null && <>
      <div className="initial-setup-step-intro"><h4>{step === 'profile' ? t('Un poco de contexto sobre vos') : t('Una primera medida, a tu ritmo')}</h4><p>{step === 'profile' ? t('Tu perfil actual ya está cargado. Revisalo o continuá sin cambios; todos los campos son opcionales.') : health.measurements.length ? t('Tu historial ya tiene medidas. Podés agregar una nueva o continuar con lo guardado.') : t('Elegí una medida que quieras observar. Si hoy no tenés una, podés dejar este paso para más adelante.')}</p></div>
      <RevisionReview draft={draft} health={health} revision={revision} busy={busy} onReview={() => { setDraft({ ...draft, base: structuredClone(health), revision }); setError('') }} onCancel={backToIntro} />
      <RecordEditor key={draft.id} draft={draft} today={today} busy={busy || unavailable} stale={draft.revision !== revision} onSubmit={save} onCancel={backToIntro} submitLabel={step === 'profile' ? t('Guardar y continuar') : t('Guardar y finalizar')} cancelLabel={t('Volver al inicio')} />
      <div className="health-actions"><button className="text-button" disabled={busy} onClick={step === 'profile' ? measurement : finish}>{step === 'profile' ? t('Continuar sin cambios') : t('Seguir sin agregar una medición')}</button></div>
    </>}
    {step === 'done' && <div className="health-card initial-setup-complete">
      <h4>{t('Seguí con tu práctica.')}</h4><p>{t('Cada dato que guardaste queda disponible en Mi salud. Podés sumar o corregir registros cuando quieras.')}</p>
      <ul className="initial-setup-summary"><li>{savedProfile ? t('Perfil guardado en esta revisión.') : t('Perfil conservado sin cambios.')}</li><li>{savedMeasurement ? t('Nueva medición guardada.') : t('Historial conservado sin agregar mediciones.')}</li></ul>
      <p className="fine-print">{t('Podés volver a esta sección cuando quieras. Volver a empezar reinicia los pasos; tus datos guardados se conservan.')}</p>
      <div className="health-actions"><button className="primary-button" onClick={onDone}>{t('Listo')}</button><button className="secondary-button" disabled={unavailable} onClick={begin}>{t('Volver a empezar')}</button></div>
    </div>}
  </section>
}
