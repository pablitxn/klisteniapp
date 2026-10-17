import {
  SessionContentSchema,
  minimumTarget,
  type Dose,
  type ProductIssue,
  type RoutineVersionV2,
  type SessionContent,
} from '@klisteniapp/b2b-contracts/product-v2'

/** Canonical JSON for operation equality. Object order is irrelevant; array
 * order and scalar values are retained. No workout deduplication/normalization. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`
  return JSON.stringify(value)
}
export type SessionPrescription = Pick<RoutineVersionV2, 'steps' | 'relations'>
export function sessionIssues(
  content: SessionContent,
  prescription: SessionPrescription,
  previous?: SessionContent,
): ProductIssue[] {
  const issues: ProductIssue[] = []
  const issue = (message: string, stepId: string | null = null) =>
    issues.push({
      code: 'invalid',
      path: ['content'],
      stepId,
      message,
    })
  const parsed = SessionContentSchema.safeParse(content)
  if (!parsed.success)
    return parsed.error.issues.map((i) => ({
      code: 'invalid',
      path: i.path.map((p) => (typeof p === 'symbol' ? String(p) : p)),
      stepId: null,
      message: i.message,
    }))
  const segments = new Map(content.segments.map((s) => [s.segmentId, s]))
  const steps = new Map(prescription.steps.map((s) => [s.id, s]))
  for (const segment of content.segments) {
    const step = steps.get(segment.originalStepId)
    if (!step) {
      issue('Unknown original routine step', segment.originalStepId)
      continue
    }
    if (segment.exerciseId === step.exerciseId) {
      if (segment.relation !== null || canonicalJson(segment.dose) !== canonicalJson(step.dose))
        issue('Source segment must use the issued prescription', step.id)
    } else {
      const relation = prescription.relations.find((r) => r.id === segment.relation?.id)
      if (
        step.substitutionPolicy === 'blocked' ||
        !relation ||
        relation.sourceExerciseId !== step.exerciseId ||
        canonicalJson(relation) !== canonicalJson(segment.relation) ||
        relation.targetExerciseId !== segment.exerciseId ||
        canonicalJson(relation.targetDose) !== canonicalJson(segment.dose) ||
        relation.conditions.some((c) => !segment.confirmedConditions.includes(c))
      )
        issue(
          'Target segment requires its frozen directed relation, dose and confirmations',
          step.id,
        )
    }
  }
  if (previous) {
    for (const prior of previous.segments) {
      if (canonicalJson(segments.get(prior.segmentId)) !== canonicalJson(prior))
        issue('Retain every prior immutable segment', prior.originalStepId)
    }
    const switched =
      canonicalJson(previous.selectedSegments) !== canonicalJson(content.selectedSegments)
    if (
      switched &&
      previous.sets.some(
        (s) =>
          !content.sets.some(
            (n) => n.performedSetId === s.performedSetId && canonicalJson(n) === canonicalJson(s),
          ),
      )
    )
      issue('Switching segments must retain earlier actuals unchanged')
    for (const set of content.sets) {
      const prior = previous.sets.find((s) => s.performedSetId === set.performedSetId)
      if (
        prior &&
        (prior.segmentId !== set.segmentId ||
          prior.ordinal !== set.ordinal ||
          prior.side !== set.side)
      )
        issue('Performed set identity cannot be relinked')
    }
    if (
      previous.sets.some((s) => !content.sets.some((n) => n.performedSetId === s.performedSetId)) &&
      !content.correctionReason.trim()
    )
      issue('Explain removal of an accepted performed set')
    if (
      (previous.status === 'completed' ||
        content.status === 'void' ||
        previous.performedAt !== content.performedAt) &&
      !content.correctionReason.trim()
    )
      issue('Explain the correction to accepted work')
  } else if (content.status === 'void' && !content.correctionReason.trim())
    issue('Explain the void correction')
  for (const set of content.sets) {
    const segment = segments.get(set.segmentId)
    if (!segment) continue
    const dose = segment.dose
    if (
      (dose.mode === 'repetitions' && (set.repetitions === null || set.durationSeconds !== null)) ||
      (dose.mode === 'duration' && (set.durationSeconds === null || set.repetitions !== null)) ||
      (dose.laterality === 'per-side' ? set.side === 'both' : set.side !== 'both') ||
      (dose.load.mode === 'external' && set.loadKg === null)
    )
      issue('Actual units, side and load must match this segment', segment.originalStepId)
  }
  if (content.status === 'completed') {
    if (!content.explicitCompletion) issue('Explicit completion is required')
    if (!prescription.steps.length) issue('No issued prescription')
    for (const step of prescription.steps) {
      const selected = content.selectedSegments.find((s) => s.originalStepId === step.id)
      const segment = selected ? segments.get(selected.segmentId) : undefined
      if (!segment) {
        issue('Select an effective segment for every original step', step.id)
        continue
      }
      const sides = segment.dose.laterality === 'per-side' ? ['left', 'right'] : ['both']
      for (let ordinal = 1; ordinal <= minimumTarget(segment.dose.sets); ordinal++) {
        for (const side of sides) {
          const set = content.sets.find(
            (s) => s.segmentId === segment.segmentId && s.ordinal === ordinal && s.side === side,
          )
          if (!set || !positiveActual(set, segment.dose))
            issue('Record positive actuals for every required set and side', step.id)
        }
      }
    }
  }
  return issues
}
function positiveActual(set: SessionContent['sets'][number], dose: Dose): boolean {
  return (
    (dose.mode === 'repetitions' ? (set.repetitions ?? 0) > 0 : (set.durationSeconds ?? 0) > 0) &&
    (dose.load.mode !== 'external' || set.loadKg !== null)
  )
}
