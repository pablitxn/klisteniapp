import { Bone, Matrix4, Quaternion, Skeleton, Vector3 } from 'three'
import {
  getExercisePose,
  solveLimb,
  type Limb,
  type Side,
  type Vec3,
} from '@klisteniapp/geometry'

export type BodySegment =
  | 'pelvis'
  | 'torso'
  | 'head'
  | 'scapula'
  | 'upperArm'
  | 'forearm'
  | 'hand'
  | 'thigh'
  | 'shin'
  | 'foot'
export type Tissue = 'muscle' | 'bone' | 'skin'
export interface SideLandmarks {
  shoulder: Vec3
  elbow: Vec3
  wrist: Vec3
  hip: Vec3
  knee: Vec3
  ankle: Vec3
  handEnd?: Vec3
  toe?: Vec3
  scapula?: Vec3
}
export interface AnatomyLandmarks {
  version: number
  pelvis: Vec3
  neck: Vec3
  headTop: Vec3
  left: SideLandmarks
  right: SideLandmarks
  support?: {
    shoulderHeight: number
    headNeckHeight: number
    pelvisHeight: number
    handHeight?: Record<Side, number>
  }
}
export interface StructureMetadata {
  tissue: Tissue
  bodySegment: BodySegment
  side: Side | null
  muscleId: string | null
  anatomyName: string
}
export interface RigSegment {
  key: string
  index: number
  segment: BodySegment
  side: Side | null
  start: Vector3
  end: Vector3
  length: number
  bone: Bone
  bindMatrix: Matrix4
  bindRotation: Quaternion
  direction: Vector3
}
export interface AnatomyRig {
  landmarks: AnatomyLandmarks
  segments: RigSegment[]
  byKey: Map<string, RigSegment>
  skeleton: Skeleton
}
export interface RetargetedPose {
  pelvis: Vec3
  torsoAngle: number
  neck: Vec3
  headAngle: number
  arms: Record<Side, Limb>
  legs: Record<Side, Limb>
}
const SIDES: Side[] = ['left', 'right']
const axial: BodySegment[] = ['pelvis', 'torso', 'head']
const vector = (point: Vec3) => new Vector3(...point)
const point = (value: Vector3): Vec3 => [value.x, value.y, value.z]
const keyOf = (segment: BodySegment, side: Side | null) =>
  axial.includes(segment) ? segment : segment + '.' + side
