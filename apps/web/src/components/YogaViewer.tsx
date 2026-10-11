import { Component, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { AnatomicalModelVariant, YogaAsanaId, YogaPracticeStep } from '@klisteniapp/scene-schema'
import { Box3, FileLoader } from 'three'
import { getAsana } from '../data/yoga'
import { selectAnatomicalModel, useAppStore } from '../lib/store'
import { yogaPreviewSide } from '../lib/yoga-preview-assets'
import { anatomyRendererOptions, anatomyShadows } from '../lib/anatomy-render-settings'
import type { YogaLayer, YogaView } from '../lib/yoga-rendering'
import { YOGA_HOLD_PHASE, YOGA_MOTION_DURATION_SECONDS, yogaMotionPhaseLabel } from '../lib/yoga-motion'
import { createMovementClock } from '../lib/movement-clock'
import YogaStage, { YogaCamera } from './YogaStage'
import YogaAsanaArt from './YogaAsanaArt'
import Icon from './Icon'
import './yoga-viewer.css'

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() { return this.state.failed ? null : this.props.children }
}

function ContextGuard({ onError }: { onError: () => void }) {
  const { gl } = useThree()
  useEffect(() => {
    function lost(event: Event) { event.preventDefault(); onError() }
    const canvas = gl.domElement
    canvas.addEventListener('webglcontextlost', lost)
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [gl, onError])
  return null
}

/** This clock only demonstrates movement; it never writes practice time. */
function MovementClock({ clock, phaseRef, playing, speed, phase, onPhase }: {
  clock: ReturnType<typeof createMovementClock>
  phaseRef: { current: number }
  playing: boolean
  speed: number
  phase: number
  onPhase: (phase: number) => void
}) {
  const { invalidate } = useThree()
  const publishedAt = useRef(0)
  useEffect(() => { clock.configure(performance.now(), playing, speed) }, [clock, playing, speed])
  useEffect(() => { invalidate() }, [phase, playing, speed, invalidate])
  // Advance before YogaStage (-1), keeping capture and live poses identical.
  useFrame(() => {
    const now = performance.now()
    if (!playing || document.hidden) { clock.reset(now); return }
    phaseRef.current = clock.advance(phaseRef.current, now)
    if (now - publishedAt.current >= 100) {
      publishedAt.current = now
      onPhase(phaseRef.current)
    }
  }, -2)
  return null
}

export default function YogaViewer({ asanaId, side = 'both', modelVariant, sideSelectable = false, suspended = false, compact = false }: {
  asanaId: YogaAsanaId
  side?: YogaPracticeStep['side']
  modelVariant?: AnatomicalModelVariant
  sideSelectable?: boolean
  suspended?: boolean
  compact?: boolean
}) {
  const { t } = useTranslation('yoga')
  const root = useRef<HTMLElement>(null)
  const preferredModel = useAppStore(selectAnatomicalModel)
  const reducedMotion = useAppStore(s => s.preferences.reducedMotion)
  const [systemReducedMotion, setSystemReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden)
  const [visible, setVisible] = useState(true)
  const model = modelVariant ?? preferredModel
  const [selectedSide, setSelectedSide] = useState(side)
  const shownSide = yogaPreviewSide(asanaId, sideSelectable ? selectedSide : side)
  const key = `${asanaId}:${model}:${shownSide}`
  const [activated, setActivated] = useState(false)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [readyKey, setReadyKey] = useState<string | null>(null)
  const [bounds, setBounds] = useState<Box3 | null>(null)
  const [view, setView] = useState<YogaView>('perspective')
  const [layer, setLayer] = useState<YogaLayer>('muscles')
  const [reset, setReset] = useState(0)
  const [clock] = useState(() => createMovementClock(YOGA_MOTION_DURATION_SECONDS))
  const phaseRef = useRef(YOGA_HOLD_PHASE)
  const [phase, setPhase] = useState(YOGA_HOLD_PHASE)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const failed = failedKey === key
  const ready = readyKey === key && !failed
  const motionPlaying = playing && ready && activated && !suspended && documentVisible && visible
  const onReady = useCallback((nextBounds: Box3) => { setBounds(nextBounds); setReadyKey(key) }, [key])
  const pause = useCallback(() => { setPlaying(false); setPhase(phaseRef.current) }, [])
  const onPhase = useCallback((nextPhase: number) => setPhase(nextPhase), [])
  const onError = useCallback(() => { setFailedKey(key); setReadyKey(null); pause() }, [key, pause])
  const asana = getAsana(asanaId)!
  const phaseLabel = t(yogaMotionPhaseLabel(phase))

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    function motionPreference() { setSystemReducedMotion(media.matches); if (media.matches) pause() }
    function visibility() { setDocumentVisible(!document.hidden); if (document.hidden) pause() }
    media.addEventListener('change', motionPreference)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      media.removeEventListener('change', motionPreference)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [pause])
  useEffect(() => {
    if (suspended || reducedMotion) pause()
  }, [suspended, reducedMotion, pause])
  useEffect(() => {
    const element = root.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => {
      const nextVisible = Boolean(entry?.isIntersecting)
      setVisible(nextVisible)
      if (!nextVisible) pause()
    }, { threshold: 0.05 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [pause])
  useEffect(() => {
    // Changing the demonstrated posture keeps the selected side explicit.
    phaseRef.current = reducedMotion || systemReducedMotion ? YOGA_HOLD_PHASE : 0
    clock.reset(performance.now())
    setPhase(phaseRef.current)
  }, [asanaId, shownSide, reducedMotion, systemReducedMotion, clock])

  function activate() {
    // Failed loader promises are cached; a retry must be able to fetch again.
    if (failed) {
      useGLTF.clear('/models/anatomy.glb')
      useLoader.clear(FileLoader, '/models/rig-landmarks.json')
    }
    phaseRef.current = reducedMotion || systemReducedMotion ? YOGA_HOLD_PHASE : 0
    clock.reset(performance.now())
    setPhase(phaseRef.current)
    setPlaying(!reducedMotion && !systemReducedMotion && !suspended && !document.hidden)
    setFailedKey(null); setReadyKey(null); setActivated(true)
  }
  function seek(nextPhase: number) {
    phaseRef.current = nextPhase
    clock.reset(performance.now())
    setPhase(nextPhase)
    setPlaying(false)
  }
  function restart() {
    phaseRef.current = 0
    clock.reset(performance.now())
    setPhase(0)
  }
  return <section ref={root} className={`yoga-anatomy-viewer${compact ? ' yoga-viewer-compact' : ''}`} data-asana={asanaId} data-model={model} data-side={shownSide} data-playback={motionPlaying ? 'playing' : 'paused'} data-phase={phase.toFixed(3)} aria-label={t('Vista anatómica 3D de {{name}}', { name: asana.name })}>
    <div className="yoga-viewer-heading"><span>{t('ASANA EN 3D')}</span><span>{t(model === 'female' ? 'Mujer' : 'Hombre', { ns: 'settings' })}{shownSide !== 'both' && ` · ${t(shownSide === 'left' ? 'Izquierdo' : 'Derecho')}`}</span></div>
    {sideSelectable && !asana.bilateral && <div className="yoga-viewer-sides" role="group" aria-label={t('Lado de la asana')}>{(['left', 'right'] as const).map(value => <button key={value} aria-pressed={shownSide === value} onClick={() => setSelectedSide(value)}>{t(value === 'left' ? 'Lado izquierdo' : 'Lado derecho')}</button>)}</div>}
    <div className={`yoga-viewer-stage${ready && activated ? ' is-ready' : ''}`}>
      <YogaAsanaArt asanaId={asanaId} side={shownSide} modelVariant={model} eager animated={false} />
      {activated && !failed && <SceneBoundary onError={onError}><div className="yoga-viewer-canvas"><Canvas orthographic frameloop={suspended ? 'never' : motionPlaying ? 'always' : 'demand'} dpr={[1, 1.5]} camera={{ position: [3, 2, 4], near: 0.01, far: 80 }} shadows={anatomyShadows} gl={{ ...anatomyRendererOptions, powerPreference: 'high-performance' }} role="img" aria-label={t('Modelo 3D de {{name}}. Girá la cámara o elegí una vista con los controles.', { name: asana.name })}>
        <ContextGuard onError={onError} />
        <MovementClock clock={clock} phaseRef={phaseRef} playing={motionPlaying} speed={speed} phase={phase} onPhase={onPhase} />
        <Suspense fallback={null}><YogaStage asanaId={asanaId} side={shownSide} modelVariant={model} layer={layer} phaseRef={phaseRef} onReady={onReady} /><YogaCamera bounds={bounds} asanaId={asanaId} side={shownSide} view={view} reset={reset} /></Suspense>
      </Canvas></div></SceneBoundary>}
      {!activated && <button className="yoga-viewer-activate" onClick={activate}><Icon name="body" size={17} />{t('Explorar en 3D')}</button>}
      {activated && !ready && !failed && <div className="yoga-viewer-loading" role="status">{t('Cargando el modelo 3D…')}</div>}
    </div>
    {failed && <div className="yoga-viewer-fallback" role="status"><p>{t('El visor 3D no está disponible en este navegador. La imagen muestra la misma postura y el mismo modelo.')}</p><button className="text-button" onClick={activate}>{t('Reintentar 3D')}</button></div>}
    {activated && !failed && <>
      <div className="yoga-motion-controls" role="group" aria-label={t('Movimiento de la asana')}>
        <div className="yoga-motion-transport">
          <button className="yoga-motion-play" disabled={!ready || suspended} onClick={() => motionPlaying ? pause() : setPlaying(true)} aria-label={t(motionPlaying ? 'Pausar movimiento' : 'Reproducir movimiento')}><span aria-hidden="true" className="yoga-motion-symbol">{motionPlaying ? 'Ⅱ' : <Icon name="play" size={16} />}</span>{t(motionPlaying ? 'Pausar' : 'Reproducir')}</button>
          <button className="yoga-motion-restart" disabled={!ready || suspended} onClick={restart} aria-label={t('Reiniciar movimiento')}><Icon name="reset" size={16} /></button>
          <label><span>{t('Velocidad')}</span><select aria-label={t('Velocidad del movimiento')} value={speed} disabled={!ready} onChange={event => setSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option></select></label>
        </div>
        <div className="yoga-motion-phase"><span>{phaseLabel}</span><span>{t('Ciclo de {{seconds}} s', { seconds: YOGA_MOTION_DURATION_SECONDS })}</span></div>
        <input className="yoga-motion-seek" type="range" min={0} max={1} step={0.001} value={phase} disabled={!ready} aria-label={t('Recorrido del movimiento')} aria-valuetext={`${phaseLabel} · ${Math.round(phase * 100)}%`} onChange={event => seek(Number(event.target.value))} />
        <p>{t(compact ? 'Esta demostración no modifica el temporizador de tu práctica.' : 'El movimiento se repite. Ver la demostración no registra tiempo de práctica.')}</p>
      </div>
      <div className="yoga-viewer-controls"><div className="yoga-viewer-views" role="group" aria-label={t('Vistas de la cámara')}>{([['perspective', 'Vista 3D'], ['front', 'Frontal'], ['side', 'Lateral'], ['back', 'Posterior']] as const).map(([value, label]) => <button key={value} disabled={!ready} aria-pressed={view === value} onClick={() => setView(value)}>{t(label)}</button>)}<button className="yoga-viewer-reset" disabled={!ready} onClick={() => setReset(value => value + 1)} aria-label={t('Restablecer vista')}><Icon name="reset" size={17} /></button></div><label>{t('Capa del modelo')}<select value={layer} disabled={!ready} onChange={event => setLayer(event.target.value as YogaLayer)}><option value="muscles">{t('Músculos')}</option><option value="skin">{t('Piel')}</option><option value="skeleton">{t('Esqueleto')}</option><option value="combined">{t('Combinado')}</option></select></label><p>{t('Arrastrá para girar. Acercá con la rueda o con dos dedos.')}</p></div>
    </>}
    <p className="yoga-viewer-caption">{t('Movimiento 3D orientativo del atlas anatómico. Adaptá el rango y los apoyos a tu cuerpo.')}</p>
  </section>
}
