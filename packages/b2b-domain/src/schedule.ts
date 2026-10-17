import {
  EnrollmentSchema,
  GoalProgramContentSchema,
  LocalDateSchema,
  OccurrenceSchema,
  WeekSchema,
  WeekSummarySchema,
  type Enrollment,
  type Occurrence,
  type SessionRevision,
} from '@klisteniapp/b2b-contracts/product-v2'

export function addDays(date: string, days: number): string {
  LocalDateSchema.parse(date)
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
export function weekStart(date: string): string {
  LocalDateSchema.parse(date)
  const day = new Date(`${date}T12:00:00Z`).getUTCDay() || 7
  return addDays(date, 1 - day)
}
export function localDate(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    numberingSystem: 'latn',
  }).formatToParts(new Date(instant))
  const part = (type: string) => parts.find((p) => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
/** Earliest instant on a local date, including zones whose midnight is skipped.
 * Calendar dates, rather than elapsed 24-hour increments, define week edges. */
export function startOfLocalDate(date: string, timeZone: string): string {
  WeekSchema.shape.timeZone.parse(timeZone)
  LocalDateSchema.parse(date)
  const noon = Date.parse(`${date}T12:00:00Z`)
  let low = noon - 48 * 3600000,
    high = noon + 48 * 3600000
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (localDate(new Date(middle).toISOString(), timeZone) < date) low = middle + 1
    else high = middle
  }
  return new Date(low).toISOString()
}
export function weekBounds(week: { startDate: string; timeZone: string }) {
  WeekSchema.parse(week)
  return {
    start: startOfLocalDate(week.startDate, week.timeZone),
    end: startOfLocalDate(addDays(week.startDate, 7), week.timeZone),
  }
}
const sameRoutine = (a: Occurrence['routine'], b: Occurrence['routine']) =>
  a.programId === b.programId && a.version === b.version && a.schemaVersion === b.schemaVersion
const daysBetween = (before: string, after: string) =>
  Math.round((Date.parse(`${after}T12:00Z`) - Date.parse(`${before}T12:00Z`)) / 86400000)
function slotDates(start: string, end: string, weekday: number): string[] {
  const dates: string[] = []
  for (let date = start; date <= end; date = addDays(date, 1))
    if ((new Date(`${date}T12:00Z`).getUTCDay() || 7) === weekday) dates.push(date)
  return dates
}

export function isCompletionEligible(
  occurrence: Occurrence,
  enrollment: Enrollment,
  performedAt: string,
): boolean {
  const date = localDate(performedAt, occurrence.currentWeek.timeZone)
  const stage = enrollment.content.stages.find((s) => s.id === occurrence.stageId)
  return (
    occurrence.eligibility === 'required' &&
    weekStart(date) === occurrence.currentWeek.startDate &&
    (date === occurrence.permittedDateOverride ||
      (!!stage && date >= stage.startDate && date <= stage.endDate))
  )
}

export function moveWithinWeek(
  occurrence: Occurrence,
  enrollment: Enrollment,
  scheduledDate: string,
  completed: boolean,
): Occurrence {
  LocalDateSchema.parse(scheduledDate)
  if (completed || enrollment.status !== 'active' || occurrence.eligibility !== 'required')
    throw new Error('OCCURRENCE_NOT_MOVABLE')
  if (weekStart(scheduledDate) !== occurrence.currentWeek.startDate)
    throw new Error('OUTSIDE_PRESCRIBED_WEEK')
  const stage = enrollment.content.stages.find((s) => s.id === occurrence.stageId)
  if (!stage) throw new Error('OCCURRENCE_NOT_MOVABLE')
  return OccurrenceSchema.parse({
    ...occurrence,
    scheduledDate,
    permittedDateOverride:
      scheduledDate < stage.startDate || scheduledDate > stage.endDate ? scheduledDate : null,
    revision: occurrence.revision + 1,
  })
}

/** The caller locks the enrollment and persists this plan atomically with its
 * revision. Existing ordinals are never reassigned; additions allocate above max.
 * Equal-length period translations move identities; extensions retain dates. */
