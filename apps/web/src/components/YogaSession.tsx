import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { dateInTimeZone, type YogaCompletedStep, type YogaLog, type YogaPractice } from '@klisteniapp/scene-schema'
import { getAsana } from '../data/yoga'
import { expandYogaSides, yogaCompletedStep, yogaDuration } from '../lib/yoga-practice'
import Icon from './Icon'
import Modal from './Modal'
import YogaAsanaArt from './YogaAsanaArt'

const YogaViewer = lazy(() => import('./YogaViewer'))

export default function YogaSession({ practice, suspended = false, unavailable, timeZone, onSave, onClose }: {
  practice: YogaPractice
  suspended?: boolean
  unavailable: boolean
  timeZone: string
  onSave: (log: YogaLog) => Promise<string | null>
  onClose: () => void
}) {
  const { t } = useTranslation('yoga')
  const [snapshot] = useState(() => expandYogaSides(practice))
  const [logId] = useState(() => crypto.randomUUID())
  const [index, setIndex] = useState(0)
  const [completed, setCompleted] = useState<YogaCompletedStep[]>([])
  const [remaining, setRemaining] = useState(snapshot.steps[0]!.durationSeconds * 1000)
  const clock = useRef({ remainingMs: remaining, startedAt: null as number | null })
  const [running, setRunning] = useState(false)
  const [review, setReview] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [autoPaused, setAutoPaused] = useState(false)
  const finishedAt = useRef<string | null>(null)
  const step = snapshot.steps[index]
  const asana = step && getAsana(step.asanaId)
  const next = snapshot.steps[index + 1]
  function remainingNow() {
    return Math.max(0, clock.current.remainingMs - (clock.current.startedAt === null ? 0 : performance.now() - clock.current.startedAt))
  }
  function pause() {
    const remainingMs = remainingNow()
    clock.current = { remainingMs, startedAt: null }
    setRemaining(remainingMs)
    setRunning(false)
  }
  function start() {
    if (unavailable || suspended || !step) return
    clock.current.startedAt = performance.now()
    setAutoPaused(false)
    setRunning(true)
  }
  function advance() {
    pause()
    const nextStep = snapshot.steps[index + 1]
    setIndex(index + 1)
    if (nextStep) {
      clock.current = { remainingMs: nextStep.durationSeconds * 1000, startedAt: null }
      setRemaining(nextStep.durationSeconds * 1000)
    } else {
      finishedAt.current = new Date().toISOString()
      setReview(true)
    }
  }
  function requestClose() {
    if (busy) return
    pause()
    setLeaving(true)
  }
  function finishHere() {
    const actualRemaining = remainingNow()
    pause()
    if (step) {
      const partial = yogaCompletedStep(step, actualRemaining)
      if (partial) setCompleted(value => [...value.filter(item => item.stepId !== step.id), partial])
    }
    finishedAt.current = new Date().toISOString()
    setLeaving(false)
    setReview(true)
  }
  useEffect(() => {
    if (!running || suspended || unavailable || !step) return
    const interval = window.setInterval(() => {
      const value = remainingNow()
      setRemaining(value)
      if (value <= 0) {
        window.clearInterval(interval)
        const done = yogaCompletedStep(step, 0)!
        setCompleted(previous => [...previous.filter(item => item.stepId !== step.id), done])
        advance()
      }
    }, 150)
    return () => window.clearInterval(interval)
    // A running segment owns one deadline. Rendering timer ticks must not restart it.
  }, [running, index, suspended, unavailable])
  useEffect(() => {
    if (suspended || unavailable) { pause(); setAutoPaused(true) }
  }, [suspended, unavailable])
  useEffect(() => {
    function onVisibility() {
      if (document.hidden && clock.current.startedAt !== null) { pause(); setAutoPaused(true) }
    }
    function beforeUnload(event: BeforeUnloadEvent) { event.preventDefault() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [])
  async function save() {
    if (busy || unavailable || !completed.length) return
    setBusy(true); setError('')
    const completedAt = finishedAt.current ?? new Date().toISOString()
    const log: YogaLog = {
      id: logId,
      date: dateInTimeZone(new Date(completedAt), timeZone),
      timeZone,
      completedAt,
      practiceSnapshot: snapshot,
      completedSteps: completed,
      durationSeconds: completed.reduce((sum, item) => sum + item.durationSeconds, 0),
      notes: notes.trim(),
    }
    try {
      const failure = await onSave(log)
      if (failure) setError(failure)
      else onClose()
    } catch { setError(t('No pudimos confirmar el guardado. Tu práctica sigue acá para reintentar.')) }
    finally { setBusy(false) }
  }
  const actualSeconds = completed.reduce((sum, item) => sum + item.durationSeconds, 0)
  const complete = completed.length === snapshot.steps.length && completed.every((item, i) => item.durationSeconds === snapshot.steps[i]?.durationSeconds)
  return <Modal title={snapshot.name} onClose={requestClose} wide suspended={suspended}>
    <div className="yoga-session">
      {leaving ? <div className="yoga-confirm"><Icon name="yoga" size={40} /><h3>{t(review ? '¿Salir sin guardar?' : '¿Terminamos por hoy?')}</h3><p>{t('Podés guardar el tiempo realizado o salir sin crear un registro. El reloj está pausado.')}</p><div className="yoga-actions"><button className="secondary-button" onClick={() => setLeaving(false)}>{t(review ? 'Volver al resumen' : 'Seguir practicando')}</button><button className="primary-button" onClick={() => { if (review) setLeaving(false); else finishHere() }}>{t('Revisar y guardar')}</button><button className="text-button" onClick={onClose}>{t('Salir sin guardar')}</button></div></div> : review ? <>
        <div className="yoga-session-result"><span className="yoga-result-icon"><Icon name={completed.length ? 'check' : 'yoga'} size={32} /></span><span className="eyebrow">{t('UN MOMENTO PARA VOS')}</span><h3>{t(complete ? 'Práctica completa' : 'Una práctica a tu ritmo')}</h3><p>{t('El valor de tu práctica no depende de cuánto duró.')}</p><div className="yoga-result-stats"><div><strong>{yogaDuration(actualSeconds)}</strong><span>{t('Tiempo realizado')}</span></div><div><strong>{completed.length} / {snapshot.steps.length}</strong><span>{t('Tramos registrados')}</span></div></div></div>
        {completed.length ? <><p className="yoga-fine">{t('Registramos únicamente el tiempo realizado. Los tramos saltados no se suman.')}</p><ol className="yoga-completed-list">{completed.map(item => <li key={item.stepId}><span>{getAsana(item.asanaId)?.name ?? item.asanaId}{item.side !== 'both' && ` · ${t(item.side === 'left' ? 'Izquierdo' : 'Derecho')}`}</span><strong>{yogaDuration(item.durationSeconds)}</strong></li>)}</ol><label className="yoga-notes">{t('¿Cómo te sentís? (opcional)')}<textarea maxLength={3000} rows={3} value={notes} disabled={busy} onChange={event => setNotes(event.target.value)} placeholder={t('Una sensación, una adaptación, algo que querés recordar…')} /></label></> : <p className="yoga-callout">{t('No hubo tiempo realizado para registrar. Podés volver a tus prácticas cuando quieras.')}</p>}
        {error && <p className="yoga-error" role="alert">{error}</p>}{unavailable && <p className="yoga-callout">{t('El guardado está temporalmente no disponible. Conservamos tu borrador mientras esta ventana siga abierta.')}</p>}
        <div className="yoga-actions yoga-session-footer"><button className="secondary-button" disabled={busy} onClick={() => completed.length ? requestClose() : onClose()}>{t(completed.length ? 'Salir sin guardar' : 'Volver a mis prácticas')}</button>{completed.length > 0 && <button className="primary-button" disabled={busy || unavailable} onClick={() => { void save() }}>{busy ? t('Guardando…') : t('Guardar registro')}</button>}</div>
      </> : step && asana ? <>
        <div className="yoga-session-top"><span>{t('Tramo {{current}} de {{total}}', { current: index + 1, total: snapshot.steps.length })}</span><span className="yoga-badge">{t(asana.family)}</span></div><progress className="yoga-session-progress" max={snapshot.steps.length} value={index} aria-label={t('Avance de la práctica')} />
        {snapshot.intention && <p className="yoga-session-intention">{snapshot.intention}</p>}
        <div className="yoga-session-main"><div className="yoga-session-pose"><Suspense fallback={<YogaAsanaArt asanaId={asana.id} side={step.side} eager />}><YogaViewer asanaId={asana.id} side={step.side} suspended={suspended} compact /></Suspense><span className="eyebrow">{asana.sanskritName}</span><h3>{asana.name}</h3>{step.side !== 'both' && <span className="yoga-badge yoga-side">{t(step.side === 'left' ? 'Lado izquierdo' : 'Lado derecho')}</span>}{step.side !== 'both' && asana.sideGuide && <p className="yoga-fine">{asana.sideGuide}</p>}<p>{asana.intention}</p><div className="yoga-breath"><Icon name="yoga" size={20} /><p>{asana.breathing}</p></div></div><div className="yoga-clock-panel"><span className="yoga-clock" role="timer" aria-label={t('Tiempo restante')}>{yogaDuration(Math.ceil(remaining / 1000))}</span><span className="yoga-fine">{running ? t('Respirá sin apuro') : remaining < step.durationSeconds * 1000 ? t('En pausa') : t('Prepará tu postura')}</span><button className="primary-button" disabled={unavailable} onClick={running ? pause : start}>{running ? t('Pausar') : remaining < step.durationSeconds * 1000 ? t('Continuar') : <><Icon name="play" size={17} />{t('Comenzar asana')}</>}</button><button className="text-button" onClick={advance}>{t('Saltar asana')}</button></div></div>
        {autoPaused && <p className="yoga-callout" role="status">{t('Pausamos el reloj al salir de esta pantalla. Retomá cuando estés listo.')}</p>}
        <details className="yoga-session-instructions" open key={step.id}><summary>{t('Entrar, permanecer y salir')}</summary><div className="yoga-session-cues"><div><h4>{t('Preparación')}</h4><ul>{asana.setup.map(text => <li key={text}>{text}</li>)}</ul><h4>{t('La postura')}</h4><ol>{asana.steps.map(text => <li key={text}>{text}</li>)}</ol></div><div><h4>{t('Cómo salir')}</h4><ul>{asana.exit.map(text => <li key={text}>{text}</li>)}</ul><h4>{t('Cuidados y adaptaciones')}</h4><ul>{[...asana.cautions, asana.adaptations[0]].filter(Boolean).map(text => <li key={text}>{text}</li>)}</ul></div></div></details>
        <div className="yoga-session-bottom"><div><span className="yoga-fine">{next ? t('DESPUÉS') : t('PARA CERRAR')}</span><p>{next ? `${getAsana(next.asanaId)?.name ?? next.asanaId}${next.side !== 'both' ? ` · ${t(next.side === 'left' ? 'Izquierdo' : 'Derecho')}` : ''}` : t('Un momento para registrar tu experiencia')}</p><span className="yoga-fine">{t('El reloj se pausa entre asanas. Entrá a la siguiente con calma.')}</span></div><button className="secondary-button" onClick={requestClose}>{t('Terminar ahora')}</button></div>
      </> : null}
    </div>
  </Modal>
}
