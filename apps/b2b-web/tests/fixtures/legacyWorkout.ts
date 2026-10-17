import { ProgramVersionSchema } from '@klisteniapp/b2b-contracts/training'
import { SessionBindingSchema, projectLegacyRoutine } from '@klisteniapp/b2b-contracts/product-v2'
import { scope, now } from './workout.ts'
export const originalRoutine = ProgramVersionSchema.parse({
  programId: 'routine',
  version: 1,
  branchId: 'east',
  name: 'Original legacy',
  description: '',
  publishedAt: now,
  steps: [
    {
      id: 'step',
      exerciseId: 'source',
      sets: 2,
      reps: 10,
      durationSeconds: null,
      loadKg: null,
      restSeconds: 60,
      alternatives: ['manual-target'],
      notes: '',
    },
  ],
  exercises: [],
  machines: [],
})
export const legacyOrigin = {
  kind: 'legacy' as const,
  assignmentId: 'assignment',
  executionId: 'original-execution',
  routine: { programId: 'routine', version: 1, schemaVersion: 1 as const },
}
export const legacySelection = { scope, id: 'original-execution', origin: legacyOrigin }
export function legacyBinding(manual = false) {
  return SessionBindingSchema.parse({
    original: {
      schemaVersion: 1,
      revision: 0,
      scope: { organizationId: 'gym', branchId: 'east', memberId: 'member' },
      original: {
        id: 'original-execution',
        assignmentId: 'assignment',
        status: 'completed',
        completedAt: now,
        notes: 'Original note',
        sets: [
          {
            stepId: 'step',
            set: 1,
            exerciseId: manual ? 'manual-target' : 'source',
            reps: 7,
            durationSeconds: null,
            loadKg: null,
            rpe: 7,
            reason: 'Original reason',
          },
        ],
      },
      routine: originalRoutine,
      createdAt: now,
    },
    accepted: null,
    prescription: {
      kind: 'legacy-compatibility',
      original: originalRoutine,
      steps: projectLegacyRoutine(originalRoutine).steps.map((s) => ({
        ...s,
        dose: { ...s.dose, laterality: 'bilateral' },
      })),
      relations: [],
    },
  })
}
export function ids() {
  let id = 0
  return () => `correction-${++id}`
}
