import {
  EffectiveSegmentSchema,
  SessionContentSchema,
  minimumTarget,
  type Dose,
  type ReviewedRelation,
  type RoutineVersionV2,
  type SessionContent,
} from '@klisteniapp/b2b-contracts/product-v2'
import type { Exercise } from '@klisteniapp/b2b-contracts/catalog'

type Step = RoutineVersionV2['steps'][number]
export type EffectiveSegment = SessionContent['segments'][number]
export type PerformedSet = SessionContent['sets'][number]
export type AlternativeEnvironment = {
  activeMachineIds: ReadonlySet<string>
  confirmedEquipment: ReadonlySet<string>
}
export type AlternativeState =
  | { kind: 'blocked'; relations: ReviewedRelation[] }
  | { kind: 'empty'; relations: ReviewedRelation[] }
  | { kind: 'reviewed'; relations: ReviewedRelation[] }

/** Block is per step. Old empty manual allowlists must not enter this function
 * as a block; legacy adoption requires a separate frozen v2 supplement. */
export function reviewedAlternatives(
  step: Step,
  relations: readonly ReviewedRelation[],
): AlternativeState {
  if (step.substitutionPolicy === 'blocked') return { kind: 'blocked', relations: [] }
  const directed = relations.filter(
    (r) => r.sourceExerciseId === step.exerciseId && r.targetExerciseId !== step.exerciseId,
  )
  return directed.length
    ? { kind: 'reviewed', relations: structuredClone(directed) }
    : { kind: 'empty', relations: [] }
}

export function targetEquipmentAvailable(
  target: Exercise,
  environment: AlternativeEnvironment,
): boolean {
  const machines = [...(target.machineId ? [target.machineId] : []), ...target.compatibleMachineIds]
  if (machines.length) return machines.some((id) => environment.activeMachineIds.has(id))
  return (
    !target.equipment ||
    target.equipment === 'none' ||
    environment.confirmedEquipment.has(target.equipment)
  )
}

function normalized(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v !== null && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, sort(x)]),
          )
        : v
  return JSON.stringify(sort(value))
}

export function createOriginalSegment(
  step: Step,
  segmentId: string,
  createdAt: string,
): EffectiveSegment {
  return EffectiveSegmentSchema.parse({
    segmentId,
    originalStepId: step.id,
    exerciseId: step.exerciseId,
    dose: step.dose,
    relation: null,
    confirmedConditions: [],
    createdAt,
  })
}

/** The caller chooses fresh identity/time. No actual from the old segment is
 * copied, converted or deleted. A target always uses its independent dose. */
export function createReviewedSegment(
  step: Step,
  frozen: readonly ReviewedRelation[],
  relationId: string,
  confirmedConditions: readonly string[],
  environment: AlternativeEnvironment,
  segmentId: string,
  createdAt: string,
): EffectiveSegment {
  const relation = reviewedAlternatives(step, frozen).relations.find((r) => r.id === relationId)
  if (!relation) throw new Error('REVIEWED_RELATION_UNAVAILABLE')
  if (!targetEquipmentAvailable(relation.target, environment))
    throw new Error('TARGET_EQUIPMENT_UNAVAILABLE')
  if (
    new Set(confirmedConditions).size !== confirmedConditions.length ||
    relation.conditions.some((condition) => !confirmedConditions.includes(condition)) ||
    confirmedConditions.some(
      (condition) =>
        !relation.conditions.includes(condition as ReviewedRelation['conditions'][number]),
    )
  )
    throw new Error('TARGET_CONDITIONS_UNCONFIRMED')
  return EffectiveSegmentSchema.parse({
    segmentId,
    originalStepId: step.id,
    exerciseId: relation.targetExerciseId,
    dose: relation.targetDose,
    relation,
    confirmedConditions: [...confirmedConditions],
    createdAt,
  })
}

/** Switching is an edit, so completion intent must be renewed explicitly. */
export function selectEffectiveSegment(
  content: SessionContent,
  segment: EffectiveSegment,
): SessionContent {
  const parsed = EffectiveSegmentSchema.parse(segment)
  const retained = content.segments.find((s) => s.segmentId === parsed.segmentId)
  if (retained && normalized(retained) !== normalized(parsed))
    throw new Error('SEGMENT_ID_CONFLICT')
  return SessionContentSchema.parse({
    ...content,
    status: content.sets.length ? 'partial' : 'draft',
    explicitCompletion: false,
    segments: retained ? content.segments : [...content.segments, parsed],
    selectedSegments: [
      ...content.selectedSegments.filter((s) => s.originalStepId !== parsed.originalStepId),
      { originalStepId: parsed.originalStepId, segmentId: parsed.segmentId },
    ],
  })
}

/** Explicitly restore a prior frozen prescription; same exercise alone is not
 * enough. Any changed dose, provenance or acknowledgments needs a new segment. */
export function restoreEffectiveSegment(
  content: SessionContent,
  expected: EffectiveSegment,
): SessionContent {
  const retained = content.segments.find((s) => s.segmentId === expected.segmentId)
  if (!retained || normalized(retained) !== normalized(expected))
    throw new Error('SEGMENT_RESTORE_MISMATCH')
  return selectEffectiveSegment(content, retained)
}

