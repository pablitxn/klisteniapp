import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ExerciseIdSchema } from '@klisteniapp/scene-schema'
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Vector3,
} from 'three'
import {
  applyAnatomyPose,
  createAnatomyRig,
  parseAnatomyLandmarks,
  retargetExercisePose,
  vertexInfluences,
} from '../src/lib/anatomy-rig.ts'
import { prepareAnatomy, structureAtFace } from '../src/lib/anatomy-model.ts'
import { previewCameras } from '../src/lib/exercise-preview-config.ts'

const landmarks = parseAnatomyLandmarks(
  JSON.parse(
    readFileSync(
      new URL('../public/models/rig-landmarks.json', import.meta.url),
      'utf8',
    ),
  ),
)
const exercises = ExerciseIdSchema.options
const near = (actual: number, expected: number, tolerance = 1e-7) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    actual + ' should equal ' + expected,
  )
const distance = (a: number[], b: number[]) =>
  Math.hypot(...a.map((value, i) => value - b[i]!))

test('the complete anatomy rest pose is an identity deformation for every source vertex', () => {
  const rig = createAnatomyRig(landmarks)
  applyAnatomyPose(rig, 'squat', 0.4)
  applyAnatomyPose(rig, 'anatomy', 0)
  for (const segment of rig.segments) {
    const deformation = segment.bone.matrix
      .clone()
      .multiply(segment.bindMatrix.clone().invert())
    deformation.elements.forEach((value, index) =>
      near(value, new Matrix4().elements[index]!),
    )
  }
  assert.equal(rig.segments.length, 17)
})

test('all catalog movements retain source shoulder/hip width and every measured limb length', () => {
  for (const exercise of exercises) {
    for (let sample = 0; sample <= 40; sample++) {
      const pose = retargetExercisePose(landmarks, exercise, sample / 40)
      if (!['prone-w', 'prone-t-raise', 'prone-y-raise'].includes(exercise))
        near(
          distance(pose.arms.left.start, pose.arms.right.start),
          distance(landmarks.left.shoulder, landmarks.right.shoulder),
        )
      near(
        distance(pose.legs.left.start, pose.legs.right.start),
        distance(landmarks.left.hip, landmarks.right.hip),
      )
      for (const side of ['left', 'right'] as const) {
        const arm = pose.arms[side],
          leg = pose.legs[side],
          source = landmarks[side]
        near(
          distance(arm.start, arm.joint),
          distance(source.shoulder, source.elbow),
        )
        near(distance(arm.joint, arm.end), distance(source.elbow, source.wrist))
        near(distance(leg.start, leg.joint), distance(source.hip, source.knee))
        near(distance(leg.joint, leg.end), distance(source.knee, source.ankle))
        assert.ok(
          arm.start[0] - pose.pelvis[0] > 0 === source.shoulder[0] > 0,
          'source anatomical side must be retained',
        )
      }
    }
  }
})

test('every animated bone is rigid: unit scale, no reflection, and finite transforms', () => {
  const rig = createAnatomyRig(landmarks)
  for (const exercise of exercises)
    for (const phase of [0, 0.125, 0.25, 0.5, 0.75, 1]) {
      applyAnatomyPose(rig, exercise, phase)
      for (const segment of rig.segments) {
        assert.ok(segment.bone.matrix.elements.every(Number.isFinite))
        near(segment.bone.matrix.determinant(), 1)
        const x = new Vector3(),
          y = new Vector3(),
          z = new Vector3()
        segment.bone.matrix.extractBasis(x, y, z)
        near(x.length(), 1)
        near(y.length(), 1)
        near(z.length(), 1)
        near(x.dot(y), 0)
        near(y.dot(z), 0)
        near(z.dot(x), 0)
      }
    }
})

test('floor supports do not drift: knee-pushup knees, bridge shoulders and resting feet', () => {
  for (let sample = 0; sample <= 30; sample++) {
    const phase = sample / 30,
      pushup = retargetExercisePose(landmarks, 'pushup', phase)
    for (const side of ['left', 'right'] as const)
      near(pushup.legs[side].joint[1], 0.11)
    const bridge = retargetExercisePose(landmarks, 'glute-bridge', phase)
    near(
      (bridge.arms.left.start[1] + bridge.arms.right.start[1]) / 2,
      landmarks.support?.shoulderHeight ?? 0.105,
    )
    near((bridge.arms.left.start[2] + bridge.arms.right.start[2]) / 2, -0.47)
    for (const exercise of ['squat', 'glute-bridge']) {
      const pose = retargetExercisePose(landmarks, exercise, phase)
      for (const side of ['left', 'right'] as const)
        near(pose.legs[side].end[1], landmarks[side].ankle[1], 1e-5)
    }
  }
})

