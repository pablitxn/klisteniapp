import { Bone, Quaternion, Skeleton, Vector3, type Object3D } from 'three'
import type { AnatomicalModelVariant, YogaAsanaId } from '@klisteniapp/scene-schema'
import { prepareAnatomy, type PreparedAnatomy } from './anatomy-model.ts'
import {
  createAnatomyRig, segmentFrame, vertexInfluences,
  type AnatomyLandmarks, type AnatomyRig, type RigSegment, type SkinInfluence, type StructureMetadata,
} from './anatomy-rig.ts'
import { applyYogaPoseFrame, getYogaPose, type YogaPose } from './yoga-rig.ts'

const CONTROL_COUNT = 9
const controls = new WeakMap<AnatomyRig, RigSegment[]>()
const shoulders = new WeakMap<AnatomyRig, RigSegment[]>()
type ProneAsana = 'bhujangasana' | 'salabhasana'
const proneSupports = new WeakMap<AnatomyLandmarks, Partial<Record<ProneAsana, number>>>()
const kneeSupports = new WeakMap<AnatomyLandmarks, Partial<Record<YogaAsanaId, number>>>()
export function getYogaPronePelvisHeight(landmarks: AnatomyLandmarks, asana: ProneAsana): number | undefined {
  return proneSupports.get(landmarks)?.[asana]
}
export function getYogaKneeHeight(landmarks: AnatomyLandmarks, asana: YogaAsanaId): number | undefined {
  const values = kneeSupports.get(landmarks)
  // The inverted V begins in a tabletop with a different shin incline. Give
  // that preparation the largest measured kneecap radius and a 3 mm margin.
  if (values && asana === 'adho-mukha-svanasana') return Math.max(...Object.values(values)) + 0.003
  return values?.[asana]
}
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }
const unitScale = new Vector3(1, 1, 1)

/** Supplemental axial frames are Yoga-only; the established exercise rig retains
 * its seventeen bones, weights, and original source geometry. */
export function createYogaAnatomyRig(landmarks: AnatomyLandmarks): AnatomyRig {
  const rig = createAnatomyRig(landmarks)
  const source = rig.byKey.get('torso')!
  const axial: RigSegment[] = []
  for (let index = 0; index < CONTROL_COUNT; index++) {
    const start = source.start.clone().lerp(source.end, index / (CONTROL_COUNT - 1))
    const end = start.clone().addScaledVector(source.direction, source.length / (CONTROL_COUNT - 1))
    const bindMatrix = segmentFrame(start, end)
    const bone = new Bone()
    bone.name = `yoga.spine.${index}`
    bone.matrixAutoUpdate = false
    bone.matrix.copy(bindMatrix)
    bone.matrixWorld.copy(bindMatrix)
    const segment: RigSegment = {
      key: bone.name, index: rig.segments.length, segment: 'torso', side: null,
      start, end, length: start.distanceTo(end), bone, bindMatrix,
      bindRotation: new Quaternion().setFromRotationMatrix(bindMatrix), direction: source.direction.clone(),
    }
    rig.segments.push(segment)
    rig.byKey.set(segment.key, segment)
    axial.push(segment)
  }
  const shoulderControls: RigSegment[] = []
  for (const side of ['left', 'right'] as const) {
    const start = new Vector3(...landmarks[side].shoulder), end = start.clone().add(new Vector3(0, 0.1, 0))
    const bindMatrix = segmentFrame(start, end), bone = new Bone()
    bone.name = `yoga.shoulder.${side}`
    bone.matrixAutoUpdate = false
    bone.matrix.copy(bindMatrix); bone.matrixWorld.copy(bindMatrix)
    const segment: RigSegment = { key: bone.name, index: rig.segments.length, segment: 'torso', side,
      start, end, length: 0.1, bone, bindMatrix, bindRotation: new Quaternion().setFromRotationMatrix(bindMatrix), direction: new Vector3(0, 1, 0) }
    rig.segments.push(segment); rig.byKey.set(segment.key, segment); shoulderControls.push(segment)
  }
  rig.skeleton.dispose()
  rig.skeleton = new Skeleton(rig.segments.map(segment => segment.bone),
    rig.segments.map(segment => segment.bindMatrix.clone().invert()))
  controls.set(rig, axial)
  shoulders.set(rig, shoulderControls)
  return rig
}

function axialAmount(rig: AnatomyRig, position: Vector3) {
  const torso = rig.byKey.get('torso')!
  return clamp(position.clone().sub(torso.start).dot(torso.direction) / torso.length)
}

