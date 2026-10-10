import { useEffect, useMemo } from 'react'
import { useFrame, useLoader, type ThreeEvent } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { FileLoader } from 'three'
import { applyAnatomyPose, parseAnatomyLandmarks } from './anatomy-rig'
import { prepareAnatomy, structureAtFace } from './anatomy-model'
import type { AnatomicalModelVariant } from '@klisteniapp/scene-schema'
import type { AssetResolver } from '@klisteniapp/model-assets'
import { isSupportedAnatomyPose } from './movement-library.ts'

export interface AnatomicalModelProps {
  assetResolver: AssetResolver
  modelVariant?: AnatomicalModelVariant
  exerciseId: string
  phaseRef: { current: number }
  primaryMuscles: string[]
  secondaryMuscles: string[]
  selectedMuscle?: string | null
  onSelectMuscle?: (id: string) => void
  onInspectStructure?: (name: string, region?: string) => void
  onReady?: () => void
  layer: 'skin' | 'muscles' | 'skeleton' | 'combined'
  highlight: boolean
}

export default function AnatomicalModel(props: AnatomicalModelProps) {
  if (!isSupportedAnatomyPose(props.exerciseId)) throw new Error(`No authored movement for ${props.exerciseId}`)
  const gltf = useGLTF(props.assetResolver('models/anatomy.glb'))
  const rawLandmarks = useLoader(
    FileLoader,
    props.assetResolver('models/rig-landmarks.json'),
    (loader) => loader.setResponseType('json'),
  )
  const anatomy = useMemo(
    () => prepareAnatomy(gltf.scene, parseAnatomyLandmarks(rawLandmarks), props.modelVariant),
    [gltf.scene, rawLandmarks, props.modelVariant],
  )
  useEffect(() => {
    props.onReady?.()
  }, [anatomy, props.onReady])
  useEffect(() => () => anatomy.dispose(), [anatomy])
  useEffect(() => {
    for (const batch of anatomy.batches) {
      const { mesh, tissue, muscleId } = batch
      const selected = Boolean(muscleId && muscleId === props.selectedMuscle)
      const primary = Boolean(
        muscleId && props.primaryMuscles.includes(muscleId),
      )
      const secondary = Boolean(
        muscleId && props.secondaryMuscles.includes(muscleId),
      )
      const reveal = props.layer === 'skin' && Boolean(props.selectedMuscle)
      mesh.visible =
        props.layer === 'skin'
          ? tissue === 'skin' || (reveal && tissue === 'muscle' && selected)
          : props.layer === 'skeleton'
            ? tissue === 'bone'
            : tissue !== 'skin'
      const transparent =
        (tissue === 'skin' && reveal) ||
        (props.layer === 'combined' && tissue === 'muscle')
      mesh.material.transparent = transparent
      mesh.material.opacity =
        tissue === 'skin' && reveal
          ? 0.21
          : props.layer === 'combined' && tissue === 'muscle'
            ? 0.5
            : 1
      mesh.material.depthWrite = !transparent
      mesh.castShadow = !transparent
      mesh.material.color.set(
        props.highlight &&
          tissue === 'muscle' &&
          !selected &&
          !primary &&
          !secondary
          ? '#788a87'
          : '#ffffff',
      )
      mesh.material.emissive.set(
        selected
          ? '#e8b96c'
          : props.highlight && primary
            ? '#e36435'
            : props.highlight && secondary
              ? '#dca839'
              : '#000000',
      )
      mesh.material.emissiveIntensity = selected
        ? 0.45
        : props.highlight && primary
          ? 0.45
          : props.highlight && secondary
            ? 0.35
            : 0
      mesh.material.needsUpdate = true
    }
  }, [
    anatomy,
    props.layer,
    props.highlight,
    props.selectedMuscle,
    props.primaryMuscles,
    props.secondaryMuscles,
  ])
  useFrame(() => {
    applyAnatomyPose(anatomy.rig, props.exerciseId, props.phaseRef.current)
    anatomy.group.updateMatrixWorld(true)
  }, -1)
  const inspect = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 4) return
    const batch = anatomy.batches.find(
      (candidate) => candidate.mesh === event.object,
    )
    if (!batch || !batch.mesh.visible || event.faceIndex == null) return
    // Let a revealed muscle receive picking through its translucent skin overlay.
    if (
      batch.tissue === 'skin' &&
      props.layer === 'skin' &&
      props.selectedMuscle
    )
      return
    if (
      props.layer === 'skin' &&
      props.selectedMuscle &&
      batch.tissue === 'skin'
    )
      return
    const structure = structureAtFace(batch, event.faceIndex)
    if (!structure) return
    event.stopPropagation()
    if (structure.muscleId) props.onSelectMuscle?.(structure.muscleId)
    props.onInspectStructure?.(structure.name, structure.muscleId ?? undefined)
  }
  return <primitive object={anatomy.group} onClick={inspect} dispose={null} />
}
