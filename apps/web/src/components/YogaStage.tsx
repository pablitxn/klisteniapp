import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, FileLoader, OrthographicCamera, Vector3 } from 'three'
import type { AnatomicalModelVariant, YogaAsanaId } from '@klisteniapp/scene-schema'
import { prepareAnatomy } from '../lib/anatomy-model'
import { parseAnatomyLandmarks } from '../lib/anatomy-rig'
import { applyYogaPose, type YogaProp } from '../lib/yoga-rig'
import { applyYogaMotion, createYogaMotion, YOGA_HOLD_PHASE } from '../lib/yoga-motion'
import { fitYogaCamera, measureYogaBounds, yogaFloorExercise, type YogaLayer, type YogaSide, type YogaView } from '../lib/yoga-rendering'
import AnatomyStudio from './AnatomyStudio'

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
  const anatomy = useMemo(() => prepareAnatomy(gltf.scene, parseAnatomyLandmarks(rawLandmarks), modelVariant), [gltf.scene, rawLandmarks, modelVariant])
  const motion = useMemo(() => createYogaMotion(anatomy.rig.landmarks, asanaId, side), [anatomy, asanaId, side])
  const { invalidate } = useThree()
  const [props, setProps] = useState<YogaProp[]>([])
  const [floorExercise, setFloorExercise] = useState(() => yogaFloorExercise(asanaId))
  useEffect(() => () => anatomy.dispose(), [anatomy])
  useLayoutEffect(() => {
    const pose = applyYogaPose(anatomy.rig, asanaId, side)
    setProps(pose.props)
    setFloorExercise(pose.floorExercise)
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
      // Entry and exit follow the same path. Sample its full changing portion,
      // including both endpoints, so the camera never tracks the moving body.
      for (let sample = 0; sample <= 12; sample++) {
        applyYogaMotion(anatomy.rig, motion, 0.08 + (sample / 12) * 0.28)
        bounds.union(measureYogaBounds(anatomy))
      }
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
    <AnatomyStudio floorExercise={floorExercise} />
    <primitive object={anatomy.group} dispose={null} />
    {props.map((prop, index) => <mesh key={index} name="yoga-support-block" position={prop.position} castShadow receiveShadow>
      <boxGeometry args={prop.size} />
      <meshStandardMaterial color="#a68b68" roughness={0.92} />
    </mesh>)}
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
  return interactive ? <OrbitControls ref={value => { controls.current = value }} target={target} makeDefault enablePan enableDamping dampingFactor={0.08} minZoom={0.6} maxZoom={4} minPolarAngle={0.06} maxPolarAngle={Math.PI * 0.7} /> : null
}