/** Preserve limb skinning, while distributing each trunk influence continuously
 * along the axial frames. Bone structures use their own centre, never per-vertex
 * weights: a rib or vertebra remains rigid even when the surrounding skin bends. */
export function yogaVertexInfluences(
  rig: AnatomyRig, position: Vector3, metadata: StructureMetadata, structureCenter = position,
): SkinInfluence {
  const original = vertexInfluences(rig, position, metadata)
  const axial = controls.get(rig)
  if (!axial) return original
  const torsoIndex = rig.byKey.get('torso')!.index
  const amount = axialAmount(rig, metadata.tissue === 'bone' ? structureCenter : position) * (axial.length - 1)
  if (metadata.tissue === 'bone') {
    if (original.indices[0] === torsoIndex) original.indices[0] = axial[Math.round(amount)]!.index
    return original
  }
  const lower = Math.floor(amount), upper = Math.min(axial.length - 1, lower + 1)
  const blend = smooth(amount - lower)
  const weights = new Map<number, number>()
  const add = (index: number, weight: number) => weights.set(index, (weights.get(index) ?? 0) + weight)
  const inputs: { influence: SkinInfluence; amount: number }[] = [{ influence: original, amount: 1 }]
  if (metadata.tissue === 'skin' && ['torso', 'pelvis', 'thigh'].includes(metadata.bodySegment)) {
    // Source territories are anatomical labels, not joint boundaries: the
    // anterior thigh skin reaches well above the iliac crest. A region-based
    // pelvis assignment leaves a rigid flap next to a bending lumbar surface.
    // Use exactly the same spatial field across every overlapping hip territory.
    const axialBlend = smooth((position.y - rig.landmarks.pelvis[1] + 0.22) / 0.10)
    inputs[0]!.amount = 1 - axialBlend
    inputs.push({ influence: vertexInfluences(rig, position, { ...metadata, bodySegment: 'torso' }), amount: axialBlend })
  }
  if (metadata.tissue === 'skin' && ['torso', 'scapula', 'upperArm'].includes(metadata.bodySegment)) {
    const side = position.x >= 0 ? 'left' : 'right'
    const shoulder = rig.landmarks[side].shoulder
    const shoulderBlend = smooth((position.y - shoulder[1] + 0.32) / 0.12)
    if (shoulderBlend > 0) {
      const arm = smooth((Math.abs(position.x) - Math.abs(shoulder[0]) + 0.12) / 0.24)
      for (const input of inputs) input.amount *= 1 - shoulderBlend
      // Across the armpit, neighbouring source territories must not alternate
      // between a rigid ribcage and a fully rotated humerus. Their shared field
      // blends medially into the chest and laterally into the upper arm.
      const spatial = { ...metadata, side, anatomyName: '' } as StructureMetadata
      const chest = vertexInfluences(rig, position, { ...spatial, bodySegment: 'torso' })
      // The generic torso-to-head blend is vertical. It must not drag the
      // lateral shoulder cap with the neck simply because both share a height.
      const lateralChest = smooth((Math.abs(position.x) - 0.045) / 0.075)
      for (let slot = 0; slot < 4; slot++) if (chest.indices[slot] === rig.byKey.get('head')!.index) {
        const headWeight = chest.weights[slot]!
        chest.weights[slot] = headWeight * (1 - lateralChest)
        inputs.push({ influence: { indices: [torsoIndex, 0, 0, 0], weights: [1, 0, 0, 0] }, amount: shoulderBlend * (1 - arm) * headWeight * lateralChest })
      }
      inputs.push({ influence: chest, amount: shoulderBlend * (1 - arm) })
      // This is already the shoulder transition. Applying the generic upper
      // arm's vertical transition again would put the lateral deltoid cap back
      // on the ribcage, folding it inside out as the humerus rises overhead.
      inputs.push({ influence: { indices: [rig.byKey.get(`upperArm.${side}`)!.index, 0, 0, 0], weights: [1, 0, 0, 0] }, amount: shoulderBlend * arm })
    }
  }
  for (const input of inputs) for (let slot = 0; slot < 4; slot++) {
    const index = input.influence.indices[slot]!, weight = input.influence.weights[slot]! * input.amount
    if (weight <= 0) continue
    if (index === torsoIndex) {
      add(axial[lower]!.index, weight * (1 - blend))
      add(axial[upper]!.index, weight * blend)
    } else add(index, weight)
  }
  const side = position.x >= 0 ? 'left' : 'right'
  const shoulder = rig.byKey.get(`yoga.shoulder.${side}`)
  const upperArm = rig.byKey.get(`upperArm.${side}`)!
  if (shoulder) {
    const chestIndices = new Set([torsoIndex, ...axial.map(segment => segment.index), rig.byKey.get(`scapula.${side}`)!.index])
    const chestWeight = [...weights].reduce((sum, [index, weight]) => sum + (chestIndices.has(index) ? weight : 0), 0)
    const armWeight = weights.get(upperArm.index) ?? 0
    const halfWeight = Math.min(chestWeight, armWeight)
    if (halfWeight > 0) {
      weights.set(upperArm.index, armWeight - halfWeight)
      for (const index of chestIndices) if (weights.has(index)) weights.set(index, weights.get(index)! * (1 - halfWeight / chestWeight))
      add(shoulder.index, halfWeight * 2)
    }
  }
  // WebGL skinning has four slots. Only a joint transition can need a fifth;
  // retain its four strongest influences and normalise after that truncation.
  const strongest = [...weights].filter(([, weight]) => weight > 0).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const total = strongest.reduce((sum, [, weight]) => sum + weight, 0)
  return {
    indices: [0, 1, 2, 3].map(slot => strongest[slot]?.[0] ?? 0) as SkinInfluence['indices'],
    weights: [0, 1, 2, 3].map(slot => (strongest[slot]?.[1] ?? 0) / total) as SkinInfluence['weights'],
  }
}

