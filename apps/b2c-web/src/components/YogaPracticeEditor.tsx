import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { YogaPracticeSchema, type YogaPractice, type YogaPracticeStep } from '@klisteniapp/scene-schema'
import { asanas, getAsana, type Asana } from '../data/yoga'
import { expandYogaSides, yogaDuration, yogaPracticeSeconds, yogaSearch, yogaStepsForAsana } from '../lib/yoga-practice'
import Icon from './Icon'
import Modal from './Modal'
import YogaAsanaArt from './YogaAsanaArt'

export default function YogaPracticeEditor({ practice, isNew, suspended = false, unavailable, stale, onSave, onClose, onInspect }: {
  practice: YogaPractice
  isNew: boolean
  suspended?: boolean
  unavailable: boolean
  stale: boolean
  onSave: (practice: YogaPractice, asCopy?: boolean) => Promise<string | null>
  onClose: () => void
  onInspect: (asana: Asana) => void
}) {
  const { t } = useTranslation('yoga')
  const [draft, setDraft] = useState(() => expandYogaSides(practice))
  const [initial] = useState(() => JSON.stringify(draft))
  const [search, setSearch] = useState('')
  const [copyId] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState(false)
  const filtered = asanas.filter(asana => yogaSearch([asana.name, asana.sanskritName, asana.englishName, ...asana.aliases].join(' ')).includes(yogaSearch(search)))
  const duration = yogaPracticeSeconds(draft)
  const sideLabel = (side: YogaPracticeStep['side']) => t(side === 'left' ? 'Izquierdo' : side === 'right' ? 'Derecho' : 'Ambos lados')
  function close() {
    if (busy) return
    if (JSON.stringify(draft) !== initial) setLeaving(true)
    else onClose()
  }
  function updateStep(id: string, patch: Partial<YogaPracticeStep>) {
    setDraft(value => ({ ...value, steps: value.steps.map(step => step.id === id ? { ...step, ...patch } : step) }))
  }
  function move(index: number, direction: number) {
    setDraft(value => {
      const steps = [...value.steps]
      const item = steps.splice(index, 1)[0]!
      steps.splice(index + direction, 0, item)
      return { ...value, steps }
    })
  }
  function add(asana: Asana) {
    const additions = yogaStepsForAsana(asana)
    if (draft.steps.length + additions.length > 100) { setError(t('Podés incluir hasta 100 tramos por práctica.')); return }
    setDraft(value => ({ ...value, steps: [...value.steps, ...additions] }))
    setError('')
  }
  async function save(event?: FormEvent, asCopy = false) {
    event?.preventDefault()
    if (busy || unavailable || (stale && !asCopy)) return
    const parsed = YogaPracticeSchema.safeParse({ ...draft, id: asCopy ? copyId : draft.id, name: draft.name.trim(), intention: draft.intention.trim() })
    if (!parsed.success) { setError(t('Revisá la práctica: agregá un nombre y al menos una asana. Cada tramo debe durar entre 5 segundos y 60 minutos; el total no puede superar 4 horas.')); return }
    setBusy(true); setError('')
    try {
      const failure = await onSave(parsed.data, asCopy)
      if (failure) setError(failure)
      else onClose()
    } catch { setError(t('No pudimos confirmar el guardado. Tu práctica sigue acá para reintentar.')) }
    finally { setBusy(false) }
  }
  return <Modal title={t(isNew ? 'Crear práctica' : 'Editar práctica')} onClose={close} wide suspended={suspended}>
    {leaving ? <div className="yoga-confirm"><Icon name="info" size={32} /><h3>{t('¿Descartar los cambios?')}</h3><p>{t('Los cambios de esta práctica todavía no están guardados.')}</p><div className="yoga-actions"><button className="secondary-button" onClick={() => setLeaving(false)}>{t('Seguir editando')}</button><button className="primary-button" onClick={onClose}>{t('Descartar cambios')}</button></div></div> : <form className="yoga-editor" onSubmit={event => { void save(event) }}>
      <p className="yoga-muted">{t('Elegí una intención y armá tu secuencia. El orden, los tiempos y los apoyos se adaptan a vos.')}</p>
      <div className="yoga-editor-meta"><label>{t('Nombre de la práctica')}<input required maxLength={100} value={draft.name} placeholder={t('Mi pausa de la mañana')} onChange={event => setDraft({ ...draft, name: event.target.value })} disabled={busy} /></label><label>{t('Intención (opcional)')}<input maxLength={1000} value={draft.intention} placeholder={t('Moverme con atención, sin apuro')} onChange={event => setDraft({ ...draft, intention: event.target.value })} disabled={busy} /></label></div>
      <div className="yoga-builder">
        <section className="yoga-sequence" aria-label={t('Secuencia de la práctica')}><div className="yoga-section-heading"><h3>{t('Tu secuencia')}</h3><span className="yoga-badge"><Icon name="clock" size={14} />{yogaDuration(duration)}</span></div><p className="yoga-fine">{t('El tiempo es de permanencia. Las transiciones se hacen con el reloj pausado. Las posturas unilaterales se agregan con un tramo por lado.')}</p>
          {!draft.steps.length && <div className="yoga-empty"><Icon name="yoga" size={40} /><h3>{t('Tu práctica empieza con una asana')}</h3><p>{t('Elegí una de la biblioteca para sumarla a la secuencia.')}</p></div>}
          <ol className="yoga-step-list">{draft.steps.map((step, index) => {
            const asana = getAsana(step.asanaId)
            return <li className="yoga-step-row" key={step.id}><span className="yoga-step-number">{String(index + 1).padStart(2, '0')}</span><span className="yoga-step-preview"><YogaAsanaArt asanaId={step.asanaId} side={step.side} suspended={suspended} /></span><div className="yoga-step-content"><button type="button" className="yoga-asana-name" onClick={() => asana && onInspect(asana)}>{asana?.name ?? step.asanaId}<Icon name="info" size={14} /></button><span className="yoga-fine">{asana?.sanskritName}</span><div className="yoga-step-fields"><label>{t('Segundos')}<input aria-label={t('Duración de {{name}}, tramo {{number}}', { name: asana?.name, number: index + 1 })} type="number" min={5} max={3600} step={1} required value={step.durationSeconds || ''} disabled={busy} onChange={event => updateStep(step.id, { durationSeconds: Number(event.target.value) })} /></label>{!asana?.bilateral && <label>{t('Lado')}<select value={step.side} disabled={busy} aria-label={t('Lado de {{name}}, tramo {{number}}', { name: asana?.name, number: index + 1 })} onChange={event => updateStep(step.id, { side: event.target.value as YogaPracticeStep['side'] })}><option value="left">{sideLabel('left')}</option><option value="right">{sideLabel('right')}</option></select></label>}</div></div><div className="yoga-step-tools"><button type="button" className="icon-button" disabled={busy || index === 0} aria-label={t('Subir tramo {{number}}', { number: index + 1 })} onClick={() => move(index, -1)}><Icon name="up" size={17} /></button><button type="button" className="icon-button" disabled={busy || index === draft.steps.length - 1} aria-label={t('Bajar tramo {{number}}', { number: index + 1 })} onClick={() => move(index, 1)}><Icon name="down" size={17} /></button><button type="button" className="icon-button" disabled={busy || draft.steps.length >= 100} aria-label={t('Repetir tramo {{number}}', { number: index + 1 })} onClick={() => setDraft(value => ({ ...value, steps: [...value.steps.slice(0, index + 1), { ...step, id: crypto.randomUUID() }, ...value.steps.slice(index + 1)] }))}><Icon name="plus" size={17} /></button><button type="button" className="icon-button" disabled={busy} aria-label={t('Quitar tramo {{number}}', { number: index + 1 })} onClick={() => setDraft(value => ({ ...value, steps: value.steps.filter(item => item.id !== step.id) }))}><Icon name="close" size={17} /></button></div></li>
          })}</ol>
        </section>
        <aside className="yoga-picker" aria-label={t('Agregar asanas')}><h3>{t('Agregar asanas')}</h3><label className="yoga-search"><Icon name="search" size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Nombre o sánscrito…')} aria-label={t('Buscar asanas para agregar')} /></label><div className="yoga-picker-list">{filtered.map(asana => <div className="yoga-picker-item" key={asana.id}><button type="button" className="yoga-picker-name" onClick={() => onInspect(asana)}><strong>{asana.name}</strong><span>{asana.sanskritName}</span><small>{t(asana.family)} · {asana.bilateral ? t('Un tramo') : t('Dos lados')}</small></button><button type="button" className="icon-button yoga-add-button" aria-label={t('Agregar {{name}}', { name: asana.name })} disabled={busy || draft.steps.length + (asana.bilateral ? 1 : 2) > 100} onClick={() => add(asana)}><Icon name="plus" size={19} /></button></div>)}{!filtered.length && <p className="yoga-fine">{t('No encontramos asanas con esa búsqueda.')}</p>}</div></aside>
      </div>
      {stale && <div className="yoga-callout" role="status"><p>{t('Esta práctica cambió o fue eliminada mientras la editabas. Guardá una copia para conservar tu borrador, o cerrá y volvé a abrir la versión actual.')}</p><button type="button" className="text-button" disabled={busy || unavailable} onClick={() => { void save(undefined, true) }}>{t('Guardar una copia')}</button></div>}
      {error && <p className="yoga-error" role="alert">{error}</p>}{unavailable && <p className="yoga-callout" role="status">{t('El guardado está temporalmente no disponible. Conservamos tu borrador mientras esta ventana siga abierta.')}</p>}
      <div className="yoga-editor-footer"><span className="yoga-fine">{t('{{count}} tramos · {{duration}} de permanencia', { count: draft.steps.length, duration: yogaDuration(duration) })}</span><div className="yoga-actions"><button type="button" className="secondary-button" disabled={busy} onClick={close}>{t('Cancelar')}</button><button type="submit" className="primary-button" disabled={busy || unavailable || stale || !draft.steps.length}>{busy ? t('Guardando…') : t('Guardar práctica')}</button></div></div>
    </form>}
  </Modal>
}
