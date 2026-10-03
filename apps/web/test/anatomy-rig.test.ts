import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
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

const landmarks = parseAnatomyLandmarks(
  JSON.parse(
    readFileSync(
      new URL('../public/models/rig-landmarks.json', import.meta.url),
      'utf8',
    ),
  ),
)
const exercises = [
  'pushup',
  'squat',
  'row',
  'glute-bridge',
  'dead-bug',
  'prone-w',
  'calf-raise',
]
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

test('all seven movements retain source shoulder/hip width and every measured limb length', () => {
  for (const exercise of exercises) {
    for (let sample = 0; sample <= 40; sample++) {
      const pose = retargetExercisePose(landmarks, exercise, sample / 40)
      if (exercise !== 'prone-w')
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
          arm.start[0] > 0 === source.shoulder[0] > 0,
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
