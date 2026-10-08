import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { YogaAsanaIdSchema } from '@klisteniapp/scene-schema'
import { createAnatomyRig, parseAnatomyLandmarks, type StructureMetadata } from '../src/lib/anatomy-rig.ts'
import { applyYogaPose, getYogaPose } from '../src/lib/yoga-rig.ts'
import { applyYogaSpine, createYogaAnatomyRig, prepareYogaAnatomy, yogaVertexInfluences } from '../src/lib/yoga-anatomy.ts'
import { applyYogaMotion, createYogaMotion } from '../src/lib/yoga-motion.ts'
import { asanas } from '../src/data/yoga.ts'

const landmarks = parseAnatomyLandmarks(JSON.parse(readFileSync(new URL('../public/models/rig-landmarks.json', import.meta.url), 'utf8')))
const near = (a: number, b: number, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`)
const metadata: StructureMetadata = { tissue: 'skin', bodySegment: 'torso', side: null, muscleId: null, anatomyName: 'trunk' }

test('Yoga axial controls are opt-in and keep the default exercise rig unchanged', () => {
  const defaultRig = createAnatomyRig(landmarks), yogaRig = createYogaAnatomyRig(landmarks)
  assert.equal(defaultRig.segments.length, 17)
  assert.equal(yogaRig.segments.length, 28)
  for (const [index, segment] of defaultRig.segments.entries()) {
    assert.deepEqual(yogaRig.segments[index]!.bindMatrix, segment.bindMatrix)
    assert.equal(yogaRig.segments[index]!.key, segment.key)
  }
  const before = defaultRig.segments.map(segment => segment.bone.matrix.clone())
  applyYogaSpine(defaultRig, getYogaPose(landmarks, 'marjaryasana'))
  assert.deepEqual(defaultRig.segments.map(segment => segment.bone.matrix), before)
  defaultRig.skeleton.dispose(); yogaRig.skeleton.dispose()
})

test('the Yoga spine rounds and extends visibly, keeps supported endpoints, and never scales its frames', () => {
  const rig = createYogaAnatomyRig(landmarks)
  const bind = rig.segments.map(segment => segment.bindMatrix.clone())
  for (const id of YogaAsanaIdSchema.options) for (const side of ['left', 'right'] as const) {
    const pose = applyYogaPose(rig, id, side)
    const base = rig.segments.slice(0, 17).map(segment => segment.bone.matrix.clone())
    applyYogaSpine(rig, pose)
    assert.deepEqual(rig.segments.slice(0, 17).map(segment => segment.bone.matrix), base, `${id} moved a supported limb`)
    for (const [index, segment] of rig.segments.entries()) {
      near(segment.bone.matrix.determinant(), 1)
      assert.deepEqual(segment.bindMatrix, bind[index])
      assert.deepEqual(segment.bone.matrix, segment.bone.matrixWorld)
    }
    const torso = rig.byKey.get('torso')!
    for (const index of [0, 6, 7, 8]) {
      const control = rig.byKey.get(`yoga.spine.${index}`)!
      const target = control.start.clone().sub(torso.start).applyQuaternion(pose.torsoRotation).add(new Vector3(...pose.pelvis))
      near(new Vector3().setFromMatrixPosition(control.bone.matrix).distanceTo(target), 0)
    }
    if (id === 'marjaryasana' || id === 'bitilasana') {
      const control = rig.byKey.get('yoga.spine.3')!
      const baseline = control.start.clone().sub(torso.start).applyQuaternion(pose.torsoRotation).add(new Vector3(...pose.pelvis))
      const difference = new Vector3().setFromMatrixPosition(control.bone.matrix).sub(baseline)
      assert.ok(difference.length() > 0.03, `${id} has no visible axial curvature`)
      assert.equal(Math.sign(difference.y), id === 'marjaryasana' ? 1 : -1)
      applyYogaSpine(rig, { ...pose, spineActivation: 0 })
      near(new Vector3().setFromMatrixPosition(control.bone.matrix).distanceTo(baseline), 0)
    }
  }
  applyYogaPose(rig, 'tadasana')
  applyYogaSpine(rig, getYogaPose(landmarks, 'tadasana'))
  for (const segment of rig.segments.slice(17)) {
    const delta = segment.bone.matrix.clone().multiply(segment.bindMatrix.clone().invert())
    for (let index = 0; index < 16; index++) near(delta.elements[index]!, new Matrix4().elements[index]!)
  }
  rig.skeleton.dispose()
})

test('soft tissue weights remain continuous; every rigid bone structure shares one axial transform', () => {
  const rig = createYogaAnatomyRig(landmarks), torso = rig.byKey.get('torso')!
  const centre = torso.start.clone().lerp(torso.end, 0.44)
  const rigid = { ...metadata, tissue: 'bone' as const }
  const reference = yogaVertexInfluences(rig, centre, rigid, centre)
  for (let step = 0; step <= 200; step++) {
    const position = torso.start.clone().lerp(torso.end, step / 200).add(new Vector3(0.06, 0, 0.08))
    assert.deepEqual(yogaVertexInfluences(rig, position, rigid, centre), reference)
    for (const tissue of ['skin', 'muscle'] as const) {
      const influence = yogaVertexInfluences(rig, position, { ...metadata, tissue })
      near(influence.weights.reduce((sum, value) => sum + value, 0), 1)
      assert.ok(influence.weights.every(value => Number.isFinite(value) && value >= 0))
      assert.ok(influence.indices.every(index => index >= 0 && index < rig.segments.length))
      const nearby = yogaVertexInfluences(rig, position.clone().add(new Vector3(0, 1e-6, 0)), { ...metadata, tissue })
      const dense = (value: typeof influence) => {
        const weights = new Array<number>(rig.segments.length).fill(0)
        value.indices.forEach((index, slot) => { weights[index]! += value.weights[slot]! })
        return weights
      }
      const a = dense(influence), b = dense(nearby)
      assert.ok(a.every((value, index) => Math.abs(value - b[index]!) < 0.0001), 'axial weight seam')
    }
  }
  assert.deepEqual(reference.weights, [1, 0, 0, 0])
  for (const height of [0, 0.08, 0.14, 0.20]) {
    const position = new Vector3(0.15, landmarks.pelvis[1] + height, -0.08)
    const lumbar = yogaVertexInfluences(rig, position, { ...metadata, bodySegment: 'torso' })
    for (const bodySegment of ['pelvis', 'thigh'] as const)
      assert.deepEqual(yogaVertexInfluences(rig, position, { ...metadata, bodySegment }), lumbar,
        `source ${bodySegment} label leaves a rigid hip flap at the lumbar boundary`)
  }
  for (const x of [0.12, 0.16, 0.20]) for (const height of [-0.20, -0.16, -0.10, 0, 0.04]) {
    const position = new Vector3(x, landmarks.left.shoulder[1] + height, -0.05)
    const chest = yogaVertexInfluences(rig, position, { ...metadata, bodySegment: 'torso' })
    for (const bodySegment of ['scapula', 'upperArm'] as const)
      assert.deepEqual(yogaVertexInfluences(rig, position, { ...metadata, bodySegment }), chest,
        `source ${bodySegment} label opens an axillary seam`)
  }
  rig.skeleton.dispose()
})

test('shoulder corrections retain outward skin faces in deep folds and overhead elevation', async () => {
  const file = readFileSync(new URL('../public/models/anatomy.glb', import.meta.url))
  const asset = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')
  const edge = new Vector3(), sourceNormal = new Vector3(), posedNormal = new Vector3(), expected = new Vector3(), direction = new Vector3()
  for (const variant of ['male', 'female'] as const) {
    const anatomy = prepareYogaAnatomy(asset.scene, landmarks, variant)
    try {
      const batch = anatomy.batches.find(batch => batch.tissue === 'skin')!, mesh = batch.mesh, geometry = mesh.geometry
      const indices = geometry.index!, weights = geometry.getAttribute('skinWeight'), bones = geometry.getAttribute('skinIndex')
      const positions = geometry.getAttribute('position')
      const source = Array.from({ length: positions.count }, (_, vertex) => new Vector3().fromBufferAttribute(positions, vertex))
      const deformed = source.map(() => new Vector3())
      const regions = batch.structures.filter(structure => /^(Deltoid region|Lateral region of thorax)[.]/.test(structure.name))
      for (const id of ['paschimottanasana', 'uttanasana', 'utkatasana', 'anjaneyasana'] as const) {
        applyYogaPose(anatomy.rig, id)
        deformed.forEach((position, vertex) => mesh.getVertexPosition(vertex, position))
        const transforms = anatomy.rig.segments.map(segment => segment.bone.matrixWorld.clone().multiply(segment.bindMatrix.clone().invert()))
        for (const region of regions) {
          let reversedArea = 0
          for (let corner = region.startFace * 3; corner < region.endFace * 3; corner += 3) {
            const triangle = [indices.getX(corner), indices.getX(corner + 1), indices.getX(corner + 2)]
            const [a, b, c] = triangle as [number, number, number]
            sourceNormal.subVectors(source[b]!, source[a]!).cross(edge.subVectors(source[c]!, source[a]!))
            const area = sourceNormal.length() / 2
            if (area < 1e-10) continue
            sourceNormal.normalize()
            posedNormal.subVectors(deformed[b]!, deformed[a]!).cross(edge.subVectors(deformed[c]!, deformed[a]!)).normalize()
            expected.set(0, 0, 0)
            for (const vertex of triangle) for (let slot = 0; slot < 4; slot++) {
              const weight = weights.getComponent(vertex, slot) / 3
              if (weight > 0) expected.addScaledVector(direction.copy(sourceNormal).transformDirection(transforms[bones.getComponent(vertex, slot)]!), weight)
            }
            if (posedNormal.dot(expected.normalize()) < -0.1) reversedArea += area
          }
          // A small compressed crease is tolerable; the former 17–40 cm²
          // inverted cap exposed a conspicuous background-visible shoulder cut.
          assert.ok(reversedArea < 0.0002, `${variant} ${id} ${region.name}: ${(reversedArea * 10000).toFixed(2)} cm² of inverted skin`)
        }
      }
    } finally { anatomy.dispose() }
  }
})

test('actual 28-bone Yoga surfaces retain floor contact through every motion, side, transition and peak breath', async () => {
  const file = readFileSync(new URL('../public/models/anatomy.glb', import.meta.url))
  const asset = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')
  const point = new Vector3(), failures: string[] = []
  // Entry/exit are deliberately asynchronous. Audit both paths, their boundaries,
  // the exact teaching frame, and both peaks of the breathing envelope.
  const phases = [0, 0.08, 0.15, 0.22, 0.3, 0.36, 0.43, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9, 0.94, 1]
  for (const variant of ['male', 'female'] as const) {
    const anatomy = prepareYogaAnatomy(asset.scene, landmarks, variant)
    try {
      assert.equal(anatomy.rig.segments.length, 28, 'audit the live Yoga rig, not the exercise fallback')
      for (const tissue of ['skin', 'muscle', 'bone']) {
        const batches = anatomy.batches.filter(batch => batch.tissue === tissue)
        assert.ok(batches.some(batch => Array.from(batch.mesh.geometry.getAttribute('skinIndex').array).some(index => index >= 17)), `${tissue} does not use axial controls`)
      }
      const skinBatch = anatomy.batches.find(batch => batch.tissue === 'skin')!, skin = skinBatch.mesh
      const count = skin.geometry.getAttribute('position').count
      const sourcePositions = skin.geometry.getAttribute('position')
      const weights = skin.geometry.getAttribute('skinWeight'), indices = skin.geometry.getAttribute('skinIndex')
      const contactVertices = new Map<string, number[]>()
      const kneeVertices = { left: new Set<number>(), right: new Set<number>() }
      for (const structure of skinBatch.structures) if (/^Anterior region of knee[.]/.test(structure.name)) {
        const side = structure.name.endsWith('.l') ? 'left' : 'right'
        for (let corner = structure.startFace * 3; corner < structure.endFace * 3; corner++)
          kneeVertices[side].add(skin.geometry.index!.getX(corner))
      }
      for (const name of ['foot.left', 'foot.right', 'hand.left', 'hand.right', 'head']) {
        const index = anatomy.rig.byKey.get(name)!.index, vertices: number[] = []
        for (let vertex = 0; vertex < count; vertex++) for (let slot = 0; slot < 4; slot++)
          if (indices.getComponent(vertex, slot) === index && weights.getComponent(vertex, slot) > 0.999)
            vertices.push(vertex)
        assert.ok(vertices.length > 0, `missing actual ${name} contact surface`)
        contactVertices.set(name, vertices)
      }
      for (const asana of asanas) for (const side of asana.bilateral ? ['both'] as const : ['left', 'right'] as const) {
        const id = asana.id, goal = applyYogaPose(anatomy.rig, id, side)
        const motion = createYogaMotion(anatomy.rig.landmarks, id, side)
        let previous: Quaternion[] | undefined
        for (let frame = 0; frame <= 240; frame++) {
          applyYogaMotion(anatomy.rig, motion, frame / 240)
          const rotations = anatomy.rig.segments.map(segment => new Quaternion().setFromRotationMatrix(segment.bone.matrix))
          if (previous) rotations.forEach((rotation, index) => {
            const delta = rotation.angleTo(previous![index]!)
            if (delta >= 0.2) failures.push(`${variant} ${id} ${side} frame ${frame}: ${anatomy.rig.segments[index]!.key} rotation jumps ${delta.toFixed(4)}rad`)
          })
          previous = rotations
        }
        // Contact reference is the authored hold, not the final preparation
        // frame visited by the continuity audit above.
        applyYogaPose(anatomy.rig, id, side)
        const anchors: { name: string; vertex: number; position: Vector3 }[] = []
        for (const [name, vertices] of contactVertices) {
          // Track the actual lowest skin vertex of a supported terminal. Free
          // feet and contextual arm gestures are covered by the whole-skin scan.
          const movingFoot = id === 'salabhasana'
            || id === 'supta-padangusthasana' && name === `foot.${goal.side}`
            || id === 'vrksasana' && name !== `foot.${goal.side}`
          const fixedHand = ['balasana', 'marjaryasana', 'bitilasana', 'adho-mukha-svanasana', 'bhujangasana', 'setu-bandha-sarvangasana'].includes(id)
          const fixedHead = ['setu-bandha-sarvangasana', 'supta-padangusthasana', 'savasana'].includes(id)
          if (name.startsWith('foot.') ? movingFoot : name.startsWith('hand.') ? !fixedHand : !fixedHead) continue
          let lowest = Infinity, vertex = -1
          const position = new Vector3()
          for (const candidate of vertices) {
            skin.getVertexPosition(candidate, point)
            if (point.y < lowest) { lowest = point.y; vertex = candidate; position.copy(point) }
          }
          if (lowest <= 0.015) anchors.push({ name, vertex, position })
        }
        for (const phase of phases) {
          const pose = applyYogaMotion(anatomy.rig, motion, phase)
          for (const segment of anatomy.rig.segments) assert.ok(segment.bone.matrix.elements.every(Number.isFinite), `${id} ${phase} invalid ${segment.key}`)
          for (const side of ['left', 'right'] as const) {
            const source = anatomy.rig.landmarks[side]
            const distance = (a: number[], b: number[]) => Math.hypot(...a.map((value, axis) => value - b[axis]!))
            near(distance(pose.arms[side].start, pose.arms[side].joint), distance(source.shoulder, source.elbow))
            near(distance(pose.arms[side].joint, pose.arms[side].end), distance(source.elbow, source.wrist))
            near(distance(pose.legs[side].start, pose.legs[side].joint), distance(source.hip, source.knee))
            near(distance(pose.legs[side].joint, pose.legs[side].end), distance(source.knee, source.ankle))
          }
          let bottom = Infinity, pelvicBottom = Infinity
          for (let vertex = 0; vertex < count; vertex++) {
            skin.getVertexPosition(vertex, point)
            bottom = Math.min(bottom, point.y)
            if (Math.abs(sourcePositions.getX(vertex)) < 0.22
              && Math.abs(sourcePositions.getY(vertex) - anatomy.rig.landmarks.pelvis[1]) < 0.15)
              pelvicBottom = Math.min(pelvicBottom, point.y)
          }
          if (bottom < -0.001) failures.push(`${variant} ${id} ${side} phase ${phase}: skin below mat ${bottom.toFixed(5)}m`)
          assert.ok(Number.isFinite(bottom), `${variant} ${id} ${phase} invalid surface bounds`)
          if ((id === 'bhujangasana' || id === 'salabhasana') && pelvicBottom > 0.015)
            failures.push(`${variant} ${id} phase ${phase}: unsupported pelvis floats ${pelvicBottom.toFixed(5)}m above mat`)
          for (const s of ['left', 'right'] as const) {
            const supported = ['balasana', 'marjaryasana', 'bitilasana'].includes(id)
              || id === 'anjaneyasana' && s !== goal.side
              || id === 'adho-mukha-svanasana' && (phase <= 0.08 || phase >= 0.94)
            if (!supported) continue
            let kneeBottom = Infinity
            for (const vertex of kneeVertices[s]) { skin.getVertexPosition(vertex, point); kneeBottom = Math.min(kneeBottom, point.y) }
            if (kneeBottom > 0.015) failures.push(`${variant} ${id} ${side} phase ${phase}: ${s} knee floats ${kneeBottom.toFixed(5)}m above mat`)
          }
          for (const anchor of anchors) {
            skin.getVertexPosition(anchor.vertex, point)
            const drift = point.distanceTo(anchor.position)
            if (drift > 0.001) failures.push(`${variant} ${id} ${side} phase ${phase}: ${anchor.name} skin support drifts ${drift.toFixed(5)}m`)
          }
        }
      }
    } finally { anatomy.dispose() }
  }
  assert.deepEqual(failures, [])
})
