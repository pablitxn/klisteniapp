import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AnatomicalModelVariantSchema, YogaAsanaIdSchema, YogaSideSchema } from '@klisteniapp/scene-schema'
import { Box3, OrthographicCamera } from 'three'
import YogaStage, { YogaCamera } from './components/YogaStage'
import { yogaPreviewSide } from './lib/yoga-preview-assets'
import { anatomyRendererOptions, anatomyShadows } from './lib/anatomy-render-settings'
import { YOGA_HOLD_PHASE } from './lib/yoga-motion'
import type { YogaLayer, YogaView } from './lib/yoga-rendering'

interface YogaCapture {
  png: string
  asanaId: string
  modelVariant: string
  side: string
  phase: number
  bounds: { min: number[]; max: number[] }
  camera: { position: number[]; quaternion: number[]; zoom: number; left: number; right: number; top: number; bottom: number }
}
declare global {
  interface Window { __yogaCapture?: { frame: (phase?: number) => Promise<YogaCapture> } }
}

const params = new URLSearchParams(location.search)
const asanaId = YogaAsanaIdSchema.parse(params.get('asana'))
const modelVariant = AnatomicalModelVariantSchema.parse(params.get('model') ?? 'male')
const side = yogaPreviewSide(asanaId, YogaSideSchema.parse(params.get('side') ?? 'both'))
const layer = (params.get('layer') ?? 'muscles') as YogaLayer
const view = (params.get('view') ?? 'perspective') as YogaView
if (!['skin', 'muscles', 'skeleton', 'combined'].includes(layer)) throw new Error('Invalid yoga capture layer')
if (!['perspective', 'front', 'side', 'back'].includes(view)) throw new Error('Invalid yoga capture view')

export default function CaptureScene() {
  const { gl, scene, camera, invalidate } = useThree()
  const [bounds, setBounds] = useState<Box3 | null>(null)
  const pending = useRef<((capture: YogaCapture) => void) | null>(null)
  const phaseRef = useRef(YOGA_HOLD_PHASE)
  const onReady = useCallback((value: Box3) => setBounds(value), [])
  useEffect(() => {
    if (!bounds) return
    window.__yogaCapture = { frame: (phase = YOGA_HOLD_PHASE) => new Promise((resolve, reject) => {
      if (pending.current || !Number.isFinite(phase) || phase < 0 || phase > 1) { reject(new Error('Invalid phase or overlapping yoga capture')); return }
      phaseRef.current = phase
      pending.current = resolve
      invalidate()
    }) }
    return () => { delete window.__yogaCapture }
  }, [bounds, invalidate])
  // Shared Stage applies the pose before this render, and YogaCamera fits it.
  useFrame(() => {
    gl.render(scene, camera)
    if (!pending.current || !bounds || !(camera instanceof OrthographicCamera)) return
    const resolve = pending.current
    pending.current = null
    resolve({
      png: gl.domElement.toDataURL('image/png'), asanaId, modelVariant, side, phase: phaseRef.current,
      bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
      camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), zoom: camera.zoom,
        left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom },
    })
  }, 1)
  return <>
    <YogaStage asanaId={asanaId} modelVariant={modelVariant} side={side} phaseRef={phaseRef} layer={layer} onReady={onReady} />
    <YogaCamera bounds={bounds} asanaId={asanaId} side={side} view={view} interactive={false} />
  </>
}

// Development-only capture entry, absent from the production bundle.
createRoot(document.getElementById('root')!).render(
  <Canvas orthographic frameloop="demand" dpr={1} camera={{ position: [3, 2, 4], near: 0.01, far: 80 }}
    shadows={anatomyShadows} gl={{ ...anatomyRendererOptions, preserveDrawingBuffer: true }}>
    <Suspense fallback={null}><CaptureScene /></Suspense>
  </Canvas>,
)
