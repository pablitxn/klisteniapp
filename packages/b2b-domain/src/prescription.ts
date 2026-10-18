import {
  GoalProgramContentSchema,
  RoutineDraftContentSchema,
  checkRoutineAssignable,
  type ProductIssue,
  type RoutineDraftContent,
} from '@klisteniapp/b2b-contracts/product-v2'

/** Units belong to their field: repetitions, seconds and kilograms never convert. */
export type NumericTarget =
  | { kind: 'fixed'; value: number }
  | { kind: 'range'; min: number; max: number }

export function targetBounds(target: NumericTarget): readonly [number, number] {
  return target.kind === 'fixed' ? [target.value, target.value] : [target.min, target.max]
}

export function targetContains(target: NumericTarget, actual: number): boolean {
  const [min, max] = targetBounds(target)
  return Number.isFinite(actual) && actual >= min && actual <= max
}

/** Persist this explicit default when creating a step; null still means unset. */
export const DEFAULT_REST_SECONDS = { kind: 'fixed', value: 60 } as const

export function checkPrescription(draft: RoutineDraftContent) {
  return checkRoutineAssignable(RoutineDraftContentSchema.parse(draft))
}

export function checkGoalActivation(value: unknown) {
  const parsed = GoalProgramContentSchema.safeParse(value)
  if (parsed.success) return { ok: true as const, content: parsed.data }
  const issues: ProductIssue[] = parsed.error.issues.map((issue) => ({
    code: 'invalid',
    path: issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
    stepId: null,
    message: issue.message,
  }))
  return { ok: false as const, issues }
}
