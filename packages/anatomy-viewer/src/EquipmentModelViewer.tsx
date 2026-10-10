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
}

class EquipmentBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function StaticEquipment({ url, onReady }: { url: string; onReady: () => void }) {
  const gltf = useGLTF(url)
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  useEffect(onReady, [onReady])
  // Loader-cache resources are shared; unmounting one card must not dispose another's model.
  return <primitive object={scene} dispose={null} />
}

function UnavailableEquipment({ children, onReady }: { children: ReactNode; onReady: () => void }) {
  useEffect(onReady, [onReady])
  return <>{children}</>
}

function EquipmentContent({ url, label, attribution, height = 320, className, fallback }: EquipmentModelViewerProps) {
  const [active, setActive] = useState(false)
  const [ready, setReady] = useState(false)
  const onReady = useMemo(() => () => setReady(true), [])
  const alternative = fallback ?? <p role="status">Vista 3D no disponible para {label}. Consultá las fotos y las instrucciones del equipo.</p>
  if (!isEquipmentModelUrl(url)) return <div className={className}>{alternative}</div>
  return <figure className={className} style={{ margin: 0 }} data-equipment-model={label}>
    {!active ? <button type="button" onClick={() => setActive(true)}>Ver {label} en 3D</button> : <EquipmentBoundary fallback={alternative}>
      <div style={{ height, width: '100%', position: 'relative' }} role="group" aria-label={`Modelo 3D de ${label}`} aria-busy={!ready}>
        <Canvas camera={{ position: [3, 2, 3], fov: 45 }} dpr={[1, 1.5]} fallback={<UnavailableEquipment onReady={onReady}>{alternative}</UnavailableEquipment>}>
          <color attach="background" args={['#172526']} />
          <ambientLight intensity={1.2} />
          <hemisphereLight args={['#ffffff', '#5c6e69', 1.3]} />
          <directionalLight position={[3, 4, 3]} intensity={2.5} />
          <Suspense fallback={null}><Bounds fit clip observe margin={1.3}><StaticEquipment url={url} onReady={onReady} /></Bounds></Suspense>
          <OrbitControls makeDefault enablePan={false} />
        </Canvas>
        {!ready && <span role="status" style={{ position: 'absolute', top: 8, left: 8 }}>Cargando modelo del equipo…</span>}
      </div>
      <button type="button" onClick={() => { setActive(false); setReady(false) }}>Cerrar vista 3D</button>
    </EquipmentBoundary>}
    {attribution && <figcaption>{attribution}</figcaption>}
  </figure>
}

/** A static, optional machine resource. Never generates a workout animation or loads before a click. */
export function EquipmentModelViewer(props: EquipmentModelViewerProps) {
  return <EquipmentContent key={props.url} {...props} />
}
