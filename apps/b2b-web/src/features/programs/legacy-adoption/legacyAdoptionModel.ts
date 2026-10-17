import { ApiError } from '@klisteniapp/b2b-client'
import {
  ProductEndpoints,
  projectLegacyRoutine,
  type ProductAccess,
  type ProductInput,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2'
import { canEditPlanning } from '../product/programmingModel.ts'

export type LegacyAssignment = ProductOutput<'legacyAssignments'>[number]
export type AdoptionPreview = ProductOutput<'legacySupplementPreview'>
export type Adoption = ProductOutput<'adoptLegacySupplement'>
export type AdoptionInput = ProductInput<'adoptLegacySupplement'>
export type SourceChoice = {
  stepId: string
  load: null | { mode: 'bodyweight' } | { mode: 'external'; kilograms: string }
  laterality: 'bilateral' | 'alternating' | 'per-side' | null
  policy: 'reviewed' | 'blocked' | null
}
export type AdoptionReview = {
  sources: SourceChoice[]
  confirmedTargets: string[]
  sourceDosesConfirmed: boolean
  sharedVersionConfirmed: boolean
}
export type AdoptionAttempt = { signature: string; input: AdoptionInput }

export function canReviewLegacy(
  access: ProductAccess,
  accountId: string,
  assignment: LegacyAssignment,
) {
  return (
    access.role !== 'member' &&
    assignment.routine.schemaVersion === 1 &&
    canEditPlanning(access, accountId, assignment.scope.organizationId, assignment.scope.branchId)
  )
}
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, ordered(entry)]),
    )
  return value
}
export function issuedDraftMatches(preview: AdoptionPreview) {
  return (
    JSON.stringify(ordered(preview.draft)) ===
    JSON.stringify(ordered(projectLegacyRoutine(preview.original)))
  )
}
export function previewMatchesAssignment(preview: AdoptionPreview, assignment: LegacyAssignment) {
  return (
    issuedDraftMatches(preview) &&
    preview.assignmentId === assignment.id &&
    preview.scope.organizationId === assignment.scope.organizationId &&
    preview.scope.branchId === assignment.scope.branchId &&
    preview.scope.memberId === assignment.scope.memberId &&
    preview.original.programId === assignment.routine.programId &&
    preview.original.version === assignment.routine.version
  )
}
export function adoptionMatchesPreview(adoption: Adoption, preview: AdoptionPreview) {
  return (
    adoption.scope.organizationId === preview.scope.organizationId &&
    adoption.scope.branchId === preview.scope.branchId &&
    adoption.scope.memberId === preview.scope.memberId &&
    adoption.programId === preview.original.programId &&
    adoption.version === preview.original.version &&
    adoption.sourceSnapshotHash === preview.sourceSnapshotHash &&
    adoption.supplement.programId === adoption.programId &&
    adoption.supplement.version === adoption.version &&
    adoption.supplement.scope.organizationId === preview.scope.organizationId &&
    adoption.supplement.scope.branchId === preview.scope.branchId
  )
}
export function newAdoptionReview(preview: AdoptionPreview): AdoptionReview {
  return {
    sources: preview.original.steps.map((step) => ({
      stepId: step.id,
      load: null,
      laterality: null,
      policy: null,
    })),
    confirmedTargets: [],
    sourceDosesConfirmed: false,
    sharedVersionConfirmed: false,
  }
}
export function changeAdoptionSource(
  review: AdoptionReview,
  stepId: string,
  patch: Partial<Omit<SourceChoice, 'stepId'>>,
): AdoptionReview {
  return {
    sources: review.sources.map((source) =>
      source.stepId === stepId ? { ...source, ...patch } : source,
    ),
    confirmedTargets: [],
    sourceDosesConfirmed: false,
    sharedVersionConfirmed: false,
  }
}
export function proposalKey(proposal: AdoptionPreview['proposals'][number]) {
  return `${proposal.relation.id}:${proposal.hash}`
}
export function eligibleProposals(preview: AdoptionPreview, review: AdoptionReview) {
  const reviewed = new Set(
    preview.original.steps
      .filter(
        (step) => review.sources.find((source) => source.stepId === step.id)?.policy === 'reviewed',
      )
      .map((step) => step.exerciseId),
  )
  return preview.proposals.filter((proposal) => reviewed.has(proposal.relation.sourceExerciseId))
}
export function prepareLegacyAdoption(
  preview: AdoptionPreview,
  review: AdoptionReview,
  previous: AdoptionAttempt | null,
  newId: () => string = () => crypto.randomUUID(),
): { ok: true; attempt: AdoptionAttempt } | { ok: false; issues: string[] } {
  const issues: string[] = []
  if (!issuedDraftMatches(preview))
    return {
      ok: false,
      issues: ['La dosis mostrada no coincide con la versión original. Volvé a consultar.'],
    }
  if (preview.supplement)
    return { ok: false, issues: ['Esta versión ya tiene una revisión guardada.'] }
  if (!review.sourceDosesConfirmed)
    issues.push('Confirmá las dosis originales y las decisiones de cada movimiento.')
  if (!review.sharedVersionConfirmed)
    issues.push(
      'Confirmá que la revisión se comparte con todas las personas que usan esta misma versión.',
    )
  // Reconstruct only from the server's issued projection; arbitrary edited scalar data is never submitted.
  const sourceSteps = preview.draft.steps.map((step, index) => {
    const original = preview.original.steps[index]
    const choice = review.sources.find((source) => source.stepId === step.id)
    if (!original || original.id !== step.id || original.exerciseId !== step.exerciseId)
      issues.push('La proyección original cambió. Volvé a consultar la revisión.')
    if (!choice?.policy)
      issues.push(`Movimiento ${index + 1}: elegí alternativas revisadas o bloqueadas.`)
    if (!choice?.laterality) issues.push(`Movimiento ${index + 1}: confirmá los lados y el conteo.`)
    let load = original?.loadKg === null ? null : step.dose.load
    if (original?.loadKg === null) {
      if (choice?.load?.mode === 'bodyweight') load = { mode: 'bodyweight' }
      else if (choice?.load?.mode === 'external' && choice.load.kilograms.trim() !== '') {
        const kilograms = Number(choice.load.kilograms)
        if (Number.isFinite(kilograms) && kilograms >= 0 && kilograms <= 1000)
          load = { mode: 'external', kilograms: { kind: 'fixed', value: kilograms } }
      }
      if (!load)
        issues.push(
          `Movimiento ${index + 1}: confirmá peso corporal o una carga externa de 0 a 1000 kg.`,
        )
    }
    return {
      ...structuredClone(step),
      substitutionPolicy: choice?.policy ?? 'reviewed',
      dose: { ...structuredClone(step.dose), load, laterality: choice?.laterality ?? null },
    }
  })
  const proposals = eligibleProposals(preview, review)
  for (const proposal of proposals)
    if (!review.confirmedTargets.includes(proposalKey(proposal)))
      issues.push(
        `Revisá y confirmá la dosis y las condiciones de ${proposal.relation.target.name}.`,
      )
  if (issues.length) return { ok: false, issues }
  const payload = {
    id: preview.assignmentId,
    expectedRevision: 0,
    sourceSnapshotHash: preview.sourceSnapshotHash,
    sourceSteps,
    sourceDosesConfirmed: true,
    sharedVersionConfirmed: true,
    targetConfirmations: proposals.map(({ relation, hash }) => ({
      relationId: relation.id,
      relationHash: hash,
    })),
  }
  const signature = JSON.stringify(payload)
  const operationId = previous?.signature === signature ? previous.input.operationId : newId()
  const parsed = ProductEndpoints.adoptLegacySupplement.input.safeParse({ ...payload, operationId })
  return parsed.success
    ? { ok: true, attempt: { signature, input: parsed.data } }
    : {
        ok: false,
        issues: parsed.error.issues.map((issue) => `${issue.path.join(' → ')}: ${issue.message}`),
      }
}
export function adoptionFailure(error: unknown): 'revoked' | 'refresh' | 'retry' {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return 'revoked'
    if (error.status === 409 || error.status === 404) return 'refresh'
  }
  return 'retry'
}
