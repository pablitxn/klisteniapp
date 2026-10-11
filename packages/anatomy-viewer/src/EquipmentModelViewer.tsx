import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, OrbitControls, useGLTF } from '@react-three/drei'
import { isEquipmentModelUrl } from './equipment-resource.ts'

export interface EquipmentModelViewerProps {
  url: string
  label: string
  attribution?: string
  height?: number
  className?: string
  fallback?: ReactNode
  format?: 'glb'
}

class EquipmentBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function StaticEquipment({ url, onReady }: { url: string; onReady: () => void }) {
  const gltf = useGLTF(url)
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  useEffect(onReady, [onReady])
  // Loader-cache resources are shared; unmounting one card must not dispose another's model.
  return <primitive object={scene} dispose={null} />
}

function EquipmentContent({ url, label, attribution, height = 320, className, fallback, format }: EquipmentModelViewerProps) {
  const [active, setActive] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const onReady = useMemo(() => () => setReady(true), [])
  const alternative = fallback ?? <p role="status">Vista 3D no disponible para {label}. Consultá las fotos y las instrucciones del equipo.</p>
  if (!isEquipmentModelUrl(url, format)) return <div className={className}>{alternative}</div>
  return <figure className={className} style={{ margin: 0 }} data-equipment-model={label}>
    {active && <EquipmentBoundary fallback={alternative} onFailure={() => setFailed(true)}>
      <div style={{ height, width: '100%', position: 'relative' }} role="group" aria-label={`Modelo 3D de ${label}`} aria-busy={!ready}>
        {/* Canvas always mounts its native fallback children, even with WebGL.
            Only a resolved model can end loading; renderer failures reach the boundary. */}
        <Canvas camera={{ position: [3, 2, 3], fov: 45 }} dpr={[1, 1.5]} fallback={alternative}>
          <color attach="background" args={['#172526']} />
          <ambientLight intensity={1.2} />
          <hemisphereLight args={['#ffffff', '#5c6e69', 1.3]} />
          <directionalLight position={[3, 4, 3]} intensity={2.5} />
          <Suspense fallback={null}><Bounds fit clip observe margin={1.3}><StaticEquipment url={url} onReady={onReady} /></Bounds></Suspense>
          <OrbitControls makeDefault enablePan={false} />
        </Canvas>
        {!ready && <span role="status" style={{ position: 'absolute', top: 8, left: 8 }}>Cargando modelo del equipo…</span>}
      </div>
    </EquipmentBoundary>}
    {/* Keep this control mounted so keyboard focus survives toggles and failures. */}
    <button type="button" aria-expanded={active} onClick={() => {
      // useGLTF also caches rejected requests. Evict only failed entries so a
      // manual retry can recover without disposing another card's loaded model.
      if (active && failed) useGLTF.clear(url)
      setActive(!active); setReady(false); setFailed(false)
    }}>{active ? 'Cerrar vista 3D' : `Ver ${label} en 3D`}</button>
    {attribution && <figcaption>{attribution}</figcaption>}
  </figure>
}

/** A static, optional machine resource. Never generates a workout animation or loads before a click. */
export function EquipmentModelViewer(props: EquipmentModelViewerProps) {
  return <EquipmentContent key={props.url} {...props} />
}
