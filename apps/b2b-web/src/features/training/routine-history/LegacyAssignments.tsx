import type { ProductOutput } from '@klisteniapp/b2b-contracts/product-v2'
import { routineAnchor, routineKey } from './model'

export function LegacyAssignments({
  assignments,
  onStartLegacy,
}: {
  assignments: ProductOutput<'legacyAssignments'>
  onStartLegacy?: (assignment: ProductOutput<'legacyAssignments'>[number]) => void
}) {
  return (
    <section aria-label="Asignaciones anteriores sin calendario">
      <h2>Rutinas asignadas sin calendario</h2>
      <p>
        Estas asignaciones conservan su versión original, incluso sin registros. No generan
        ausencias prescritas.
      </p>
      {!assignments.length && <p>No hay asignaciones anteriores sin calendario.</p>}
      {assignments.map((assignment) => (
        <article className="card" key={assignment.id}>
          <h3>{assignment.name}</h3>
          <p>
            {assignment.active ? 'Asignación vigente' : 'Asignación anterior'}
            {assignment.archivedAt ? ' · Rutina archivada' : ''}
          </p>
          <p>
            Asignación {assignment.id} · asignada {assignment.createdAt} · actor{' '}
            {assignment.assignedBy}
          </p>
          <p>
            <a href={`#${routineAnchor(assignment.routine)}`}>
              Ver rutina original {routineKey(assignment.routine)}
            </a>
          </p>
          {onStartLegacy && assignment.active && !assignment.archivedAt && (
            <button className="button" onClick={() => onStartLegacy(assignment)}>
              Abrir registro de {assignment.name}
            </button>
          )}
        </article>
      ))}
    </section>
  )
}
