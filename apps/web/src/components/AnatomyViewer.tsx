import { useTranslation } from 'react-i18next'
import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Color, Vector3 } from 'three'
import type { AnatomicalModelVariant } from '@klisteniapp/scene-schema'
import { selectAnatomicalModel, useAppStore } from '../lib/store'
import { EXERCISE_PHASES, getExercisePose } from '@klisteniapp/geometry'
import ExerciseStage from './ExerciseStage'
import { exerciseCycleSeconds, isAlternatingExercise } from '../lib/exercise-animation'
import { anatomyRendererOptions, anatomyShadows } from '../lib/anatomy-render-settings'
import './anatomy-viewer.css'

interface Props {
  modelVariant?: AnatomicalModelVariant
  exerciseId: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  selectedMuscle?: string | null
  onSelectMuscle?: (id: string | null) => void
  reducedMotion?: boolean
  initialMode?: 'movement' | 'anatomical'
  initialView?: View
}
type Layer = 'skin' | 'muscles' | 'skeleton' | 'combined'
type View = 'perspective' | 'front' | 'side' | 'back'
const muscleNames: Record<string, string> = {
  pectorals: 'Pectorales',
  deltoids: 'Deltoides',
  triceps: 'Tríceps',
  lats: 'Dorsales',
  biceps: 'Bíceps',
  'upper-back': 'Espalda alta',
  abdominals: 'Abdominales',
  obliques: 'Oblicuos',
  glutes: 'Glúteos',
  quadriceps: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  calves: 'Gemelos y sóleo',
}

function Camera({
  view,
  floor,
  reset,
}: {
  view: View
  floor: boolean
  reset: number
}) {
  const { camera, size } = useThree()
  const target = useMemo(
    () => new Vector3(0, floor ? 0.37 : 0.94, floor ? -0.1 : 0),
    [floor],
  )
  const position = useMemo(() => {
    if (view === 'front')
      return new Vector3(0, floor ? 2.2 : 1.0, floor ? 2.7 : 3.9)
    if (view === 'back')
      return new Vector3(0, floor ? 2.2 : 1.0, floor ? -2.8 : -3.9)
    if (view === 'side')
      return new Vector3(floor ? 3.0 : 3.9, floor ? 0.85 : 1.0, 0)
    return floor ? new Vector3(2.35, 1.5, 2.1) : new Vector3(2.4, 1.4, 3.1)
  }, [view, floor])
  useEffect(() => {
    const fit = floor ? Math.max(1.12, 1.6 / (size.width / size.height)) : 1
    camera.position.copy(position).sub(target).multiplyScalar(fit).add(target)
    camera.lookAt(target)
    camera.updateProjectionMatrix()
  }, [camera, position, target, reset, floor, size.width, size.height])
  return (
    <OrbitControls
      key={`${floor}-${reset}`}
      target={target}
      makeDefault
      enablePan
      minDistance={0.7}
      maxDistance={8}
      minPolarAngle={0.08}
      maxPolarAngle={Math.PI * 0.78}
      enableDamping
      dampingFactor={0.09}
    />
  )
}

