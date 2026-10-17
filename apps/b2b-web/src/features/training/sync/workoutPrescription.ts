import {
  SessionBindingSchema,
  SessionPrescriptionBindingSchema,
  type ProductOutput,
  type RoutineVersionV2,
  type SessionContent,
  type SessionPrescriptionBinding,
} from '@klisteniapp/b2b-contracts/product-v2'
import { canonicalJson, sessionIssues } from '@klisteniapp/b2b-domain/sessions'
import type { WorkoutDocument } from '../storage/workoutStore.ts'

export type WorkoutBinding = ProductOutput<'sessionBinding'>
export type LegacyOriginal = NonNullable<WorkoutBinding['original']>
export function prescriptionContent(binding: SessionPrescriptionBinding) {
  return binding.kind === 'reviewed' ? binding.routine : binding
}
export function workoutPrescription(options: {
  routine?: RoutineVersionV2
  prescription?: SessionPrescriptionBinding
}): SessionPrescriptionBinding {
  if (options.prescription) return SessionPrescriptionBindingSchema.parse(options.prescription)
  if (options.routine) return { kind: 'reviewed', routine: options.routine }
  throw new Error('An explicit issued session prescription is required')
}
export function prescriptionDisplay(binding: SessionPrescriptionBinding) {
  return binding.kind === 'reviewed'
    ? binding.routine
    : { ...binding.original, steps: binding.steps, relations: binding.relations }
}
/** Validate linkage without inventing an accepted v2 revision for revision zero. */
export function validateWorkoutBinding(
  document: Pick<WorkoutDocument, 'id' | 'scope' | 'origin'>,
  raw: unknown,
): WorkoutBinding {
  const binding = SessionBindingSchema.parse(raw)
  const { origin, scope, id } = document
  if (!binding.original && !binding.accepted) throw new Error('Missing original session binding')
  if (
    binding.accepted &&
    (binding.accepted.id !== id ||
      canonicalJson(binding.accepted.origin) !== canonicalJson(origin) ||
      binding.accepted.scope.organizationId !== scope.organizationId ||
      binding.accepted.scope.branchId !== scope.branchId ||
      binding.accepted.scope.memberId !== scope.actorId)
  )
    throw new Error('Foreign accepted session binding')
  if (
    binding.original &&
    (origin.kind !== 'legacy' ||
      origin.executionId !== id ||
      binding.original.original.id !== id ||
      binding.original.original.assignmentId !== origin.assignmentId ||
      origin.routine.schemaVersion !== 1 ||
      binding.original.routine.programId !== origin.routine.programId ||
      binding.original.routine.version !== origin.routine.version ||
      binding.original.scope.organizationId !== scope.organizationId ||
      binding.original.scope.branchId !== scope.branchId ||
      binding.original.scope.memberId !== scope.actorId)
  )
    throw new Error('Foreign legacy original binding')
  const p = binding.prescription
  const r = p.kind === 'reviewed' ? p.routine : p.original
  if (
    r.programId !== origin.routine.programId ||
    r.version !== origin.routine.version ||
    (p.kind === 'reviewed' &&
      (p.routine.scope.organizationId !== scope.organizationId ||
        p.routine.scope.branchId !== scope.branchId)) ||
    (p.kind === 'legacy-compatibility' && origin.routine.schemaVersion !== 1)
  )
    throw new Error('Foreign prescription binding')
  if (
    p.kind === 'legacy-compatibility' &&
    binding.original &&
    canonicalJson(p.original) !== canonicalJson(binding.original.routine)
  )
    throw new Error('Legacy prescription does not retain the original routine')
  if (binding.accepted && sessionIssues(binding.accepted.content, prescriptionContent(p)).length)
    throw new Error('Accepted session does not match its retained prescription')
  return binding
}
export const legacySetKey = (set: LegacyOriginal['original']['sets'][number]) =>
  JSON.stringify([set.stepId, set.set])
/** Old manual variants have no reviewed provenance. Preserve them as evidence;
 * only exact source units/side can be projected to new correction entries. */
export function legacySetSupported(
  set: LegacyOriginal['original']['sets'][number],
  prescription: SessionPrescriptionBinding,
) {
  const step = prescriptionContent(prescription).steps.find((s) => s.id === set.stepId)
  return Boolean(
    step &&
      step.exerciseId === set.exerciseId &&
      step.dose.laterality === 'bilateral' &&
      set.set <= (step.dose.sets.kind === 'fixed' ? step.dose.sets.value : step.dose.sets.max) &&
      (step.dose.mode === 'repetitions'
        ? set.reps !== null && set.durationSeconds === null
        : set.reps === null && set.durationSeconds !== null) &&
      !(step.dose.load.mode === 'bodyweight' && set.loadKg !== null),
  )
}
export function unsupportedLegacySets(binding: WorkoutBinding) {
  return (
    binding.original?.original.sets.filter((s) => !legacySetSupported(s, binding.prescription)) ??
    []
  )
}
export function hasExplicitLegacyEntry(document: WorkoutDocument, key: string) {
  const binding = document.binding
  const original = binding && unsupportedLegacySets(binding).find((s) => legacySetKey(s) === key)
  if (!binding || !original) return false
  return (
    document.content.sets.some((set) => {
      const segment = document.content.segments.find((s) => s.segmentId === set.segmentId)
      return (
        segment?.originalStepId === original.stepId &&
        set.ordinal === original.set &&
        (segment.dose.mode === 'repetitions'
          ? (set.repetitions ?? 0) > 0
          : (set.durationSeconds ?? 0) > 0)
      )
    }) &&
    !sessionIssues(
      document.content,
      prescriptionContent(binding.prescription),
      document.accepted?.content,
    ).length
  )
}
/** Also protects programmatic queueing and replay, not just the visible form. */
export function firstCorrectionProblem(document: WorkoutDocument): string | null {
  if (
    document.accepted ||
    document.origin.kind !== 'legacy' ||
    document.origin.executionId === null
  )
    return null
  if (!document.content.correctionReason.trim())
    return 'Indicá el motivo de la primera corrección antes de sincronizar.'
  if (!document.binding?.original)
    return 'Cargá el vínculo original de esta corrección antes de sincronizar.'
  for (const set of unsupportedLegacySets(document.binding)) {
    const key = legacySetKey(set)
    if (!document.legacyConfirmedSetKeys?.includes(key) || !hasExplicitLegacyEntry(document, key))
      return 'Registrá y confirmá una corrección explícita para cada serie original sin vínculo compatible.'
  }
  return null
}
export function confirmLegacyEntry(document: WorkoutDocument, key: string): WorkoutDocument {
  if (document.accepted || !hasExplicitLegacyEntry(document, key))
    throw new Error('Enter an explicit compatible correction before confirming this original set')
  return {
    ...document,
    legacyConfirmedSetKeys: [...new Set([...(document.legacyConfirmedSetKeys ?? []), key])],
  }
}
export function projectLegacyActuals(
  binding: WorkoutBinding,
  segments: SessionContent['segments'],
  createId: () => string,
): SessionContent['sets'] {
  return (
    binding.original?.original.sets
      .filter((s) => legacySetSupported(s, binding.prescription))
      .map((set) => ({
        performedSetId: createId(),
        segmentId: segments.find((s) => s.originalStepId === set.stepId && s.relation === null)!
          .segmentId,
        ordinal: set.set,
        side: 'both',
        repetitions: set.reps,
        durationSeconds: set.durationSeconds,
        loadKg: set.loadKg,
        rpe: set.rpe,
        notes: set.reason,
      })) ?? []
  )
}
