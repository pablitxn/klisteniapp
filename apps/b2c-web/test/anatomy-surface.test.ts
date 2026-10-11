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

for (const modelVariant of ['male', 'female'] as const) test(`${modelVariant}: the actual atlas head surfaces clear the mat and supported head/hands stay at calibrated contact through full cycles`, async (context) => {
  const buffer = readFileSync(
    new URL('../../../packages/model-assets/public/models/anatomy.glb', import.meta.url),
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
        new URL('../../../packages/model-assets/public/models/rig-landmarks.json', import.meta.url),
        'utf8',
      ),
    ),
  )
  const headNames = new Set<string>(),
    torsoNames = new Set<string>(),
    handNames = { left: new Set<string>(), right: new Set<string>() },
    footNames = { left: new Set<string>(), right: new Set<string>() },
    kneeNames = { left: new Set<string>(), right: new Set<string>() }
  asset.scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const metadata = inferredMetadata(
      { ...object.parent?.userData, ...object.userData },
      object.name,
    )
    if (metadata.tissue !== 'skin') return
    if (metadata.bodySegment === 'head') headNames.add(metadata.anatomyName)
    if (metadata.bodySegment === 'torso') torsoNames.add(metadata.anatomyName)
    if (metadata.bodySegment === 'hand' && metadata.side)
      handNames[metadata.side].add(metadata.anatomyName)
    if (metadata.bodySegment === 'foot' && metadata.side)
      footNames[metadata.side].add(metadata.anatomyName)
    if (metadata.anatomyName.includes('region of knee') && metadata.side)
      kneeNames[metadata.side].add(metadata.anatomyName)
  })
  assert.ok(
    headNames.size > 50,
    'audit every actual head skin territory, not a proxy radius',
  )
  const anatomy = prepareAnatomy(asset.scene, landmarks, modelVariant)
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
      torso = verticesFor(torsoNames),
      hands = {
        left: verticesFor(handNames.left),
        right: verticesFor(handNames.right),
      },
      feet = {
        left: verticesFor(footNames.left),
        right: verticesFor(footNames.right),
      },
      knees = {
        left: verticesFor(kneeNames.left),
        right: verticesFor(kneeNames.right),
      }
    for (const side of ['left', 'right'] as const) {
      assert.ok(feet[side].length > 0 && knees[side].length > 0)
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
    const additionalSupports: Record<string, [number, number]> = {}
    for (const exercise of [
      'pushup',
      'glute-bridge',
      'dead-bug',
      'prone-w',
      'row',
      'full-pushup',
      'pike-pushup',
      'bird-dog',
      'mountain-climber',
      'crunch',
      'quarter-squat', 'paused-squat', 'knee-narrow-pushup', 'narrow-pushup',
      'dead-bug-heel-tap', 'quadruped-leg-extension', 'prone-t-raise', 'prone-y-raise',
      'split-squat', 'single-leg-calf-raise', 'bridge-march', 'single-leg-glute-bridge',
      'bent-knee-row', 'dead-bug-arm-only', 'sumo-squat', 'single-leg-deadlift',
      'forward-lunge', 'quadruped-arm-raise', 'prone-hip-extension',
      'supine-march', 'supine-heel-slide', 'plank-shoulder-tap',
    ]) {
      let headMinimum = Infinity
      const samples = ['bird-dog', 'mountain-climber', 'quadruped-leg-extension', 'bridge-march', 'dead-bug-heel-tap',
        'dead-bug-arm-only', 'forward-lunge', 'quadruped-arm-raise', 'supine-march', 'supine-heel-slide', 'plank-shoulder-tap'].includes(exercise) ? 100 : 40
      for (let sample = 0; sample <= samples; sample++) {
        const phase = sample / samples
        applyAnatomyPose(anatomy.rig, exercise, phase)
        anatomy.group.updateMatrixWorld(true)
        const recordSupport = (key: string, value: number) => {
          const range = additionalSupports[key] ?? [Infinity, -Infinity]
          additionalSupports[key] = [Math.min(range[0], value), Math.max(range[1], value)]
        }
        for (const side of ['left', 'right'] as const) {
          if (['quarter-squat', 'paused-squat', 'split-squat', 'narrow-pushup'].includes(exercise)
            || (['single-leg-calf-raise', 'single-leg-glute-bridge'].includes(exercise) && side === 'right')
            || (exercise === 'bridge-march' && side === (phase < 0.5 ? 'left' : 'right')))
            recordSupport(exercise + ' foot', minimum(feet[side]))
          if (exercise === 'knee-narrow-pushup') {
            recordSupport(exercise + ' knee', minimum(knees[side]))
          }
          if (exercise === 'dead-bug-heel-tap' && ((phase === 0.25 && side === 'right') || (phase === 0.75 && side === 'left')))
            recordSupport(exercise + ' heel', minimum(feet[side]))
          if (['bent-knee-row', 'sumo-squat', 'supine-heel-slide', 'plank-shoulder-tap'].includes(exercise)
            || (['single-leg-deadlift', 'prone-hip-extension'].includes(exercise) && side === 'right')
            || (exercise === 'supine-march' && side === (phase < 0.5 ? 'left' : 'right')))
            recordSupport(exercise + ' foot', minimum(feet[side]))
          if (exercise === 'forward-lunge') {
            const halfCycle = (phase * 2) % 1
            const trailingSide = phase < 0.5 ? 'left' : 'right'
            if (side === trailingSide || (halfCycle >= 0.25 && halfCycle <= 0.75))
              recordSupport(exercise + ' foot', minimum(feet[side]))
          }
        }
        const headHeight = minimum(head)
        if (['pushup', 'full-pushup', 'knee-narrow-pushup', 'narrow-pushup',
          'pike-pushup', 'prone-w', 'prone-t-raise', 'prone-y-raise',
          'mountain-climber', 'bird-dog', 'prone-hip-extension'].includes(exercise))
          assert.ok(minimum(torso) >= -0.0019, `${exercise} phase ${phase}: actual torso penetrates the mat`)
        if (exercise === 'prone-hip-extension')
          recordSupport(exercise + ' chest', minimum(torso))
        headMinimum = Math.min(headMinimum, headHeight)
        assert.ok(
          headHeight >= 0.0019,
          `${exercise} phase ${phase}: actual head penetrates support plane (${headHeight})`,
        )
        if (['glute-bridge', 'dead-bug', 'bridge-march', 'single-leg-glute-bridge', 'dead-bug-heel-tap',
          'dead-bug-arm-only', 'supine-march', 'supine-heel-slide'].includes(exercise))
          assert.ok(
            Math.abs(headHeight - 0.002) < 1e-5,
            `${exercise}: occiput loses calibrated support`,
          )
        if (['pushup', 'glute-bridge', 'full-pushup', 'pike-pushup', 'mountain-climber', 'bird-dog', 'knee-narrow-pushup', 'narrow-pushup', 'dead-bug-heel-tap', 'quadruped-leg-extension', 'bridge-march', 'single-leg-glute-bridge',
          'quadruped-arm-raise', 'prone-hip-extension', 'supine-march', 'supine-heel-slide', 'plank-shoulder-tap'].includes(exercise))
          for (const side of ['left', 'right'] as const) {
            const handHeight = minimum(hands[side])
            const supportedHand = exercise === 'bird-dog'
              ? phase < 0.5 ? 'right' : 'left' : phase < 0.5 ? 'left' : 'right'
            const planted = !['bird-dog', 'quadruped-arm-raise', 'plank-shoulder-tap'].includes(exercise) || side === supportedHand
            assert.ok(
              planted ? Math.abs(handHeight - 0.002) < 1e-5 : handHeight >= -0.0019,
              `${exercise} ${side} phase ${phase}: actual hand loses support (${handHeight})`,
            )
          }
        if (['full-pushup', 'pike-pushup', 'mountain-climber', 'bird-dog', 'crunch',
          'quarter-squat', 'paused-squat', 'knee-narrow-pushup', 'narrow-pushup',
          'dead-bug-heel-tap', 'quadruped-leg-extension', 'prone-t-raise', 'prone-y-raise',
          'split-squat', 'single-leg-calf-raise', 'bridge-march', 'single-leg-glute-bridge',
          'bent-knee-row', 'dead-bug-arm-only', 'sumo-squat', 'single-leg-deadlift',
          'forward-lunge', 'quadruped-arm-raise', 'prone-hip-extension',
          'supine-march', 'supine-heel-slide', 'plank-shoulder-tap'].includes(exercise))
          for (const side of ['left', 'right'] as const) {
            const footHeight = minimum(feet[side])
            assert.ok(
              footHeight >= -0.0019,
              `${exercise} ${side} phase ${phase}: actual foot penetrates the mat (${footHeight})`,
            )
          }
        if (['bird-dog', 'mountain-climber', 'quadruped-leg-extension', 'knee-narrow-pushup', 'split-squat',
          'forward-lunge', 'quadruped-arm-raise', 'prone-hip-extension', 'plank-shoulder-tap'].includes(exercise))
          for (const side of ['left', 'right'] as const) {
            const kneeHeight = minimum(knees[side])
            assert.ok(
              kneeHeight >= -0.0019,
              `${exercise} ${side} phase ${phase}: actual knee penetrates the mat (${kneeHeight})`,
            )
            const supportedLeg = phase < 0.5 ? 'left' : 'right'
            if ((exercise === 'bird-dog' || exercise === 'quadruped-leg-extension') && side === supportedLeg)
              assert.ok(kneeHeight <= 0.005, `${exercise} ${side}: supported knee floats above the mat (${kneeHeight})`)
            if (exercise === 'quadruped-arm-raise')
              assert.ok(kneeHeight <= 0.005, `${exercise} ${side}: supported knee floats above the mat (${kneeHeight})`)
          }
      }
      measurements[exercise] = Number(headMinimum.toFixed(6))
    }
    context.diagnostic(
      'Actual skin minimum head Y in metres across 41–101 phases; mat top Y = -0.002: ' +
        JSON.stringify(measurements),
    )
    context.diagnostic('Additional support surface ranges in metres: ' + JSON.stringify(additionalSupports))
    for (const [support, [minimum, maximum]] of Object.entries(additionalSupports)) {
      assert.ok(minimum >= -0.0019 && maximum <= 0.005, `${support}: actual support surface loses contact (${minimum}..${maximum})`)
    }
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
