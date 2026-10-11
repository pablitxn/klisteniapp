import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { YogaPracticeSchema, type YogaLog, type YogaPractice, type YogaAsanaId } from '@klisteniapp/scene-schema'
import { asanas, getAsana, yogaContext, yogaPracticeTemplates, yogaSources, type Asana } from '../data/yoga'
import { useAppStore } from '../lib/store'
import { expandYogaSides, yogaDuration, yogaPracticeSeconds, yogaSearch, yogaStepsForAsana } from '../lib/yoga-practice'
import Icon from './Icon'
import Modal from './Modal'
import YogaAsanaArt from './YogaAsanaArt'
import YogaPracticeEditor from './YogaPracticeEditor'
import YogaSession from './YogaSession'
import './yoga.css'

const YogaViewer = lazy(() => import('./YogaViewer'))

type Tab = 'library' | 'practices' | 'history'
type Editor = { practice: YogaPractice; isNew: boolean }

type YogaPageProps = { unavailable: boolean; suspended?: boolean; initialAsanaId?: YogaAsanaId }

export default function YogaPage({ unavailable, suspended = false, initialAsanaId }: YogaPageProps) {
  const owner = useAppStore(state => state.user?.id ?? 'local')
  // A session, notes and practice drafts belong to one account, just like saved data.
  return <YogaWorkspace key={owner} initialAsanaId={initialAsanaId} unavailable={unavailable} suspended={suspended} />
}