test('new floor movements keep their supporting hands, knees and ankles fixed', () => {
  for (const exercise of ['full-pushup', 'pike-pushup', 'mountain-climber', 'bird-dog']) {
    const rest = retargetExercisePose(landmarks, exercise, 0)
    for (let sample = 0; sample <= 100; sample++) {
      const phase = sample / 100
      const pose = retargetExercisePose(landmarks, exercise, phase)
      // Anatomical left has positive X, opposite the teaching template's labels.
      const supportedLeg = phase < 0.5 ? 'left' : 'right'
      const supportedHand = supportedLeg === 'left' ? 'right' : 'left'
      for (const side of ['left', 'right'] as const) {
        if (exercise !== 'bird-dog' || side === supportedHand)
          near(distance(pose.arms[side].end, rest.arms[side].end), 0, 1e-6)
        if (exercise === 'full-pushup' || exercise === 'pike-pushup' || side === supportedLeg)
          near(distance(pose.legs[side].end, rest.legs[side].end), 0, 1e-6)
        if (exercise === 'bird-dog' && side === supportedLeg)
          near(distance(pose.legs[side].joint, rest.legs[side].joint), 0, 1e-6)
      }
    }
  }
})

test('new cycles close and remain continuous between support changes', () => {
  for (const exercise of [
    'full-pushup', 'pike-pushup', 'reverse-lunge', 'lateral-lunge',
    'good-morning', 'bird-dog', 'mountain-climber', 'crunch',
    'quarter-squat', 'paused-squat', 'knee-narrow-pushup', 'narrow-pushup',
    'dead-bug-heel-tap', 'quadruped-leg-extension', 'prone-t-raise', 'prone-y-raise',
    'split-squat', 'single-leg-calf-raise', 'bridge-march', 'single-leg-glute-bridge',
    'bent-knee-row', 'dead-bug-arm-only', 'sumo-squat', 'single-leg-deadlift',
    'forward-lunge', 'quadruped-arm-raise', 'prone-hip-extension',
    'supine-march', 'supine-heel-slide', 'plank-shoulder-tap',
  ]) {
    const rest = retargetExercisePose(landmarks, exercise, 0)
    let previous = rest
    for (let sample = 1; sample <= 1000; sample++) {
      const phase = sample / 1000
      const pose = retargetExercisePose(landmarks, exercise, phase)
      for (const side of ['left', 'right'] as const)
        for (const limb of ['arms', 'legs'] as const)
          for (const point of ['start', 'joint', 'end'] as const) {
            assert.ok(
              distance(pose[limb][side][point], previous[limb][side][point]) < 0.02,
              `${exercise} phase ${phase}: ${side} ${limb} ${point} jumps across a support transition`,
            )
            if (sample === 1000)
              near(distance(pose[limb][side][point], rest[limb][side][point]), 0, 1e-6)
          }
      previous = pose
    }
  }
})

test('additional variants preserve fixed supports and unilateral sets never switch their supporting leg', () => {
  for (const exercise of ['quarter-squat', 'paused-squat', 'knee-narrow-pushup', 'narrow-pushup',
    'dead-bug-heel-tap', 'quadruped-leg-extension', 'split-squat', 'single-leg-glute-bridge', 'bridge-march']) {
    const rest = retargetExercisePose(landmarks, exercise, 0)
    for (let frame = 0; frame <= 100; frame++) {
      const phase = frame / 100
      const pose = retargetExercisePose(landmarks, exercise, phase)
      for (const side of ['left', 'right'] as const) {
        if (!['quarter-squat', 'paused-squat', 'split-squat'].includes(exercise))
          near(distance(pose.arms[side].end, rest.arms[side].end), 0, 1e-6)
        if (['quarter-squat', 'paused-squat', 'split-squat', 'narrow-pushup'].includes(exercise)
          || (exercise === 'single-leg-glute-bridge' && side === 'right')
          || (exercise === 'bridge-march' && side === (phase < 0.5 ? 'left' : 'right')))
          near(distance(pose.legs[side].end, rest.legs[side].end), 0, 1e-6)
        if (exercise === 'single-leg-glute-bridge' && side === 'left')
          assert.ok(pose.legs[side].end[1] > pose.legs.right.end[1] + 0.5)
        if (exercise === 'quadruped-leg-extension' && side === (phase < 0.5 ? 'left' : 'right'))
          near(distance(pose.legs[side].joint, rest.legs[side].joint), 0, 1e-6)
      }
    }
  }
})

