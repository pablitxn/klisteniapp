import { useState } from 'react'
import { useLoad } from '@klisteniapp/b2b-react'
import type { Enrollment, Occurrence } from '@klisteniapp/b2b-contracts/product-v2'
import type { ProductV2Client } from '@klisteniapp/b2b-client'
import { executionDoseLabel, prescriptionDoseLabel } from '@klisteniapp/b2b-ui'
import {
  actualEligibility,
  dateInZone,
  doseText,
  latestSessions,
  performedAt,
  routineAnchor,
  routineKey,
  routineReference,
  sessionAnchor,
  sessionId,
  type HistoryScope,
  type SessionRecord,
} from './model'

export type HistoryClientFactory = (signal?: AbortSignal) => ProductV2Client
const statuses = { draft: 'Borrador', partial: 'Parcial', completed: 'Completada', void: 'Anulada' }
const eligibility = {
  eligible: 'Dentro de la prescripción vigente',
  excluded: 'Trabajo conservado, excluido del seguimiento vigente',
  unplanned: 'Registro anterior sin turno prescrito; no genera ausencias',
  unknown: 'Inclusión semanal por consultar en la semana de este turno',
}

export function SessionHistory({
  records,
  scope,
  occurrences,
  enrollments,
  createClient,
  accessKey,
  timeZone,
}: {
  records: SessionRecord[]
  scope: HistoryScope
  occurrences: Occurrence[]
  enrollments: Enrollment[]
  createClient: HistoryClientFactory
  accessKey: string
  timeZone: string | null
}) {
  const latest = latestSessions(records, scope)
  return (
    <section aria-label="Sesiones realizadas">
      <h2>Lo que hiciste, por fecha</h2>
      {!latest.length && <p>Todavía no hay registros aceptados.</p>}
      {latest.map((record) => (
        <article
          className="card"
          id={sessionAnchor(record)}
          key={sessionId(record)}
          style={{ marginBottom: 20, overflowWrap: 'anywhere' }}
        >
          <h3>
            {timeZone ? dateInZone(performedAt(record), timeZone) : performedAt(record)} ·{' '}
            {statuses[record.schemaVersion === 1 ? record.original.status : record.content.status]}
          </h3>
          <p>
            <time dateTime={performedAt(record)}>{performedAt(record)}</time>
            {timeZone && ` · fecha local en ${timeZone}`}
          </p>
          <p>
            <a href={`#${routineAnchor(routineReference(record))}`}>
              Ver rutina original {routineKey(routineReference(record))}
            </a>
          </p>
          <p>{eligibility[actualEligibility(record, occurrences, enrollments)]}</p>
          <SessionActuals record={record} />
          <RevisionHistory
            record={record}
            createClient={createClient}
            accessKey={accessKey}
            scope={scope}
          />
        </article>
      ))}
    </section>
  )
}
export function SessionActuals({ record }: { record: SessionRecord }) {
  if (record.schemaVersion === 1)
    return (
      <>
        <h4>
          {record.routine.name} · versión {record.routine.version}
        </h4>
        <p>
          Asignación original {record.original.assignmentId} · registro {record.original.id} ·
          revisión 0
        </p>
        <p>{record.original.notes}</p>
        <div className="table-wrap">
          <table>
            <caption>Valores originales y realizados</caption>
            <thead>
              <tr>
                <th>Ejercicio realizado</th>
                <th>Serie</th>
                <th>Indicado</th>
                <th>Realizado</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {record.original.sets.map((set) => (
                <tr key={`${set.stepId}-${set.set}`}>
                  <td>
                    {record.routine.exercises.find((item) => item.id === set.exerciseId)?.name ??
                      set.exerciseId}
                  </td>
                  <td>{set.set}</td>
                  <td>
                    {(() => {
                      const step = record.routine.steps.find((item) => item.id === set.stepId)
                      return step ? prescriptionDoseLabel(step) : '—'
                    })()}
                  </td>
                  <td>{executionDoseLabel(set)}</td>
                  <td>{set.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Recibido {record.createdAt}. La falta de metadatos antiguos no implica una alternativa
          revisada.
        </p>
      </>
    )
  const content = record.content
  return (
    <>
      <p>
        Registro {record.id} · revisión {record.revision} · recibido {record.acceptedAt} · actor{' '}
        {record.actorId}
      </p>
      {record.origin.kind === 'legacy' ? (
        <p>
          Asignación original {record.origin.assignmentId} · registro anterior{' '}
          {record.origin.executionId ?? 'Sin registro anterior'}
        </p>
      ) : (
        <p>Turno original {record.origin.occurrenceId}</p>
      )}
      {content.notes && <p>{content.notes}</p>}
      {content.correctionReason && <p>Motivo de corrección: {content.correctionReason}</p>}
      {content.segments.map((segment) => {
        const selected = content.selectedSegments.some(
          (item) => item.segmentId === segment.segmentId,
        )
        const sets = content.sets.filter((item) => item.segmentId === segment.segmentId)
        return (
          <section key={segment.segmentId} aria-label={`Segmento ${segment.segmentId}`}>
            <h4>
              {segment.relation?.target.name ?? segment.exerciseId} ·{' '}
              {selected ? 'Prescripción seleccionada' : 'Trabajo adicional conservado'}
            </h4>
            <p>
              Paso original {segment.originalStepId} · {doseText(segment.dose)}
            </p>
            {segment.relation && (
              <p>
                Variante {segment.relation.type}: {segment.relation.sourceExerciseId} →{' '}
                {segment.relation.targetExerciseId}. {segment.relation.rationale}
              </p>
            )}
            {segment.confirmedConditions.length > 0 && (
              <p>Condiciones confirmadas: {segment.confirmedConditions.join(', ')}</p>
            )}
            <div className="table-wrap">
              <table>
                <caption>Series realizadas en este segmento</caption>
                <thead>
                  <tr>
                    <th>Serie / lado</th>
                    <th>Repeticiones / tiempo</th>
                    <th>Carga</th>
                    <th>RPE</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {sets.map((set) => (
                    <tr key={set.performedSetId}>
                      <td>
                        {set.ordinal} / {set.side}
                      </td>
                      <td>
                        {set.repetitions !== null
                          ? `${set.repetitions} rep`
                          : `${set.durationSeconds} s`}
                      </td>
                      <td>{set.loadKg === null ? '—' : `${set.loadKg} kg`}</td>
                      <td>{set.rpe ?? '—'}</td>
                      <td>{set.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!sets.length && <p>Sin series registradas en este segmento.</p>}
          </section>
        )
      })}
    </>
  )
}
function RevisionHistory({
  record,
  createClient,
  accessKey,
  scope,
}: {
  record: SessionRecord
  createClient: HistoryClientFactory
  accessKey: string
  scope: HistoryScope
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button className="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Ocultar revisiones' : 'Ver registro original y correcciones'}
      </button>
      {open && (
        <LoadedRevisions
          record={record}
          createClient={createClient}
          accessKey={accessKey}
          scope={scope}
        />
      )}
    </div>
  )
}
function LoadedRevisions({
  record,
  createClient,
  accessKey,
  scope,
}: {
  record: SessionRecord
  createClient: HistoryClientFactory
  accessKey: string
  scope: HistoryScope
}) {
  const revisions = useLoad(
    (signal) => createClient(signal).call('sessionRevisions', { id: sessionId(record) }),
    JSON.stringify([accessKey, scope, sessionId(record), record.revision]),
  )
  return (
    <div>
      {revisions.loading && <p role="status">Cargando revisiones…</p>}
      {revisions.error && <p role="alert">{revisions.error}</p>}
      {revisions.data
        ?.filter(
          (item) =>
            item.scope.organizationId === scope.organizationId &&
            item.scope.branchId === scope.branchId &&
            item.scope.memberId === scope.memberId,
        )
        .sort((a, b) => a.revision - b.revision)
        .map((item) => (
          <details key={`${sessionId(item)}-${item.revision}`}>
            <summary>
              Revisión {item.revision} · {performedAt(item)}
            </summary>
            <SessionActuals record={item} />
          </details>
        ))}
    </div>
  )
}