function YogaWorkspace({ unavailable, suspended = false, initialAsanaId }: YogaPageProps) {
  const { t, i18n } = useTranslation('yoga')
  const practices = useAppStore(state => state.yogaPractices)
  const logs = useAppStore(state => state.yogaLogs)
  const user = useAppStore(state => state.user)
  const timeZone = useAppStore(state => (state.user ? state.personalData : state.localPersonalData)?.settings.profile.timeZone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const [tab, setTab] = useState<Tab>('library')
  const [search, setSearch] = useState('')
  const [family, setFamily] = useState('Todas')
  const [level, setLevel] = useState('Todos los niveles')
  const [selected, setSelected] = useState<Asana | null>(() => initialAsanaId ? getAsana(initialAsanaId) ?? null : null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [session, setSession] = useState<YogaPractice | null>(null)
  const [deleting, setDeleting] = useState<{ kind: 'practice' | 'log'; id: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(15)
  const families = ['Todas', ...new Set(asanas.map(asana => asana.family))]
  const filtered = asanas.filter(asana => (family === 'Todas' || asana.family === family) && (level === 'Todos los niveles' || asana.level === level) && yogaSearch([asana.name, asana.sanskritName, asana.englishName, ...asana.aliases, asana.family].join(' ')).includes(yogaSearch(search)))
  function newPractice(asana?: Asana) {
    if (unavailable) return
    setSelected(null); setError(''); setMessage('')
    setEditor({ isNew: true, practice: { id: crypto.randomUUID(), name: '', intention: '', steps: asana ? yogaStepsForAsana(asana) : [] } })
  }
  function useTemplate(template: typeof yogaPracticeTemplates[number]) {
    if (unavailable) return
    setError(''); setMessage('')
    setEditor({ isNew: true, practice: { id: crypto.randomUUID(), name: template.name, intention: template.intention, steps: template.steps.map(step => ({ ...step, id: crypto.randomUUID() })) } })
  }
  function start(practice: YogaPractice) {
    const expanded = YogaPracticeSchema.safeParse(expandYogaSides(practice))
    if (!expanded.success) { setError(t('Esta práctica supera los límites al contar ambos lados. Editala antes de comenzar: hasta 100 tramos y 4 horas.')); return }
    setSession(expanded.data); setError(''); setMessage('')
  }
  function failure() {
    const state = useAppStore.getState()
    return state.accountError || state.storageError || t('No pudimos confirmar el guardado. Tu práctica sigue acá para reintentar.')
  }
  async function savePractice(practice: YogaPractice, asCopy = false) {
    if (!asCopy && editor && !editor.isNew && JSON.stringify(useAppStore.getState().yogaPractices.find(item => item.id === editor.practice.id)) !== JSON.stringify(editor.practice)) {
      return t('Esta práctica cambió o fue eliminada mientras la editabas. Guardá una copia para conservar tu borrador, o cerrá y volvé a abrir la versión actual.')
    }
    if (!await useAppStore.getState().saveYogaPractice(practice)) return failure()
    setTab('practices'); setMessage(t('Práctica guardada. Ya podés volver a ella cuando quieras.')); return null
  }
  async function saveLog(log: YogaLog) {
    if (!await useAppStore.getState().addYogaLog(log)) return failure()
    setTab('history'); setMessage(t('Tu práctica quedó registrada.')); return null
  }
  async function remove() {
    if (!deleting || busy) return
    setBusy(true); setError('')
    try {
      const success = deleting.kind === 'practice' ? await useAppStore.getState().deleteYogaPractice(deleting.id) : await useAppStore.getState().deleteYogaLog(deleting.id)
      if (success) { setDeleting(null); setMessage(t('Eliminado.')) }
      else setError(failure())
    } catch { setError(t('No pudimos eliminarlo. Volvé a intentar.')) }
    finally { setBusy(false) }
  }
  function dateLabel(log: YogaLog) {
    return new Date(log.completedAt).toLocaleString(i18n.resolvedLanguage ?? 'es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: log.timeZone ?? timeZone })
  }
  return <section className="yoga-page" aria-label={t('Yoga')}>
    <div className="yoga-hero"><div className="yoga-hero-copy"><span className="eyebrow">{t('MOVIMIENTO · RESPIRACIÓN · ATENCIÓN')}</span><div className="yoga-hero-meta"><span><Icon name="book" size={16} />{t('{{count}} asanas con contexto', { count: asanas.length })}</span><span><Icon name="yoga" size={18} />{t('Tu cuerpo, tu ritmo')}</span></div></div><button className="primary-button" disabled={unavailable} onClick={() => newPractice()}><Icon name="plus" size={18} />{t('Crear práctica')}</button></div>
    <nav className="yoga-tabs" aria-label={t('Secciones de yoga')}>{([{ id: 'library', label: 'Biblioteca', icon: 'book', count: asanas.length }, { id: 'practices', label: 'Mis prácticas', icon: 'yoga', count: practices.length }, { id: 'history', label: 'Historial', icon: 'clock', count: logs.length }] as const).map(item => <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => { setTab(item.id); setError(''); setMessage('') }}><Icon name={item.icon} size={18} />{t(item.label)}<span aria-hidden="true">{item.count}</span></button>)}</nav>
    {unavailable && <p className="yoga-callout">{t('Por ahora podés consultar la biblioteca y tus registros. La creación y el guardado volverán a estar disponibles cuando se restablezca el acceso.')}</p>}
    {message && <p className="yoga-success" role="status"><Icon name="check" size={18} />{message}</p>}{error && !deleting && <p className="yoga-error" role="alert">{error}</p>}
    {(i18n.resolvedLanguage ?? i18n.language).split('-')[0] !== 'es' && <p className="yoga-fine">{t('Las fichas y las propuestas iniciales están disponibles en español. Los nombres en sánscrito se conservan.')}</p>}
    {tab === 'library' && <>
      <details className="yoga-context"><summary><span><Icon name="yoga" size={21} />{t('Más que una postura')}</span><Icon name="chevron" size={17} /></summary><div><h3>{yogaContext.title}</h3><p>{yogaContext.description}</p><ul>{yogaContext.principles.map(principle => <li key={principle}>{principle}</li>)}</ul><p>{yogaContext.practiceNote}</p><div className="yoga-sources"><span>{t('Para seguir explorando')}</span>{yogaSources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<Icon name="arrow" size={14} /></a>)}</div></div></details>
      <div className="yoga-library-heading"><div><h3>{t('La biblioteca de asanas')}</h3><p>{t('El nombre es el comienzo. Descubrí cómo entrar, qué observar y de dónde viene cada postura.')}</p></div><span className="yoga-fine" role="status">{t('{{count}} resultados', { count: filtered.length })}</span></div>
      <div className="yoga-filters"><label className="yoga-search"><Icon name="search" size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Buscá una asana, su nombre en sánscrito…')} aria-label={t('Buscar asanas')} /></label><label className="yoga-level"><span className="sr-only">{t('Nivel')}</span><select aria-label={t('Nivel de las asanas')} value={level} onChange={event => setLevel(event.target.value)}><option value="Todos los niveles">{t('Todos los niveles')}</option><option value="Inicial">{t('Inicial')}</option><option value="Intermedio">{t('Intermedio')}</option></select></label></div>
      <div className="yoga-family-filters" aria-label={t('Familias de asanas')}>{families.map(item => <button aria-pressed={family === item} key={item} onClick={() => setFamily(item)}>{t(item)}</button>)}</div>
      <div className="yoga-library-grid">{filtered.map(asana => <article className="yoga-asana-card" key={asana.id}><button className="yoga-card-art" onClick={() => setSelected(asana)} aria-label={t('Ver {{name}}', { name: asana.name })}><span className="yoga-badge">{t(asana.family)}</span><YogaAsanaArt asanaId={asana.id} suspended={suspended} /></button><div className="yoga-card-body"><span className="yoga-sanskrit">{asana.sanskritName}</span><h4><button onClick={() => setSelected(asana)}>{asana.name}</button></h4><p>{asana.description}</p><div className="yoga-card-meta"><span>{t(asana.level)}</span><span><Icon name="clock" size={14} />{yogaDuration(asana.defaultHoldSeconds)}{!asana.bilateral && ` ${t('por lado')}`}</span></div><div className="yoga-card-footer"><button className="text-button" onClick={() => setSelected(asana)}>{t('Explorar asana')}<Icon name="arrow" size={16} /></button><button className="icon-button yoga-add-button" disabled={unavailable} onClick={() => newPractice(asana)} aria-label={t('Crear práctica con {{name}}', { name: asana.name })}><Icon name="plus" size={19} /></button></div></div></article>)}</div>
      {!filtered.length && <div className="yoga-empty"><Icon name="search" size={34} /><h3>{t('No encontramos asanas con esa búsqueda.')}</h3><button className="text-button" onClick={() => { setSearch(''); setFamily('Todas'); setLevel('Todos los niveles') }}>{t('Limpiar filtros')}</button></div>}
      <p className="yoga-fine yoga-library-footnote">{t('Los tiempos son puntos de partida, no metas. Buscá estabilidad y una respiración cómoda; podés salir antes y usar apoyos.')}</p>
    </>}
    {tab === 'practices' && <div className="yoga-practices"><div className="yoga-section-heading"><div><h3>{t('Tus prácticas')}</h3><p className="yoga-muted">{t('Secuencias que podés ajustar y volver a recorrer.')}</p></div></div>{practices.length ? <div className="yoga-practice-grid">{practices.map(practice => <article className="yoga-practice-card" key={practice.id}><div className="yoga-practice-card-top"><Icon name="yoga" size={30} /><span className="yoga-badge"><Icon name="clock" size={14} />{yogaDuration(yogaPracticeSeconds(practice))}</span></div><h4>{practice.name}</h4><p>{practice.intention || t('Un momento para respirar y moverte con atención.')}</p><div className="yoga-practice-preview">{practice.steps.slice(0, 3).map(step => <span key={step.id}>{getAsana(step.asanaId)?.name ?? step.asanaId}{step.side !== 'both' && ` · ${t(step.side === 'left' ? 'Izq.' : 'Der.')}`}</span>)}{practice.steps.length > 3 && <span>{t('+ {{count}} tramos', { count: practice.steps.length - 3 })}</span>}</div><div className="yoga-practice-actions"><button className="primary-button" disabled={unavailable} onClick={() => start(practice)} aria-label={t('Comenzar {{name}}', { name: practice.name })}><Icon name="play" size={16} />{t('Comenzar')}</button><button className="text-button" disabled={unavailable} onClick={() => setEditor({ isNew: false, practice: structuredClone(practice) })} aria-label={t('Editar {{name}}', { name: practice.name })}>{t('Editar')}</button><button className="icon-button" aria-label={t('Eliminar {{name}}', { name: practice.name })} onClick={() => { setError(''); setDeleting({ kind: 'practice', id: practice.id }) }}><Icon name="close" size={17} /></button></div></article>)}</div> : <div className="yoga-empty yoga-practices-empty"><Icon name="yoga" size={40} /><h3>{t('Tu primera práctica, a tu manera')}</h3><p>{t('Empezá con una propuesta o elegí tus propias asanas. Después podés cambiar todo.')}</p><button className="secondary-button" disabled={unavailable} onClick={() => newPractice()}><Icon name="plus" size={17} />{t('Crear desde cero')}</button></div>}
      <div className="yoga-section-heading yoga-templates-heading"><div><span className="eyebrow">{t('PUNTOS DE PARTIDA')}</span><h3>{t('Una intención para cada momento')}</h3><p className="yoga-muted">{t('Propuestas editables. Revisá las indicaciones de cada asana y elegí lo que te resulte cómodo.')}</p></div></div><div className="yoga-template-grid">{yogaPracticeTemplates.map((template, index) => <article className="yoga-template-card" key={template.id}><span className="yoga-template-number">{String(index + 1).padStart(2, '0')}</span><div><h4>{template.name}</h4><p>{template.description}</p><span className="yoga-fine"><Icon name="clock" size={14} />{yogaDuration(yogaPracticeSeconds(template))} · {t('{{count}} tramos', { count: template.steps.reduce((count, step) => count + (!getAsana(step.asanaId)?.bilateral && step.side === 'both' ? 2 : 1), 0) })}</span></div><button className="secondary-button" disabled={unavailable} onClick={() => useTemplate(template)} aria-label={t('Personalizar {{name}}', { name: template.name })}>{t('Personalizar')}<Icon name="arrow" size={15} /></button></article>)}</div>
    </div>}
    {tab === 'history' && <div className="yoga-history"><div className="yoga-section-heading"><div><h3>{t('El recorrido de tu práctica')}</h3><p className="yoga-muted">{t('Tiempo realizado, secuencias y sensaciones. Cada registro conserva la práctica tal como la hiciste.')}</p></div></div>{logs.length > 0 && <div className="yoga-history-stats"><div><strong>{logs.length}</strong><span>{t('Prácticas registradas')}</span></div><div><strong>{yogaDuration(logs.reduce((total, log) => total + log.durationSeconds, 0))}</strong><span>{t('Tiempo realizado')}</span></div></div>}{logs.length ? [...logs].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt)).slice(0, limit).map(log => <article className="yoga-history-card" key={log.id}><div className="yoga-history-heading"><div><span className="yoga-fine">{dateLabel(log)}</span><h4>{log.practiceSnapshot.name}</h4></div><span className="yoga-badge"><Icon name="clock" size={14} />{yogaDuration(log.durationSeconds)}</span><button className="icon-button" aria-label={t('Eliminar registro de {{name}}', { name: log.practiceSnapshot.name })} onClick={() => { setError(''); setDeleting({ kind: 'log', id: log.id }) }}><Icon name="close" size={17} /></button></div>{log.practiceSnapshot.intention && <p className="yoga-muted">{log.practiceSnapshot.intention}</p>}{log.notes && <p className="yoga-history-note">{log.notes}</p>}<details><summary>{t('Ver práctica realizada')} <span className="yoga-fine">{t('{{count}} tramos', { count: log.completedSteps.length })}</span></summary><ol className="yoga-completed-list">{log.completedSteps.map(step => <li key={step.stepId}><button className="text-button" onClick={() => setSelected(getAsana(step.asanaId) ?? null)}>{getAsana(step.asanaId)?.name ?? step.asanaId}{step.side !== 'both' && ` · ${t(step.side === 'left' ? 'Izquierdo' : 'Derecho')}`}</button><span>{yogaDuration(step.durationSeconds)}</span></li>)}</ol><p className="yoga-fine">{t('Las pausas y las asanas saltadas no se suman al tiempo registrado.')}</p></details></article>) : <div className="yoga-empty"><Icon name="clock" size={38} /><h3>{t('Tu historia empieza con una práctica')}</h3><p>{t('Cuando termines, podés guardar el recorrido y una nota sobre cómo te sentiste.')}</p><button className="secondary-button" onClick={() => setTab('practices')}>{t('Ver mis prácticas')}<Icon name="arrow" size={16} /></button></div>}{logs.length > limit && <button className="text-button" onClick={() => setLimit(value => value + 15)}>{t('Mostrar más registros')}</button>}</div>}
    <p className="yoga-privacy">{user ? t('Tus prácticas y registros se guardan en tu cuenta.') : t('Tus prácticas y registros se guardan en este navegador. Exportá una copia desde Ajustes para conservarlos.')} <a href="/privacy">{t('Privacidad y datos')}</a></p>
    {editor && <YogaPracticeEditor key={editor.practice.id} {...editor} unavailable={unavailable} stale={!editor.isNew && JSON.stringify(practices.find(item => item.id === editor.practice.id)) !== JSON.stringify(editor.practice)} suspended={suspended || !!selected} onSave={savePractice} onClose={() => setEditor(null)} onInspect={setSelected} />}
    {session && <YogaSession key={session.id} practice={session} unavailable={unavailable} suspended={suspended} timeZone={timeZone} onSave={saveLog} onClose={() => setSession(null)} />}
    {selected && <AsanaDetail asana={selected} suspended={suspended} unavailable={unavailable} inEditor={!!editor} onClose={() => setSelected(null)} onCreate={() => newPractice(selected)} />}
    {deleting && <Modal title={t(deleting.kind === 'practice' ? 'Eliminar práctica' : 'Eliminar registro')} suspended={suspended} onClose={() => { if (!busy) setDeleting(null) }}><div className="yoga-confirm"><p>{t(deleting.kind === 'practice' ? 'Se eliminará esta secuencia guardada. Las prácticas que ya registraste se conservan en tu historial.' : 'Se eliminarán este registro y sus notas. La secuencia guardada en Mis prácticas se conserva.')}</p>{error && <p className="yoga-error" role="alert">{error}</p>}<div className="yoga-actions"><button className="secondary-button" disabled={busy} onClick={() => setDeleting(null)}>{t('Cancelar')}</button><button className="primary-button" disabled={busy} onClick={() => { void remove() }}>{busy ? t('Eliminando…') : t('Sí, eliminar')}</button></div></div></Modal>}
  </section>
}