/** Theme the live canvas without changing the reproducible capture studio. */
function LiveSceneBackground() {
  const { gl, scene, invalidate } = useThree()
  const background = useMemo(() => new Color(), [])
  useLayoutEffect(() => {
    const element = gl.domElement.closest('.anatomy-viewer')
    if (!element) return
    const previous = scene.background
    const sync = () => {
      const styles = getComputedStyle(element)
      const color = styles.getPropertyValue('--studio').trim() || styles.getPropertyValue('--surface-soft').trim()
      if (!color) return
      background.set(color)
      scene.background = background
      invalidate()
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-color-theme', 'style'] })
    return () => {
      observer.disconnect()
      if (scene.background === background) scene.background = previous
    }
  }, [background, gl, scene, invalidate])
  // The shared studio can reattach during scene updates; keep the live surface themed.
  useFrame(() => { if (scene.background !== background) scene.background = background }, -3)
  return null
}

function Scene({
  phaseRef,
  playing,
  speed,
  onProgress,
  view,
  cameraReset,
  layer,
  highlight,
  onReady,
  onInspectStructure,
  ...props
}: Props & {
  phaseRef: { current: number }
  playing: boolean
  speed: number
  onProgress: (phase: number) => void
  view: View
  cameraReset: number
  layer: Layer
  highlight: boolean
  onReady: () => void
  onInspectStructure: (name: string, region?: string) => void
}) {
  const last = useRef(0)
  const floor = getExercisePose(props.exerciseId, 0).floorExercise
  useFrame((state, delta) => {
    if (playing)
      phaseRef.current =
        (phaseRef.current +
          (Math.min(delta, 0.1) * speed) /
            exerciseCycleSeconds(props.exerciseId)) %
        1
    if (state.clock.elapsedTime - last.current > 0.09) {
      onProgress(phaseRef.current)
      last.current = state.clock.elapsedTime
    }
  }, -2)
  return (
    <>
      <Camera view={view} floor={floor} reset={cameraReset} />
      <ExerciseStage
        {...props}
        phaseRef={phaseRef}
        layer={layer}
        highlight={highlight}
        onReady={onReady}
        onInspectStructure={onInspectStructure}
      />
      <LiveSceneBackground />
    </>
  )
}

class Boundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function ControlIcon({
  name,
}: {
  name: 'play' | 'pause' | 'reset' | 'expand' | 'close' | 'eye'
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'play' ? (
        <path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none" />
      ) : name === 'pause' ? (
        <path d="M9 6v12M15 6v12" strokeWidth="3" />
      ) : name === 'expand' ? (
        <path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6" />
      ) : name === 'close' ? (
        <path d="m6 6 12 12M6 18 18 6" />
      ) : name === 'eye' ? (
        <>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" />
        </>
      )}
    </svg>
  )
}

