import assert from 'node:assert/strict'
import test from 'node:test'
import { exercises } from '@klisteniapp/catalog-base'
import { getExercisePose } from '@klisteniapp/geometry'
import { getMovementDefinition, isSupportedAnatomyPose } from '../src/movement-library.ts'

test('all preserved catalog movements have authored cameras and finite poses', () => {
  for (const exercise of exercises) {
    const definition = getMovementDefinition(exercise.id)
    assert.equal(definition?.exercise, exercise)
    assert.ok(definition?.camera.height)
    for (const phase of [0, 0.25, 0.5, 0.75]) {
      const pose = getExercisePose(exercise.id, phase)
      assert.ok(pose.pelvis.every(Number.isFinite), `${exercise.id} at ${phase}`)
    }
  }
})

test('unrecognized and equipment-only IDs cannot silently use a fallback animation', () => {
  for (const id of ['machine:lat-pulldown', 'low-row-bar', 'constructor', '__proto__', '', 'SQUAT']) {
    assert.equal(getMovementDefinition(id), undefined)
    assert.equal(isSupportedAnatomyPose(id), false)
  }
  assert.equal(isSupportedAnatomyPose('anatomy'), true)
  assert.equal(getMovementDefinition('anatomy'), undefined)
})