export function prepareYogaAnatomy(
  source: Object3D, landmarks: AnatomyLandmarks, variant: AnatomicalModelVariant = 'male',
): PreparedAnatomy {
  const anatomy = prepareAnatomy(source, landmarks, variant, {
    createRig: createYogaAnatomyRig, influences: yogaVertexInfluences,
  })
  calibrateYogaProneSupports(anatomy)
  calibrateYogaKneeSupports(anatomy)
  anatomy.group.userData.yogaArticulation = 'axial-v1'
  return anatomy
}

/** Kneecap contact depends on the source surface and thigh angle. Calibrate
 * supported knees per posture instead of reusing a mannequin's 105 mm radius. */
function calibrateYogaKneeSupports(anatomy: PreparedAnatomy) {
  const skin = anatomy.batches.find(batch => batch.tissue === 'skin')
  if (!skin) return
  const index = skin.mesh.geometry.index!
  const bySide = { left: new Set<number>(), right: new Set<number>() }
  for (const structure of skin.structures) {
    if (!/^Anterior region of knee[.]/.test(structure.name)) continue
    const side = structure.name.endsWith('.l') ? 'left' : 'right'
    for (let corner = structure.startFace * 3; corner < structure.endFace * 3; corner++)
      bySide[side].add(index.getX(corner))
  }
  if (!bySide.left.size || !bySide.right.size) return
  const supports: Partial<Record<YogaAsanaId, number>> = {}
  kneeSupports.set(anatomy.rig.landmarks, supports)
  const position = new Vector3()
  for (const id of ['balasana', 'marjaryasana', 'bitilasana', 'anjaneyasana'] as const) {
    for (let iteration = 0; iteration < 4; iteration++) {
      const pose = getYogaPose(anatomy.rig.landmarks, id, 'right')
      applyYogaPoseFrame(anatomy.rig, pose)
      let bottom = Infinity
      // The right-sided Low Lunge rests on the left rear knee.
      for (const vertex of bySide.left) {
        skin.mesh.getVertexPosition(vertex, position)
        bottom = Math.min(bottom, position.y)
      }
      // Child changes the thigh angle over a planted knee. Its extra 2 mm
      // keeps the beginning of that roll clear while retaining visible contact.
      const clearance = id === 'balasana' ? 0.005 : 0.003
      supports[id] = pose.legs.left.joint[1] + clearance - bottom
      if (Math.abs(bottom - clearance) < 1e-5) break
    }
  }
  for (const segment of anatomy.rig.segments) {
    segment.bone.matrix.copy(segment.bindMatrix)
    segment.bone.matrixWorld.copy(segment.bindMatrix)
  }
  anatomy.rig.skeleton.update()
}

/** Cache support from each prepared body's actual deformed pelvic surface.
 * This is isolated from both the shared GLTF and exercise support landmarks;
 * the illustrative female pelvis and different torso bends need their own
 * contact height rather than a chest-wide radius or a universal offset. */
