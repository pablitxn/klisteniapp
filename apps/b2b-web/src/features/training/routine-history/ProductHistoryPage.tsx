import './routineHistory.css'
import type { Occurrence, ProductOutput } from '@klisteniapp/b2b-contracts/product-v2'
import type { SessionRecord } from './model'
import { useEffect, useRef, useState } from 'react'
import { useLoad } from '@klisteniapp/b2b-react'
import {
  dateInZone,
  enrollments,
  inScope,
  latestSessions,
  monday,
  calendarDate,
  type HistoryScope,
  type RoutineReference,
} from './model'
import { EnrollmentPeriodDetails } from './EnrollmentPeriodDetails'
import { loadRoutineHistory } from './historyReads'
import { LegacyAssignments } from './LegacyAssignments'
import { RoutineContinuity } from './RoutineContinuity'
import { SessionHistory, type HistoryClientFactory } from './SessionHistory'
import { OriginalRoutines } from './OriginalRoutines'
import { WeekCalendar } from '../week-calendar/WeekCalendar'

export type ProductHistoryProps = {
  scope: HistoryScope
  /** Changes on authenticated identity, access revision or host/branch context changes. */
  accessKey: string
  createClient: HistoryClientFactory
  canReschedule: boolean
  onOpenRoutine?: (routine: RoutineReference) => void
  onStartOccurrence?: (occurrence: Occurrence) => void
  onStartLegacy?: (assignment: ProductOutput<'legacyAssignments'>[number]) => void
  onEditSession?: (record: SessionRecord) => void
}
export function ProductHistoryPage(props: ProductHistoryProps) {
  return <ProductHistoryWorkspace key={JSON.stringify([props.accessKey, props.scope])} {...props} />
}
function ProductHistoryWorkspace({
  scope,
  accessKey,
  createClient,
  canReschedule,
  onOpenRoutine,
  onStartOccurrence,
  onStartLegacy,
  onEditSession,
}: ProductHistoryProps) {
  const [clock, setClock] = useState(() => new Date().toISOString())
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date().toISOString()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  const mutations = useRef(new Set<AbortController>())
  useEffect(() => {
    const pending = mutations.current
    return () => {
      for (const controller of pending) controller.abort()
    }
  }, [])
  const [refresh, setRefresh] = useState(0)
  const [moveMessage, setMoveMessage] = useState('')
  const focusOccurrence = useRef<string | null>(null)
  const ownerKey = JSON.stringify([accessKey, scope])
  const history = useLoad((signal) => loadRoutineHistory(createClient(signal), scope), ownerKey, {
    refreshKey: refresh,
  })
  const plans = history.data
    ? enrollments(history.data.continuity).filter((item) => inScope(item, scope))
    : []
  const timeZones = [...new Set(plans.map((item) => item.content.timeZone))]
  const [selectedZone, setSelectedZone] = useState('')
  const zone = timeZones.includes(selectedZone) ? selectedZone : (timeZones[0] ?? null)
  const [selectedWeek, setSelectedWeek] = useState('')
  const weekStart = zone ? selectedWeek || monday(dateInZone(clock, zone)) : null
  const weekly = useLoad(
    async (signal) => {
      if (!zone || !weekStart) return null
      const client = createClient(signal)
      const input = { memberId: scope.memberId, weekStart, timeZone: zone }
      const [summary, occurrences] = await Promise.all([
        client.call('week', input),
        client.call('occurrences', input),
      ])
      if (
        !inScope(summary, scope) ||
        summary.week.startDate !== weekStart ||
        summary.week.timeZone !== zone
      )
        throw new Error('El calendario cambió de contexto. Volvé a cargarlo.')
      return { summary, occurrences: occurrences.filter((item) => inScope(item, scope)) }
    },
    JSON.stringify([ownerKey, zone, weekStart]),
    { refreshKey: JSON.stringify([refresh, zone ? dateInZone(clock, zone) : null]) },
  )
  useEffect(() => {
    if (!weekly.data || weekly.loading || !focusOccurrence.current) return
    document.getElementById(`scheduled-occurrence-${focusOccurrence.current}`)?.focus()
    focusOccurrence.current = null
  }, [weekly.data, weekly.loading])
  const records = latestSessions(history.data?.records ?? [], scope)
  return (
    <div className="routine-history">
      <h1>Mi rutina e historial</h1>
      <p>
        La planificación conserva objetivos y períodos. Cada sesión mantiene sus valores reales y su
        versión original.
      </p>
      <button
        className="button"
        onClick={() => {
          history.reload()
          weekly.reload()
        }}
      >
        Actualizar historial y calendario
      </button>
      {history.loading && <p role="status">Cargando historial…</p>}
      {history.error && <p role="alert">{history.error}</p>}
      {weekly.error && <p role="alert">{weekly.error}</p>}
      {moveMessage && <p role="status">{moveMessage}</p>}
      {history.data && !history.error && !weekly.error && (
        <>
          <RoutineContinuity
            continuity={{
              ...history.data.continuity,
              current: history.data.continuity.current.filter((item) => inScope(item, scope)),
              past: history.data.continuity.past.filter((item) => inScope(item, scope)),
              future: history.data.continuity.future.filter((item) => inScope(item, scope)),
            }}
            now={clock}
            createClient={createClient}
            accessKey={accessKey}
            onOpenRoutine={onOpenRoutine}
          />
          {zone && weekStart && (
            <>
              <label htmlFor="history-zone">Zona horaria de la inscripción</label>
              <select
                id="history-zone"
                value={zone}
                onChange={(event) => {
                  setSelectedZone(event.target.value)
                  setSelectedWeek('')
                }}
              >
                {timeZones.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <nav
                aria-label="Elegir semana"
                style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlock: 20 }}
              >
                <button
                  className="button"
                  onClick={() => setSelectedWeek(calendarDate(weekStart, -7))}
                >
                  Semana anterior
                </button>
                <button className="button" onClick={() => setSelectedWeek('')}>
                  Esta semana
                </button>
                <button
                  className="button"
                  onClick={() => setSelectedWeek(calendarDate(weekStart, 7))}
                >
                  Semana siguiente
                </button>
              </nav>
            </>
          )}
          {weekly.loading && zone && <p role="status">Cargando calendario…</p>}
          {weekly.data && (
            <WeekCalendar
              summary={weekly.data.summary}
              occurrences={weekly.data.occurrences}
              sessions={records}
              enrollments={plans}
              occurrenceContexts={history.data.contexts}
              now={clock}
              onStartOccurrence={onStartOccurrence}
              renderIssuedPeriod={(occurrence) => (
                <EnrollmentPeriodDetails
                  reference={{
                    id: occurrence.enrollmentId,
                    revision: occurrence.issuedEnrollmentRevision,
                    stageId: occurrence.stageId,
                  }}
                  scope={scope}
                  accessKey={accessKey}
                  createClient={createClient}
                  onOpenRoutine={onOpenRoutine}
                />
              )}
              canReschedule={
                canReschedule &&
                !history.loading &&
                !history.error &&
                !weekly.loading &&
                !weekly.error
              }
              onMove={async (request) => {
                const controller = new AbortController()
                mutations.current.add(controller)
                try {
                  await createClient(controller.signal).call('moveOccurrence', request)
                  if (!controller.signal.aborted) {
                    focusOccurrence.current = request.id
                    setMoveMessage(
                      `Turno ${request.id}: cambio a ${request.scheduledDate} aceptado.`,
                    )
                    setRefresh((value) => value + 1)
                  }
                } finally {
                  mutations.current.delete(controller)
                }
              }}
            />
          )}
          <LegacyAssignments assignments={history.data.assignments} onStartLegacy={onStartLegacy} />
          <OriginalRoutines
            enrollments={plans}
            references={history.data.assignments.map((a) => a.routine)}
            records={records}
            occurrences={[
              ...(weekly.data?.occurrences ?? []),
              ...history.data.contexts.map((pair) => pair.occurrence),
            ]}
            onOpenRoutine={onOpenRoutine}
          />
          <SessionHistory
            records={records}
            scope={scope}
            occurrenceContexts={history.data.contexts}
            createClient={createClient}
            accessKey={accessKey}
            timeZone={zone}
            onEditSession={onEditSession}
            onOpenRoutine={onOpenRoutine}
          />
        </>
      )}
    </div>
  )
}