test('expanded movements retain planted supports, fixed tabletop legs and unilateral balance', () => {
  for (const exercise of ['bent-knee-row', 'dead-bug-arm-only', 'sumo-squat', 'single-leg-deadlift',
    'quadruped-arm-raise', 'prone-hip-extension', 'supine-march', 'supine-heel-slide', 'plank-shoulder-tap']) {
    const rest = retargetExercisePose(landmarks, exercise, 0)
    for (let sample = 0; sample <= 100; sample++) {
      const phase = sample / 100
      const pose = retargetExercisePose(landmarks, exercise, phase)
      for (const side of ['left', 'right'] as const) {
        const supportSide = phase < 0.5 ? 'left' : 'right'
        if (['sumo-squat', 'bent-knee-row', 'quadruped-arm-raise', 'plank-shoulder-tap'].includes(exercise)
          || (exercise === 'single-leg-deadlift' && side === 'right')
          || (exercise === 'prone-hip-extension' && side === 'right')
          || (exercise === 'supine-march' && side === supportSide))
          near(distance(pose.legs[side].end, rest.legs[side].end), 0, 1e-6)
        if (exercise === 'dead-bug-arm-only')
          for (const point of ['start', 'joint', 'end'] as const)
            near(distance(pose.legs[side][point], rest.legs[side][point]), 0, 1e-6)
        if (exercise === 'quadruped-arm-raise')
          near(distance(pose.legs[side].joint, rest.legs[side].joint), 0, 1e-6)
        if (exercise === 'bent-knee-row') {
          near(distance(pose.legs[side].joint, rest.legs[side].joint), 0, 1e-6)
          near(pose.arms[side].end[1], 1.04, 1e-6)
          near(pose.arms[side].end[2], -0.66, 1e-6)
          const thigh = new Vector3(...pose.legs[side].start).sub(new Vector3(...pose.legs[side].joint)).normalize()
          near(thigh.dot(new Vector3(0, Math.cos(pose.torsoAngle), Math.sin(pose.torsoAngle))), 1, 1e-6)
          if (sample === 0)
            near(distance(pose.arms[side].start, pose.arms[side].end),
              distance(landmarks[side].shoulder, landmarks[side].elbow) + distance(landmarks[side].elbow, landmarks[side].wrist), 0.00002)
        }
        if (['bent-knee-row', 'supine-march', 'supine-heel-slide'].includes(exercise)
          || (['quadruped-arm-raise', 'plank-shoulder-tap'].includes(exercise) && side === supportSide))
          near(distance(pose.arms[side].end, rest.arms[side].end), 0, 1e-6)
        if (exercise === 'single-leg-deadlift' && side === 'left')
          assert.ok(pose.legs.left.end[1] > pose.legs.right.end[1] + 0.02)
      }
    }
  }
})

test('expanded preview cameras frame complete movement cycles with room for source surfaces', () => {
  const rig = createAnatomyRig(landmarks)
  for (const exercise of ['bent-knee-row', 'dead-bug-arm-only', 'sumo-squat', 'single-leg-deadlift',
    'forward-lunge', 'quadruped-arm-raise', 'prone-hip-extension', 'supine-march',
    'supine-heel-slide', 'plank-shoulder-tap'] as const) {
    const config = previewCameras[exercise]
    const half = config.height / 2
    const camera = new OrthographicCamera(-half, half, half, -half, 0.01, 80)
    camera.position.set(...config.position)
    camera.lookAt(...config.target)
    camera.updateMatrixWorld(true)
    for (let sample = 0; sample <= 40; sample++) {
      applyAnatomyPose(rig, exercise, sample / 40)
      for (const segment of rig.segments) {
        const deformation = segment.bone.matrix.clone().multiply(segment.bindMatrix.clone().invert())
        for (const source of [segment.start, segment.end]) {
          const target = source.clone().applyMatrix4(deformation)
          // Sample the source anchor plus an anatomical surface margin, including
          // toes and fingers, with the exact square orthographic preview camera.
          for (const offset of [new Vector3(), new Vector3(0.09, 0, 0), new Vector3(-0.09, 0, 0),
            new Vector3(0, 0.09, 0), new Vector3(0, -0.09, 0), new Vector3(0, 0, 0.09), new Vector3(0, 0, -0.09)]) {
            const projected = target.clone().add(offset).project(camera)
            assert.ok(Math.max(Math.abs(projected.x), Math.abs(projected.y)) < 0.96,
              `${exercise} phase ${sample / 40}: ${segment.key} leaves preview frame`)
          }
        }
      }
    }
  }
  rig.skeleton.dispose()
})

