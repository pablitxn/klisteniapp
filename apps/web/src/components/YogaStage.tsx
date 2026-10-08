import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, RoundedBox, useGLTF } from '@react-three/drei'
import { Box3, FileLoader, OrthographicCamera, Shape, Vector3 } from 'three'
import type { AnatomicalModelVariant, YogaAsanaId } from '@klisteniapp/scene-schema'
import { prepareYogaAnatomy } from '../lib/yoga-anatomy'
import { parseAnatomyLandmarks } from '../lib/anatomy-rig'
import { applyYogaPose, type YogaProp } from '../lib/yoga-rig'
import { applyYogaMotion, createYogaMotion, YOGA_HOLD_PHASE } from '../lib/yoga-motion'
import { fitYogaCamera, measureYogaBounds, type YogaLayer, type YogaSide, type YogaView } from '../lib/yoga-rendering'

const matExtrusion = { depth: 0.01, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, steps: 1, curveSegments: 8 }

/** A physical mat edge and a short, soft key shadow make the support plane
 * readable even for hands, knees and a reclined head. All lighting is local. */
function YogaStudio({ asanaId }: { asanaId: YogaAsanaId }) {
  const mat = useMemo(() => {
    const width = 1.04, length = 2.35, radius = 0.065
    const x = width / 2, y = length / 2
    return new Shape().moveTo(-x + radius, -y).lineTo(x - radius, -y)
      .quadraticCurveTo(x, -y, x, -y + radius).lineTo(x, y - radius)
      .quadraticCurveTo(x, y, x - radius, y).lineTo(-x + radius, y)
      .quadraticCurveTo(-x, y, -x, y - radius).lineTo(-x, -y + radius)
      .quadraticCurveTo(-x, -y, -x + radius, -y)
  }, [])
  const across = asanaId === 'virabhadrasana-ii' || asanaId === 'trikonasana'
  return <>
    <color attach="background" args={['#172526']} />
    <ambientLight intensity={0.22} />
    <hemisphereLight args={['#eef2ed', '#303c3c', 0.6]} />
    <directionalLight position={[2.4, 6, 3.2]} intensity={1.8} color="#fff1df" castShadow
      shadow-mapSize={[2048, 2048]} shadow-radius={3.5} shadow-normalBias={0.002}
      shadow-bias={-0.00006} shadow-camera-left={-2.1} shadow-camera-right={2.1}
      shadow-camera-top={2.5} shadow-camera-bottom={-2.1} shadow-camera-near={0.1} shadow-camera-far={12} />
    <directionalLight position={[-3.5, 3, 2]} intensity={0.8} color="#d9e5f3" />
    <directionalLight position={[-1, 3, -4]} intensity={1.9} color="#f0eadb" />
    <Environment resolution={128} frames={1} environmentIntensity={0.42}>
      <Lightformer form="rect" intensity={2.2} color="#fff3e6" position={[3, 5, 3]}
        scale={[4, 5, 1]} target={[0, 0.8, 0]} />
      <Lightformer form="rect" intensity={1.4} color="#d6e4ed" position={[-4, 2, 1]}
        scale={[3, 4, 1]} target={[0, 0.8, 0]} />
      <Lightformer form="rect" intensity={2.5} color="#f6f0e4" position={[-1, 4, -3]}
        scale={[3, 4, 1]} target={[0, 0.8, 0]} />
    </Environment>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.018, 0]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <shadowMaterial transparent opacity={0.2} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0185, 0]}>
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial color="#172526" toneMapped={false} />
    </mesh>
    <group rotation={[0, across ? Math.PI / 2 : 0, 0]} position={[0, 0, across ? 0 : -0.06]}>
      <mesh name="yoga-mat" rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.014, 0]} receiveShadow>
        <extrudeGeometry args={[mat, matExtrusion]} />
        <meshStandardMaterial color="#28433f" roughness={0.98} />
      </mesh>
    </group>
  </>
}

export interface YogaStageProps {
  asanaId: YogaAsanaId
  side?: YogaSide
  modelVariant: AnatomicalModelVariant
  layer?: YogaLayer
  phaseRef?: { current: number }
  onReady?: (bounds: Box3) => void
}

