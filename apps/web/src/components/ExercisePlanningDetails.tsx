import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('core')

  const { planning } = exercise
  const { requirements } = planning
  return (
    <details className="exercise-planning" key={exercise.id}>
      <summary>{t("Cómo encaja en tu rutina")}</summary>
      <dl className="exercise-planning-facts">
        <div><dt>{t("Movimiento")}</dt><dd>{t(movementFamilyLabels[planning.movementFamily])}</dd></div>
        <div><dt>{t("Trabajo")}</dt><dd>{planning.planningRoles.map(role => t(planningRoleLabels[role])).join(' · ')}</dd></div>
        <div><dt>{t("Posición y apoyos")}</dt><dd>{t(positionLabels[requirements.position])}: {requirements.supports.map(support => t(supportLabels[support])).join(', ')}</dd></div>
        <div><dt>{t("Equilibrio")}</dt><dd>{t(balanceLabels[requirements.balance])}</dd></div>
        <div><dt>{t("Cómo contar")}</dt><dd>{planning.laterality === 'alternating'
          ? t("Alterná los lados; contá las repeticiones de cada lado.")
          : planning.laterality === 'unilateral'
          ? t("Completá las repeticiones de un lado y después cambiá. La demostración muestra un lado.")
          : t("Ambos lados trabajan juntos en cada repetición.")}</dd></div>
      </dl>
      {requirements.capabilities.length > 0 && <div className="exercise-planning-requirements">
        <strong>{t("Control necesario")}</strong>
        <ul>{requirements.capabilities.map(capability => <li key={capability}>{t(capabilityLabels[capability])}</li>)}</ul>
      </div>}
      <div className="exercise-planning-relations">
        <strong>{t("Opciones relacionadas")}</strong>
        {planning.relations.length === 0
          ? <p>{t("Todavía no hay un reemplazo revisado para este movimiento en la galería.")}</p>
          : planning.relations.map(relation => {
            const target = getExercise(relation.targetId)!
            return <div className="exercise-planning-option" key={relation.targetId}>
              <button type="button" className="text-button" onClick={() => onExplore(target.id)}>
                {t(relationLabels[relation.type])}: {t(target.name)} ↗
              </button>
              <p>{relation.rationale}</p>
              <ul>{relation.conditions.map(condition => <li key={condition}>{t(relationConditionLabels[condition])}</li>)}</ul>
            </div>
          })}
      </div>
    </details>
  )
}
