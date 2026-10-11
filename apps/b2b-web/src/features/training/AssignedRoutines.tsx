import type { Assignment, Execution } from '@klisteniapp/b2b-contracts'
import { supportsMachine } from '@klisteniapp/b2b-domain/catalog'
import { Empty, prescriptionStepLabel } from '@klisteniapp/b2b-ui'

function usesMachine(assignment: Assignment, machineId: string): boolean {
  return assignment.program.steps.some((step) => {
    const exercise = assignment.program.exercises.find((item) => item.id === step.exerciseId)
    return Boolean(exercise && supportsMachine(exercise, machineId))
  })
}

export function AssignedRoutines({
  assignments,
  executions,
  machineId,
  canStart,
  onStart,
}: {
  assignments: Assignment[]
  executions: Execution[]
  machineId: string | null
  canStart: boolean
  onStart: (assignmentId: string) => void
}) {
  const visible = machineId
    ? assignments.filter((assignment) => usesMachine(assignment, machineId))
    : assignments
  return (
    <>
      <div className="grid three" style={{ marginBottom: 26 }}>
        <div className="card stat">
          <strong>{assignments.length}</strong>
          <span>Rutinas asignadas</span>
        </div>
        <div className="card stat">
          <strong>{executions.filter((item) => item.status === 'completed').length}</strong>
          <span>Sesiones completas</span>
        </div>
        <div className="card stat">
          <strong>{executions.reduce((total, item) => total + item.sets.length, 0)}</strong>
          <span>Series registradas</span>
        </div>
      </div>
      {visible.length ? (
        <div className="grid two">
          {visible.map((assignment) => (
            <article className="card" key={assignment.id}>
              <div className="card-head">
                <span className="pill">TU PLAN</span>
                <span className="small muted">v{assignment.program.version}</span>
              </div>
              <h2>{assignment.program.name}</h2>
              <p className="muted">{assignment.program.description}</p>
              <div className="list">
                {assignment.program.steps.map((step, index) => (
                  <div className="list-row" key={step.id}>
                    <div>
                      <strong>
                        {index + 1}.{' '}
                        {assignment.program.exercises.find((item) => item.id === step.exerciseId)
                          ?.name ?? step.exerciseId}
                      </strong>
                      <p>{prescriptionStepLabel(step)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="button primary"
                style={{ width: '100%', marginTop: 22 }}
                disabled={!canStart}
                onClick={() => onStart(assignment.id)}
              >
                Empezar sesión <span aria-hidden="true">→</span>
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            machineId
              ? 'Este equipo no aparece en tus rutinas asignadas'
              : 'Tu próxima rutina está en camino'
          }
        >
          {machineId
            ? 'Consultá a tu entrenador antes de sumar un movimiento. Podés volver a todas tus rutinas desde el enlace de arriba.'
            : 'El equipo del gimnasio te asignará un plan. Mientras tanto, podés conocer los movimientos.'}
        </Empty>
      )}
    </>
  )
}