export function reconcileOccurrences(
  previous: Enrollment | null,
  next: Enrollment,
  existing: readonly Occurrence[],
  allocateId: () => string,
  endedAt?: string,
): Occurrence[] {
  EnrollmentSchema.parse(next)
  GoalProgramContentSchema.parse(next.content)
  if (
    existing.some(
      (o) =>
        o.enrollmentId !== next.id ||
        o.scope.organizationId !== next.scope.organizationId ||
        o.scope.branchId !== next.scope.branchId ||
        o.scope.memberId !== next.scope.memberId,
    )
  )
    throw new Error('FOREIGN_OCCURRENCE')
  if (new Set(existing.map((o) => o.id)).size !== existing.length)
    throw new Error('DUPLICATE_OCCURRENCE')
  if (next.status === 'ended') {
    if (!endedAt) throw new Error('EXPLICIT_END_TIME_REQUIRED')
    return existing.map((o) =>
      o.scheduledDate > localDate(endedAt, o.currentWeek.timeZone) && o.eligibility === 'required'
        ? OccurrenceSchema.parse({
            ...o,
            eligibility: 'cancelled',
            cancellationReason: 'Enrollment ended before prescribed date',
            revision: o.revision + 1,
          })
        : o,
    )
  }
  const result: Occurrence[] = []
  const retained = new Set<string>()
  for (const stage of next.content.stages) {
    for (const slot of stage.slots) {
      const originals = existing.filter((o) => o.stageId === stage.id && o.slotId === slot.id)
      const oldStage = previous?.content.stages.find((s) => s.id === stage.id)
      const translated =
        oldStage &&
        daysBetween(stage.startDate, stage.endDate) ===
          daysBetween(oldStage.startDate, oldStage.endDate) &&
        stage.startDate !== oldStage.startDate
      const dates = slotDates(stage.startDate, stage.endDate, slot.weekday)
      const oldWeekday = oldStage?.slots.find((s) => s.id === slot.id)?.weekday ?? slot.weekday
      const oldDates = oldStage ? slotDates(oldStage.startDate, oldStage.endDate, oldWeekday) : []
      let ordinal = Math.max(-1, ...originals.map((o) => o.slotOrdinal)) + 1
      for (const date of dates) {
        // Match issued slot dates, not user-moved dates. A user move must not create an extra obligation.
        const match = originals.find((o) => {
          const nominalBefore = addDays(o.currentWeek.startDate, oldWeekday - 1)
          const target =
            translated && oldDates.includes(nominalBefore)
              ? dates[oldDates.indexOf(nominalBefore)]
              : addDays(o.currentWeek.startDate, slot.weekday - 1)
          return !retained.has(o.id) && sameRoutine(o.routine, slot.routine) && target === date
        })
        if (match) {
          retained.add(match.id)
          const nominalBefore = addDays(match.currentWeek.startDate, oldWeekday - 1)
          const weekDelta = daysBetween(match.currentWeek.startDate, weekStart(date))
          const scheduledDate =
            match.scheduledDate === nominalBefore ? date : addDays(match.scheduledDate, weekDelta)
          const override = match.permittedDateOverride
            ? addDays(match.permittedDateOverride, weekDelta)
            : scheduledDate < stage.startDate || scheduledDate > stage.endDate
              ? scheduledDate
              : null
          const changed =
            match.eligibility !== 'required' ||
            match.scheduledDate !== scheduledDate ||
            match.permittedDateOverride !== override
          result.push(
            OccurrenceSchema.parse({
              ...match,
              scheduledDate,
              currentWeek: {
                startDate: weekStart(scheduledDate),
                timeZone: match.currentWeek.timeZone,
              },
              permittedDateOverride: override,
              eligibility: 'required',
              cancellationReason: null,
              revision: match.revision + (changed ? 1 : 0),
            }),
          )
        } else {
          const week = { startDate: weekStart(date), timeZone: next.content.timeZone }
          result.push(
            OccurrenceSchema.parse({
              schemaVersion: 2,
              id: allocateId(),
              scope: next.scope,
              enrollmentId: next.id,
              stageId: stage.id,
              slotId: slot.id,
              slotOrdinal: ordinal++,
              routine: slot.routine,
              issuedEnrollmentRevision: next.revision,
              originalDate: date,
              originalWeek: week,
              scheduledDate: date,
              currentWeek: week,
              permittedDateOverride: null,
              revision: 1,
              eligibility: 'required',
              cancellationReason: null,
            }),
          )
        }
      }
    }
  }
  for (const original of existing) {
    if (!retained.has(original.id))
      result.push(
        OccurrenceSchema.parse({
          ...original,
          eligibility: 'cancelled',
          cancellationReason: 'Excluded by planning revision',
          revision: original.revision + (original.eligibility === 'cancelled' ? 0 : 1),
        }),
      )
  }
  return result
}

export function deriveWeek(input: {
  scope: Occurrence['scope']
  week: Occurrence['currentWeek']
  asOf: string
  revision: number
  occurrences: readonly Occurrence[]
  sessions: readonly SessionRevision[]
  enrollments: readonly Enrollment[]
}) {
  const { scope, week } = input
  WeekSchema.parse(week)
  const required = input.occurrences.filter(
    (o) =>
      o.scope.organizationId === scope.organizationId &&
      o.scope.branchId === scope.branchId &&
      o.scope.memberId === scope.memberId &&
      o.eligibility === 'required' &&
      o.currentWeek.startDate === week.startDate &&
      o.currentWeek.timeZone === week.timeZone,
  )
  const latest = new Map<string, SessionRevision>()
  for (const session of input.sessions) {
    if (
      session.scope.organizationId !== scope.organizationId ||
      session.scope.branchId !== scope.branchId ||
      session.scope.memberId !== scope.memberId
    )
      continue
    const prior = latest.get(session.id)
    if (!prior || prior.revision < session.revision) latest.set(session.id, session)
  }
  let completed = 0,
    partial = 0
  for (const occurrence of required) {
    const enrollment = input.enrollments.find((e) => e.id === occurrence.enrollmentId)
    const linked = [...latest.values()].filter(
      (s) =>
        s.origin.kind === 'occurrence' &&
        s.origin.occurrenceId === occurrence.id &&
        enrollment &&
        isCompletionEligible(occurrence, enrollment, s.content.performedAt),
    )
    if (linked.some((s) => s.content.status === 'completed' && s.content.explicitCompletion))
      completed++
    else if (linked.some((s) => s.content.status === 'partial')) partial++
  }
  const closed = Date.parse(input.asOf) >= Date.parse(weekBounds(week).end)
  return WeekSummarySchema.parse({
    schemaVersion: 2,
    scope,
    week,
    revision: input.revision,
    asOf: input.asOf,
    closed,
    required: required.length,
    completed,
    partial,
    missed: closed ? required.length - completed : 0,
    pending: closed ? 0 : required.length - completed,
    occurrenceIds: required.map((o) => o.id).sort(),
  })
}