const clamp = (value: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, value))
const smooth = (a: number, b: number, value: number) => {
  const t = clamp((value - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const rotation = (angle: number) =>
  new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), angle)

/** Landmarks are source-derived rig anchors, not medical joint-centre measurements. */
export function parseAnatomyLandmarks(raw: unknown): AnatomyLandmarks {
  if (!raw || typeof raw !== 'object')
    throw new Error(
      'No se encontraron los puntos de articulación del modelo anatómico.',
    )
  const data = raw as AnatomyLandmarks
  const valid = (value: unknown): value is Vec3 =>
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((x) => typeof x === 'number' && Number.isFinite(x))
  for (const name of ['pelvis', 'neck', 'headTop'] as const)
    if (!valid(data[name])) throw new Error('Punto anatómico inválido: ' + name)
  for (const side of SIDES) {
    if (!data[side]) throw new Error('Falta el lado anatómico: ' + side)
    for (const name of [
      'shoulder',
      'elbow',
      'wrist',
      'hip',
      'knee',
      'ankle',
    ] as const) {
      if (!valid(data[side][name]))
        throw new Error('Punto anatómico inválido: ' + side + '.' + name)
    }
  }
  return data
}

/** A complete frame with a stable fallback when the direction meets the reference axis. */
export function segmentFrame(
  start: Vector3,
  end: Vector3,
  reference = new Vector3(0, 0, 1),
): Matrix4 {
  const y = end.clone().sub(start).normalize()
  if (y.lengthSq() < 0.5) throw new Error('Segmento anatómico sin longitud')
  const z = reference.clone().addScaledVector(y, -reference.dot(y))
  if (z.lengthSq() < 1e-10) {
    z.set(Math.abs(y.x) < 0.8 ? 1 : 0, Math.abs(y.x) < 0.8 ? 0 : 1, 0)
    z.addScaledVector(y, -z.dot(y))
  }
  z.normalize()
  const x = new Vector3().crossVectors(y, z).normalize()
  z.crossVectors(x, y).normalize()
  return new Matrix4().makeBasis(x, y, z).setPosition(start)
}

export function createAnatomyRig(landmarks: AnatomyLandmarks): AnatomyRig {
  const segments: RigSegment[] = []
  function add(
    segment: BodySegment,
    side: Side | null,
    start: Vec3,
    end: Vec3,
    reference?: Vector3,
  ) {
    const first = vector(start),
      last = vector(end)
    const bindMatrix = segmentFrame(first, last, reference)
    const bone = new Bone()
    bone.name = keyOf(segment, side)
    bone.matrixAutoUpdate = false
    bone.matrix.copy(bindMatrix)
    bone.matrixWorld.copy(bindMatrix)
    segments.push({
      key: bone.name,
      index: segments.length,
      segment,
      side,
      start: first,
      end: last,
      length: first.distanceTo(last),
      bone,
      bindMatrix,
      bindRotation: new Quaternion().setFromRotationMatrix(bindMatrix),
      direction: last.clone().sub(first).normalize(),
    })
  }
  add(
    'pelvis',
    null,
    landmarks.pelvis,
    point(vector(landmarks.pelvis).add(new Vector3(0, 0.1, 0))),
  )
  add('torso', null, landmarks.pelvis, landmarks.neck)
  add('head', null, landmarks.neck, landmarks.headTop)
  for (const side of SIDES) {
    const joints = landmarks[side]
    const blade =
      joints.scapula ??
      point(
        vector(joints.shoulder).add(
          new Vector3(-Math.sign(joints.shoulder[0]) * 0.055, -0.08, -0.075),
        ),
      )
    add(
      'scapula',
      side,
      blade,
      point(vector(blade).add(new Vector3(0, 0.1, 0))),
    )
    add('upperArm', side, joints.shoulder, joints.elbow)
    add('forearm', side, joints.elbow, joints.wrist)
    add(
      'hand',
      side,
      joints.wrist,
      joints.handEnd ??
        point(
          vector(joints.wrist).add(
            vector(joints.wrist)
              .sub(vector(joints.elbow))
              .normalize()
              .multiplyScalar(0.17),
          ),
        ),
    )
    add('thigh', side, joints.hip, joints.knee)
    add('shin', side, joints.knee, joints.ankle)
    add(
      'foot',
      side,
      joints.ankle,
      joints.toe ??
        point(vector(joints.ankle).add(new Vector3(0, -0.045, 0.18))),
      new Vector3(0, 1, 0),
    )
  }
  const skeleton = new Skeleton(
    segments.map((s) => s.bone),
    segments.map((s) => s.bindMatrix.clone().invert()),
  )
  return {
    landmarks,
    segments,
    byKey: new Map(segments.map((s) => [s.key, s])),
    skeleton,
  }
}

function scapularSourcePoint(
  landmarks: AnatomyLandmarks,
  side: Side,
  sourcePoint: Vec3,
  amount: number,
): Vec3 {
  const source = landmarks[side],
    sign = Math.sign(source.shoulder[0])
  const pivot =
    source.scapula ??
    point(
      vector(source.shoulder).add(new Vector3(-sign * 0.055, -0.08, -0.075)),
    )
  return point(
    vector(sourcePoint)
      .sub(vector(pivot))
      .applyAxisAngle(new Vector3(0, 1, 0), sign * 0.045 * amount)
      .add(vector(pivot))
      .add(new Vector3(-sign * 0.008 * amount, 0, -0.004 * amount)),
  )
}

function transformSource(
  value: Vec3,
  landmarks: AnatomyLandmarks,
  pelvis: Vec3,
  angle: number,
): Vec3 {
  return point(
    vector(value)
      .sub(vector(landmarks.pelvis))
      .applyQuaternion(rotation(angle))
      .add(vector(pelvis)),
  )
}
function length(a: Vec3, b: Vec3) {
  return vector(a).distanceTo(vector(b))
}
function bend(limb: Limb): Vec3 {
  return point(
    vector(limb.joint).sub(vector(limb.start).lerp(vector(limb.end), 0.5)),
  )
}

/**
 * The template contributes motion targets. Original shoulder/hip widths and all four
 * measured limb lengths are retained. There is no nonuniform mesh or bone scaling.
 * Source anatomical left is mapped by its actual X sign; the old mannequin's side
 * labels are not allowed to reflect the source anatomy.
 */
export function retargetExercisePose(
  landmarks: AnatomyLandmarks,
  exerciseId: string,
  phase: number,
): RetargetedPose {
  const template = getExercisePose(exerciseId, phase)
  let pelvis: Vec3 = [
    template.pelvis[0],
    template.pelvis[1] + landmarks.pelvis[1] - 0.94,
    template.pelvis[2],
  ]
  let angle = template.torsoAngle
  const cycle = (1 - Math.cos(2 * Math.PI * phase)) / 2
  const shoulders = vector(landmarks.left.shoulder)
    .add(vector(landmarks.right.shoulder))
    .multiplyScalar(0.5)
  if (exerciseId === 'glute-bridge') {
    // Preserve the actual shoulder-to-pelvis distance around supported shoulders.
    const shoulderHeight = landmarks.support?.shoulderHeight ?? 0.105
    const pelvisHeight =
      (landmarks.support?.pelvisHeight ?? 0.16) + 0.23 * cycle
    const offset = shoulders.clone().sub(vector(landmarks.pelvis))
    angle =
      -Math.acos(
        clamp(
          (shoulderHeight - pelvisHeight) / Math.hypot(offset.y, offset.z),
          -1,
          1,
        ),
      ) - Math.atan2(offset.z, offset.y)
    pelvis = point(
      new Vector3(0, shoulderHeight, -0.47).sub(
        offset.applyQuaternion(rotation(angle)),
      ),
    )
  }
  if (exerciseId === 'pushup') {
    const pelvisAt = (bodyAngle: number): Vec3 => {
      const candidates = SIDES.map((side) => {
        const source = landmarks[side]
        const knee = new Vector3(source.hip[0], 0.11, -0.64)
        const hip = new Vector3(0, Math.cos(bodyAngle), Math.sin(bodyAngle))
          .multiplyScalar(length(source.hip, source.knee))
          .add(knee)
        return hip.sub(
          vector(source.hip)
            .sub(vector(landmarks.pelvis))
            .applyQuaternion(rotation(bodyAngle)),
        )
      })
      return point(candidates[0]!.add(candidates[1]!).multiplyScalar(0.5))
    }
    const reachable = (bodyAngle: number) =>
      SIDES.every((side) => {
        const source = landmarks[side],
          shoulder = transformSource(
            source.shoulder,
            landmarks,
            pelvisAt(bodyAngle),
            bodyAngle,
          )
        const wrist: Vec3 = [
          shoulder[0] + Math.sign(source.shoulder[0]) * 0.06,
          landmarks.support?.handHeight?.[side] ?? 0.065,
          0.23,
        ]
        return (
          length(shoulder, wrist) <=
          length(source.shoulder, source.elbow) +
            length(source.elbow, source.wrist) -
            1e-5
        )
      })
    // Keep real hands and knees planted when the atlas has shorter arms than the template.
    if (!reachable(angle)) {
      let low = angle,
        high = Math.PI / 2 - 0.1
      for (let iteration = 0; iteration < 24; iteration++) {
        const middle = (low + high) / 2
        if (reachable(middle)) high = middle
        else low = middle
      }
      angle = high
    }
    pelvis = pelvisAt(angle)
  }
  // Standing targets must be reachable without lifting a planted heel.
  if (!template.floorExercise) {
    for (const side of SIDES) {
      const source = landmarks[side],
        sign = Math.sign(source.ankle[0])
      const ankle = new Vector3(
        source.ankle[0] + (exerciseId === 'squat' ? sign * 0.04 : 0),
        source.ankle[1] + (exerciseId === 'calf-raise' ? 0.085 * cycle : 0),
        source.ankle[2] +
          (exerciseId === 'squat'
            ? 0.075
            : exerciseId === 'calf-raise'
              ? 0.015 * cycle
              : 0),
      )
      const hipOffset = vector(source.hip)
        .sub(vector(landmarks.pelvis))
        .applyQuaternion(rotation(angle))
      const reach =
        length(source.hip, source.knee) +
        length(source.knee, source.ankle) -
        1e-5
      const horizontal = Math.hypot(
        pelvis[0] + hipOffset.x - ankle.x,
        pelvis[2] + hipOffset.z - ankle.z,
      )
      pelvis[1] = Math.min(
        pelvis[1],
        ankle.y +
          Math.sqrt(Math.max(0, reach * reach - horizontal * horizontal)) -
          hipOffset.y,
      )
    }
  }
  const arms = {} as Record<Side, Limb>,
    legs = {} as Record<Side, Limb>
  for (const side of SIDES) {
    const source = landmarks[side]
    const templateSide = source.shoulder[0] >= 0 ? 'right' : 'left'
    const sign = source.shoulder[0] >= 0 ? 1 : -1
    const arm = template.arms[templateSide],
      leg = template.legs[templateSide]
    const shoulderSource =
      exerciseId === 'prone-w'
        ? scapularSourcePoint(landmarks, side, source.shoulder, cycle)
        : source.shoulder
    const shoulder = transformSource(shoulderSource, landmarks, pelvis, angle)
    const hip = transformSource(source.hip, landmarks, pelvis, angle)
    const wrist: Vec3 = [
      arm.end[0] + shoulder[0] - arm.start[0],
      arm.end[1],
      arm.end[2],
    ]
    if (!template.floorExercise) wrist[1] += pelvis[1] - template.pelvis[1]
    if (exerciseId === 'pushup') {
      wrist[0] = shoulder[0] + sign * 0.06
      wrist[1] = landmarks.support?.handHeight?.[side] ?? 0.065
      wrist[2] = 0.23
    }
    if (exerciseId === 'glute-bridge') {
      const reach =
        length(source.shoulder, source.elbow) +
        length(source.elbow, source.wrist) -
        0.002
      wrist[0] = shoulder[0] + sign * 0.045
      wrist[1] = landmarks.support?.handHeight?.[side] ?? 0.045
      wrist[2] =
        shoulder[2] +
        Math.sqrt(
          Math.max(
            0,
            reach * reach - 0.045 ** 2 - (wrist[1] - shoulder[1]) ** 2,
          ),
        )
    }
    arms[side] = solveLimb(
      shoulder,
      wrist,
      length(source.shoulder, source.elbow),
      length(source.elbow, source.wrist),
      bend(arm),
    )
    const ankle: Vec3 = [
      leg.end[0] + source.ankle[0] - sign * 0.17,
      leg.end[1] + source.ankle[1] - 0.085,
      leg.end[2],
    ]
    if (!template.floorExercise) {
      ankle[0] = source.ankle[0] + (exerciseId === 'squat' ? sign * 0.04 : 0)
      ankle[1] =
        source.ankle[1] + (exerciseId === 'calf-raise' ? 0.085 * cycle : 0)
      ankle[2] =
        source.ankle[2] +
        (exerciseId === 'squat'
          ? 0.075
          : exerciseId === 'calf-raise'
            ? 0.015 * cycle
            : 0)
    }
    if (exerciseId === 'pushup') {
      const knee: Vec3 = [source.hip[0], 0.11, -0.64]
      legs[side] = {
        start: hip,
        joint: knee,
        end: [knee[0], knee[1], knee[2] - length(source.knee, source.ankle)],
      }
    } else {
      legs[side] = solveLimb(
        hip,
        ankle,
        length(source.hip, source.knee),
        length(source.knee, source.ankle),
        bend(leg),
      )
    }
  }
  const neck =
    exerciseId === 'glute-bridge'
      ? point(
          vector(landmarks.neck)
            .sub(shoulders)
            .applyQuaternion(rotation(-Math.PI / 2))
            .add(
              new Vector3(0, landmarks.support?.shoulderHeight ?? 0.105, -0.47),
            ),
        )
      : transformSource(landmarks.neck, landmarks, pelvis, angle)
  if (exerciseId === 'glute-bridge' || exerciseId === 'dead-bug')
    neck[1] = landmarks.support?.headNeckHeight ?? 0.105
  return {
    pelvis,
    torsoAngle: angle,
    neck,
    headAngle: exerciseId === 'glute-bridge' ? -Math.PI / 2 : angle,
    arms,
    legs,
  }
}

function setRigidSourceTransform(
  segment: RigSegment,
  sourcePivot: Vec3,
  targetPivot: Vec3,
  angle: number,
) {
  const delta = new Matrix4()
    .makeTranslation(...targetPivot)
    .multiply(new Matrix4().makeRotationX(angle))
    .multiply(
      new Matrix4().makeTranslation(
        -sourcePivot[0],
        -sourcePivot[1],
        -sourcePivot[2],
      ),
    )
  segment.bone.matrix.copy(delta.multiply(segment.bindMatrix))
}
function setLimbFrame(
  segment: RigSegment,
  start: Vec3,
  end: Vec3,
  bodyAngle: number,
) {
  const bodyRotation = rotation(bodyAngle)
  const from = segment.direction.clone().applyQuaternion(bodyRotation)
  const to = vector(end).sub(vector(start)).normalize()
  const turn = new Quaternion().setFromUnitVectors(from, to)
  const orientation = turn.multiply(bodyRotation).multiply(segment.bindRotation)
  segment.bone.matrix.compose(vector(start), orientation, new Vector3(1, 1, 1))
}

/** Update just 17 GPU bone matrices; vertices and surface normals stay on the GPU. */
export function applyAnatomyPose(
  rig: AnatomyRig,
  exerciseId: string,
  phase: number,
): RetargetedPose | null {
  if (exerciseId === 'anatomy') {
    for (const segment of rig.segments) {
      segment.bone.matrix.copy(segment.bindMatrix)
      segment.bone.matrixWorld.copy(segment.bindMatrix)
    }
    rig.skeleton.update()
    return null
  }
  const pose = retargetExercisePose(rig.landmarks, exerciseId, phase)
  for (const segment of rig.segments) {
    if (segment.segment === 'pelvis' || segment.segment === 'torso') {
      setRigidSourceTransform(
        segment,
        rig.landmarks.pelvis,
        pose.pelvis,
        pose.torsoAngle,
      )
    } else if (segment.segment === 'scapula') {
      const amount =
        exerciseId === 'prone-w' ? (1 - Math.cos(2 * Math.PI * phase)) / 2 : 0
      const moved = scapularSourcePoint(
        rig.landmarks,
        segment.side!,
        point(segment.start),
        amount,
      )
      const target = transformSource(
        moved,
        rig.landmarks,
        pose.pelvis,
        pose.torsoAngle,
      )
      const orientation = rotation(pose.torsoAngle)
        .multiply(
          new Quaternion().setFromAxisAngle(
            new Vector3(0, 1, 0),
            Math.sign(rig.landmarks[segment.side!].shoulder[0]) *
              0.045 *
              amount,
          ),
        )
        .multiply(segment.bindRotation)
      segment.bone.matrix.compose(
        vector(target),
        orientation,
        new Vector3(1, 1, 1),
      )
    } else if (segment.segment === 'head') {
      setRigidSourceTransform(
        segment,
        rig.landmarks.neck,
        pose.neck,
        pose.headAngle,
      )
    } else {
      const side = segment.side!
      const arm = pose.arms[side],
        leg = pose.legs[side]
      if (segment.segment === 'upperArm')
        setLimbFrame(segment, arm.start, arm.joint, pose.torsoAngle)
      else if (segment.segment === 'forearm')
        setLimbFrame(segment, arm.joint, arm.end, pose.torsoAngle)
      else if (segment.segment === 'thigh')
        setLimbFrame(segment, leg.start, leg.joint, pose.torsoAngle)
      else if (segment.segment === 'shin')
        setLimbFrame(segment, leg.joint, leg.end, pose.torsoAngle)
      else if (segment.segment === 'hand') {
        if (exerciseId === 'pushup' || exerciseId === 'glute-bridge') {
          segment.bone.matrix.copy(
            segmentFrame(
              vector(arm.end),
              vector(arm.end).add(new Vector3(0, 0, segment.length)),
              new Vector3(0, -1, 0),
            ),
          )
        } else {
          const forearm = rig.byKey.get(keyOf('forearm', side))!
          const delta = forearm.bone.matrix
            .clone()
            .multiply(forearm.bindMatrix.clone().invert())
          segment.bone.matrix.copy(delta.multiply(segment.bindMatrix))
        }
      } else if (segment.segment === 'foot') {
        const source = rig.landmarks[side]
        if (exerciseId === 'pushup' || exerciseId === 'prone-w') {
          segment.bone.matrix.copy(
            segmentFrame(
              vector(leg.end),
              vector(leg.end).add(new Vector3(0, -0.035, -segment.length)),
              new Vector3(0, -1, 0),
            ),
          )
        } else if (exerciseId === 'dead-bug') {
          const shin = rig.byKey.get(keyOf('shin', side))!
          const delta = shin.bone.matrix
            .clone()
            .multiply(shin.bindMatrix.clone().invert())
          segment.bone.matrix.copy(delta.multiply(segment.bindMatrix))
        } else {
          let footAngle = 0
          if (exerciseId === 'calf-raise') {
            const offset = segment.end.clone().sub(segment.start)
            const radius = Math.hypot(offset.y, offset.z)
            footAngle =
              Math.atan2(offset.y, offset.z) -
              Math.asin(clamp((segment.end.y - leg.end[1]) / radius, -1, 1))
          }
          setRigidSourceTransform(segment, source.ankle, leg.end, footAngle)
        }
      }
    }
    segment.bone.matrixWorld.copy(segment.bone.matrix)
  }
  rig.skeleton.update()
  return pose
}

export interface SkinInfluence {
  indices: [number, number, number, number]
  weights: [number, number, number, number]
}
const distanceToSegment = (position: Vector3, segment: RigSegment) => {
  const along = clamp(
    position.clone().sub(segment.start).dot(segment.direction),
    0,
    segment.length,
  )
  return position.distanceTo(
    segment.start.clone().addScaledVector(segment.direction, along),
  )
}

/** Rigid bones; continuous 2–3 joint influences for muscles and the registered skin. */
export function vertexInfluences(
  rig: AnatomyRig,
  position: Vector3,
  metadata: StructureMetadata,
): SkinInfluence {
  let segment = rig.byKey.get(
    keyOf(
      metadata.muscleId === 'glutes' ? 'pelvis' : metadata.bodySegment,
      metadata.side,
    ),
  )
  if (metadata.tissue === 'skin') {
    const side =
      metadata.side ??
      (position.x >= 0
        ? rig.landmarks.left.shoulder[0] >= 0
          ? 'left'
          : 'right'
        : rig.landmarks.left.shoulder[0] < 0
          ? 'left'
          : 'right')
    const source = rig.landmarks[side]
    const result: SkinInfluence = {
      indices: [0, 0, 0, 0],
      weights: [0, 0, 0, 0],
    }
    const influences: [BodySegment, number][] = []
    if (['upperArm', 'forearm', 'hand'].includes(metadata.bodySegment)) {
      const upper = smooth(
        source.elbow[1] - 0.07,
        source.elbow[1] + 0.07,
        position.y,
      )
      const hand =
        1 - smooth(source.wrist[1] - 0.04, source.wrist[1] + 0.04, position.y)
      const torso =
        upper *
        smooth(source.shoulder[1] - 0.07, source.shoulder[1] + 0.06, position.y)
      influences.push(
        ['torso', torso],
        ['upperArm', upper - torso],
        ['forearm', 1 - upper - hand],
        ['hand', hand],
      )
    } else if (['thigh', 'shin', 'foot'].includes(metadata.bodySegment)) {
      const thigh = smooth(
        source.knee[1] - 0.07,
        source.knee[1] + 0.07,
        position.y,
      )
      const foot =
        1 - smooth(source.ankle[1] - 0.045, source.ankle[1] + 0.045, position.y)
      const pelvis =
        thigh * smooth(source.hip[1] - 0.12, source.hip[1] + 0.1, position.y)
      influences.push(
        ['pelvis', pelvis],
        ['thigh', thigh - pelvis],
        ['shin', 1 - thigh - foot],
        ['foot', foot],
      )
    } else {
      const head = smooth(
        rig.landmarks.neck[1] - 0.1,
        rig.landmarks.neck[1] + 0.05,
        position.y,
      )
      const pelvis =
        1 -
        smooth(
          rig.landmarks.pelvis[1] - 0.1,
          rig.landmarks.pelvis[1] + 0.16,
          position.y,
        )
      const thigh =
        pelvis *
        (1 - smooth(source.hip[1] - 0.12, source.hip[1] + 0.1, position.y)) *
        smooth(0.025, 0.07, Math.abs(position.x))
      influences.push(
        ['pelvis', pelvis - thigh],
        ['torso', 1 - pelvis - head],
        ['head', head],
        ['thigh', thigh],
      )
    }
    if (/^scapular region/i.test(metadata.anatomyName)) {
      influences.splice(
        0,
        influences.length,
        ['torso', 0.25],
        ['scapula', 0.75],
      )
    }
    let sum = 0
    influences.forEach(([name, weight], index) => {
      result.indices[index] = rig.byKey.get(keyOf(name, side))!.index
      result.weights[index] = Math.max(0, weight)
      sum += result.weights[index]
    })
    result.weights = result.weights.map(
      (weight) => weight / sum,
    ) as SkinInfluence['weights']
    return result
  }
  if (!segment) {
    const candidates = rig.segments.filter(
      (candidate) =>
        candidate.side === null || candidate.side === metadata.side,
    )
    segment = candidates.reduce((best, candidate) =>
      distanceToSegment(position, candidate) < distanceToSegment(position, best)
        ? candidate
        : best,
    )
  }
  const result: SkinInfluence = {
    indices: [segment.index, 0, 0, 0],
    weights: [1, 0, 0, 0],
  }
  if (metadata.tissue === 'bone') return result
  const inferredSide =
    position.x >= 0
      ? rig.landmarks.left.shoulder[0] >= 0
        ? 'left'
        : 'right'
      : rig.landmarks.left.shoulder[0] < 0
        ? 'left'
        : 'right'
  const influenceSide = segment.side ?? metadata.side ?? inferredSide
  const addInfluence = (other: BodySegment, amount: number) => {
    const target = rig.byKey.get(keyOf(other, influenceSide))
    if (!target || amount <= 0) return
    const slot = result.weights.findIndex(
      (weight, index) => index > 0 && weight === 0,
    )
    if (slot < 0) return
    const weight = Math.min(amount, result.weights[0])
    result.indices[slot] = target.index
    result.weights[slot] = weight
    result.weights[0] -= weight
  }
  const t =
    position.clone().sub(segment.start).dot(segment.direction) / segment.length
  const parent: Partial<Record<BodySegment, BodySegment>> = {
    upperArm: 'torso',
    forearm: 'upperArm',
    hand: 'forearm',
    thigh: 'pelvis',
    shin: 'thigh',
    foot: 'shin',
    head: 'torso',
  }
  const child: Partial<Record<BodySegment, BodySegment>> = {
    upperArm: 'forearm',
    forearm: 'hand',
    thigh: 'shin',
    shin: 'foot',
  }
  if (parent[segment.segment])
    addInfluence(parent[segment.segment]!, 0.5 * (1 - smooth(-0.15, 0.22, t)))
  if (child[segment.segment])
    addInfluence(child[segment.segment]!, 0.5 * smooth(0.78, 1.15, t))
  if (segment.segment === 'pelvis' && metadata.muscleId === 'glutes') {
    const thigh = rig.byKey.get(keyOf('thigh', influenceSide))!
    const insertion =
      position.clone().sub(thigh.start).dot(thigh.direction) / thigh.length
    addInfluence('thigh', 0.85 * smooth(-0.04, 0.35, insertion))
  }
  if (
    segment.segment === 'torso' &&
    /rhomboid|trapezius/i.test(metadata.anatomyName)
  ) {
    const blade = rig.byKey.get(keyOf('scapula', influenceSide))!
    addInfluence(
      'scapula',
      0.8 *
        smooth(0.015, 0.095, Math.abs(position.x)) *
        (1 - smooth(0.1, 0.24, Math.abs(position.y - blade.start.y))),
    )
  }
  if (segment.segment === 'torso') {
    addInfluence('pelvis', 0.5 * (1 - smooth(0, 0.23, t)))
    addInfluence('head', 0.4 * smooth(0.88, 1.07, t))
  }
  return result
}

export function inferredMetadata(
  raw: Record<string, unknown>,
  name: string,
): StructureMetadata {
  const system = String(raw.tissue ?? raw.system ?? '').toLowerCase()
  const tissue: Tissue =
    system.includes('skin') || system.includes('integument')
      ? 'skin'
      : system.includes('bone') || system.includes('skelet')
        ? 'bone'
        : 'muscle'
  let segment = String(raw.bodySegment ?? 'torso') as BodySegment
  if (
    tissue === 'bone' &&
    /^scapula[._ ]/i.test(String(raw.anatomyName ?? name))
  )
    segment = 'scapula'
  if (tissue === 'skin') {
    const label = String(raw.anatomyName ?? name).toLowerCase()
    if (
      /\b(anal|urogenital|hypogastric|inguinal|hip|sacral|gluteal)\b/.test(
        label,
      )
    )
      segment = 'pelvis'
    else if (/\b(mental|mentolabial|submental|submandibular)\b/.test(label))
      segment = 'head'
  }
  const side =
    raw.side === 'left' || raw.side === 'L' || raw.side === 'l'
      ? 'left'
      : raw.side === 'right' || raw.side === 'R' || raw.side === 'r'
        ? 'right'
        : null
  const region = raw.muscleId ?? raw.region
  return {
    tissue,
    bodySegment: segment,
    side,
    muscleId: typeof region === 'string' && region.length > 0 ? region : null,
    anatomyName: String(raw.anatomyName ?? name),
  }
}
