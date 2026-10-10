import { ExecutionInputSchema, ExecutionSetSchema, IdSchema } from '@klisteniapp/b2b-contracts'
import type { Assignment, ExecutionInput } from '@klisteniapp/b2b-contracts'

export type DraftSet = ExecutionInput['sets'][number] & { done: boolean }
export type SessionDraft = {
  id: string
  assignmentId: string
  sets: DraftSet[]
  notes: string
  pending?: ExecutionInput
}
export type SessionStorage = Pick<Storage, 'getItem' | 'setItem'>
type ExecutionStatus = ExecutionInput['status']
type PreparedExecution = { ok: true; payload: ExecutionInput } | { ok: false; error: string }
const DraftSetReferenceSchema = ExecutionSetSchema.omit({ reps: true, loadKg: true })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function sessionDraftKey(orgId: string, userId: string, assignmentId: string): string {
  return `klisteni.b2b.session.v1.${orgId}.${userId}.${assignmentId}`
}

export function createSessionDraft(assignment: Assignment, id: string): SessionDraft {
  return {
    id,
    assignmentId: assignment.id,
    notes: '',
    sets: assignment.program.steps.flatMap((step) =>
      Array.from({ length: step.sets }, (_, index) => ({
        stepId: step.id,
        set: index + 1,
        exerciseId: step.exerciseId,
        reps: step.reps,
        loadKg: step.loadKg,
        reason: '',
        done: false,
      })),
    ),
  }
}

function belongsToAssignment(set: ExecutionInput['sets'][number], assignment: Assignment): boolean {
  return assignment.program.steps.some(
    (step) =>
      step.id === set.stepId &&
      set.set <= step.sets &&
      (step.exerciseId === set.exerciseId || step.alternatives.includes(set.exerciseId)),
  )
}

function recordedSets(draft: SessionDraft): ExecutionInput['sets'] {
  return draft.sets
    .filter((set) => set.done)
    .map(({ stepId, set, exerciseId, reps, loadKg, reason }) => ({
      stepId,
      set,
      exerciseId,
      reps,
      loadKg,
      reason,
    }))
}

/** Local storage is untrusted. Recover only a complete set layout from this assignment. */
export function parseSessionDraft(value: unknown, assignment: Assignment): SessionDraft | null {
  if (
    !isRecord(value) ||
    value.assignmentId !== assignment.id ||
    !IdSchema.safeParse(value.id).success ||
    typeof value.id !== 'string' ||
    typeof value.notes !== 'string' ||
    value.notes.length > 2000 ||
    !Array.isArray(value.sets)
  )
    return null

  const expectedSets = assignment.program.steps.reduce((total, step) => total + step.sets, 0)
  if (value.sets.length !== expectedSets) return null

  const sets: DraftSet[] = []
  const seen = new Set<string>()
  for (const item of value.sets) {
    if (!isRecord(item) || typeof item.done !== 'boolean') return null
    const { done, reps, loadKg, ...input } = item
    // Drafts retain unfinished numeric edits. Only performed sets in the outgoing
    // payload must satisfy execution bounds; invalid unused rows must not lose retries.
    if (
      typeof reps !== 'number' ||
      !Number.isFinite(reps) ||
      !(loadKg === null || (typeof loadKg === 'number' && Number.isFinite(loadKg)))
    )
      return null
    const parsed = DraftSetReferenceSchema.safeParse(input)
    if (!parsed.success) return null
    const set = { ...parsed.data, reps, loadKg, done }
    if (!belongsToAssignment(set, assignment)) return null
    const key = `${parsed.data.stepId}:${parsed.data.set}`
    if (seen.has(key)) return null
    seen.add(key)
    sets.push(set)
  }

  const draft: SessionDraft = {
    id: value.id,
    assignmentId: assignment.id,
    notes: value.notes,
    sets,
  }
  if (value.pending !== undefined) {
    const pending = ExecutionInputSchema.safeParse(value.pending)
    if (
      !pending.success ||
      pending.data.id !== draft.id ||
      pending.data.assignmentId !== assignment.id ||
      pending.data.notes !== draft.notes ||
      pending.data.sets.some((set) => !belongsToAssignment(set, assignment)) ||
      (pending.data.status === 'completed' && pending.data.sets.length !== expectedSets) ||
      JSON.stringify(pending.data.sets) !== JSON.stringify(recordedSets(draft))
    )
      return null
    draft.pending = pending.data
  }
  return draft
}

