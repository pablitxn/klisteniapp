import type { Assignment } from '@klisteniapp/b2b-contracts/training'
import { parseSessionDraft, type SessionStorage } from '../sessionDraft.ts'
import { parseWorkoutDocument, type WorkoutStore } from './workoutStore.ts'
/** Archive exact v1/v2 localStorage bytes before product editing. Never translate
 * pending legacy POSTs into a new operation ID or remove the original key. */
export async function preserveLegacyWorkout(
  store: WorkoutStore,
  storage: Pick<SessionStorage, 'getItem'>,
  key: string,
  assignment: Assignment,
) {
  const bytes = storage.getItem(key)
  if (bytes === null) return null
  await store.preserveLegacy(key, bytes)
  let value: unknown
  try {
    value = JSON.parse(bytes)
  } catch {
    throw new Error('Legacy draft is preserved but cannot be decoded.')
  }
  const draft = parseSessionDraft(value, assignment)
  if (!draft) throw new Error('Legacy draft is preserved but does not match the issued assignment.')
  return { draft, bytes, requiresLegacyReplay: Boolean(draft.pending) }
}

/** Adopt readable unsent work only after the caller supplies its owner-scoped
 * issued v2 supplement. Pending POSTs stay on the exact legacy transport. */
export async function migrateLegacyWorkoutDraft(options: {
  store: WorkoutStore
  storage: Pick<SessionStorage, 'getItem'>
  key: string
  assignment: Assignment
  initial: import('./workoutStore.ts').WorkoutDocument
}): Promise<import('./workoutStore.ts').WorkoutDocument | null> {
  const recovered = await preserveLegacyWorkout(
    options.store,
    options.storage,
    options.key,
    options.assignment,
  )
  if (!recovered) return null
  if (recovered.requiresLegacyReplay)
    throw new Error('Confirm the preserved legacy POST before adopting product editing.')
  const { initial, assignment } = options
  if (
    initial.id !== recovered.draft.id ||
    initial.origin.kind !== 'legacy' ||
    initial.origin.assignmentId !== assignment.id ||
    initial.origin.executionId !== null ||
    initial.origin.routine.schemaVersion !== 1 ||
    initial.origin.routine.programId !== assignment.program.programId ||
    initial.origin.routine.version !== assignment.program.version
  )
    throw new Error('Keep the legacy draft identity and issued routine linkage.')
  const bytes = recovered.bytes
  const sets = recovered.draft.sets
    .filter((s) => s.done)
    .map((s) => {
      const segment = initial.content.segments.find(
        (segment) => segment.originalStepId === s.stepId && segment.exerciseId === s.exerciseId,
      )
      if (
        !segment ||
        segment.relation ||
        segment.dose.laterality !== 'bilateral' ||
        (segment.dose.mode === 'duration') !== (s.durationSeconds !== null)
      )
        throw new Error(
          'Legacy variants require explicit review; the original draft remains preserved.',
        )
      return {
        performedSetId: `legacy-${initial.content.segments.indexOf(segment)}-${s.set}`,
        segmentId: segment.segmentId,
        ordinal: s.set,
        side: 'both' as const,
        repetitions: s.reps,
        durationSeconds: s.durationSeconds ?? null,
        loadKg: s.loadKg,
        rpe: s.rpe ?? null,
        notes: s.reason,
      }
    })
  const document = {
    ...initial,
    legacyDraft: { key: options.key, bytes },
    content: {
      ...initial.content,
      notes: recovered.draft.notes,
      sets,
      status: sets.length ? ('partial' as const) : ('draft' as const),
      explicitCompletion: false,
    },
  }
  parseWorkoutDocument(document)
  await options.store.compareAndSet(document, null)
  return document
}