/** Shared by the interactive asana, poster and offline movement captures. */
export default function YogaStage({ asanaId, side = 'both', modelVariant, layer = 'muscles', phaseRef, onReady }: YogaStageProps) {
  const gltf = useGLTF('/models/anatomy.glb')
  const rawLandmarks = useLoader(FileLoader, '/models/rig-landmarks.json', loader => loader.setResponseType('json'))
  const anatomy = useMemo(() => prepareYogaAnatomy(gltf.scene, parseAnatomyLandmarks(rawLandmarks), modelVariant), [gltf.scene, rawLandmarks, modelVariant])
  const motion = useMemo(() => createYogaMotion(anatomy.rig.landmarks, asanaId, side), [anatomy, asanaId, side])
  const { invalidate } = useThree()
  const [props, setProps] = useState<YogaProp[]>([])
  useEffect(() => () => anatomy.dispose(), [anatomy])
  useLayoutEffect(() => {
    const pose = applyYogaPose(anatomy.rig, asanaId, side)
    setProps(pose.props)
    for (const { mesh, tissue } of anatomy.batches) {
      mesh.visible = layer === 'skin' ? tissue === 'skin' : layer === 'skeleton' ? tissue === 'bone' : tissue !== 'skin'
      const transparent = layer === 'combined' && tissue === 'muscle'
      mesh.material.transparent = transparent
      mesh.material.opacity = transparent ? 0.5 : 1
      mesh.material.depthWrite = !transparent
      mesh.castShadow = !transparent
      mesh.material.color.set('#ffffff')
      mesh.material.emissive.set('#000000')
      mesh.material.emissiveIntensity = 0
      mesh.material.needsUpdate = true
    }
    const bounds = new Box3()
    if (phaseRef) {
      // Entry, quiet breathing and the staged exit have distinct timing. Fit
      // the entire cycle once, so scrubbing never makes the camera follow it.
      for (let sample = 0; sample <= 32; sample++) {
        applyYogaMotion(anatomy.rig, motion, sample / 32)
        bounds.union(measureYogaBounds(anatomy))
      }
      // Cover the small excursion between samples without another expensive
      // vertex pass. This is below 1 cm, well inside the visual framing margin.
      bounds.expandByScalar(0.008)
      applyYogaMotion(anatomy.rig, motion, phaseRef.current ?? YOGA_HOLD_PHASE)
    } else bounds.copy(measureYogaBounds(anatomy))
    for (const prop of pose.props) bounds.union(new Box3().setFromCenterAndSize(new Vector3(...prop.position), new Vector3(...prop.size)))
    onReady?.(bounds)
    invalidate()
  }, [anatomy, asanaId, side, layer, phaseRef, motion, onReady, invalidate])
  useFrame(() => {
    if (phaseRef) applyYogaMotion(anatomy.rig, motion, phaseRef.current)
  }, -1)
  return <>
    <YogaStudio asanaId={asanaId} />
    <primitive object={anatomy.group} dispose={null} />
    {props.map((prop, index) => <RoundedBox key={index} name="yoga-support-block" position={prop.position}
      args={prop.size} radius={Math.min(...prop.size) * 0.075} smoothness={3} castShadow receiveShadow>
      <meshStandardMaterial color="#a58a64" roughness={0.95} />
    </RoundedBox>)}
  </>
}

export function YogaCamera({ bounds, asanaId, side = 'both', view = 'perspective', reset = 0, interactive = true }: {
  bounds: Box3 | null
  asanaId: YogaAsanaId
  side?: YogaSide
  view?: YogaView
  reset?: number
  interactive?: boolean
}) {
  const { camera, size, invalidate } = useThree()
  const [target, setTarget] = useState(() => new Vector3(0, 0.9, 0))
  const controls = useRef<{ target: Vector3; update: () => void } | null>(null)
  useLayoutEffect(() => {
    if (!bounds || !(camera instanceof OrthographicCamera) || size.width <= 0 || size.height <= 0) return
    const frame = fitYogaCamera(camera, bounds, size.width / size.height, asanaId, view, side)
    controls.current?.target.copy(frame.target)
    controls.current?.update()
    setTarget(frame.target)
    invalidate()
  }, [camera, bounds, size.width, size.height, asanaId, side, view, reset, invalidate])
  return interactive ? <OrbitControls ref={value => { controls.current = value }} target={target} makeDefault enablePan enableDamping dampingFactor={0.08} minZoom={0.6} maxZoom={4} minPolarAngle={0.06} maxPolarAngle={Math.PI / 2 - 0.02} /> : null
}
