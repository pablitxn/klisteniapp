import {
  PersonalExportSchema,
  TrainingInterchangeSchema,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2'
import type { MembershipIdentity } from './restrictedAccess.ts'

export type TrainingInterchange = ProductOutput<'personalExport'>['training'][number]

function assertScope(training: TrainingInterchange, identity: MembershipIdentity) {
  const { scope } = training
  if (
    training.ownerId !== identity.userId ||
    scope.memberId !== identity.userId ||
    scope.organizationId !== identity.organizationId
  )
    throw new Error('Export identity mismatch')
  const memberRecords = [
    ...training.legacyExecutions,
    ...training.enrollments,
    ...training.occurrences,
    ...training.sessionRevisions,
    ...training.supplements,
  ]
  for (const record of memberRecords)
    if (
      record.scope.organizationId !== scope.organizationId ||
      record.scope.branchId !== scope.branchId ||
      record.scope.memberId !== scope.memberId
    )
      throw new Error('Export branch mismatch')
  const routines = [
    ...training.routines.filter((routine) => routine.schemaVersion === 2).map((r) => r.snapshot),
    ...training.supplements.map((s) => s.supplement),
  ]
  for (const routine of routines)
    if (
      routine.scope.organizationId !== scope.organizationId ||
      routine.scope.branchId !== scope.branchId
    )
      throw new Error('Routine branch mismatch')
  const legacyRoutines = [
    ...training.routines.filter((routine) => routine.schemaVersion === 1).map((r) => r.snapshot),
    ...training.legacyExecutions.map((execution) => execution.routine),
  ]
  for (const routine of legacyRoutines)
    if (routine.branchId && routine.branchId !== scope.branchId)
      throw new Error('Legacy routine branch mismatch')
}

/** Preserve the entire validated envelope, including revisions of the same ID.
 * This is an archive adapter, not a claim of B2C store/import capabilities.
 * Return the original JSON data: schema transforms must not normalize history. */
export function readTrainingInterchange(raw: string): TrainingInterchange {
  const value: unknown = JSON.parse(raw)
  const checked = TrainingInterchangeSchema.parse(value)
  assertScope(checked, {
    userId: checked.ownerId,
    organizationId: checked.scope.organizationId,
  })
  return value as TrainingInterchange
}

export function writeTrainingInterchange(value: TrainingInterchange): string {
  TrainingInterchangeSchema.parse(value)
  const raw = JSON.stringify(value, null, 2)
  readTrainingInterchange(raw)
  return raw
}

export function personalExportDownload(value: unknown, identity: MembershipIdentity) {
  const checked = PersonalExportSchema.parse(value)
  if (checked.ownerId !== identity.userId || checked.health.ownerId !== identity.userId)
    throw new Error('Export owner mismatch')
  for (const training of checked.training) assertScope(training, identity)
  // Keep every original field. Do not map routines into a narrower B2C shape.
  return {
    filename: 'klisteni-personal-export-v2.json',
    json: JSON.stringify(value, null, 2),
  }
}
