import assert from 'node:assert/strict'
import test from 'node:test'
import { EXERCISE_PHASES, getExercisePose } from '@klisteniapp/geometry'
import {
  createDefaultPersonalData,
  ExerciseIdSchema,
  PersonalDataSchema,
  type ExerciseId,
  type ProgressData,
} from '@klisteniapp/scene-schema'
import { exercises, muscles, starterRoutine } from '../src/data/exercises.ts'
import { exerciseCycleSeconds, isAlternatingExercise } from '../src/lib/exercise-animation.ts'
import { previewCameras } from '../src/lib/exercise-preview-config.ts'
import { parseProgress, serializeProgress } from '../src/lib/progress.ts'

const legacyIds: ExerciseId[] = [
  'pushup', 'squat', 'glute-bridge', 'dead-bug', 'prone-w', 'calf-raise', 'row',
]
const firstExpansionIds: ExerciseId[] = [
  'full-pushup', 'pike-pushup', 'reverse-lunge', 'lateral-lunge',
  'good-morning', 'bird-dog', 'mountain-climber', 'crunch',
]
const nextExpansionIds: ExerciseId[] = [
  'quarter-squat', 'paused-squat', 'knee-narrow-pushup', 'narrow-pushup',
  'dead-bug-heel-tap', 'quadruped-leg-extension', 'prone-t-raise', 'prone-y-raise',
  'split-squat', 'single-leg-calf-raise', 'bridge-march', 'single-leg-glute-bridge',
]
const thirdExpansionIds: ExerciseId[] = [
  'bent-knee-row', 'dead-bug-arm-only', 'sumo-squat', 'single-leg-deadlift',
  'forward-lunge', 'quadruped-arm-raise', 'prone-hip-extension',
  'supine-march', 'supine-heel-slide', 'plank-shoulder-tap',
]
const newIds = [...firstExpansionIds, ...nextExpansionIds, ...thirdExpansionIds]

test('the expanded catalog keeps stable legacy identities and fills every supported exercise', () => {
  const ids = exercises.map(({ id }) => id)
  assert.deepEqual(new Set(ids), new Set([...legacyIds, ...newIds]))
  assert.equal(ids.length, new Set(ids).size, 'one card per exercise ID')
  assert.deepEqual(new Set(ids), new Set(ExerciseIdSchema.options))
  assert.equal(new Set(exercises.map(({ name }) => name)).size, ids.length)
  assert.equal(new Set(exercises.map(({ shortName }) => shortName)).size, ids.length)
  for (const exercise of exercises) {
    const muscleIds = [...exercise.primaryMuscles, ...exercise.secondaryMuscles]
    assert.equal(new Set(muscleIds).size, muscleIds.length, `${exercise.id}: muscle roles must not overlap`)
    assert.ok(muscleIds.every((id) => muscles[id]?.id === id), `${exercise.id}: each muscle resolves to a definition`)
  }
  assert.deepEqual(starterRoutine.exerciseIds, legacyIds.filter((id) => id !== 'row'))
  const existingIds = new Set([...legacyIds, ...firstExpansionIds])
  assert.deepEqual(
    new Set(exercises.filter(({ id, reps }) => existingIds.has(id) && reps.perSide).map(({ id }) => id)),
    new Set(['dead-bug', 'reverse-lunge', 'lateral-lunge', 'bird-dog', 'mountain-climber']),
    'existing IDs retain the meaning of historical repetition counts',
  )
})

test('every gallery entry has a moving demonstration, instructional phases and a usable capture camera', () => {
  assert.deepEqual(new Set(Object.keys(previewCameras)), new Set(exercises.map(({ id }) => id)))
  for (const exercise of exercises) {
    const camera = previewCameras[exercise.id]
    assert.ok([...camera.position, ...camera.target, camera.height, camera.posterPhase].every(Number.isFinite))
    assert.ok(camera.height > 0)
    assert.ok(camera.posterPhase >= 0 && camera.posterPhase <= 1)
    assert.notDeepEqual(camera.position, camera.target)
    const phases = EXERCISE_PHASES[exercise.id]
    assert.ok(phases?.every((phase) => phase.trim().length > 0), `${exercise.id}: missing phase instructions`)
    const poses = [0, 0.25, 0.5, 0.75].map((phase) => JSON.stringify(getExercisePose(exercise.id, phase)))
    assert.ok(new Set(poses).size > 1, `${exercise.id}: a static fallback is not a demonstration`)
    assert.equal(isAlternatingExercise(exercise.id), exercise.planning.laterality === 'alternating', `${exercise.id}: cycle timing must follow demonstrated alternation`)
    assert.equal(exercise.reps.perSide, exercise.planning.laterality !== 'bilateral', `${exercise.id}: alternating and unilateral doses count each side`)
    assert.ok(exerciseCycleSeconds(exercise.id) > 0)
  }
})

