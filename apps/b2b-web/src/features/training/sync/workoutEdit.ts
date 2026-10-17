import { workoutContentHash } from './workoutCrypto.ts'
import {
  SessionContentSchema,
  minimumTarget,
  type SessionContent,
  type RoutineVersionV2,
  type SessionRevision,
  type ProductInput,
} from '@klisteniapp/b2b-contracts/product-v2'
import {
  createOriginalSegment,
  createReviewedSegment,
  selectEffectiveSegment,
  restoreEffectiveSegment,
  type AlternativeEnvironment,
} from '@klisteniapp/b2b-domain/alternatives'
import { sessionIssues } from '@klisteniapp/b2b-domain/sessions'
import {
  parseWorkoutDocument,
  workoutKey,
  type WorkoutDocument,
  type WorkoutScope,
} from '../storage/workoutStore.ts'
import { editedContent } from './workoutSync.ts'
export function createWorkoutDocument(
  scope: WorkoutScope,
  id: string,
  origin: ProductInput<'saveSession'>['origin'],
  routine: RoutineVersionV2,
  createId: () => string,
  now: string,
  accepted: SessionRevision | null = null,
): WorkoutDocument {
  if (
    scope.organizationId !== routine.scope.organizationId ||
    scope.branchId !== routine.scope.branchId ||
    scope.accountId !== scope.actorId ||
    origin.routine.programId !== routine.programId ||
    origin.routine.version !== routine.version
  )
    throw new Error('Workout prescription scope mismatch')
  if (
    accepted &&
    (accepted.id !== id ||
      accepted.scope.memberId !== scope.actorId ||
      accepted.scope.organizationId !== scope.organizationId ||
      accepted.scope.branchId !== scope.branchId)
  )
    throw new Error('Foreign accepted session')
  const segments = routine.steps.map((step) => createOriginalSegment(step, createId(), now))
  return parseWorkoutDocument({
    schemaVersion: 2,
    key: workoutKey(scope, id),
    id,
    scope: structuredClone(scope),
    origin: structuredClone(origin),
    generation: 0,
    content: accepted
      ? structuredClone(accepted.content)
      : {
          status: 'draft',
          explicitCompletion: false,
          performedAt: now,
          notes: '',
          correctionReason: '',
          segments,
          selectedSegments: segments.map((s) => ({
            originalStepId: s.originalStepId,
            segmentId: s.segmentId,
          })),
          sets: [],
        },
    accepted,
    operations: [],
    legacyDraft: null,
    supersededOperationIds: [],
    recovery: [],
    problem: null,
    replayAccessRevision: null,
  })
}
export function changeWorkoutActual(
  content: SessionContent,
  actual: SessionContent['sets'][number],
  remove = false,
): SessionContent {
  const prior = content.sets.find((s) => s.performedSetId === actual.performedSetId)
  if (
    prior &&
    (prior.segmentId !== actual.segmentId ||
      prior.ordinal !== actual.ordinal ||
      prior.side !== actual.side)
  )
    throw new Error('Performed identity cannot change')
  return SessionContentSchema.parse(
    editedContent({
      ...content,
      sets: remove
        ? content.sets.filter((s) => s.performedSetId !== actual.performedSetId)
        : prior
          ? content.sets.map((s) => (s.performedSetId === actual.performedSetId ? actual : s))
          : [...content.sets, actual],
    }),
  )
}
export function selectWorkoutAlternative(
  content: SessionContent,
  routine: RoutineVersionV2,
  stepId: string,
  relationId: string,
  confirmations: string[],
  environment: AlternativeEnvironment,
  id: string,
  now: string,
) {
  const step = routine.steps.find((s) => s.id === stepId)
  if (!step) throw new Error('Unknown original step')
  return selectEffectiveSegment(
    content,
    createReviewedSegment(step, routine.relations, relationId, confirmations, environment, id, now),
  )
}
export function restoreWorkoutSegment(content: SessionContent, id: string) {
  const retained = content.segments.find((s) => s.segmentId === id)
  if (!retained) throw new Error('Missing retained segment')
  return restoreEffectiveSegment(content, retained)
}
export function prepareWorkoutContent(
  document: WorkoutDocument,
  routine: RoutineVersionV2,
  complete: boolean | 'void',
): SessionContent {
  const content = SessionContentSchema.parse(
    complete === 'void'
      ? { ...document.content, status: 'void', explicitCompletion: false }
      : complete
        ? { ...document.content, status: 'completed', explicitCompletion: true }
        : editedContent(document.content),
  )
  const issues = sessionIssues(content, routine, document.accepted?.content)
  if (issues.length) throw new Error(issues.map((i) => i.message).join('\n'))
  return content
}
export function segmentRows(segment: SessionContent['segments'][number]) {
  const sides: SessionContent['sets'][number]['side'][] =
    segment.dose.laterality === 'bilateral' ? ['both'] : ['left', 'right']
  return Array.from({ length: minimumTarget(segment.dose.sets) }, (_, i) => i + 1).flatMap(
    (ordinal) => sides.map((side) => ({ ordinal, side })),
  )
}

/** A rejected, unselected target can be archived explicitly. Accepted segments
 * remain immutable; discarded local actuals remain in owner recovery export. */
export function archiveUnacceptedTarget(
  document: WorkoutDocument,
  segmentId: string,
): WorkoutDocument {
  const target = document.content.segments.find((s) => s.segmentId === segmentId)
  if (
    !target?.relation ||
    document.content.selectedSegments.some((s) => s.segmentId === segmentId) ||
    document.accepted?.content.segments.some((s) => s.segmentId === segmentId)
  )
    throw new Error('Only an unselected, unaccepted target can be archived')
  return {
    ...document,
    recovery: [...document.recovery, structuredClone(document.content)],
    content: editedContent({
      ...document.content,
      segments: document.content.segments.filter((s) => s.segmentId !== segmentId),
      sets: document.content.sets.filter((s) => s.segmentId !== segmentId),
    }),
  }
}

/** A fresh occurrence draft must be discoverable after reload and across tabs.
 * Prefer an existing server session ID. This fallback never relabels legacy IDs. */
export async function occurrenceWorkoutId(
  scope: WorkoutScope,
  occurrenceId: string,
): Promise<string> {
  const hash = workoutContentHash(
    JSON.stringify([
      'klisteni-session-v2',
      scope.organizationId,
      scope.branchId,
      scope.actorId,
      occurrenceId,
    ]),
  )
  return `session-${hash.slice(0, 40)}`
}
