import { createClientId } from '@klisteniapp/b2b-client'
import {
  ProductEndpoints,
  RoutineDraftContentSchema,
  GoalProgramDraftContentSchema,
  GoalProgramContentSchema,
  checkRoutineAssignable,
  type RoutineDraftContent,
  type ProductInput,
  type ProductOutput,
  type ProductAccess,
  type ProductIssue,
} from '@klisteniapp/b2b-contracts/product-v2'

export type Routine = ProductOutput<'routine'>
export type Goal = ProductOutput<'goals'>[number]
export type GoalContent = ProductInput<'saveGoal'>['content']
export type Step = RoutineDraftContent['steps'][number]
export type Target = NonNullable<Step['dose']['sets']>
export type RoutineReference = NonNullable<
  GoalContent['stages'][number]['slots'][number]['routine']
>
export type PlanningMutation =
  | 'saveRoutine'
  | 'publishRoutine'
  | 'saveGoal'
  | 'enroll'
  | 'applyPeriod'
export type Attempt = { endpoint: PlanningMutation; payload: string; operationId: string }
export type WorkingCopy<T> = { id: string; content: T; attempt: Attempt | null }

export function routineContent(routine?: Routine): RoutineDraftContent {
  return routine
    ? structuredClone({
        name: routine.name,
        description: routine.description,
        steps: routine.steps,
      })
    : { name: '', description: '', steps: [] }
}
export function goalContent(goal?: Goal): GoalContent {
  return goal
    ? structuredClone({
        name: goal.name,
        goal: goal.goal,
        timeZone: goal.timeZone,
        stages: goal.stages,
      })
    : { name: '', goal: '', timeZone: null, stages: [] }
}
export function blankStep(id: string = createClientId()): Step {
  return {
    id,
    exerciseId: null,
    substitutionPolicy: 'reviewed',
    dose: {
      mode: null,
      sets: null,
      repetitions: null,
      durationSeconds: null,
      load: null,
      restSeconds: { kind: 'fixed', value: 60 },
      laterality: null,
      targetRpe: null,
      notes: '',
    },
  }
}
export function setDoseMode(dose: Step['dose'], mode: Step['dose']['mode']): Step['dose'] {
  return {
    ...dose,
    mode,
    repetitions: mode === 'repetitions' ? dose.repetitions : null,
    durationSeconds: mode === 'duration' ? dose.durationSeconds : null,
  }
}
export function canEditPlanning(
  access: ProductAccess,
  account: string,
  organization: string,
  branch?: string,
) {
  return (
    access.userId === account &&
    access.organizationId === organization &&
    Boolean(branch) &&
    access.accessMode === 'active' &&
    access.capabilities.includes('edit-planning') &&
    (access.role === 'admin' ||
      access.role === 'superadmin' ||
      access.branches.some((grant) => grant.branchId === branch && grant.role === 'coach'))
  )
}

/** Recovery tolerates finite out-of-range edits; the transport still validates before sending. */
export function isRoutineContent(value: unknown): value is RoutineDraftContent {
  if (RoutineDraftContentSchema.safeParse(value).success) return true
  if (!value || typeof value !== 'object' || !('steps' in value) || !Array.isArray(value.steps))
    return false
  function target(value: unknown): unknown {
    if (value === null) return null
    if (!value || typeof value !== 'object') return value
    const v = value as Record<string, unknown>
    if (
      v.kind === 'fixed' &&
      Object.keys(v).length === 2 &&
      typeof v.value === 'number' &&
      Number.isFinite(v.value)
    )
      return { kind: 'fixed', value: 1 }
    if (
      v.kind === 'range' &&
      Object.keys(v).length === 3 &&
      typeof v.min === 'number' &&
      Number.isFinite(v.min) &&
      typeof v.max === 'number' &&
      Number.isFinite(v.max)
    )
      return { kind: 'range', min: 1, max: 1 }
    return value
  }
  const steps = value.steps.map((step: unknown) => {
    if (
      !step ||
      typeof step !== 'object' ||
      !('dose' in step) ||
      !step.dose ||
      typeof step.dose !== 'object'
    )
      return step
    const dose = step.dose as Record<string, unknown>
    const load = dose.load
    return {
      ...step,
      dose: {
        ...dose,
        sets: target(dose.sets),
        repetitions: target(dose.repetitions),
        durationSeconds: target(dose.durationSeconds),
        restSeconds: target(dose.restSeconds),
        load:
          load &&
          typeof load === 'object' &&
          'mode' in load &&
          load.mode === 'external' &&
          'kilograms' in load
            ? { ...load, kilograms: target(load.kilograms) }
            : load,
        targetRpe:
          typeof dose.targetRpe === 'number' && Number.isFinite(dose.targetRpe)
            ? 1
            : dose.targetRpe,
      },
    }
  })
  return RoutineDraftContentSchema.safeParse({ ...value, steps }).success
}
export function isGoalContent(value: unknown): value is GoalContent {
  return GoalProgramDraftContentSchema.safeParse(value).success
}
export function isWorkingCopy<T>(validate: (value: unknown) => value is T) {
  return (value: unknown): value is WorkingCopy<T> => {
    if (!value || typeof value !== 'object') return false
    const v = value as Record<string, unknown>
    if (typeof v.id !== 'string' || !v.id || !validate(v.content)) return false
    if (v.attempt === null) return true
    if (!v.attempt || typeof v.attempt !== 'object') return false
    const a = v.attempt as Record<string, unknown>
    return (
      ['saveRoutine', 'publishRoutine', 'saveGoal', 'enroll', 'applyPeriod'].includes(
        String(a.endpoint),
      ) &&
      typeof a.payload === 'string' &&
      typeof a.operationId === 'string' &&
      a.operationId.length > 0
    )
  }
}
export function mutationAttempt(
  endpoint: PlanningMutation,
  input: unknown,
  previous: Attempt | null,
  newId: () => string = () => createClientId(),
): Attempt {
  const payload = JSON.stringify(input)
  return previous?.endpoint === endpoint && previous.payload === payload
    ? previous
    : { endpoint, payload, operationId: newId() }
}
export function routineIssues(content: RoutineDraftContent): ProductIssue[] {
  const result = checkRoutineAssignable(content)
  return result.ok ? [] : result.issues
}
export function goalIssues(content: GoalContent): ProductIssue[] {
  const result = GoalProgramContentSchema.safeParse(content)
  return result.success
    ? []
    : result.error.issues.map((issue) => ({
        code: 'required',
        path: issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
        stepId: null,
        message: issue.message,
      }))
}
export function stagePosition(stage: GoalContent['stages'][number], today: string) {
  if (!stage.startDate || !stage.endDate) return 'Sin fechas completas'
  return stage.endDate < today ? 'Pasada' : stage.startDate > today ? 'Futura' : 'Actual'
}
export function localToday(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (key: string) => parts.find((p) => p.type === key)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function referenceKey(reference: RoutineReference) {
  return JSON.stringify([reference.programId, reference.version, reference.schemaVersion])
}

/** The exact persisted request can be replayed after a lost response, never merged with newer edits. */
export function readAttempt<K extends PlanningMutation>(
  attempt: Attempt | null,
  endpoint: K,
): ProductInput<K> | null {
  if (!attempt || attempt.endpoint !== endpoint) return null
  try {
    const input: unknown = JSON.parse(attempt.payload)
    if (!input || typeof input !== 'object') return null
    const parsed = ProductEndpoints[endpoint].input.safeParse({
      ...input,
      operationId: attempt.operationId,
    })
    return parsed.success ? (parsed.data as ProductInput<K>) : null
  } catch {
    return null
  }
}