test('all skin weights are finite, positive, normalized and point to real bones', () => {
  const rig = createAnatomyRig(landmarks)
  for (const segment of rig.segments) {
    for (const amount of [-0.2, 0, 0.1, 0.5, 0.9, 1, 1.2]) {
      const position = segment.start
        .clone()
        .lerp(segment.end, amount)
        .add(new Vector3(0.015, 0, 0.02))
      for (const tissue of ['bone', 'muscle', 'skin'] as const) {
        const result = vertexInfluences(rig, position, {
          tissue,
          bodySegment: segment.segment,
          side: segment.side,
          muscleId: null,
          anatomyName: 'test',
        })
        near(
          result.weights.reduce((sum, value) => sum + value, 0),
          1,
        )
        assert.ok(
          result.weights.every(
            (value) => Number.isFinite(value) && value >= 0 && value <= 1,
          ),
        )
        assert.ok(
          result.indices.every(
            (index) =>
              Number.isInteger(index) &&
              index >= 0 &&
              index < rig.segments.length,
          ),
        )
        if (tissue === 'bone') assert.deepEqual(result.weights, [1, 0, 0, 0])
      }
    }
  }
})

test('batching retains source transforms, tendon colors and exact structure picking ranges', () => {
  const source = new Group()
  for (const [index, name] of ['First muscle', 'Second muscle'].entries()) {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([0, 1, 0, 0.1, 1, 0, 0, 1.1, 0], 3),
    )
    geometry.setAttribute(
      'color',
      new Float32BufferAttribute(
        [0.8, 0.3, 0.2, 0.9, 0.85, 0.7, 0.8, 0.3, 0.2],
        3,
      ),
    )
    const mesh = new Mesh(geometry, new MeshStandardMaterial())
    mesh.position.x = index * 0.1
    mesh.userData = {
      tissue: 'muscle',
      bodySegment: 'torso',
      muscleId: 'pectorals',
      anatomyName: name,
    }
    source.add(mesh)
  }
  const anatomy = prepareAnatomy(source, landmarks)
  assert.equal(anatomy.batches.length, 1)
  assert.equal(anatomy.sourceStructures, 2)
  assert.equal(anatomy.triangles, 2)
  const batch = anatomy.batches[0]!
  assert.equal(structureAtFace(batch, 0)?.name, 'First muscle')
  assert.equal(structureAtFace(batch, 1)?.name, 'Second muscle')
  assert.equal(structureAtFace(batch, 2), undefined)
  near(batch.mesh.geometry.getAttribute('position').getX(3), 0.1)
  near(batch.mesh.geometry.getAttribute('color').getY(1), 0.85)
  anatomy.dispose()
})

test('coincident boundaries of skin territories deform together without changing source surfaces', () => {
  const source = new Group()
  for (const segment of ['torso', 'upperArm']) {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        [0.18, 1.45, 0, 0.19, 1.46, 0, 0.18, 1.46, 0.01],
        3,
      ),
    )
    const mesh = new Mesh(geometry, new MeshStandardMaterial())
    mesh.userData = {
      tissue: 'skin',
      bodySegment: segment,
      side: 'left',
      anatomyName: segment + ' skin',
    }
    source.add(mesh)
  }
  const anatomy = prepareAnatomy(source, landmarks),
    mesh = anatomy.batches[0]!.mesh
  applyAnatomyPose(anatomy.rig, 'squat', 0.5)
  const a = new Vector3(),
    b = new Vector3()
  for (let i = 0; i < 3; i++) {
    mesh.getVertexPosition(i, a)
    mesh.getVertexPosition(i + 3, b)
    near(a.distanceTo(b), 0)
    assert.deepEqual(
      Array.from(mesh.geometry.getAttribute('skinWeight').array).slice(
        i * 4,
        i * 4 + 4,
      ),
      Array.from(mesh.geometry.getAttribute('skinWeight').array).slice(
        (i + 3) * 4,
        (i + 3) * 4 + 4,
      ),
    )
  }
  assert.equal(mesh.geometry.getAttribute('position').count, 6)
  assert.equal(mesh.geometry.index!.count, 6)
  anatomy.dispose()
})

