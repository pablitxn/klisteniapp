import assert from 'node:assert/strict'
import test from 'node:test'
import { latestEditorEntity } from '../src/shared/editor/editorEntity.ts'
import type { Exercise, Program } from '@klisteniapp/b2b-contracts'
import {
  exerciseDraft,
  exerciseInput,
  isExerciseDraft,
} from '../src/features/catalog/exerciseDraft.ts'
import {
  isProgramDraft,
  moveProgramStep,
  newProgramStep,
  programDraft,
  programInput,
} from '../src/features/programs/programDraft.ts'
import { readEditorDraft, writeEditorDraft } from '../src/shared/editor/editorDraftStorage.ts'

function exampleExercise(): Exercise {
  return {
    id: 'base-press',
    scope: 'base',
    status: 'published',
    revision: 4,
    version: 2,
    name: 'Press',
    description: 'Control the movement',
    instructions: ['Adjust the seat', 'Push'],
    equipment: 'machine',
    pattern: 'push',
    muscles: ['chest'],
    machineId: 'press',
    compatibleMachineIds: ['cable'],
    animationId: null,
    baseExerciseId: null,
    assets: [
      { id: 'photo', kind: 'image', url: '/photo.jpg', label: 'Seat position', attribution: '' },
    ],
  }
}

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}

test('exercise recovery accepts unfinished content but saving requires complete instructions', () => {
  const unfinished = exerciseDraft()
  assert.equal(isExerciseDraft(unfinished), true)
  const storage = memoryStorage()
  writeEditorDraft(storage, 'new-exercise', unfinished, null)
  assert.deepEqual(readEditorDraft(storage, 'new-exercise', isExerciseDraft)?.value, unfinished)
  assert.throws(() => exerciseInput(unfinished))
  assert.equal(isExerciseDraft({ ...unfinished, machineIds: ['press', null] }), false)
  assert.equal(
    isExerciseDraft({
      ...unfinished,
      assets: [{ ...exampleExercise().assets[0], attribution: undefined }],
    }),
    false,
  )
})

test('exercise save normalizes editable lists while preserving base provenance across variants', () => {
  const base = exampleExercise()
  const draft = {
    ...exerciseDraft(base),
    instructions: ' Adjust seat \n\n Push slowly \n',
    muscles: ' chest, , triceps ',
    machineId: '',
    animationId: '',
  }
  const input = exerciseInput(draft, base)
  assert.deepEqual(input.instructions, ['Adjust seat', 'Push slowly'])
  assert.deepEqual(input.muscles, ['chest', 'triceps'])
  assert.equal(input.baseExerciseId, base.id)
  assert.equal(input.machineId, null)
  assert.equal(input.animationId, null)
  assert.equal(
    exerciseInput(draft, {
      ...base,
      id: 'gym-press',
      scope: 'organization',
      baseExerciseId: base.id,
    }).baseExerciseId,
    base.id,
  )
})

test('editing source exercises or programs cannot mutate the fetched catalog or assigned data', () => {
  const exercise = exampleExercise()
  const draft = exerciseDraft(exercise)
  draft.machineIds.push('other')
  draft.assets[0].label = 'Updated photo'
  assert.deepEqual(exercise.compatibleMachineIds, ['cable'])
  assert.equal(exercise.assets[0].label, 'Seat position')

  const step = { ...newProgramStep(exercise.id), alternatives: ['other'] }
  const program: Program = {
    id: 'program',
    name: 'Training',
    description: '',
    steps: [step],
    revision: 2,
    publishedVersion: null,
  }
  const editable = programDraft(program)
  editable.steps[0].alternatives.push('third')
  editable.steps[0].sets = 5
  assert.deepEqual(program.steps[0].alternatives, ['other'])
  assert.equal(program.steps[0].sets, 3)
})

test('program recovery preserves intermediate dosing but rejects ambiguous or malformed steps', () => {
  const step = { ...newProgramStep('press'), sets: 0 }
  const draft = { name: '', description: '', steps: [step] }
  assert.equal(isProgramDraft(draft), true)
  assert.throws(() => programInput(draft))
  assert.equal(isProgramDraft({ ...draft, steps: [step, { ...step }] }), false)
  assert.equal(isProgramDraft({ ...draft, steps: [{ ...step, loadKg: Infinity }] }), false)
  assert.equal(isProgramDraft({ ...draft, steps: [{ ...step, alternatives: [12] }] }), false)
  assert.equal(isProgramDraft({ ...draft, steps: [{ ...step, restSeconds: undefined }] }), false)
})

test('step reordering preserves identity, dose and alternatives and ignores invalid positions', () => {
  const first = { ...newProgramStep('press'), sets: 5, alternatives: ['cable'] }
  const second = { ...newProgramStep('squat'), loadKg: 20 }
  const steps = [first, second]
  assert.deepEqual(moveProgramStep(steps, 0, 1), [second, first])
  assert.deepEqual(steps, [first, second])
  for (const [index, delta] of [
    [0, -1],
    [1, 1],
    [-1, 1],
    [3, -1],
    [0.5, 1],
    [0, Number.NaN],
  ]) {
    assert.deepEqual(moveProgramStep(steps, index, delta), steps)
  }
})

test('an older list response cannot replace a just-saved editor revision', () => {
  const saved = { id: 'press', revision: 4, name: 'Saved correction' }
  assert.deepEqual(latestEditorEntity(saved, [{ ...saved, revision: 3, name: 'Old name' }]), saved)
  assert.deepEqual(
    latestEditorEntity(saved, [{ id: 'other', revision: 100, name: 'Other' }]),
    saved,
  )
  const remote = { ...saved, revision: 5, name: 'Concurrent change' }
  assert.deepEqual(latestEditorEntity(saved, [remote]), remote)
})

test('timed prescriptions and target effort survive drafts while historical copies remain readable', () => {
  const step = { ...newProgramStep('plank'), reps: null, durationSeconds: 45, targetRpe: 7.5 }
  const draft = { name: 'Fuerza y control', description: '', steps: [step] }
  assert.equal(isProgramDraft(draft), true)
  assert.deepEqual(programInput(draft).steps[0], step)
  assert.throws(() => programInput({ ...draft, steps: [{ ...step, reps: 12 }] }))
  assert.throws(() => programInput({ ...draft, steps: [{ ...step, targetRpe: 11 }] }))
  const legacy = Object.fromEntries(
    Object.entries(newProgramStep('squat')).filter(
      ([key]) => key !== 'durationSeconds' && key !== 'targetRpe',
    ),
  )
  assert.equal(isProgramDraft({ ...draft, steps: [legacy] }), true)
  assert.equal(
    programInput({ ...draft, steps: [legacy] } as unknown as typeof draft).steps[0].durationSeconds,
    null,
  )
})
