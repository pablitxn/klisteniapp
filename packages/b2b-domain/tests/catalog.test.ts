import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ExerciseInputSchema, type Exercise } from '@klisteniapp/b2b-contracts/catalog'
import { ProgramStepSchema } from '@klisteniapp/b2b-contracts/training'
import {
  exerciseAvailability,
  exerciseMachineIds,
  programAvailability,
  supportsMachine,
} from '../src/catalog.ts'

function exercise(id: string, input: Partial<Exercise> = {}): Exercise {
  return {
    ...ExerciseInputSchema.parse({ name: id, instructions: ['Contenido del ejercicio.'] }),
    id,
    scope: 'base',
    status: 'published',
    version: 1,
    revision: 0,
    ...input,
  }
}

test('model compatibility includes explicit alternatives, without inferring it from equipment labels', () => {
  const press = exercise('press', {
    machineId: 'press-a',
    compatibleMachineIds: ['press-a', 'press-b', 'press-b'],
    equipment: 'machine',
  })
  assert.deepEqual(exerciseMachineIds(press), ['press-a', 'press-b'])
  assert.equal(supportsMachine(press, 'press-a'), true)
  assert.equal(supportsMachine(press, 'press-b'), true)
  assert.equal(supportsMachine(press, 'machine'), false)
  assert.equal(supportsMachine(exercise('bodyweight'), 'press-a'), false)
  assert.deepEqual(press.compatibleMachineIds, ['press-a', 'press-b', 'press-b'])
})

test('availability distinguishes compatible inventory, textual requirements and bodyweight exercises', () => {
  const press = exercise('press', {
    machineId: 'press-a',
    compatibleMachineIds: ['press-b'],
    equipment: 'machine',
  })
  assert.equal(exerciseAvailability(press, new Set(['press-b'])), 'available')
  assert.equal(exerciseAvailability(press, new Set(['leg-press'])), 'unavailable')
  assert.equal(exerciseAvailability(press, new Set()), 'unavailable')
  assert.equal(
    exerciseAvailability(exercise('dumbbell', { equipment: 'dumbbell' }), new Set(['dumbbell'])),
    'equipment-required',
  )
  assert.equal(exerciseAvailability(exercise('bodyweight'), new Set()), 'available')
  assert.equal(
    exerciseAvailability(exercise('empty-requirement', { equipment: '' }), new Set()),
    'available',
  )
  assert.equal(
    exerciseAvailability(
      exercise('explicit-model', { machineId: 'press-a', equipment: 'none' }),
      new Set(),
    ),
    'unavailable',
  )
})

test('assigned snapshot availability follows current inventory while preserving each permitted alternative and historical content', () => {
  const snapshot = {
    steps: [
      ProgramStepSchema.parse({
        id: 'step',
        exerciseId: 'press',
        sets: 3,
        reps: 10,
        alternatives: ['pushup', 'missing'],
      }),
    ],
    exercises: [
      exercise('press', { machineId: 'press-a', equipment: 'machine' }),
      exercise('pushup'),
    ],
  }
  const saved = structuredClone(snapshot)
  assert.deepEqual(programAvailability(snapshot, new Set()), [
    {
      stepId: 'step',
      exercises: [
        { exerciseId: 'press', status: 'unavailable', equipment: 'machine' },
        { exerciseId: 'pushup', status: 'available', equipment: 'none' },
        { exerciseId: 'missing', status: 'unavailable', equipment: '' },
      ],
    },
  ])
  assert.equal(
    programAvailability(snapshot, new Set(['press-a']))[0].exercises[0].status,
    'available',
  )
  assert.deepEqual(snapshot, saved)
})