test('the next expansion adds twelve repetition-based exercises without required equipment', () => {
  for (const id of nextExpansionIds) {
    const exercise = exercises.find((item) => item.id === id)
    assert.ok(exercise, id)
    assert.equal(exercise.equipment, 'none', `${id}: no required household or gym element`)
    assert.ok(exercise.reps.min > 0 && exercise.reps.max >= exercise.reps.min)
  }
  for (const id of ['split-squat', 'single-leg-calf-raise', 'single-leg-glute-bridge'] as const) {
    const exercise = exercises.find((item) => item.id === id)!
    assert.equal(exercise.planning.laterality, 'unilateral', `${id}: complete each side in its own series`)
    assert.equal(exercise.reps.perSide, true)
    assert.equal(isAlternatingExercise(id), false, `${id}: a fixed-side preview must not claim to alternate`)
  }
  for (const id of ['dead-bug-heel-tap', 'quadruped-leg-extension', 'bridge-march'] as const) {
    assert.equal(exercises.find((item) => item.id === id)!.planning.laterality, 'alternating')
    assert.equal(isAlternatingExercise(id), true)
  }
})

test('legacy progress and new exercise logs round-trip together without changing IDs or repetitions', () => {
  const data: ProgressData = {
    version: 1,
    workouts: [
      {
        id: 'legacy-workout', date: '2026-10-03', completedAt: '2026-10-03T16:00:00Z',
        durationMinutes: 20,
        exercises: legacyIds.map((exerciseId) => ({ exerciseId, sets: 2, reps: 8 })),
      },
      {
        id: 'expanded-workout', date: '2026-10-04', completedAt: '2026-10-04T17:00:00+02:00',
        durationMinutes: 25,
        exercises: newIds.map((exerciseId, index) => ({ exerciseId, sets: 1, reps: index + 5 })),
      },
    ],
    cardio: [],
  }
  assert.deepEqual(parseProgress(serializeProgress(data)), { data, error: null })
})

test('the third expansion includes an equipped pull and preserves the side-counting contract', () => {
  assert.equal(thirdExpansionIds.length, 10)
  for (const id of thirdExpansionIds) {
    const exercise = exercises.find((item) => item.id === id)!
    assert.ok(exercise, id)
    assert.equal(exercise.equipment, id === 'bent-knee-row' ? 'bar-or-rings' : 'none')
    const expected = ['single-leg-deadlift', 'prone-hip-extension'].includes(id) ? 'unilateral'
      : ['sumo-squat', 'bent-knee-row'].includes(id) ? 'bilateral' : 'alternating'
    assert.equal(exercise.planning.laterality, expected, id)
    assert.equal(exerciseCycleSeconds(id), expected === 'alternating' ? 10 : 6, id)
    assert.ok(exercise.sources.length > 0)
  }
})

test('account routines and historical snapshots preserve all new IDs through export and import', () => {
  const data = createDefaultPersonalData('Prueba de galería', 'Europe/Paris')
  const routine = { id: 'expanded-routine', name: 'Más movimientos', exerciseIds: newIds, sets: 2 }
  data.settings.routines.push(routine)
  data.settings.activeRoutineId = routine.id
  data.progress.workouts.push({
    id: 'account-workout', date: '2026-10-04', completedAt: '2026-10-04T17:00:00+02:00',
    durationMinutes: 25, timeZone: 'Europe/Paris', routineSnapshot: structuredClone(routine),
    exercises: newIds.flatMap((exerciseId) => [
      { exerciseId, sets: 1, reps: 6 },
      { exerciseId, sets: 1, reps: 8 },
    ]),
  })
  assert.deepEqual(PersonalDataSchema.parse(JSON.parse(JSON.stringify(data))), data)
})

test('a full expanded routine retains different repetitions for every completed set', () => {
  const data: ProgressData = {
    version: 1, cardio: [], workouts: [{
      id: 'full-catalog-session', date: '2026-10-04', completedAt: '2026-10-04T17:00:00+02:00',
      durationMinutes: 90,
      exercises: exercises.flatMap(({ id: exerciseId }) => [
        { exerciseId, sets: 1, reps: 6 },
        { exerciseId, sets: 1, reps: 7 },
        { exerciseId, sets: 1, reps: 8 },
      ]),
    }],
  }
  assert.equal(data.workouts[0]!.exercises.length, 111)
  assert.deepEqual(parseProgress(serializeProgress(data)), { data, error: null })
})