export function emptyPerformedSet(
  segment: EffectiveSegment,
  performedSetId: string,
  ordinal: number,
  side: PerformedSet['side'],
): PerformedSet {
  return {
    performedSetId,
    segmentId: segment.segmentId,
    ordinal,
    side,
    repetitions: segment.dose.mode === 'repetitions' ? 0 : null,
    durationSeconds: segment.dose.mode === 'duration' ? 0 : null,
    loadKg: null,
    rpe: null,
    notes: '',
  }
}

function validActual(set: PerformedSet, dose: Dose): boolean {
  const measured = dose.mode === 'repetitions' ? set.repetitions : set.durationSeconds
  return (
    measured !== null &&
    measured > 0 &&
    (dose.mode === 'repetitions' ? set.durationSeconds === null : set.repetitions === null) &&
    (dose.load.mode === 'external'
      ? set.loadKg !== null
      : dose.load.mode === 'bodyweight' && set.loadKg === null)
  )
}

/** Minimum set count for ranged targets, with separate coverage on each side
 * for alternating/per-side doses. Below-target truthful actuals still count. */
export function segmentCoverage(segment: EffectiveSegment, sets: readonly PerformedSet[]): boolean {
  const sides: PerformedSet['side'][] =
    segment.dose.laterality === 'bilateral' ? ['both'] : ['left', 'right']
  const actuals = sets.filter((set) => set.segmentId === segment.segmentId)
  for (let ordinal = 1; ordinal <= minimumTarget(segment.dose.sets); ordinal += 1)
    for (const side of sides)
      if (
        !actuals.some(
          (set) => set.ordinal === ordinal && set.side === side && validActual(set, segment.dose),
        )
      )
        return false
  return true
}

/** WP03's authoritative session rules call this with the issued routine. */
export function checkEffectiveSegments(
  routine: RoutineVersionV2,
  content: SessionContent,
): { ok: true } | { ok: false; code: 'INVALID_SEGMENT' | 'INVALID_ACTUAL' | 'INCOMPLETE_SEGMENT' } {
  if (!SessionContentSchema.safeParse(content).success)
    return { ok: false, code: 'INVALID_SEGMENT' }
  const steps = new Map(routine.steps.map((s) => [s.id, s]))
  if (content.selectedSegments.length !== routine.steps.length)
    return { ok: false, code: 'INVALID_SEGMENT' }
  for (const segment of content.segments) {
    const step = steps.get(segment.originalStepId)
    if (!step) return { ok: false, code: 'INVALID_SEGMENT' }
    if (segment.relation) {
      const frozen = reviewedAlternatives(step, routine.relations).relations.find(
        (r) => r.id === segment.relation?.id,
      )
      if (!frozen || normalized(frozen) !== normalized(segment.relation))
        return { ok: false, code: 'INVALID_SEGMENT' }
      if (
        segment.confirmedConditions.length !== frozen.conditions.length ||
        segment.confirmedConditions.some(
          (condition) =>
            !frozen.conditions.includes(condition as ReviewedRelation['conditions'][number]),
        )
      )
        return { ok: false, code: 'INVALID_SEGMENT' }
    } else if (
      segment.exerciseId !== step.exerciseId ||
      normalized(segment.dose) !== normalized(step.dose)
    )
      return { ok: false, code: 'INVALID_SEGMENT' }
  }
  for (const set of content.sets) {
    const segment = content.segments.find((s) => s.segmentId === set.segmentId)!
    const max = segment.dose.sets.kind === 'fixed' ? segment.dose.sets.value : segment.dose.sets.max
    const wrongSide =
      segment.dose.laterality === 'bilateral' ? set.side !== 'both' : set.side === 'both'
    if (
      set.ordinal > max ||
      wrongSide ||
      (segment.dose.mode === 'repetitions'
        ? set.repetitions === null
        : set.durationSeconds === null) ||
      (segment.dose.load.mode === 'bodyweight' && set.loadKg !== null)
    )
      return { ok: false, code: 'INVALID_ACTUAL' }
  }
  if (content.status === 'completed')
    for (const selected of content.selectedSegments) {
      const segment = content.segments.find((s) => s.segmentId === selected.segmentId)!
      if (!segmentCoverage(segment, content.sets)) return { ok: false, code: 'INCOMPLETE_SEGMENT' }
    }
  return { ok: true }
}

/** WP03 rechecks current inventory when a new segment is submitted. Retained
 * historical segments remain valid if equipment later becomes unavailable. */
export function checkNewSegmentSelections(
  routine: RoutineVersionV2,
  content: SessionContent,
  previous: Pick<SessionContent, 'segments'>,
  environment: AlternativeEnvironment,
): ReturnType<typeof checkEffectiveSegments> | { ok: false; code: 'TARGET_EQUIPMENT_UNAVAILABLE' } {
  const checked = checkEffectiveSegments(routine, content)
  if (!checked.ok) return checked
  for (const old of previous.segments) {
    const retained = content.segments.find((s) => s.segmentId === old.segmentId)
    if (!retained || normalized(old) !== normalized(retained))
      return { ok: false, code: 'INVALID_SEGMENT' }
  }
  for (const segment of content.segments) {
    if (previous.segments.some((old) => old.segmentId === segment.segmentId)) continue
    if (segment.relation && !targetEquipmentAvailable(segment.relation.target, environment))
      return { ok: false, code: 'TARGET_EQUIPMENT_UNAVAILABLE' }
  }
  return { ok: true }
}
