import { ProgramInputSchema, type Program, type ProgramStep } from '@klisteniapp/b2b-contracts'

export type ProgramDraft = { name: string; description: string; steps: ProgramStep[] }

export function programDraft(program?: Program): ProgramDraft {
  return {
    name: program?.name ?? '',
    description: program?.description ?? '',
    steps: program?.steps.map((step) => ({ ...step, alternatives: [...step.alternatives] })) ?? [],
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Keep unfinished numeric inputs (including zero) recoverable; validate their range on save. */
function isDraftStep(value: unknown): value is ProgramStep {
  if (!value || typeof value !== 'object') return false
  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'exerciseId' in value &&
    typeof value.exerciseId === 'string' &&
    'sets' in value &&
    isFiniteNumber(value.sets) &&
    'reps' in value &&
    (value.reps === null || isFiniteNumber(value.reps)) &&
    (!('durationSeconds' in value) ||
      value.durationSeconds === null ||
      isFiniteNumber(value.durationSeconds)) &&
    (!('targetRpe' in value) || value.targetRpe === null || isFiniteNumber(value.targetRpe)) &&
    'restSeconds' in value &&
    isFiniteNumber(value.restSeconds) &&
    'loadKg' in value &&
    (value.loadKg === null || isFiniteNumber(value.loadKg)) &&
    'notes' in value &&
    typeof value.notes === 'string' &&
    'alternatives' in value &&
    Array.isArray(value.alternatives) &&
    value.alternatives.length <= 10 &&
    value.alternatives.every((id) => typeof id === 'string')
  )
}

export function isProgramDraft(value: unknown): value is ProgramDraft {
  if (!value || typeof value !== 'object') return false
  return (
    'name' in value &&
    typeof value.name === 'string' &&
    'description' in value &&
    typeof value.description === 'string' &&
    'steps' in value &&
    Array.isArray(value.steps) &&
    value.steps.length <= 100 &&
    value.steps.every(isDraftStep) &&
    new Set(value.steps.map((step) => step.id)).size === value.steps.length
  )
}

export function programInput(draft: ProgramDraft) {
  return ProgramInputSchema.parse(draft)
}

export function newProgramStep(exerciseId: string): ProgramStep {
  return {
    id: crypto.randomUUID(),
    exerciseId,
    sets: 3,
    reps: 10,
    durationSeconds: null,
    targetRpe: null,
    loadKg: null,
    restSeconds: 60,
    alternatives: [],
    notes: '',
  }
}

export function moveProgramStep(steps: ProgramStep[], index: number, delta: number): ProgramStep[] {
  const target = index + delta
  if (
    !Number.isInteger(index) ||
    !Number.isInteger(delta) ||
    index < 0 ||
    index >= steps.length ||
    target < 0 ||
    target >= steps.length
  )
    return steps
  const reordered = [...steps]
  const source = reordered[index]
  reordered[index] = reordered[target]
  reordered[target] = source
  return reordered
}
