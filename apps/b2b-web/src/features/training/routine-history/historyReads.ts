import type { ProductV2Client } from '@klisteniapp/b2b-client'
import type { ProductInput } from '@klisteniapp/b2b-contracts/product-v2'
import { contextForRecord, inScope, latestSessions, type HistoryScope } from './model.ts'

/** Preserve the atomic occurrence/enrollment response; never merge its members
 * into independently loaded weekly or continuity arrays. */
export type PeriodReference = ProductInput<'enrollmentRevision'> & {
  stageId?: string
}

export async function loadRoutineHistory(client: ProductV2Client, scope: HistoryScope) {
  const [continuity, allRecords, assignments] = await Promise.all([
    client.call('continuity', { memberId: scope.memberId }),
    client.call('sessions', { memberId: scope.memberId }),
    client.call('legacyAssignments', { memberId: scope.memberId }),
  ])
  if (
    !inScope(continuity, scope) ||
    assignments.some((item) => !inScope(item, scope)) ||
    [...continuity.current, ...continuity.past, ...continuity.future, ...allRecords].some(
      (item) => !inScope(item, scope),
    )
  )
    throw new Error('El historial no corresponde al contexto autorizado.')
  const records = latestSessions(allRecords, scope)
  const ids = [
    ...new Set(
      records.flatMap((record) =>
        record.schemaVersion === 2 && record.origin.kind === 'occurrence'
          ? [record.origin.occurrenceId]
          : [],
      ),
    ),
  ]
  const contexts = await Promise.all(
    ids.map(async (id) => {
      const pair = await client.call('occurrence', { id })
      if (
        pair.occurrence.id !== id ||
        !inScope(pair.occurrence, scope) ||
        !inScope(pair.enrollment, scope) ||
        pair.occurrence.enrollmentId !== pair.enrollment.id
      )
        throw new Error('El turno no corresponde al contexto autorizado.')
      return pair
    }),
  )
  for (const record of records) contextForRecord(record, contexts)
  return { continuity, records, assignments, contexts }
}

export async function loadEnrollmentRevision(
  client: ProductV2Client,
  scope: HistoryScope,
  reference: PeriodReference,
) {
  const snapshot = await client.call('enrollmentRevision', {
    id: reference.id,
    revision: reference.revision,
  })
  if (
    !inScope(snapshot.enrollment, scope) ||
    snapshot.enrollment.id !== reference.id ||
    snapshot.enrollment.revision !== reference.revision ||
    (reference.stageId &&
      !snapshot.enrollment.content.stages.some((stage) => stage.id === reference.stageId))
  )
    throw new Error('La revisión recibida no corresponde al período solicitado.')
  return snapshot
}

export async function loadHistorySubjects(
  client: ProductV2Client,
  scope: { organizationId: string; branchId: string },
) {
  const roster = await client.call('historySubjects', {})
  if (
    roster.scope.organizationId !== scope.organizationId ||
    roster.scope.branchId !== scope.branchId
  )
    throw new Error('Las personas no corresponden a la sede autorizada.')
  return roster.members
}
