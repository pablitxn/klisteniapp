import { workoutPrescription, prescriptionDisplay } from './workoutPrescription'
import { newWorkoutId } from './workoutCrypto'
import type {
  RoutineVersionV2,
  SessionContent,
  SessionPrescriptionBinding,
} from '@klisteniapp/b2b-contracts/product-v2'
import {
  emptyPerformedSet,
  targetEquipmentAvailable,
  type AlternativeEnvironment,
} from '@klisteniapp/b2b-domain/alternatives'
import { Field } from '@klisteniapp/b2b-ui'
import { ReviewedAlternatives } from '../../alternatives/ReviewedAlternatives'
import { doseLabel } from '../../alternatives/alternativePresentation'
import { RestTimer } from '../RestTimer'
import {
  changeWorkoutActual,
  restoreWorkoutSegment,
  segmentRows,
  selectWorkoutAlternative,
} from './workoutEdit'

type Actual = SessionContent['sets'][number]
export function ProductSessionStep({
  step,
  routine,
  prescription,
  content,
  environment,
  disabled,
  onEdit,
  acceptedSegmentIds,
  onArchiveTarget,
}: {
  step: RoutineVersionV2['steps'][number]
  routine?: RoutineVersionV2
  prescription?: SessionPrescriptionBinding
  content: SessionContent
  environment: AlternativeEnvironment
  disabled: boolean
  acceptedSegmentIds: ReadonlySet<string>
  onArchiveTarget: (id: string) => void
  onEdit: (change: (c: SessionContent) => SessionContent) => void
}) {
  const binding = workoutPrescription({ routine, prescription })
  const display = prescriptionDisplay(binding)
  const selected = content.selectedSegments.find((s) => s.originalStepId === step.id)?.segmentId
  const segments = content.segments.filter((s) => s.originalStepId === step.id)
  const unavailableIds = new Set(
    display.relations
      .filter((r) => !targetEquipmentAvailable(r.target, environment))
      .map((r) => r.id),
  )
  return (
    <section
      className="card workout-step"
      aria-label={display.exercises.find((e) => e.id === step.exerciseId)?.name ?? step.exerciseId}
    >
      <h2>{display.exercises.find((e) => e.id === step.exerciseId)?.name ?? step.exerciseId}</h2>
      <fieldset disabled={disabled}>
        <legend>Prescripción y alternativas</legend>
        {binding.kind === 'reviewed' ? (
          <ReviewedAlternatives
            step={step}
            relations={binding.routine.relations}
            unavailableIds={unavailableIds}
            onSelect={(relation, confirmed) =>
              onEdit((c) =>
                selectWorkoutAlternative(
                  c,
                  binding.routine,
                  step.id,
                  relation.id,
                  confirmed,
                  environment,
                  newWorkoutId(),
                  new Date().toISOString(),
                ),
              )
            }
          />
        ) : (
          <p>
            Prescripción histórica compatible; no es una publicación revisada ni una confirmación de
            lateralidad. Las variantes manuales originales se conservan por separado.
          </p>
        )}
        {segments.map((segment) => (
          <section key={segment.segmentId} className="subtle workout-segment">
            <h3>
              {display.exercises.find((e) => e.id === segment.exerciseId)?.name ??
                segment.relation?.target.name ??
                segment.exerciseId}{' '}
              · {segment.segmentId === selected ? 'Objetivo actual' : 'Trabajo conservado'}
            </h3>
            <p>{doseLabel(segment.dose)}</p>
            {segment.dose.notes && <p>{segment.dose.notes}</p>}
            {segment.segmentId !== selected && (
              <button
                type="button"
                className="button"
                onClick={() => onEdit((c) => restoreWorkoutSegment(c, segment.segmentId))}
              >
                Volver a este objetivo
              </button>
            )}
            {segment.relation &&
              segment.segmentId !== selected &&
              !acceptedSegmentIds.has(segment.segmentId) && (
                <button
                  type="button"
                  className="button"
                  onClick={() => onArchiveTarget(segment.segmentId)}
                >
                  Archivar objetivo local no aceptado y conservar copia
                </button>
              )}
            {[
              ...segmentRows(segment),
              ...content.sets
                .filter(
                  (s) =>
                    s.segmentId === segment.segmentId &&
                    !segmentRows(segment).some((r) => r.ordinal === s.ordinal && r.side === s.side),
                )
                .map((s) => ({ ordinal: s.ordinal, side: s.side })),
            ].map(({ ordinal, side }) => {
              const actual = content.sets.find(
                (s) =>
                  s.segmentId === segment.segmentId && s.ordinal === ordinal && s.side === side,
              )
              const change = (patch: Partial<Actual>) =>
                onEdit((c) => {
                  const existing = c.sets.find(
                    (s) =>
                      s.segmentId === segment.segmentId && s.ordinal === ordinal && s.side === side,
                  )
                  return changeWorkoutActual(c, {
                    ...(existing ?? emptyPerformedSet(segment, newWorkoutId(), ordinal, side)),
                    ...patch,
                  })
                })
              return (
                <fieldset key={`${ordinal}:${side}`} className="workout-actual">
                  <legend>
                    Serie {ordinal}
                    {side === 'both' ? '' : side === 'left' ? ' · izquierda' : ' · derecha'}
                  </legend>
                  <div className="workout-fields">
                    <Field
                      label={
                        segment.dose.mode === 'repetitions'
                          ? 'Repeticiones realizadas'
                          : 'Segundos realizados'
                      }
                    >
                      <input
                        aria-label={`${segment.segmentId} ${ordinal} ${side} cantidad`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={segment.dose.mode === 'repetitions' ? 1000 : 86400}
                        value={
                          actual
                            ? ((segment.dose.mode === 'repetitions'
                                ? actual.repetitions
                                : actual.durationSeconds) ?? '')
                            : ''
                        }
                        onChange={(e) =>
                          change(
                            segment.dose.mode === 'repetitions'
                              ? { repetitions: e.target.value === '' ? 0 : Number(e.target.value) }
                              : {
                                  durationSeconds:
                                    e.target.value === '' ? 0 : Number(e.target.value),
                                },
                          )
                        }
                      />
                    </Field>
                    {segment.dose.load.mode !== 'bodyweight' && (
                      <Field
                        label={
                          segment.dose.load.mode === 'unspecified'
                            ? 'Carga realizada kg (opcional; carga prescrita sin especificar)'
                            : 'Carga realizada kg'
                        }
                      >
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={1000}
                          step="any"
                          value={actual?.loadKg ?? ''}
                          onChange={(e) =>
                            change({
                              loadKg: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                    )}
                    <Field label="RPE opcional">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={1}
                        max={10}
                        step="0.5"
                        value={actual?.rpe ?? ''}
                        onChange={(e) =>
                          change({ rpe: e.target.value === '' ? null : Number(e.target.value) })
                        }
                      />
                    </Field>
                    <Field label="Notas de la serie">
                      <input
                        maxLength={1000}
                        value={actual?.notes ?? ''}
                        onChange={(e) => change({ notes: e.target.value })}
                      />
                    </Field>
                  </div>
                  {actual && (
                    <button
                      type="button"
                      className="button"
                      onClick={() => onEdit((c) => changeWorkoutActual(c, actual, true))}
                    >
                      Quitar registro de esta serie
                    </button>
                  )}
                </fieldset>
              )
            })}
            {segmentRows(segment).length < 60 &&
              (() => {
                const max =
                  segment.dose.sets.kind === 'fixed'
                    ? segment.dose.sets.value
                    : segment.dose.sets.max
                const last = Math.max(
                  0,
                  ...content.sets
                    .filter((s) => s.segmentId === segment.segmentId)
                    .map((s) => s.ordinal),
                  segment.dose.sets.kind === 'fixed'
                    ? segment.dose.sets.value
                    : segment.dose.sets.min,
                )
                return last < max ? (
                  <button
                    type="button"
                    className="button"
                    onClick={() =>
                      onEdit((c) => {
                        const sides: Actual['side'][] =
                          segment.dose.laterality === 'bilateral' ? ['both'] : ['left', 'right']
                        return sides.reduce(
                          (v, side) =>
                            changeWorkoutActual(
                              v,
                              emptyPerformedSet(segment, newWorkoutId(), last + 1, side),
                            ),
                          c,
                        )
                      })
                    }
                  >
                    Agregar serie dentro del rango
                  </button>
                ) : null
              })()}
            <RestTimer
              key={segment.segmentId}
              seconds={
                segment.dose.restSeconds.kind === 'fixed'
                  ? segment.dose.restSeconds.value
                  : segment.dose.restSeconds.min
              }
              movement={segment.relation?.target.name ?? segment.exerciseId}
            />
          </section>
        ))}
      </fieldset>
    </section>
  )
}
