import { type Report } from '@klisteniapp/b2b-contracts'
import {
  dateLabel,
  Empty,
  executionDoseLabel,
  Field,
  Notice,
  prescriptionDoseLabel,
} from '@klisteniapp/b2b-ui'
import { useState } from 'react'
import { Heading } from '../../shared/Heading'

export function Reports({ report }: { report: Report }) {
  const [memberId, setMemberId] = useState('')
  const executions = report.executions.filter(
    (execution) => !memberId || execution.memberId === memberId,
  )
  return (
    <>
      <Heading
        title="Acompañar también es observar."
        description="Compará la rutina asignada con lo realizado, incluyendo cambios, cargas y sesiones parciales."
      />
      <div className="grid three" style={{ marginBottom: 25 }}>
        <div className="card stat">
          <strong>{report.members.length}</strong>
          <span>Socios a tu cargo</span>
        </div>
        <div className="card stat">
          <strong>{report.members.reduce((sum, item) => sum + item.completed, 0)}</strong>
          <span>Sesiones completas</span>
        </div>
        <div className="card stat">
          <strong>{report.members.reduce((sum, item) => sum + item.partial, 0)}</strong>
          <span>Sesiones parciales</span>
        </div>
      </div>
      <Field label="Filtrar seguimiento por socio">
        <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
          <option value="">Todas las personas autorizadas</option>
          {report.members.map((member) => (
            <option value={member.userId} key={member.userId}>
              {member.name}
            </option>
          ))}
        </select>
      </Field>
      <section className="card" style={{ marginTop: 24 }}>
        <h2>Un vistazo a cada recorrido</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rutinas</th>
                <th>Completas</th>
                <th>Parciales</th>
                <th>Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {report.members
                .filter((member) => !memberId || member.userId === memberId)
                .map((member) => (
                  <tr key={member.userId}>
                    <td>{member.name}</td>
                    <td>{member.assignments}</td>
                    <td>{member.completed}</td>
                    <td>{member.partial}</td>
                    <td>
                      {member.lastActivityAt
                        ? dateLabel(member.lastActivityAt)
                        : 'Todavía sin sesiones'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <h2 style={{ marginTop: 32 }}>Planificado y realizado</h2>
      {executions.length ? (
        <div className="list">
          {executions.map((execution) => (
            <article className="card" key={execution.id}>
              <div className="card-head">
                <div>
                  <p className="eyebrow">
                    {execution.memberName} · {dateLabel(execution.completedAt)}
                  </p>
                  <h2>{execution.program.name}</h2>
                </div>
                <span className={`pill ${execution.status === 'completed' ? 'done' : 'warning'}`}>
                  {execution.status === 'completed' ? 'Completada' : 'Parcial'}
                </span>
              </div>
              <p className="small muted">
                Versión asignada: {execution.program.version}. Los valores planificados pertenecen a
                esa versión.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Movimiento planificado</th>
                      <th>Serie</th>
                      <th>Objetivo</th>
                      <th>Realizado</th>
                      <th>Ejercicio realizado / motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {execution.program.steps.flatMap((step) =>
                      Array.from({ length: step.sets }, (_, index) => {
                        const set = execution.sets.find(
                          (set) => set.stepId === step.id && set.set === index + 1,
                        )
                        const planned = execution.program.exercises.find(
                          (exercise) => exercise.id === step.exerciseId,
                        )
                        return (
                          <tr key={`${step.id}-${index}`}>
                            <td>{planned?.name ?? step.exerciseId}</td>
                            <td>{index + 1}</td>
                            <td>{prescriptionDoseLabel(step)}</td>
                            <td>
                              {set ? (
                                executionDoseLabel(set)
                              ) : (
                                <span className="muted">Sin registrar</span>
                              )}
                            </td>
                            <td>
                              {set && set.exerciseId !== step.exerciseId ? (
                                <>
                                  {execution.program.exercises.find(
                                    (exercise) => exercise.id === set.exerciseId,
                                  )?.name ?? set.exerciseId}
                                  <br />
                                  <small>{set.reason}</small>
                                </>
                              ) : set ? (
                                'Según lo previsto'
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        )
                      }),
                    )}
                  </tbody>
                </table>
              </div>
              {execution.notes && <Notice>{execution.notes}</Notice>}
            </article>
          ))}
        </div>
      ) : (
        <Empty title="El recorrido se escribe entrenando">
          Los registros de tus socios aparecerán acá cuando confirmen sus sesiones.
        </Empty>
      )}
    </>
  )
}