export function recoverSessionDraft(
  storage: SessionStorage,
  key: string,
  assignment: Assignment,
  createId: () => string,
  now: () => number = Date.now,
): { draft: SessionDraft; recovered: boolean } {
  try {
    const stored = storage.getItem(key)
    if (stored) {
      let value: unknown
      try {
        value = JSON.parse(stored)
      } catch {
        value = null
      }
      const draft = parseSessionDraft(value, assignment)
      if (draft) return { draft, recovered: true }
      // Keep the original bytes before the fresh draft replaces an unusable copy.
      storage.setItem(`${key}.recovery.${now()}`, stored)
    }
  } catch {
    // The view reports write failures; inaccessible storage must not prevent training.
  }
  return { draft: createSessionDraft(assignment, createId()), recovered: false }
}

export function changeDraftSet(
  draft: SessionDraft,
  index: number,
  patch: Partial<DraftSet>,
): SessionDraft {
  if (draft.pending) return draft
  return {
    ...draft,
    sets: draft.sets.map((set, position) => (position === index ? { ...set, ...patch } : set)),
  }
}

export function substituteExercise(exerciseId: string): Partial<DraftSet> {
  return { exerciseId, loadKg: null, done: false, reason: '' }
}

export function exerciseAvailability(assignment: Assignment, stepId: string, exerciseId: string) {
  return assignment.availability
    .find((step) => step.stepId === stepId)
    ?.exercises.find((exercise) => exercise.exerciseId === exerciseId)
}

/** Pending payloads are immutable: a lost response must retry the same id, timestamp and data. */
export function prepareExecution(
  draft: SessionDraft,
  assignment: Assignment,
  status: ExecutionStatus,
  completedAt: string,
): PreparedExecution {
  if (draft.pending) return { ok: true, payload: draft.pending }
  const sets = recordedSets(draft)
  if (
    sets.some(
      (set) =>
        exerciseAvailability(assignment, set.stepId, set.exerciseId)?.status === 'unavailable',
    )
  ) {
    return {
      ok: false,
      error:
        'Uno de los equipos ya no está disponible. Elegí una alternativa autorizada o guardá sólo las series realizadas disponibles.',
    }
  }
  if (!sets.length)
    return { ok: false, error: 'Marcá al menos una serie realizada antes de guardar.' }
  if (status === 'completed' && sets.length !== draft.sets.length) {
    return {
      ok: false,
      error: 'Para completar la sesión, marcá todas las series o guardá una sesión parcial.',
    }
  }
  if (
    sets.some(
      (set) =>
        set.exerciseId !==
          assignment.program.steps.find((step) => step.id === set.stepId)?.exerciseId &&
        !set.reason.trim(),
    )
  ) {
    return { ok: false, error: 'Contanos el motivo de cada sustitución antes de guardar.' }
  }
  const parsed = ExecutionInputSchema.safeParse({
    id: draft.id,
    assignmentId: assignment.id,
    status,
    sets,
    notes: draft.notes,
    completedAt,
  })
  return parsed.success
    ? { ok: true, payload: parsed.data }
    : {
        ok: false,
        error: 'Revisá las repeticiones, las cargas y las notas de la sesión antes de guardar.',
      }
}

/** Timeouts, rate limits and server/network failures leave delivery uncertain. */
export function isDefinitiveRejection(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429
}

/** A late response must not erase a newer session created under the same assignment. */
export function discardConfirmedSession(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  key: string,
  executionId: string,
): void {
  const stored = storage.getItem(key)
  if (!stored) return
  let value: unknown
  try {
    value = JSON.parse(stored)
  } catch {
    return
  }
  if (isRecord(value) && value.id === executionId) storage.removeItem(key)
}