function AsanaDetail({ asana, suspended, unavailable, inEditor, onClose, onCreate }: { asana: Asana; suspended: boolean; unavailable: boolean; inEditor: boolean; onClose: () => void; onCreate: () => void }) {
  const { t } = useTranslation('yoga')
  return <Modal title={asana.name} onClose={onClose} wide suspended={suspended}><article className="yoga-detail"><div className="yoga-detail-hero"><div className="yoga-detail-model"><Suspense fallback={<YogaAsanaArt asanaId={asana.id} eager />}><YogaViewer asanaId={asana.id} sideSelectable suspended={suspended} /></Suspense></div><div><span className="yoga-sanskrit">{asana.sanskritName}</span><p className="yoga-detail-intention">{asana.intention}</p><p>{asana.description}</p><div className="yoga-detail-badges"><span className="yoga-badge">{t(asana.family)}</span><span className="yoga-badge">{t(asana.level)}</span><span className="yoga-badge"><Icon name="clock" size={14} />{yogaDuration(asana.defaultHoldSeconds)} {!asana.bilateral && t('por lado')}</span></div><p className="yoga-fine">{t('Los tiempos son orientativos: podés salir antes, descansar o adaptar la postura.')}</p>{!asana.bilateral && <p className="yoga-side-guide"><strong>{t('Practicá ambos lados.')}</strong> {asana.sideGuide}</p>}</div></div>
    <div className="yoga-detail-columns"><section><h3><Icon name="body" size={20} />{t('Entrar y explorar')}</h3><h4>{t('Preparación')}</h4><ul>{asana.setup.map(text => <li key={text}>{text}</li>)}</ul><h4>{t('Paso a paso')}</h4><ol>{asana.steps.map(text => <li key={text}>{text}</li>)}</ol><h4>{t('Cómo salir')}</h4><ul>{asana.exit.map(text => <li key={text}>{text}</li>)}</ul></section><section><h3><Icon name="yoga" size={20} />{t('Qué observar')}</h3><div className="yoga-breath"><p>{asana.breathing}</p></div><h4>{t('Sensaciones esperables')}</h4><ul>{asana.sensations.map(text => <li key={text}>{text}</li>)}</ul><h4>{t('Para no forzar')}</h4><ul>{asana.mistakes.map(text => <li key={text}>{text}</li>)}</ul><h4>{t('Adaptaciones y apoyos')}</h4><ul>{asana.adaptations.map(text => <li key={text}>{text}</li>)}</ul></section></div>
    <section className="yoga-detail-cautions"><h3><Icon name="info" size={19} />{t('Cuidados para esta asana')}</h3><ul>{asana.cautions.map(text => <li key={text}>{text}</li>)}</ul></section>
    <div className="yoga-detail-context"><section><span className="eyebrow">{t('HISTORIA')}</span><h3>{t('De dónde viene')}</h3><p>{asana.history}</p></section><section><span className="eyebrow">{t('CONTEXTO CULTURAL')}</span><h3>{t('El nombre también cuenta')}</h3><p>{asana.culturalContext}</p></section></div>
    <section className="yoga-sources"><h3>{t('Fuentes y lecturas')}</h3><p className="yoga-fine">{t('Referencias para la práctica, la historia y el contexto. Las distintas tradiciones pueden enseñar variantes de una misma asana.')}</p>{asana.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<Icon name="arrow" size={15} /></a>)}</section>
    <div className="yoga-actions yoga-detail-footer">{inEditor ? <button className="primary-button" onClick={onClose}>{t('Volver a la práctica')}</button> : <><button className="secondary-button" onClick={onClose}>{t('Volver a la biblioteca')}</button><button className="primary-button" disabled={unavailable} onClick={onCreate}><Icon name="plus" size={17} />{t('Crear práctica con esta asana')}</button></>}</div>
  </article></Modal>
}
