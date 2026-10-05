import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Mesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mapAnatomyLandmarks, mapAnatomyPoint } from '../src/lib/anatomy-variants.ts'
import { prepareAnatomy, structureAtFace } from '../src/lib/anatomy-model.ts'
import { applyAnatomyPose, parseAnatomyLandmarks, retargetExercisePose } from '../src/lib/anatomy-rig.ts'
import { exercises } from '../src/data/exercises.ts'

const landmarks = parseAnatomyLandmarks(JSON.parse(readFileSync(new URL('../public/models/rig-landmarks.json', import.meta.url), 'utf8')))

test('body presets keep floor/height, symmetric joints and legacy coordinates', () => {
  const female = mapAnatomyLandmarks(landmarks, 'female')
  assert.deepEqual(mapAnatomyLandmarks(landmarks, 'male'), landmarks)
  assert.deepEqual(female.headTop, landmarks.headTop)
  assert.ok(female.left.shoulder[0] < landmarks.left.shoulder[0])
  assert.ok(female.left.hip[0] > landmarks.left.hip[0])
  for (const joint of ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'] as const) {
    assert.equal(female.left[joint][0], -female.right[joint][0])
    assert.equal(female.left[joint][1], landmarks.left[joint][1])
  }
  assert.deepEqual(mapAnatomyPoint([0.1, 0, 0.2], 'female'), [0.1, 0, 0.2])
  const chest = [0.09, 1.335, 0.1] as [number, number, number]
  assert.equal(mapAnatomyPoint(chest, 'female')[2], chest[2])
  assert.ok(mapAnatomyPoint(chest, 'female', true)[2] > chest[2])
})

test('female atlas retains selectable regions and finite poses, leaving the shared GLTF untouched', async () => {
  const file = readFileSync(new URL('../public/models/anatomy.glb', import.meta.url))
  const asset = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')
  const original: { mesh: Mesh; positions: number[] }[] = []
  asset.scene.traverse(object => {
    if (object instanceof Mesh) original.push({ mesh: object, positions: Array.from(object.geometry.getAttribute('position').array) })
  })
  const anatomy = prepareAnatomy(asset.scene, landmarks, 'female')
  try {
    assert.equal(anatomy.sourceStructures, original.length)
    assert.equal(anatomy.group.userData.modelVariant, 'female')
    for (const exercise of ['row', 'bent-knee-row']) {
      for (const phase of [0, 0.25, 0.5, 0.75]) {
        const pose = retargetExercisePose(anatomy.rig.landmarks, exercise, phase)
        for (const side of ['left', 'right'] as const) {
          const wrist = pose.arms[side].end
          assert.ok(Math.abs(wrist[0]) < 0.52, 'grip remains within shared bar supports')
          assert.ok(Math.abs(wrist[1] - 1.04) < 1e-6, 'grip remains at the shared bar height')
          assert.ok(Math.abs(wrist[2] + 0.66) < 1e-6, 'grip remains at the shared bar depth')
        }
      }
    }
    for (const batch of anatomy.batches) {
      assert.ok(batch.structures.length > 0)
      for (const structure of batch.structures) assert.equal(structureAtFace(batch, structure.startFace)?.name, structure.name)
      const normals = batch.mesh.geometry.getAttribute('normal')
      for (let i = 0; i < normals.count; i += 101) {
        assert.ok(Math.abs(new Vector3().fromBufferAttribute(normals, i).length() - 1) < 0.001)
      }
    }
    const point = new Vector3()
    for (const id of ['anatomy', ...exercises.map(exercise => exercise.id)]) {
      for (const phase of [0, 0.25, 0.5, 0.75]) {
        applyAnatomyPose(anatomy.rig, id, phase)
        anatomy.group.updateMatrixWorld(true)
        for (const batch of anatomy.batches) {
          const positions = batch.mesh.geometry.getAttribute('position')
          for (let vertex = 0; vertex < positions.count; vertex += 701) {
            batch.mesh.getVertexPosition(vertex, point)
            assert.ok([point.x, point.y, point.z].every(Number.isFinite), `${id} phase ${phase}`)
            assert.ok(point.length() < 3, `${id} stays inside the shared stage`)
          }
        }
      }
    }
    for (const { mesh, positions } of original) assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array), positions)
  } finally { anatomy.dispose() }
})
