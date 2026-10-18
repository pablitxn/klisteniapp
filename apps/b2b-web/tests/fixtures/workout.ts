import {
  RoutineVersionV2Schema,
  ReviewedRelationSchema,
  type ProductAccess,
  type SessionRevision,
} from '@klisteniapp/b2b-contracts/product-v2'
import { ExerciseSchema, ExerciseInputSchema } from '@klisteniapp/b2b-contracts'
import { createWorkoutDocument } from '../../src/features/training/sync/workoutEdit.ts'
import {
  LocalWorkoutConflict,
  assertWorkoutTransition,
  parseWorkoutDocument,
  type WorkoutDocument,
  type WorkoutStore,
  type SaveWorkout,
} from '../../src/features/training/storage/workoutStore.ts'
import { workoutRequestHash } from '../../src/features/training/sync/workoutSync.ts'
export const now = '2026-10-17T12:00:00.000Z'
export const scope = {
  origin: 'https://synthetic.example',
  accountId: 'member',
  organizationId: 'gym',
  branchId: 'east',
  actorId: 'member',
}
export const dose = {
  mode: 'repetitions',
  sets: { kind: 'fixed', value: 2 },
  repetitions: { kind: 'fixed', value: 10 },
  durationSeconds: null,
  load: { mode: 'external', kilograms: { kind: 'fixed', value: 20 } },
  restSeconds: { kind: 'fixed', value: 60 },
  laterality: 'bilateral',
  targetRpe: null,
  notes: '',
}
const target = ExerciseSchema.parse({
  ...ExerciseInputSchema.parse({ name: 'Target', instructions: ['Control'], equipment: 'rings' }),
  id: 'target',
  scope: 'base',
  status: 'published',
  version: 1,
  revision: 0,
})
export const relation = ReviewedRelationSchema.parse({
  id: 'relation',
  sourceExerciseId: 'source',
  targetExerciseId: 'target',
  type: 'progression',
  conditions: [
    'target-requirements-confirmed',
    'use-target-dose',
    'accept-higher-demand',
    'accept-different-laterality',
  ],
  rationale: 'Reviewed target',
  catalogRevision: 'a'.repeat(64),
  sourceContentHash: 'b'.repeat(64),
  targetContentHash: 'c'.repeat(64),
  requirements: ['Balance'],
  target,
  targetDose: {
    ...dose,
    mode: 'duration',
    sets: { kind: 'range', min: 1, max: 3 },
    repetitions: null,
    durationSeconds: { kind: 'range', min: 20, max: 30 },
    load: { mode: 'bodyweight' },
    laterality: 'per-side',
    restSeconds: { kind: 'fixed', value: 90 },
  },
})
export const routine = RoutineVersionV2Schema.parse({
  schemaVersion: 2,
  programId: 'routine',
  version: 1,
  scope: { organizationId: 'gym', branchId: 'east' },
  publishedAt: now,
  name: 'Routine',
  description: '',
  steps: [{ id: 'step', exerciseId: 'source', substitutionPolicy: 'reviewed', dose }],
  exercises: [target],
  machines: [],
  relations: [relation],
})
export const environment = {
  activeMachineIds: new Set<string>(),
  confirmedEquipment: new Set(['rings']),
}
export const access: ProductAccess = {
  schemaVersion: 2,
  organizationId: 'gym',
  userId: 'member',
  role: 'member',
  accessMode: 'active',
  accessRevision: 1,
  branches: [{ branchId: 'east', role: 'member' }],
  capabilities: ['edit-own-sessions', 'export-own-records'],
}
export function draft() {
  let id = 0
  return createWorkoutDocument(
    scope,
    'session',
    {
      kind: 'occurrence',
      occurrenceId: 'occurrence',
      routine: { programId: 'routine', version: 1, schemaVersion: 2 },
    },
    routine,
    () => `segment-${++id}`,
    now,
  )
}
export class MemoryWorkoutStore implements WorkoutStore {
  documents = new Map<string, WorkoutDocument>()
  legacy = new Map<string, string>()
  fail = false
  async read(key: string) {
    const d = this.documents.get(key)
    return d ? parseWorkoutDocument(d) : null
  }
  async compareAndSet(d: WorkoutDocument, expected: number | null) {
    if (this.fail) throw new DOMException('Synthetic quota exhausted', 'QuotaExceededError')
    const current = this.documents.get(d.key)
    if (
      (current?.generation ?? null) !== expected ||
      d.generation !== (expected === null ? 0 : expected + 1)
    )
      throw new LocalWorkoutConflict()
    if (current) assertWorkoutTransition(current, d)
    this.documents.set(d.key, parseWorkoutDocument(d))
  }
  async preserveLegacy(key: string, bytes: string) {
    this.legacy.set(JSON.stringify([key, bytes]), bytes)
  }
}
export async function receipt(input: SaveWorkout, revision = input.expectedRevision + 1) {
  const requestHash = await workoutRequestHash(scope, input)
  const session: SessionRevision = {
    schemaVersion: 2,
    id: input.id,
    scope: {
      organizationId: scope.organizationId,
      branchId: scope.branchId,
      memberId: scope.actorId,
    },
    origin: input.origin,
    revision,
    operationId: input.operationId,
    content: input.content,
    actorId: scope.actorId,
    acceptedAt: now,
  }
  return {
    session,
    receipt: {
      schemaVersion: 2 as const,
      operationId: input.operationId,
      resourceId: input.id,
      revision,
      requestHash,
      acceptedAt: now,
    },
  }
}
export async function stored() {
  const store = new MemoryWorkoutStore()
  const d = draft()
  await store.compareAndSet(d, null)
  return { store, d }
}
