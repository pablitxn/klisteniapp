import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ExerciseIdSchema } from '@klisteniapp/scene-schema'
import { getExercise } from './data/exercises'
import ExerciseStage from './components/ExerciseStage'
import { previewCameras } from './lib/exercise-preview-config'
import { anatomyRendererOptions, anatomyShadows } from './lib/anatomy-render-settings'

declare global {
  interface Window {
    __exerciseCapture?: { frame: (phase: number) => Promise<string> }
  }
}

const id = ExerciseIdSchema.parse(new URLSearchParams(location.search).get('exercise'))
const config = previewCameras[id]
const exercise = getExercise(id)!

export default function CaptureScene() {
  const { gl, scene, camera, invalidate } = useThree()
  const phaseRef = useRef(0)
  const pending = useRef<((png: string) => void) | null>(null)
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])
  useEffect(() => {
    camera.lookAt(...config.target)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate])
  useEffect(() => {
    if (!ready) return
    window.__exerciseCapture = {
      frame: (phase) => new Promise((resolve, reject) => {
        if (!Number.isFinite(phase) || phase < 0 || phase > 1 || pending.current) {
          reject(new Error('Invalid phase or overlapping capture'))
          return
        }
        phaseRef.current = phase
        pending.current = resolve
        invalidate()
      }),
    }
    return () => { delete window.__exerciseCapture }
  }, [ready, invalidate])
  // Runs AFTER AnatomicalModel's pose update (-1) and studio environment (0).
  // Capture is tied to the rendered phase, never to a wall-clock sleep.
  useFrame(() => {
    gl.render(scene, camera)
    if (pending.current) {
      const resolve = pending.current
      pending.current = null
      resolve(gl.domElement.toDataURL('image/png'))
    }
  }, 1)
  return <ExerciseStage
    exerciseId={id}
    phaseRef={phaseRef}
    primaryMuscles={exercise.primaryMuscles}
    secondaryMuscles={exercise.secondaryMuscles}
    layer="muscles"
    highlight={false}
    onReady={onReady}
  />
}

// A separate Vite development entry, absent from the production application.
createRoot(document.getElementById('root')!).render(
  <Canvas
    orthographic
    frameloop="demand"
    dpr={1}
    camera={{ position: config.position, zoom: innerHeight / config.height, near: 0.01, far: 80 }}
    shadows={anatomyShadows}
    gl={{ ...anatomyRendererOptions, preserveDrawingBuffer: true }}
  >
    <Suspense fallback={null}><CaptureScene /></Suspense>
  </Canvas>,
)
