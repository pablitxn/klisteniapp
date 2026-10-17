import { useRef, useState } from 'react'
import { errorMessage } from '@klisteniapp/b2b-client'
import type { Enrollment, Occurrence, ProductInput } from '@klisteniapp/b2b-contracts/product-v2'
import {
  dateInZone,
  inScope,
  linkedSessions,
  routineAnchor,
  routineKey,
  sessionAnchor,
  type SessionRecord,
} from '../routine-history/model'
import {
  canMoveOccurrence,
  isLateCorrectedWeek,
  moveRequest,
  occurrenceState,
  weekDates,
  type WeekSummary,
} from './model'

const labels = {
  excluded: 'Excluida',
  completed: 'Completada',
  partial: 'Parcial',
  missed: 'Ausente',
  pending: 'Pendiente',
}
export function WeekCalendar({
  summary,
  occurrences,
  sessions,
  enrollments,
  now,
  canReschedule,
  onMove,
}: {
  summary: WeekSummary
  occurrences: Occurrence[]
  sessions: SessionRecord[]
  enrollments: Enrollment[]
  now: string
  canReschedule: boolean
  onMove: (request: ProductInput<'moveOccurrence'>) => Promise<void>
}) {
  const dates = weekDates(summary.week.startDate)
  const today = dateInZone(now, summary.week.timeZone)
  const visible = occurrences.filter(
    (item) =>
      inScope(item, summary.scope) &&
      item.currentWeek.startDate === summary.week.startDate &&
      item.currentWeek.timeZone === summary.week.timeZone,
  )
  return (
    <section aria-label="Calendario semanal">
      <h2>Semana del {summary.week.startDate}</h2>
      <p>
        {summary.week.timeZone} · {summary.closed ? 'Semana cerrada' : 'Semana en curso'}
      </p>
      <dl className="grid three">
        {(
          [
            ['Prescritas', summary.required],
            ['Completadas', summary.completed],
            ['Parciales', summary.partial],
            ['Ausentes', summary.missed],
            ['Pendientes', summary.pending],
          ] as const
        ).map(([label, count]) => (
          <div className="card stat" key={label}>
            <dt>{label}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
      <p>
        Las parciales siguen pendientes; al cierre cuentan entre las ausentes. Cada turno conserva
        su identidad aunque coincida con otro día.
      </p>
      <p className="small muted">
        Resumen r{summary.revision} · actualizado {summary.asOf}. El resultado cerrado se recalcula
        con correcciones aceptadas.
      </p>
      {isLateCorrectedWeek(summary, sessions) && (
        <p role="status">
          Corrección recibida después del cierre. El resumen muestra el resultado vigente; consultá
          las revisiones de cada registro.
        </p>
      )}
      <ol className="list" style={{ padding: 0, listStyle: 'none' }}>
        {dates.map((date) => (
          <li className="card" key={date} aria-current={today === date ? 'date' : undefined}>
            <h3>
              <time dateTime={date}>{date}</time>
              {date === today ? ' · Hoy' : ''}
            </h3>
            {!visible.some((item) => item.scheduledDate === date) && (
              <p>Sin sesiones prescritas este día.</p>
            )}
            {visible
              .filter((item) => item.scheduledDate === date)
              .map((occurrence) => {
                const state = occurrenceState(occurrence, sessions, enrollments, summary.closed)
                return (
                  <article
                    key={occurrence.id}
                    id={`scheduled-occurrence-${occurrence.id}`}
                    tabIndex={-1}
                    style={{ borderTop: '1px solid currentColor', marginTop: 12, paddingTop: 12 }}
                  >
                    <h4>
                      Turno {occurrence.id} · {labels[state]}
                    </h4>
                    {state === 'partial' && summary.closed && (
                      <p>Parcial al cierre: incluida entre las ausentes.</p>
                    )}
                    <p>
                      <a href={`#${routineAnchor(occurrence.routine)}`}>
                        Rutina original {routineKey(occurrence.routine)}
                      </a>
                    </p>
                    <p className="small muted">
                      Etapa {occurrence.stageId} · período emitido r
                      {occurrence.issuedEnrollmentRevision} · calendario r{occurrence.revision} ·
                      fecha original {occurrence.originalDate}
                    </p>
                    {occurrence.permittedDateOverride && (
                      <p>
                        Reprogramación aceptada fuera del período original:{' '}
                        {occurrence.permittedDateOverride}
                      </p>
                    )}
                    {occurrence.cancellationReason && (
                      <p>Excluida del seguimiento: {occurrence.cancellationReason}</p>
                    )}
                    {linkedSessions(occurrence, sessions).map((record) => (
                      <p key={record.id}>
                        <a href={`#${sessionAnchor(record)}`}>Ver registro {record.id}</a>
                      </p>
                    ))}
                    {canReschedule &&
                      canMoveOccurrence(
                        occurrence,
                        sessions,
                        enrollments.find((item) => item.id === occurrence.enrollmentId),
                      ) && (
                        <MoveOccurrence
                          key={`${occurrence.id}-${occurrence.revision}`}
                          occurrence={occurrence}
                          onMove={onMove}
                        />
                      )}
                  </article>
                )
              })}
          </li>
        ))}
      </ol>
    </section>
  )
}
function MoveOccurrence({
  occurrence,
  onMove,
}: {
  occurrence: Occurrence
  onMove: (request: ProductInput<'moveOccurrence'>) => Promise<void>
}) {
  const [date, setDate] = useState(occurrence.scheduledDate)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const lock = useRef(false)
  const retry = useRef<ProductInput<'moveOccurrence'> | null>(null)
  const id = `move-${occurrence.id}`
  async function move(event: React.FormEvent) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const request =
        retry.current?.scheduledDate === date
          ? retry.current
          : moveRequest(occurrence, date, crypto.randomUUID())
      retry.current = request
      await onMove(request)
      retry.current = null
      setMessage('Reprogramación aceptada. El calendario se actualizó.')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <form onSubmit={(event) => void move(event)} aria-label={`Reprogramar turno ${occurrence.id}`}>
      <label htmlFor={id}>Mover dentro de esta semana</label>
      <select
        style={{ maxWidth: '100%' }}
        id={id}
        value={date}
        disabled={busy}
        onChange={(event) => {
          setDate(event.target.value)
          setError('')
          setMessage('')
        }}
      >
        {weekDates(occurrence.currentWeek.startDate).map((day) => (
          <option key={day} value={day}>
            {day}
          </option>
        ))}
      </select>
      <button className="button" type="submit" disabled={busy || date === occurrence.scheduledDate}>
        {busy ? 'Guardando…' : 'Confirmar cambio de día'}
      </button>
      {error && (
        <p role="alert">
          {error} El cambio no se confirmó. Actualizá el calendario si otra persona lo modificó.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  )
}