test('the W moves each source scapula medially with attached humeral heads and returns to rest', () => {
  const rig = createAnatomyRig(landmarks)
  applyAnatomyPose(rig, 'prone-w', 0)
  const first = rig.byKey.get('scapula.left')!.bone.matrix.clone()
  applyAnatomyPose(rig, 'prone-w', 0.5)
  const retracted = rig.byKey.get('scapula.left')!.bone.matrix
  assert.ok(
    retracted.elements[12]! < first.elements[12]!,
    'anatomical left scapula moves medially',
  )
  assert.ok(
    Math.abs(retracted.elements[12]! - first.elements[12]!) < 0.02,
    'small controlled scapular excursion',
  )
  applyAnatomyPose(rig, 'anatomy', 0)
  assert.deepEqual(
    rig.byKey.get('scapula.left')!.bone.matrix.elements,
    rig.byKey.get('scapula.left')!.bindMatrix.elements,
  )
})

test('verified skin T-junctions subdivide existing faces and retain source structure picking', () => {
  const source = new Group()
  for (const [name, segment, vertices] of [
    ['Torso', 'torso', [0.16, 1.35, 0, 0.2, 1.35, 0, 0.18, 1.4, 0.01]],
    ['Arm', 'upperArm', [0.18, 1.35, 0, 0.18, 1.31, 0, 0.2, 1.32, 0.02]],
  ] as const) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    const mesh = new Mesh(geometry, new MeshStandardMaterial())
    mesh.userData = {
      tissue: 'skin',
      bodySegment: segment,
      side: 'left',
      anatomyName: name,
    }
    source.add(mesh)
  }
  const anatomy = prepareAnatomy(source, landmarks),
    batch = anatomy.batches[0]!
  assert.equal(
    batch.mesh.geometry.getAttribute('position').count,
    6,
    'reuse the exact source junction vertex',
  )
  assert.equal(anatomy.triangles, 3, 'split one existing triangle into two')
  assert.equal(structureAtFace(batch, 0)?.name, 'Torso')
  assert.equal(structureAtFace(batch, 1)?.name, 'Torso')
  assert.equal(structureAtFace(batch, 2)?.name, 'Arm')
  const index = batch.mesh.geometry.index!
  assert.ok(
    Array.from(index.array).slice(0, 6).includes(3),
    'both territories share the same animated junction',
  )
  anatomy.dispose()
})

test('small source axillary gaps retain one local deformation without welding or filling geometry', () => {
  const source = new Group()
  for (const [name, segment, vertices] of [
    [
      'Lateral region of thorax.l',
      'torso',
      [0.18, 1.35, 0.001, 0.14, 1.34, 0, 0.15, 1.3, 0],
    ],
    [
      'Posterior region of arm.l',
      'upperArm',
      [0.17, 1.33, 0, 0.2, 1.33, 0, 0.18, 1.37, 0],
    ],
  ] as const) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    const mesh = new Mesh(geometry, new MeshStandardMaterial())
    mesh.userData = {
      tissue: 'skin',
      bodySegment: segment,
      side: 'left',
      anatomyName: name,
    }
    source.add(mesh)
  }
  const anatomy = prepareAnatomy(source, landmarks),
    mesh = anatomy.batches[0]!.mesh
  assert.equal(mesh.geometry.index!.count, 6, 'no caps or bridging faces')
  near(mesh.geometry.getAttribute('position').getZ(0), 0.001, 1e-9)
  const weights = mesh.geometry.getAttribute('skinWeight'),
    indices = mesh.geometry.getAttribute('skinIndex')
  for (const index of [3, 4, 5])
    for (let slot = 0; slot < 4; slot++) {
      near(weights.getComponent(index, slot), weights.getComponent(0, slot))
      assert.equal(
        indices.getComponent(index, slot),
        indices.getComponent(0, slot),
      )
    }
  anatomy.dispose()
})
