import { isCompletionEligible } from '@klisteniapp/b2b-domain/schedule'
import type {
  Dose,
  Enrollment,
  Occurrence,
  ProductOutput,
  SessionRevision,
} from '@klisteniapp/b2b-contracts/product-v2'

export type OccurrenceContext = ProductOutput<'occurrence'>
export function contextForRecord(
  record: SessionRecord,
  contexts: readonly OccurrenceContext[],
): OccurrenceContext | null {
  if (record.schemaVersion === 1 || record.origin.kind === 'legacy') return null
  const id = record.origin.occurrenceId
  const pair = contexts.find(
    (item) => item.occurrence.id === id && inScope(item.occurrence, record.scope),
  )
  if (!pair) return null
  if (
    !inScope(pair.enrollment, record.scope) ||
    pair.enrollment.id !== pair.occurrence.enrollmentId ||
    routineKey(pair.occurrence.routine) !== routineKey(record.origin.routine)
  ) {
    throw new Error('El período y el turno no corresponden al registro original.')
  }
  return pair
}

export type Continuity = ProductOutput<'continuity'>
export type SessionRecord = ProductOutput<'sessions'>[number]
export type HistoryScope = Occurrence['scope']
export type RoutineReference = Occurrence['routine']

export function inScope(value: { scope: HistoryScope }, scope: HistoryScope): boolean {
  return (
    value.scope.organizationId === scope.organizationId &&
    value.scope.branchId === scope.branchId &&
    value.scope.memberId === scope.memberId
  )
}

export function dateInZone(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    calendar: 'iso8601',
    numberingSystem: 'latn',
  }).format(new Date(instant))
}

// Date-only presentation arithmetic must not follow the device timezone or DST.
export function calendarDate(date: string, offset: number): string {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + offset)
  return value.toISOString().slice(0, 10)
}
export function monday(date: string): string {
  return calendarDate(date, 1 - (new Date(`${date}T12:00:00Z`).getUTCDay() || 7))
}
export function stagePosition(stage: Enrollment['content']['stages'][number], today: string) {
  return today < stage.startDate ? 'future' : today > stage.endDate ? 'past' : 'current'
}
export function enrollments(continuity: Continuity): Enrollment[] {
  return [...continuity.current, ...continuity.past, ...continuity.future]
}
export function sessionId(record: SessionRecord): string {
  return record.schemaVersion === 1 ? record.original.id : record.id
}
export function performedAt(record: SessionRecord): string {
  return record.schemaVersion === 1 ? record.original.completedAt : record.content.performedAt
}
export function routineReference(record: SessionRecord): RoutineReference {
  return record.schemaVersion === 1
    ? { programId: record.routine.programId, version: record.routine.version, schemaVersion: 1 }
    : record.origin.routine
}
export function routineKey(ref: RoutineReference): string {
  return `${ref.programId}-v${ref.version}-s${ref.schemaVersion}`
}
export function routineAnchor(ref: RoutineReference): string {
  return `original-routine-${routineKey(ref)}`
}
export function sessionAnchor(record: SessionRecord): string {
  return `actual-session-${sessionId(record)}`
}
export function latestSessions(
  records: readonly SessionRecord[],
  scope: HistoryScope,
): SessionRecord[] {
  const latest = new Map<string, SessionRecord>()
  for (const record of records.filter((item) => inScope(item, scope))) {
    const prior = latest.get(sessionId(record))
    if (!prior || record.revision > prior.revision) latest.set(sessionId(record), record)
  }
  // Corrections of legacy records retain executionId, but acquire a session ID.
  const corrected = new Set(
    [...latest.values()].flatMap((record) =>
      record.schemaVersion === 2 && record.origin.kind === 'legacy' && record.origin.executionId
        ? [record.origin.executionId]
        : [],
    ),
  )
  return [...latest.values()]
    .filter((record) => record.schemaVersion !== 1 || !corrected.has(record.original.id))
    .sort(
      (a, b) =>
        performedAt(b).localeCompare(performedAt(a)) || sessionId(a).localeCompare(sessionId(b)),
    )
}
export function linkedSessions(
  occurrence: Occurrence,
  records: readonly SessionRecord[],
): SessionRevision[] {
  return latestSessions(records, occurrence.scope).filter(
    (record): record is SessionRevision =>
      record.schemaVersion === 2 &&
      record.origin.kind === 'occurrence' &&
      record.origin.occurrenceId === occurrence.id,
  )
}
export function actualEligibility(record: SessionRecord, contexts: readonly OccurrenceContext[]) {
  if (record.schemaVersion === 1 || record.origin.kind === 'legacy') return 'unplanned'
  const pair = contextForRecord(record, contexts)
  if (!pair) return 'unknown'
  return isCompletionEligible(pair.occurrence, pair.enrollment, record.content.performedAt)
    ? 'eligible'
    : 'excluded'
}
export function doseText(dose: Dose): string {
  const target = (
    value: { kind: 'fixed'; value: number } | { kind: 'range'; min: number; max: number } | null,
  ) =>
    value === null
      ? '—'
      : value.kind === 'fixed'
        ? String(value.value)
        : `${value.min}–${value.max}`
  return `${target(dose.sets)} series · ${dose.mode === 'repetitions' ? `${target(dose.repetitions)} rep` : `${target(dose.durationSeconds)} s`} · ${dose.load.mode === 'bodyweight' ? 'peso corporal' : dose.load.mode === 'external' ? `${target(dose.load.kilograms)} kg` : 'carga sin especificar'} · descanso ${target(dose.restSeconds)} s · ${dose.laterality}`
}
