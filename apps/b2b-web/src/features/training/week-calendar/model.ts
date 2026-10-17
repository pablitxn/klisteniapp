import type { OccurrenceContext } from '../routine-history/model.ts'
import { isCompletionEligible } from '@klisteniapp/b2b-domain/schedule'
import type {
  Enrollment,
  Occurrence,
  ProductInput,
  ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2'
import {
  actualEligibility,
  calendarDate,
  dateInZone,
  inScope,
  latestSessions,
  linkedSessions,
  type SessionRecord,
} from '../routine-history/model.ts'

export type WeekSummary = ProductOutput<'week'>
export function weekDates(start: string): string[] {
  return Array.from({ length: 7 }, (_, index) => calendarDate(start, index))
}
export function occurrenceState(
  occurrence: Occurrence,
  records: readonly SessionRecord[],
  contexts: readonly OccurrenceContext[],
  closed: boolean,
) {
  if (occurrence.eligibility === 'cancelled') return 'excluded'
  const linked = linkedSessions(occurrence, records)
  const eligible = linked.filter((record) => actualEligibility(record, contexts) === 'eligible')
  if (
    eligible.some(
      (record) => record.content.status === 'completed' && record.content.explicitCompletion,
    )
  )
    return 'completed'
  if (linked.some((record) => actualEligibility(record, contexts) === 'unknown')) return 'unknown'
  if (eligible.some((record) => record.content.status === 'partial')) return 'partial'
  return closed ? 'missed' : 'pending'
}
export function canMoveOccurrence(
  occurrence: Occurrence,
  records: readonly SessionRecord[],
  enrollment: Enrollment | undefined,
): boolean {
  return (
    occurrence.eligibility === 'required' &&
    enrollment?.status === 'active' &&
    enrollment.id === occurrence.enrollmentId &&
    inScope(enrollment, occurrence.scope) &&
    !linkedSessions(occurrence, records).some(
      (record) =>
        record.content.status === 'completed' &&
        record.content.explicitCompletion &&
        isCompletionEligible(occurrence, enrollment, record.content.performedAt),
    )
  )
}
export function moveRequest(
  occurrence: Occurrence,
  scheduledDate: string,
  operationId: string,
): ProductInput<'moveOccurrence'> {
  if (!weekDates(occurrence.currentWeek.startDate).includes(scheduledDate))
    throw new Error('Elegí un día de la misma semana.')
  return { id: occurrence.id, expectedRevision: occurrence.revision, operationId, scheduledDate }
}
export function isLateCorrectedWeek(
  summary: WeekSummary,
  records: readonly SessionRecord[],
): boolean {
  return (
    summary.closed &&
    latestSessions(records, summary.scope).some((record) => {
      if (
        record.schemaVersion !== 2 ||
        record.revision < 2 ||
        record.origin.kind !== 'occurrence' ||
        !summary.occurrenceIds.includes(record.origin.occurrenceId)
      )
        return false
      const performed = dateInZone(record.content.performedAt, summary.week.timeZone)
      return (
        performed >= summary.week.startDate &&
        performed < calendarDate(summary.week.startDate, 7) &&
        dateInZone(record.acceptedAt, summary.week.timeZone) >=
          calendarDate(summary.week.startDate, 7)
      )
    })
  )
}
