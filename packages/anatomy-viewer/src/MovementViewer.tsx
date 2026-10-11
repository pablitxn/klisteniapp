import { Component, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { localAssets, type AssetResolver } from '@klisteniapp/model-assets'
import type { AnatomicalModelVariant } from '@klisteniapp/scene-schema'
import ExerciseStage from './ExerciseStage'
import { anatomyRendererOptions, anatomyShadows } from './anatomy-render-settings.ts'
import { getMovementDefinition } from './movement-library.ts'
import { exerciseCycleSeconds } from './exercise-animation.ts'
import { ExercisePreview } from './ExercisePreview'

export interface MovementViewerProps {
  exerciseId: string
  modelVariant?: AnatomicalModelVariant
  assetResolver?: AssetResolver
  fallback?: ReactNode
  height?: number
  playing?: boolean
  reducedMotion?: boolean
  layer?: 'skin' | 'muscles' | 'skeleton' | 'combined'
  highlight?: boolean
  className?: string
}

class ViewerBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function MovementScene({ definition, playing, modelVariant, assetResolver, layer, highlight, onReady }: {
  definition: NonNullable<ReturnType<typeof getMovementDefinition>>
  playing: boolean
  modelVariant: AnatomicalModelVariant
  assetResolver: AssetResolver
  layer: NonNullable<MovementViewerProps['layer']>
  highlight: boolean
  onReady: () => void
}) {
  const phaseRef = useRef(0)
  const { camera, size } = useThree()
  const config = definition.camera
  useEffect(() => {
    camera.position.set(...config.position)
    camera.lookAt(...config.target)
    if ('zoom' in camera) camera.zoom = Math.min(size.height, size.width) / config.height
    camera.updateProjectionMatrix()
  }, [camera, config, size.width, size.height])
  useFrame((_state, delta) => {
    if (playing && !document.hidden) phaseRef.current = (phaseRef.current + Math.min(delta, 0.1) / exerciseCycleSeconds(definition.exercise.id)) % 1
  }, -2)
  return <>
    <OrbitControls target={config.target} enablePan={false} minZoom={30} maxZoom={450} />
    <ExerciseStage exerciseId={definition.exercise.id} modelVariant={modelVariant} assetResolver={assetResolver} phaseRef={phaseRef} primaryMuscles={definition.exercise.primaryMuscles} secondaryMuscles={definition.exercise.secondaryMuscles} layer={layer} highlight={highlight} onReady={onReady} />
  </>
}

function AvailableMovement({ definition, modelVariant = 'male', assetResolver = localAssets, fallback, height = 360, playing = true, reducedMotion = false, layer = 'muscles', highlight = true, className }: MovementViewerProps & { definition: NonNullable<ReturnType<typeof getMovementDefinition>> }) {
  const [paused, setPaused] = useState(false)
  const [systemReduced, setSystemReduced] = useState(true)
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setSystemReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const alternative = fallback ?? <div><ExercisePreview exerciseId={definition.exercise.id} modelVariant={modelVariant} assetResolver={assetResolver} /><p>{definition.exercise.description}</p></div>
  return <figure className={className} style={{ margin: 0 }} data-movement={definition.exercise.id} data-model-variant={modelVariant}>
    <ViewerBoundary fallback={alternative}>
      <div style={{ height, width: '100%', position: 'relative' }}>
        {/* Native canvas fallback children mount even while the GLB is loading. */}
        <Canvas orthographic camera={{ position: definition.camera.position, zoom: height / definition.camera.height, near: 0.01, far: 80 }} dpr={[1, 1.5]} shadows={anatomyShadows} gl={anatomyRendererOptions} fallback={alternative}>
          <Suspense fallback={null}><MovementScene definition={definition} playing={playing && !paused && !reducedMotion && !systemReduced} modelVariant={modelVariant} assetResolver={assetResolver} layer={layer} highlight={highlight} onReady={onReady} /></Suspense>
        </Canvas>
        {!ready && <span role="status" style={{ position: 'absolute', top: 8, left: 8 }}>Cargando vista 3D…</span>}
      </div>
      {playing && !reducedMotion && !systemReduced && <button type="button" onClick={() => setPaused(value => !value)}>{paused ? 'Reproducir movimiento' : 'Pausar movimiento'}</button>}
    </ViewerBoundary>
    <figcaption>Referencia educativa · <a href={assetResolver('models/NOTICE.md')}>Créditos del modelo</a></figcaption>
  </figure>
}

/** Only the known movement library can enter the rig; arbitrary B2B IDs cannot fall through to a squat. */
export function MovementViewer(props: MovementViewerProps) {
  const definition = getMovementDefinition(props.exerciseId)
  if (!definition) return <div className={props.className} data-movement-unavailable={props.exerciseId}>{props.fallback ?? 'Este ejercicio todavía no tiene una demostración 3D.'}</div>
  return <AvailableMovement key={`${props.exerciseId}:${props.modelVariant}:${props.assetResolver?.('models/anatomy.glb') ?? ''}`} {...props} definition={definition} />
}
