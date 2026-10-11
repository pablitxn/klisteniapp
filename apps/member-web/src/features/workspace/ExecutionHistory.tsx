import type { Execution } from '@klisteniapp/b2b-contracts'
import { dateLabel, Empty, executionDoseLabel, prescriptionDoseLabel } from '@klisteniapp/b2b-ui'

export function ExecutionHistory({
  executions,
  branchNames = {},
}: {
  executions: Execution[]
  branchNames?: Record<string, string>
}) {
  return executions.length ? (
    <div className="list">
      {executions.map((execution) => (
        <article className="card" key={execution.id}>
          <div className="card-head">
            <div>
              <p className="eyebrow">{dateLabel(execution.completedAt)}</p>
              {execution.branchId && (
                <p className="small muted">
                  Sede del registro: {branchNames[execution.branchId] ?? 'Sede anterior'}
                </p>
              )}
              <h2>{execution.program.name}</h2>
            </div>
            <span className={`pill ${execution.status === 'completed' ? 'done' : 'warning'}`}>
              {execution.status === 'completed' ? 'Completada' : 'Parcial'}
            </span>
          </div>
          <p>
            {execution.sets.length} series registradas · Versión {execution.program.version}
          </p>
          {execution.notes && <p className="muted">{execution.notes}</p>}
          <p className="small muted">
            Registro confirmado. Para entrenar de nuevo, iniciá otra sesión desde Mi rutina.
          </p>
          <details className="history-details">
            <summary>Ver lo que hiciste</summary>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ejercicio</th>
                    <th>Serie</th>
                    <th>Indicado</th>
                    <th>Realizado</th>
                    <th>Cambio</th>
                  </tr>
                </thead>
                <tbody>
                  {execution.sets.map((set) => (
                    <tr key={`${set.stepId}-${set.set}`}>
                      <td>
                        {execution.program.exercises.find(
                          (exercise) => exercise.id === set.exerciseId,
                        )?.name ?? set.exerciseId}
                      </td>
                      <td>{set.set}</td>
                      <td>
                        {(() => {
                          const planned = execution.program.steps.find(
                            (step) => step.id === set.stepId,
                          )
                          return planned ? prescriptionDoseLabel(planned) : '—'
                        })()}
                      </td>
                      <td>{executionDoseLabel(set)}</td>
                      <td>{set.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </article>
      ))}
    </div>
  ) : (
    <Empty title="Cada comienzo cuenta">
      Cuando guardes tu primera sesión, vas a encontrarla acá.
    </Empty>
  )
}
