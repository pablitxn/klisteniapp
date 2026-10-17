import { useId, useState } from 'react'
import type { ReviewedRelation, RoutineVersionV2 } from '@klisteniapp/b2b-contracts/product-v2'
import {
  alternativePresentation,
  conditionLabels,
  doseLabel,
  requirementLabel,
} from './alternativePresentation.ts'

export function ReviewedAlternatives({
  step,
  relations,
  unavailableIds,
  onSelect,
}: {
  step: RoutineVersionV2['steps'][number]
  relations: readonly ReviewedRelation[]
  unavailableIds: ReadonlySet<string>
  onSelect: (relation: ReviewedRelation, confirmedConditions: string[]) => void
}) {
  const state = alternativePresentation(step, relations)
  return (
    <section aria-label="Alternativas revisadas" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <p role="status">{state.message}</p>
      {state.options.map((relation) => (
        <AlternativeOption
          key={
            step.id + relation.id + relation.catalogRevision + JSON.stringify(relation.targetDose)
          }
          relation={relation}
          unavailable={unavailableIds.has(relation.id)}
          onSelect={onSelect}
        />
      ))}
    </section>
  )
}

function AlternativeOption({
  relation,
  unavailable,
  onSelect,
}: {
  relation: ReviewedRelation
  unavailable: boolean
  onSelect: (relation: ReviewedRelation, confirmedConditions: string[]) => void
}) {
  const id = useId()
  const [confirmed, setConfirmed] = useState<string[]>([])
  const accepted = relation.conditions.every((condition) => confirmed.includes(condition))
  return (
    <fieldset style={{ minWidth: 0, marginBlock: '1rem' }}>
      <legend>{relation.target.name}</legend>
      <p>
        {relation.type === 'progression'
          ? 'Progresión'
          : relation.type === 'regression'
            ? 'Regresión'
            : 'Alternativa'}
        : {relation.rationale}
      </p>
      <p>{doseLabel(relation.targetDose)}</p>
      {relation.targetDose.notes && (
        <p style={{ whiteSpace: 'pre-line' }}>{relation.targetDose.notes}</p>
      )}
      <ul>
        {relation.requirements.map((requirement) => (
          <li key={requirement}>{requirementLabel(requirement)}</li>
        ))}
      </ul>
      {unavailable && (
        <p role="status" id={`${id}-equipment`}>
          El equipo necesario no está disponible en esta sede.
        </p>
      )}
      {relation.conditions.map((condition) => (
        <label
          key={condition}
          style={{ display: 'flex', alignItems: 'center', minHeight: 44, gap: 8 }}
        >
          <input
            type="checkbox"
            checked={confirmed.includes(condition)}
            onChange={(event) =>
              setConfirmed(
                event.target.checked
                  ? [...confirmed, condition]
                  : confirmed.filter((item) => item !== condition),
              )
            }
          />
          {conditionLabels[condition]}
        </label>
      ))}
      <button
        type="button"
        style={{ minHeight: 44, maxWidth: '100%', whiteSpace: 'normal' }}
        disabled={unavailable || !accepted}
        aria-describedby={unavailable ? `${id}-equipment` : undefined}
        onClick={() => onSelect(relation, [...confirmed])}
      >
        Usar {relation.target.name}
      </button>
    </fieldset>
  )
}
