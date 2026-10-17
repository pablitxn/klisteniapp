import { ExerciseSchema, ProgramVersionSchema } from '@klisteniapp/b2b-contracts'
import {
  LegacySupplementPreviewSchema,
  LegacySupplementSchema,
  RoutineVersionV2Schema,
  projectLegacyRoutine,
  type ProductAccess,
  type ProductInput,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2'
import {
  newAdoptionReview,
  proposalKey,
  type AdoptionReview,
} from '../src/features/programs/legacy-adoption/legacyAdoptionModel.ts'

export function legacyAdoptionFixture() {
  const exercise = (id: string, name: string) =>
    ExerciseSchema.parse({
      id,
      name,
      scope: 'base',
      status: 'published',
      version: 1,
      revision: 0,
      description: 'Synthetic movement',
      instructions: ['Follow the stated target'],
      equipment: 'none',
      pattern: '',
      muscles: [],
      machineId: null,
      compatibleMachineIds: [],
      animationId: null,
      baseExerciseId: null,
      assets: [],
    })
  const source = exercise('source', 'Original squat')
  const known = exercise('known', 'Original hold')
  const target = exercise('target-time', 'Timed target')
  const second = exercise('target-reps', 'Repetition target')
  const original = ProgramVersionSchema.parse({
    programId: 'routine',
    version: 1,
    name: 'Legacy routine',
    description: 'Original member prescription',
    publishedAt: '2026-10-01T10:00:00Z',
    steps: [
      {
        id: 'unknown',
        exerciseId: source.id,
        sets: 3,
        reps: 8,
        durationSeconds: null,
        loadKg: null,
        restSeconds: 60,
        targetRpe: 7,
        notes: 'Original source notes',
        alternatives: ['manual-variant'],
      },
      {
        id: 'zero-load',
        exerciseId: known.id,
        sets: 2,
        reps: null,
        durationSeconds: 30,
        loadKg: 0,
        restSeconds: 0,
        targetRpe: null,
        notes: 'Original hold notes',
        alternatives: [],
      },
    ],
    exercises: [source, known],
    machines: [],
  })
  const dose = {
    mode: 'duration' as const,
    sets: { kind: 'fixed' as const, value: 2 },
    repetitions: null,
    durationSeconds: { kind: 'range' as const, min: 20, max: 40 },
    load: { mode: 'bodyweight' as const },
    restSeconds: { kind: 'fixed' as const, value: 45 },
    laterality: 'per-side' as const,
    targetRpe: null,
    notes: 'Independent target dose',
  }
  const relation = {
    id: 'directed-time',
    sourceExerciseId: source.id,
    targetExerciseId: target.id,
    type: 'alternative' as const,
    conditions: [
      'target-requirements-confirmed',
      'use-target-dose',
      'accept-different-laterality',
    ] as const,
    rationale: 'Synthetic directed proposal for component tests',
    catalogRevision: '1'.repeat(64),
    sourceContentHash: '2'.repeat(64),
    targetContentHash: '3'.repeat(64),
    requirements: ['position:standing', 'count:per-side'],
    target,
    targetDose: dose,
  }
  const scope = { organizationId: 'brand', branchId: 'center', memberId: 'member' }
  const preview = LegacySupplementPreviewSchema.parse({
    assignmentId: 'assignment',
    scope,
    sourceSnapshotHash: 'a'.repeat(64),
    original,
    draft: projectLegacyRoutine(original),
    proposals: [
      { relation, hash: '4'.repeat(64) },
      {
        relation: {
          ...relation,
          id: 'directed-reps',
          targetExerciseId: second.id,
          target: second,
          type: 'progression',
          conditions: ['target-requirements-confirmed', 'use-target-dose', 'accept-higher-demand'],
          targetContentHash: '5'.repeat(64),
          targetDose: {
            ...dose,
            mode: 'repetitions',
            repetitions: { kind: 'range', min: 10, max: 15 },
            durationSeconds: null,
            laterality: 'bilateral',
          },
        },
        hash: '6'.repeat(64),
      },
    ],
    supplement: null,
  })
  const assignment: ProductOutput<'legacyAssignments'>[number] = {
    schemaVersion: 2,
    id: preview.assignmentId,
    scope,
    active: true,
    assignedBy: 'coach',
    createdAt: '2026-10-01T11:00:00Z',
    routine: { programId: original.programId, version: original.version, schemaVersion: 1 },
    name: original.name,
    archivedAt: null,
  }
  const access: ProductAccess = {
    schemaVersion: 2,
    organizationId: 'brand',
    userId: 'coach',
    role: 'coach',
    accessMode: 'active',
    accessRevision: 1,
    branches: [{ branchId: 'center', role: 'coach' }],
    capabilities: ['edit-planning', 'read-training-history'],
  }
  return { preview, assignment, access }
}
export function confirmedLegacyReview(preview = legacyAdoptionFixture().preview): AdoptionReview {
  const review = newAdoptionReview(preview)
  return {
    ...review,
    sources: review.sources.map((source) => ({
      ...source,
      load: { mode: 'bodyweight' },
      laterality: 'bilateral',
      policy: 'reviewed',
    })),
    confirmedTargets: preview.proposals.map(proposalKey),
    sourceDosesConfirmed: true,
    sharedVersionConfirmed: true,
  }
}
export function syntheticLegacySupplement(
  preview: ProductOutput<'legacySupplementPreview'>,
  input: ProductInput<'adoptLegacySupplement'>,
) {
  const proposals = preview.proposals.filter((proposal) =>
    input.targetConfirmations.some((c) => c.relationId === proposal.relation.id),
  )
  const exercises = [...preview.original.exercises, ...proposals.map((p) => p.relation.target)]
  const supplement = RoutineVersionV2Schema.parse({
    schemaVersion: 2,
    scope: { organizationId: preview.scope.organizationId, branchId: preview.scope.branchId },
    programId: preview.original.programId,
    version: preview.original.version,
    publishedAt: preview.original.publishedAt,
    name: preview.original.name,
    description: preview.original.description,
    steps: input.sourceSteps,
    machines: preview.original.machines,
    exercises: [...new Map(exercises.map((exercise) => [exercise.id, exercise])).values()],
    relations: proposals.map((proposal) => proposal.relation),
  })
  return LegacySupplementSchema.parse({
    schemaVersion: 2,
    scope: preview.scope,
    programId: preview.original.programId,
    version: preview.original.version,
    sourceSnapshotHash: preview.sourceSnapshotHash,
    supplement,
  })
}
