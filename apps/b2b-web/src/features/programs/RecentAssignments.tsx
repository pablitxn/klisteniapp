import type { Assignment } from '@klisteniapp/b2b-contracts'
import { dateLabel } from '@klisteniapp/b2b-ui'

export function RecentAssignments({ assignments }: { assignments: Assignment[] }) {
  return (
    <section className="card" style={{ marginTop: 26 }}>
      <h2>Asignaciones recientes</h2>
      {assignments.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rutina</th>
                <th>Versión</th>
                <th>Asignada</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>{assignment.memberName}</td>
                  <td>{assignment.program.name}</td>
                  <td>{assignment.program.version}</td>
                  <td>{dateLabel(assignment.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Cuando asignes una rutina, aparecerá acá.</p>
      )}
    </section>
  )
}
