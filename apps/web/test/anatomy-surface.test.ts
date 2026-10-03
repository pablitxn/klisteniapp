import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Mesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  applyAnatomyPose,
  inferredMetadata,
  parseAnatomyLandmarks,
} from '../src/lib/anatomy-rig.ts'
import { prepareAnatomy } from '../src/lib/anatomy-model.ts'

test('the actual atlas head surfaces clear the mat and supported head/hands stay at calibrated contact through full cycles', async (context) => {
  const buffer = readFileSync(
    new URL('../public/models/anatomy.glb', import.meta.url),
  )
  const asset = await new GLTFLoader().parseAsync(
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ),
    '',
  )
  const landmarks = parseAnatomyLandmarks(
    JSON.parse(
      readFileSync(
        new URL('../public/models/rig-landmarks.json', import.meta.url),
        'utf8',
      ),
    ),
  )
  const headNames = new Set<string>(),
    handNames = { left: new Set<string>(), right: new Set<string>() }
  asset.scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const metadata = inferredMetadata(
      { ...object.parent?.userData, ...object.userData },
      object.name,
    )
    if (metadata.tissue !== 'skin') return
    if (metadata.bodySegment === 'head') headNames.add(metadata.anatomyName)
    if (metadata.bodySegment === 'hand' && metadata.side)
      handNames[metadata.side].add(metadata.anatomyName)
  })
  assert.ok(
    headNames.size > 50,
    'audit every actual head skin territory, not a proxy radius',
  )
  const anatomy = prepareAnatomy(asset.scene, landmarks)
  try {
    const skin = anatomy.batches.find((batch) => batch.tissue === 'skin')!
    const index = skin.mesh.geometry.index!
    const verticesFor = (names: Set<string>) => {
      const vertices = new Set<number>()
      for (const structure of skin.structures)
        if (names.has(structure.name)) {
          for (
            let faceIndex = structure.startFace * 3;
            faceIndex < structure.endFace * 3;
            faceIndex++
          )
            vertices.add(index.getX(faceIndex))
        }
      return [...vertices]
    }
    const head = verticesFor(headNames),
      hands = {
        left: verticesFor(handNames.left),
        right: verticesFor(handNames.right),
      }
    const point = new Vector3()
    const minimum = (vertices: number[]) => {
      let result = Infinity
      for (const vertex of vertices) {
        skin.mesh.getVertexPosition(vertex, point)
        result = Math.min(result, point.y)
      }
      return result
    }
    const measurements: Record<string, number> = {}
    for (const exercise of [
      'pushup',
      'glute-bridge',
      'dead-bug',
      'prone-w',
      'row',
    ]) {
      let headMinimum = Infinity
      for (let sample = 0; sample <= 40; sample++) {
        const phase = sample / 40
        applyAnatomyPose(anatomy.rig, exercise, phase)
        anatomy.group.updateMatrixWorld(true)
        const headHeight = minimum(head)
        headMinimum = Math.min(headMinimum, headHeight)
        assert.ok(
          headHeight >= 0.0019,
          `${exercise} phase ${phase}: actual head penetrates support plane (${headHeight})`,
        )
        if (exercise === 'glute-bridge' || exercise === 'dead-bug')
          assert.ok(
            Math.abs(headHeight - 0.002) < 1e-5,
            `${exercise}: occiput loses calibrated support`,
          )
        if (exercise === 'pushup' || exercise === 'glute-bridge')
          for (const side of ['left', 'right'] as const) {
            const handHeight = minimum(hands[side])
            assert.ok(
              Math.abs(handHeight - 0.002) < 1e-5,
              `${exercise} ${side} phase ${phase}: actual hand loses support (${handHeight})`,
            )
          }
      }
      measurements[exercise] = Number(headMinimum.toFixed(6))
    }
    context.diagnostic(
      'Actual skin minimum head Y in metres across 41 phases; mat top Y = -0.002: ' +
        JSON.stringify(measurements),
    )
  } finally {
    anatomy.dispose()
    asset.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.geometry.dispose()
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        material.dispose()
    })
  }
})
