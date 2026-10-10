import assert from 'node:assert/strict'
import test from 'node:test'
import { ExerciseIdSchema, validateExercisePlanningCatalog } from '@klisteniapp/scene-schema'
import { exercises, getExercise, exercisePlanning, starterRoutine } from '../src/index.ts'

test('the extracted catalog retains every existing exercise identifier and reviewed planning relation', () => {
  assert.deepEqual(exercises.map(exercise => exercise.id).sort(), [...ExerciseIdSchema.options].sort())
  assert.deepEqual(validateExercisePlanningCatalog(exercises), [])
  for (const exercise of exercises) {
    assert.equal(getExercise(exercise.id), exercise)
    assert.deepEqual(exercise.planning, exercisePlanning[exercise.id])
  }
  assert.ok(starterRoutine)
})

test('unknown gym or imported IDs do not resolve to a personal catalog exercise', () => {
  assert.equal(getExercise('gym:machine-42'), undefined)
  assert.equal(getExercise('constructor'), undefined)
})
