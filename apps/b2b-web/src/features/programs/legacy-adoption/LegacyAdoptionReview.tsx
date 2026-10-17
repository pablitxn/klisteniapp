import { useRef, useState } from 'react'
import { Field } from '@klisteniapp/b2b-ui'
import {
  conditionLabels,
  doseLabel,
  requirementLabel,
} from '../../alternatives/alternativePresentation'
import {
  changeAdoptionSource,
  eligibleProposals,
  newAdoptionReview,
  prepareLegacyAdoption,
  proposalKey,
  type AdoptionAttempt,
  type AdoptionInput,
  type AdoptionPreview,
  type SourceChoice,
} from './legacyAdoptionModel'

export function LegacyAdoptionReview({
  preview,
  onSubmit,
  onRefresh,
  error = '',
  busy = false,
}: {
  preview: AdoptionPreview
  onSubmit: (input: AdoptionInput) => Promise<void>
  onRefresh: () => void
  error?: string
  busy?: boolean
}) {
  const [review, setReview] = useState(() => newAdoptionReview(preview))
  const [issues, setIssues] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const lock = useRef(false)
  const attempt = useRef<AdoptionAttempt | null>(null)
  const proposals = eligibleProposals(preview, review)
  const ready = prepareLegacyAdoption(preview, review, attempt.current, () => 'validation-only').ok
  const disabled = busy || sending
  function change(stepId: string, patch: Partial<Omit<SourceChoice, 'stepId'>>) {
    setReview((current) => changeAdoptionSource(current, stepId, patch))
    setIssues([])
  }
  const name = (id: string) =>
    preview.original.exercises.find((exercise) => exercise.id === id)?.name ?? id
  return (
    <section className="legacy-adoption" aria-label="Revisar versión anterior">
      <h1>Revisar una rutina anterior</h1>
      <p>
        {preview.original.name} · versión {preview.original.version} · asignación{' '}
        {preview.assignmentId}
      </p>
      <p>{preview.original.description}</p>
      <p>
        La rutina y los registros originales se conservan. Esta revisión añade decisiones explícitas
        para usar alternativas revisadas; no convierte otras versiones ni modifica registros
        anteriores.
      </p>
      <details>
        <summary>Identidad de la versión original</summary>
        <dl>
          <dt>Rutina</dt>
          <dd>{preview.original.programId}</dd>
          <dt>Publicada</dt>
          <dd>{preview.original.publishedAt}</dd>
          <dt>Hash de la instantánea original</dt>
          <dd>
            <code>{preview.sourceSnapshotHash}</code>
          </dd>
        </dl>
      </details>
      <form
        noValidate
        onSubmit={async (event) => {
          event.preventDefault()
          if (lock.current || disabled) return
          const result = prepareLegacyAdoption(preview, review, attempt.current)
          if (!result.ok) {
            setIssues(result.issues)
            return
          }
          attempt.current = result.attempt
          lock.current = true
          setSending(true)
          setIssues([])
          try {
            await onSubmit(result.attempt.input)
          } finally {
            lock.current = false
            setSending(false)
          }
        }}
      >
        <fieldset disabled={disabled} className="legacy-adoption-stack">
          <legend>Dosis originales y decisiones explícitas</legend>
          {preview.original.steps.map((step, index) => {
            const choice = review.sources.find((source) => source.stepId === step.id)!
            return (
              <article className="card legacy-adoption-stack" key={step.id}>
                <h2>
                  Movimiento {index + 1}: {name(step.exerciseId)}
                </h2>
                <dl className="legacy-adoption-scalars">
                  <dt>Series originales</dt>
                  <dd>{step.sets}</dd>
                  <dt>Repeticiones originales</dt>
                  <dd>{step.reps ?? 'No aplican'}</dd>
                  <dt>Duración original (segundos)</dt>
                  <dd>{step.durationSeconds ?? 'No indicada'}</dd>
                  <dt>Carga original (kg)</dt>
                  <dd>{step.loadKg ?? 'No confirmada; no equivale a peso corporal'}</dd>
                  <dt>Descanso original (segundos)</dt>
                  <dd>{step.restSeconds}</dd>
                  <dt>RPE original</dt>
                  <dd>{step.targetRpe ?? 'No indicado'}</dd>
                </dl>
                <p>Indicaciones originales: {step.notes || 'Sin indicaciones'}</p>
                <p>
                  Autorizaciones manuales anteriores:{' '}
                  {step.alternatives.map(name).join(', ') || 'Sin lista'}. No acreditan relaciones
                  revisadas y se conservan como evidencia original.
                </p>
                {step.loadKg === null ? (
                  <>
                    <Field label={`Carga a confirmar · movimiento ${index + 1}`}>
                      <select
                        value={choice.load?.mode ?? ''}
                        onChange={(e) =>
                          change(step.id, {
                            load:
                              e.target.value === 'bodyweight'
                                ? { mode: 'bodyweight' }
                                : e.target.value === 'external'
                                  ? { mode: 'external', kilograms: '' }
                                  : null,
                          })
                        }
                      >
                        <option value="">Sin confirmar</option>
                        <option value="bodyweight">Peso corporal</option>
                        <option value="external">Carga externa (kg)</option>
                      </select>
                    </Field>
                    {choice.load?.mode === 'external' && (
                      <Field label={`Carga externa a confirmar (kg) · movimiento ${index + 1}`}>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={1000}
                          step="any"
                          value={choice.load.kilograms}
                          onChange={(e) =>
                            change(step.id, {
                              load: { mode: 'external', kilograms: e.target.value },
                            })
                          }
                        />
                      </Field>
                    )}
                  </>
                ) : (
                  <p>La carga conocida de {step.loadKg} kg se conserva sin cambios.</p>
                )}
                <Field label={`Lados y conteo a confirmar · movimiento ${index + 1}`}>
                  <select
                    value={choice.laterality ?? ''}
                    onChange={(e) =>
                      change(step.id, {
                        laterality: (e.target.value || null) as SourceChoice['laterality'],
                      })
                    }
                  >
                    <option value="">Sin confirmar</option>
                    <option value="bilateral">Ambos lados juntos</option>
                    <option value="alternating">Por lado, alternando</option>
                    <option value="per-side">Por cada lado</option>
                  </select>
                </Field>
                <Field label={`Alternativas en esta versión · movimiento ${index + 1}`}>
                  <select
                    value={choice.policy ?? ''}
                    onChange={(e) =>
                      change(step.id, {
                        policy: (e.target.value || null) as SourceChoice['policy'],
                      })
                    }
                  >
                    <option value="">Elegí una política</option>
                    <option value="reviewed">Alternativas revisadas</option>
                    <option value="blocked">Bloquear alternativas</option>
                  </select>
                </Field>
                {choice.policy === 'blocked' && (
                  <p role="status">
                    Las alternativas están bloqueadas para este movimiento en esta versión.
                  </p>
                )}
                {choice.policy === 'reviewed' &&
                  !preview.proposals.some(
                    (p) => p.relation.sourceExerciseId === step.exerciseId,
                  ) && (
                    <p role="status">No hay relaciones revisadas elegibles para este ejercicio.</p>
                  )}
              </article>
            )
          })}
          <section
            aria-label="Todos los destinos revisados elegibles"
            className="legacy-adoption-stack"
          >
            <h2>Destinos revisados</h2>
            <p>
              Cada destino usa su propia dosis, carga y condiciones. No se presupone la misma carga
              ni el mismo efecto. Se confirman todas las relaciones elegibles de los movimientos con
              alternativas revisadas.
            </p>
            {proposals.map((proposal) => {
              const relation = proposal.relation
              const key = proposalKey(proposal)
              return (
                <article className="card" key={key}>
                  <h3>
                    {name(relation.sourceExerciseId)} → {relation.target.name}
                  </h3>
                  <p>
                    {relation.type === 'progression'
                      ? 'Progresión'
                      : relation.type === 'regression'
                        ? 'Regresión'
                        : 'Alternativa'}
                    : {relation.rationale}
                  </p>
                  <p>{doseLabel(relation.targetDose)}</p>
                  {relation.targetDose.notes && <p>{relation.targetDose.notes}</p>}
                  <h4>Requisitos del destino</h4>
                  <ul>
                    {relation.requirements.map((requirement) => (
                      <li key={requirement}>{requirementLabel(requirement)}</li>
                    ))}
                  </ul>
                  <h4>Condiciones de esta relación dirigida</h4>
                  <ul>
                    {relation.conditions.map((condition) => (
                      <li key={condition}>{conditionLabels[condition]}</li>
                    ))}
                  </ul>
                  <details>
                    <summary>Identidad exacta de esta relación</summary>
                    <dl>
                      <dt>Relación</dt>
                      <dd>{relation.id}</dd>
                      <dt>Hash de la propuesta revisada</dt>
                      <dd>
                        <code>{proposal.hash}</code>
                      </dd>
                      <dt>Revisión del catálogo</dt>
                      <dd>
                        <code>{relation.catalogRevision}</code>
                      </dd>
                      <dt>Hash del contenido de origen</dt>
                      <dd>
                        <code>{relation.sourceContentHash}</code>
                      </dd>
                      <dt>Hash del contenido de destino</dt>
                      <dd>
                        <code>{relation.targetContentHash}</code>
                      </dd>
                    </dl>
                  </details>
                  <label className="legacy-adoption-check">
                    <input
                      type="checkbox"
                      checked={review.confirmedTargets.includes(key)}
                      onChange={(e) =>
                        setReview((current) => ({
                          ...current,
                          sourceDosesConfirmed: false,
                          sharedVersionConfirmed: false,
                          confirmedTargets: e.target.checked
                            ? [...current.confirmedTargets, key]
                            : current.confirmedTargets.filter((k) => k !== key),
                        }))
                      }
                    />
                    Confirmo la dosis propia y todas las condiciones de {relation.target.name} para
                    este origen.
                  </label>
                </article>
              )
            })}
          </section>
          <label className="legacy-adoption-check">
            <input
              type="checkbox"
              checked={review.sourceDosesConfirmed}
              onChange={(e) =>
                setReview((current) => ({ ...current, sourceDosesConfirmed: e.target.checked }))
              }
            />
            Confirmo las dosis originales y las decisiones explícitas de carga, lados y alternativas
            de cada movimiento.
          </label>
          <label className="legacy-adoption-check">
            <input
              type="checkbox"
              checked={review.sharedVersionConfirmed}
              onChange={(e) =>
                setReview((current) => ({ ...current, sharedVersionConfirmed: e.target.checked }))
              }
            />
            Entiendo que esta revisión se aplica a todas las personas que tienen asignada esta misma
            versión de la rutina, sin cambiar sus instantáneas ni registros originales.
          </label>
          <div className="legacy-adoption-actions">
            <button className="button primary" disabled={disabled || !ready}>
              {disabled ? 'Guardando revisión…' : 'Guardar revisión explícita de esta versión'}
            </button>
            <button type="button" className="button" disabled={disabled} onClick={onRefresh}>
              Volver a consultar y revisar desde el inicio
            </button>
          </div>
          {!ready && (
            <p role="status">Completá las decisiones y todas las confirmaciones para guardar.</p>
          )}
        </fieldset>
        {issues.length > 0 && (
          <div role="alert">
            <ul>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  )
}