export default function AnatomyViewer(props: Props) {
  const { t } = useTranslation('core')
  const preferredModel = useAppStore(selectAnatomicalModel)
  const modelVariant = props.modelVariant ?? preferredModel

  const [playing, setPlaying] = useState(
    () =>
      props.initialMode !== 'anatomical' &&
      !props.reducedMotion &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [phase, setPhase] = useState(0),
    [speed, setSpeed] = useState(1),
    [view, setView] = useState<View>(props.initialView ?? 'perspective')
  const [anatomy, setAnatomy] = useState(props.initialMode === 'anatomical'),
    [layer, setLayer] = useState<Layer>('muscles'),
    [highlight, setHighlight] = useState(false)
  const [visible, setVisible] = useState(true)
  const [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false),
    [expanded, setExpanded] = useState(false)
  const [cameraReset, setCameraReset] = useState(0),
    [structure, setStructure] = useState<{
      name: string
      region?: string
    } | null>(null)
  const phaseRef = useRef(0),
    viewer = useRef<HTMLElement>(null),
    expandButton = useRef<HTMLButtonElement>(null)
  const exerciseRef = useRef(props.exerciseId)
  useEffect(() => setStructure(null), [modelVariant])
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0 },
    )
    if (viewer.current) observer.observe(viewer.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (exerciseRef.current !== props.exerciseId) {
      phaseRef.current = 0
      setPhase(0)
      setStructure(null)
      exerciseRef.current = props.exerciseId
      if (!anatomy) setCameraReset((n) => n + 1)
    }
  }, [props.exerciseId, anatomy])
  useEffect(() => {
    if (props.reducedMotion) setPlaying(false)
  }, [props.reducedMotion])
  useEffect(() => {
    if (props.selectedMuscle && layer === 'skeleton') setLayer('muscles')
  }, [props.selectedMuscle, layer])
  useEffect(() => {
    if (!expanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpanded(false)
        expandButton.current?.focus()
      }
      if (e.key === 'Tab') {
        const elements = Array.from(
          viewer.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),a[href],summary',
          ) ?? [],
        ).filter(
          (element) =>
            element.getClientRects().length > 0 &&
            (!element.closest('details:not([open])') ||
              element.tagName === 'SUMMARY'),
        )
        if (e.shiftKey && document.activeElement === elements[0]) {
          e.preventDefault()
          elements.at(-1)?.focus()
        }
        if (!e.shiftKey && document.activeElement === elements.at(-1)) {
          e.preventDefault()
          elements[0]?.focus()
        }
      }
    }
    document.addEventListener('keydown', escape)
    expandButton.current?.focus()
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', escape)
    }
  }, [expanded])
  const scrub = (value: number) => {
    setAnatomy(false)
    phaseRef.current = value
    setPhase(value)
    setPlaying(false)
  }
  const phases = EXERCISE_PHASES[props.exerciseId] ?? [
    t("Movete con control"),
    t("Volvé al inicio"),
  ]
  const phaseIndex =
    props.exerciseId === 'paused-squat'
      ? phase < 5 / 6 ? 0 : 1
      : isAlternatingExercise(props.exerciseId)
      ? phase % 0.5 < 0.25
        ? 0
        : 1
      : phase < 0.5
        ? 0
        : 1
  const selected = props.selectedMuscle
    ? t(muscleNames[props.selectedMuscle] ?? props.selectedMuscle)
    : undefined
  const inspected =
    structure &&
    (structure.region
      ? structure.region === props.selectedMuscle
      : !props.selectedMuscle)
      ? structure.name
      : null
  return (
    <section
      ref={viewer}
      className={`viewer anatomy-viewer ${expanded ? 'anatomy-expanded' : ''}`}
      data-model={modelVariant}
      aria-label={t("Demostración 3D del ejercicio")}
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded || undefined}
    >
      <div className="anatomy-toolbar">
        <div>
          <span className="anatomy-live-dot" />
          <span>{t("ESTUDIO ANATÓMICO")}</span>
          <span className="anatomy-version">3D · {t(modelVariant === 'female' ? 'Mujer' : 'Hombre', { ns: 'settings' })}</span>
        </div>
        <button
          ref={expandButton}
          className="anatomy-icon-button"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? t("Cerrar vista ampliada") : t("Ampliar visor")}
          aria-expanded={expanded}
        >
          <ControlIcon name={expanded ? 'close' : 'expand'} />
        </button>
      </div>
      <div className="anatomy-layer-row">
        <div
          className="anatomy-layers"
          role="group"
          aria-label={t("Capas anatómicas")}
        >
          {(
            [
              ['skin', t("Piel")],
              ['muscles', t("Músculos")],
              ['skeleton', t("Huesos")],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setLayer(id)
                setStructure(null)
                if (id !== 'muscles') setHighlight(false)
                if (id === 'skeleton') props.onSelectMuscle?.(null)
              }}
              aria-pressed={layer === id}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="anatomy-activation"
          aria-label={t("Mostrar trabajo muscular")}
          aria-pressed={highlight}
          onClick={() => {
            if (!highlight) setLayer('muscles')
            setHighlight(!highlight)
          }}
        >
          <ControlIcon name="eye" />
          <span>{t("Trabajo muscular")}</span>
        </button>
      </div>
      <div className="viewer-stage anatomy-stage">
        {!failed && (
          <Boundary onError={() => setFailed(true)}>
            <Suspense fallback={null}>
              <Canvas
                frameloop={playing && !anatomy && visible ? 'always' : 'demand'}
                role="img"
                aria-label={t("Modelo anatómico interactivo. Usá los controles de capas, cámara y reproducción; la explicación textual está debajo.")}
                camera={{
                  position: [2.4, 1.4, 3.1],
                  fov: 32,
                  near: 0.01,
                  far: 80,
                }}
                dpr={[1, 1.75]}
                shadows={anatomyShadows}
                gl={{
                  ...anatomyRendererOptions,
                  powerPreference: 'high-performance',
                }}
              >
                <Suspense fallback={null}>
                  <Scene
                    {...props}
                    modelVariant={modelVariant}
                    exerciseId={anatomy ? 'anatomy' : props.exerciseId}
                    phaseRef={phaseRef}
                    playing={playing && !anatomy && loaded && visible}
                    speed={speed}
                    onProgress={setPhase}
                    view={view}
                    cameraReset={cameraReset}
                    layer={layer}
                    highlight={highlight}
                    onReady={() => setLoaded(true)}
                    onInspectStructure={(name, region) => {
                      if (!region) props.onSelectMuscle?.(null)
                      setStructure({ name, region })
                    }}
                  />
                </Suspense>
              </Canvas>
            </Suspense>
          </Boundary>
        )}
        {!loaded && !failed && (
          <div className="anatomy-loading" role="status">
            <span className="anatomy-loader" />
            <strong>{t("Preparando la anatomía")}</strong>
            <p>{t("Cargando músculos, huesos y superficie corporal.")}</p>
          </div>
        )}
        {failed && (
          <div className="viewer-fallback">
            <strong>{t("Vista 3D no disponible")}</strong>
            <p>{t("No pudimos cargar el modelo en este dispositivo. Las instrucciones y los músculos siguen disponibles debajo.")}</p>
          </div>
        )}
        <div className="anatomy-stage-top">
          <span className="anatomy-phase">
            <i>{anatomy ? '◎' : phaseIndex === 0 ? '01' : '02'}</i>
            {anatomy ? t("Posición anatómica") : t(phases[phaseIndex] ?? "Movete con control")}
          </span>
          <div
            className="anatomy-mode"
            role="group"
            aria-label={t("Contenido del visor")}
          >
            <button aria-pressed={!anatomy} onClick={() => setAnatomy(false)}>{t("Movimiento")}</button>
            <button aria-pressed={anatomy} onClick={() => setAnatomy(true)}>{t("Anatomía")}</button>
          </div>
        </div>
        {(selected || inspected) && (
          <div className="anatomy-selection">
            <span />
            <div>
              <strong>{selected ?? 'Estructura anatómica'}</strong>
              {inspected && (
                <small>
                  {inspected.replace(/\.[lr]$/, (m) =>
                    m === '.l' ? t(" · izquierda") : t(" · derecha"),
                  )}
                </small>
              )}
            </div>
            <button
              className="anatomy-icon-button"
              aria-label={t("Quitar selección anatómica")}
              onClick={() => {
                props.onSelectMuscle?.(null)
                setStructure(null)
              }}
            >
              <ControlIcon name="close" />
            </button>
          </div>
        )}
        <div className="anatomy-stage-bottom">
          <span className="anatomy-interaction-hint">{t("Arrastrá para girar · pellizcá para acercar")}</span>
          <div
            className="viewer-camera anatomy-camera"
            aria-label={t("Ángulo de cámara")}
          >
            {(
              [
                ['perspective', '3D'],
                ['front', t("Frente")],
                ['side', t("Perfil")],
                ['back', t("Espalda")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                aria-pressed={view === id}
                onClick={() => {
                  setView(id)
                  setCameraReset((n) => n + 1)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="viewer-controls anatomy-controls">
        <button
          className="viewer-play"
          aria-label={
            playing && !anatomy
              ? t("Pausar demostración")
              : t("Reproducir demostración")
          }
          onClick={() => {
            setAnatomy(false)
            setPlaying(anatomy ? true : !playing)
          }}
          disabled={!loaded || failed}
        >
          <ControlIcon name={playing && !anatomy ? 'pause' : 'play'} />
        </button>
        <div className="viewer-timeline">
          <div>
            <span>
              {anatomy
                ? t("Estudiá la forma y las relaciones")
                : t("El movimiento, a tu ritmo")}
            </span>
            <span>{Math.round(phase * 100)}%</span>
          </div>
          <input
            aria-label={t("Posición de la demostración")}
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={phase}
            onChange={(e) => scrub(Number(e.target.value))}
            disabled={!loaded || failed}
          />
        </div>
        <button
          className="viewer-speed"
          aria-label={t("Velocidad {{speed}}. Cambiar velocidad", { speed })}
          onClick={() => setSpeed(speed === 1 ? 0.5 : 1)}
        >
          {speed === 1 ? '1×' : '½×'}
        </button>
        <button
          className="viewer-reset"
          aria-label={t("Reiniciar demostración")}
          onClick={() => {
            scrub(0)
            setCameraReset((n) => n + 1)
          }}
        >
          <ControlIcon name="reset" />
        </button>
      </div>
      <div className="anatomy-legend">
        {highlight ? (
          <>
            <span>
              <i className="anatomy-primary" />{t("Músculo principal")}</span>
            <span>
              <i className="anatomy-secondary" />{t("Apoyo y estabilización")}</span>
          </>
        ) : (
          <span>{t("Color de los tejidos · tocá una región para identificarla")}</span>
        )}
      </div>
      <details className="anatomy-provenance">
        <summary>{t("Geometría anatómica y precisión")}<span>↗</span>
        </summary>
        <p>{t("Superficie corporal, músculos y huesos del atlas")}{' '}
          <strong>Z-Anatomy / BodyParts3D</strong>{t(". Las capas conservan sus relaciones en la posición anatómica. El movimiento es una animación educativa; no representa una medición de tu cuerpo ni una simulación biomecánica validada.")}</p>
        {modelVariant === 'female' && <p>{t('Variante corporal ilustrativa; no es un atlas específico de anatomía femenina.', { ns: 'settings' })}</p>}
        <a href="/models/NOTICE.md" target="_blank" rel="noreferrer">{t("Fuentes, modificaciones y licencia CC BY-SA 4.0 ↗")}</a>
      </details>
    </section>
  )
}
