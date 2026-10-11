import type { ExecutionInput, ProgramVersion } from '@klisteniapp/b2b-contracts/training'

type ProgramSteps = Pick<ProgramVersion, 'steps'>
type ExecutionSet = ExecutionInput['sets'][number]
type SetReference = Pick<ExecutionSet, 'stepId' | 'set' | 'exerciseId'>
export type RuleResult<Code extends string> = { ok: true } | { ok: false; code: Code }
export type ExecutionIssue = 'INVALID_SET' | 'INVALID_SUBSTITUTION' | 'INCOMPLETE_EXECUTION'

export function programExerciseIds(program: ProgramSteps): string[] {
  return [...new Set(program.steps.flatMap((step) => [step.exerciseId, ...step.alternatives]))]
}

export function checkProgramAlternatives(program: ProgramSteps): RuleResult<'INVALID_ALTERNATIVE'> {
  for (const step of program.steps) {
    if (
      new Set(step.alternatives).size !== step.alternatives.length ||
      step.alternatives.includes(step.exerciseId)
    ) {
      return { ok: false, code: 'INVALID_ALTERNATIVE' }
    }
  }
  return { ok: true }
}

/** Drafts may omit substitution reasons while editing, but their references must
 * always point to a prescribed series and an authorized exercise in the snapshot. */
export function isAuthorizedSet(program: ProgramSteps, set: SetReference): boolean {
  const step = program.steps.find((candidate) => candidate.id === set.stepId)
  return (
    step !== undefined &&
    Number.isInteger(set.set) &&
    set.set >= 1 &&
    set.set <= step.sets &&
    (step.exerciseId === set.exerciseId || step.alternatives.includes(set.exerciseId))
  )
}

/** Shape validation belongs to the contracts. These rules relate an execution
 * to its immutable assigned version, independent of transport and inventory. */
export function checkExecution(
  program: ProgramSteps,
  input: Pick<ExecutionInput, 'sets' | 'status'>,
): RuleResult<ExecutionIssue> {
  const steps = new Map(program.steps.map((step) => [step.id, step]))
  const completedSets = new Map<string, Set<number>>()
  for (const set of input.sets) {
    const step = steps.get(set.stepId)
    if (!step || !Number.isInteger(set.set) || set.set < 1 || set.set > step.sets) {
      return { ok: false, code: 'INVALID_SET' }
    }
    const substituted = set.exerciseId !== step.exerciseId
    if (substituted && (!step.alternatives.includes(set.exerciseId) || !set.reason.trim())) {
      return { ok: false, code: 'INVALID_SUBSTITUTION' }
    }
    if (set.reps > 0) {
      const numbers = completedSets.get(step.id) ?? new Set<number>()
      numbers.add(set.set)
      completedSets.set(step.id, numbers)
    }
  }

  if (input.status === 'completed') {
    for (const step of program.steps) {
      const numbers = completedSets.get(step.id)
      for (let number = 1; number <= step.sets; number += 1) {
        if (!numbers?.has(number)) return { ok: false, code: 'INCOMPLETE_EXECUTION' }
      }
    }
  }
  return { ok: true }
}
