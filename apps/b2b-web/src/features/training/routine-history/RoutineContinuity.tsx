import type { Enrollment } from '@klisteniapp/b2b-contracts/product-v2'
import {
  dateInZone,
  enrollments,
  routineAnchor,
  routineKey,
  stagePosition,
  type Continuity,
} from './model'

const positions = { past: 'Etapa anterior', current: 'Etapa actual', future: 'Próxima etapa' }
const weekdays = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
export function RoutineContinuity({ continuity, now }: { continuity: Continuity; now: string }) {
  const plans = enrollments(continuity)
  return (
    <section aria-label="Continuidad de la rutina">
      <h2>Objetivos y etapas</h2>
      {!plans.length && (
        <p>
          No hay un programa por etapas. Las rutinas anteriores conservan sus registros sin un
          calendario supuesto.
        </p>
      )}
      {plans.map((enrollment) => (
        <EnrollmentContinuity key={enrollment.id} enrollment={enrollment} now={now} />
      ))}
      {continuity.unscheduledLegacyAssignmentIds.length > 0 && (
        <p>
          Asignaciones anteriores sin calendario:{' '}
          {continuity.unscheduledLegacyAssignmentIds.join(', ')}. No generan ausencias semanales.
        </p>
      )}
    </section>
  )
}
function EnrollmentContinuity({ enrollment, now }: { enrollment: Enrollment; now: string }) {
  const today = dateInZone(now, enrollment.content.timeZone)
  const current = enrollment.content.stages.find(
    (stage) => stagePosition(stage, today) === 'current',
  )
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7
  return (
    <article className="card" style={{ marginBottom: 20 }}>
      <h3>{enrollment.content.name}</h3>
      <p>Objetivo: {enrollment.content.goal || 'Sin objetivo indicado'}</p>
      <p>
        Hoy {today} · {enrollment.content.timeZone} ·{' '}
        {enrollment.status === 'ended' ? 'Inscripción finalizada' : 'Inscripción activa'}
      </p>
      <p className="small muted">
        Programa {enrollment.goalProgramId} · revisión emitida {enrollment.issuedGoalRevision} ·
        período vigente r{enrollment.revision}
      </p>
      {enrollment.status === 'active' && !current && (
        <p role="status">
          Hoy no hay una etapa prescrita. El intervalo entre etapas no genera ausencias.
        </p>
      )}
      {enrollment.status === 'active' &&
        current &&
        !current.slots.some((slot) => slot.weekday === weekday) && (
          <p>
            Hoy no hay un turno original. Consultá el calendario por reprogramaciones aceptadas.
          </p>
        )}
      <ol className="list">
        {enrollment.content.stages.map((stage) => {
          const position = stagePosition(stage, today)
          return (
            <li key={stage.id} aria-current={position === 'current' ? 'step' : undefined}>
              <strong>
                {positions[position]}: {stage.name}
              </strong>
              <p>
                {stage.startDate} a {stage.endDate}
              </p>
              <ul>
                {stage.slots.map((slot) => (
                  <li key={slot.id}>
                    {weekdays[slot.weekday - 1]} ·{' '}
                    <a href={`#${routineAnchor(slot.routine)}`}>
                      Rutina {routineKey(slot.routine)}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ol>
    </article>
  )
}
