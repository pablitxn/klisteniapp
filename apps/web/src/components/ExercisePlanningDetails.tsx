import type { Exercise } from '@klisteniapp/scene-schema'
import { getExercise } from '../data/exercises'
import {
  balanceLabels, capabilityLabels, movementFamilyLabels, planningRoleLabels,
  positionLabels, relationConditionLabels, supportLabels,
} from '../lib/exercise-planning-labels'

const relationLabels = {
  alternative: 'Otra opción', regression: 'Menor dificultad', progression: 'Progresión',
}

export default function ExercisePlanningDetails({ exercise, onExplore }: {
  exercise: Exercise
  onExplore: (id: string) => void
}) {
  const { planning } = exercise
  const { requirements } = planning
  return (
    <details className="exercise-planning" key={exercise.id}>
      <summary>Cómo encaja en tu rutina</summary>
      <dl className="exercise-planning-facts">
        <div><dt>Movimiento</dt><dd>{movementFamilyLabels[planning.movementFamily]}</dd></div>
        <div><dt>Trabajo</dt><dd>{planning.planningRoles.map(role => planningRoleLabels[role]).join(' · ')}</dd></div>
        <div><dt>Posición y apoyos</dt><dd>{positionLabels[requirements.position]}: {requirements.supports.map(support => supportLabels[support]).join(', ')}</dd></div>
        <div><dt>Equilibrio</dt><dd>{balanceLabels[requirements.balance]}</dd></div>
        <div><dt>Cómo contar</dt><dd>{planning.laterality === 'alternating'
          ? 'Alterná los lados; contá las repeticiones de cada lado.'
          : planning.laterality === 'unilateral'
          ? 'Completá las repeticiones de un lado y después cambiá. La demostración muestra un lado.'
          : 'Ambos lados trabajan juntos en cada repetición.'}</dd></div>
      </dl>
      {requirements.capabilities.length > 0 && <div className="exercise-planning-requirements">
        <strong>Control necesario</strong>
        <ul>{requirements.capabilities.map(capability => <li key={capability}>{capabilityLabels[capability]}</li>)}</ul>
      </div>}
      <div className="exercise-planning-relations">
        <strong>Opciones relacionadas</strong>
        {planning.relations.length === 0
          ? <p>Todavía no hay un reemplazo revisado para este movimiento en la galería.</p>
          : planning.relations.map(relation => {
            const target = getExercise(relation.targetId)!
            return <div className="exercise-planning-option" key={relation.targetId}>
              <button type="button" className="text-button" onClick={() => onExplore(target.id)}>
                {relationLabels[relation.type]}: {target.name} ↗
              </button>
              <p>{relation.rationale}</p>
              <ul>{relation.conditions.map(condition => <li key={condition}>{relationConditionLabels[condition]}</li>)}</ul>
            </div>
          })}
      </div>
    </details>
  )
}