function calibrateYogaProneSupports(anatomy: PreparedAnatomy) {
  const skin = anatomy.batches.find(batch => batch.tissue === 'skin')?.mesh
  if (!skin) return
  const source = skin.geometry.getAttribute('position'), landmarks = anatomy.rig.landmarks
  const vertices: number[] = []
  for (let index = 0; index < source.count; index++) {
    if (Math.abs(source.getX(index)) < 0.22 && Math.abs(source.getY(index) - landmarks.pelvis[1]) < 0.15)
      vertices.push(index)
  }
  if (!vertices.length) return
  const supports: Partial<Record<ProneAsana, number>> = {}
  proneSupports.set(landmarks, supports)
  const position = new Vector3()
  for (const id of ['bhujangasana', 'salabhasana'] as const) {
    for (let iteration = 0; iteration < 3; iteration++) {
      const pose = getYogaPose(landmarks, id)
      applyYogaPoseFrame(anatomy.rig, pose)
      let bottom = Infinity
      for (const index of vertices) {
        skin.getVertexPosition(index, position)
        bottom = Math.min(bottom, position.y)
      }
      supports[id] = pose.pelvis[1] + 0.003 - bottom
      if (Math.abs(bottom - 0.003) < 1e-5) break
    }
  }
  for (const segment of anatomy.rig.segments) {
    segment.bone.matrix.copy(segment.bindMatrix)
    segment.bone.matrixWorld.copy(segment.bindMatrix)
  }
  anatomy.rig.skeleton.update()
}

// Positive values open the anterior body; negative values round the back.
// The excursion is deliberately concentrated below the shoulder girdle, keeping
// the arm roots and supported head at the pose solver's measured endpoints.
const curvature: Partial<Record<YogaAsanaId, number>> = {
  marjaryasana: -0.045, bitilasana: 0.036,
  balasana: -0.028, uttanasana: -0.024, 'paschimottanasana': -0.03,
  'janu-sirsasana': -0.024, bhujangasana: 0.034, salabhasana: 0.023,
  'setu-bandha-sarvangasana': 0.025,
}

/** Endpoint-preserving educational spine deformation, applied after base limb
 * matrices. These are unit-scale rigid frames, not a vertebral biomechanics
 * simulation: the bowed centreline is an approximation and not arc-length exact.
 * The upper chest, shoulders, pelvis anchor and head remain where IK placed them. */
export function applyYogaSpine(rig: AnatomyRig, pose: YogaPose & { spineActivation?: number }): void {
  const axial = controls.get(rig)
  if (!axial) return
  const torso = rig.byKey.get('torso')!
  const activation = Number.isFinite(pose.spineActivation) ? clamp(pose.spineActivation!) : 1
  const amplitude = (curvature[pose.asanaId] ?? 0) * activation
  const normal = new Vector3(0, 0, 1).addScaledVector(torso.direction, -torso.direction.z).normalize()
  for (let index = 0; index < axial.length; index++) {
    const segment = axial[index]!, t = index / (axial.length - 1)
    const u = clamp(t / 0.72)
    const displacement = Math.sin(Math.PI * u) ** 2 * amplitude
    const slope = (t > 0 && t < 0.72)
      ? Math.PI * Math.sin(2 * Math.PI * u) * amplitude / (0.72 * torso.length) : 0
    const position = segment.start.clone().sub(torso.start)
      .addScaledVector(normal, displacement).applyQuaternion(pose.torsoRotation).add(new Vector3(...pose.pelvis))
    const direction = torso.direction.clone().addScaledVector(normal, slope).normalize()
    const curveRotation = new Quaternion().setFromUnitVectors(torso.direction, direction)
    const rotation = pose.pelvisRotation.clone().slerp(pose.torsoRotation, smooth(t / 0.42))
      .multiply(curveRotation).multiply(segment.bindRotation)
    segment.bone.matrix.compose(position, rotation, unitScale)
    segment.bone.matrixWorld.copy(segment.bone.matrix)
  }
  for (const segment of shoulders.get(rig) ?? []) {
    const side = segment.side!, upperArm = rig.byKey.get(`upperArm.${side}`)!
    const armRotation = new Quaternion().setFromRotationMatrix(
      upperArm.bone.matrix.clone().multiply(upperArm.bindMatrix.clone().invert()))
    const rotation = pose.torsoRotation.clone().slerp(armRotation, 0.5).multiply(segment.bindRotation)
    segment.bone.matrix.compose(new Vector3(...pose.arms[side].start), rotation, unitScale)
    segment.bone.matrixWorld.copy(segment.bone.matrix)
  }
}
