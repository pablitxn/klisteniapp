import { useId, useState } from 'react'
import { useLoad } from '@klisteniapp/b2b-react'
import type { ProductOutput } from '@klisteniapp/b2b-contracts/product-v2'
import { loadEnrollmentRevision, type PeriodReference } from './historyReads'
import { routineKey, type HistoryScope, type RoutineReference } from './model'
import type { HistoryClientFactory } from './SessionHistory'

export function EnrollmentPeriodDetails({
  reference,
  scope,
  accessKey,
  createClient,
  onOpenRoutine,
  label = `Ver período original emitido r${reference.revision}`,
}: {
  reference: PeriodReference
  scope: HistoryScope
  accessKey: string
  createClient: HistoryClientFactory
  label?: string
  onOpenRoutine?: (routine: RoutineReference) => void
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div>
      <button
        className="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {open ? 'Ocultar detalle del período' : label}
      </button>
      <div id={id}>
        {open && (
          <LoadedPeriod
            key={JSON.stringify([accessKey, scope, reference])}
            reference={reference}
            scope={scope}
            accessKey={accessKey}
            createClient={createClient}
            onOpenRoutine={onOpenRoutine}
          />
        )}
      </div>
    </div>
  )
}
function LoadedPeriod({
  reference,
  scope,
  accessKey,
  createClient,
  onOpenRoutine,
}: {
  reference: PeriodReference
  scope: HistoryScope
  accessKey: string
  createClient: HistoryClientFactory
  onOpenRoutine?: (routine: RoutineReference) => void
}) {
  const loaded = useLoad(
    (signal) => loadEnrollmentRevision(createClient(signal), scope, reference),
    JSON.stringify([accessKey, scope, reference]),
  )
  return (
    <>
      {loaded.loading && <p role="status">Cargando período emitido r{reference.revision}…</p>}
      {loaded.error && <p role="alert">{loaded.error}</p>}
      {loaded.error && (
        <button className="button" onClick={loaded.reload}>
          Reintentar período
        </button>
      )}
      {loaded.data && !loaded.error && (
        <EnrollmentPeriodSnapshot
          snapshot={loaded.data}
          stageId={reference.stageId}
          onOpenRoutine={onOpenRoutine}
        />
      )}
    </>
  )
}
export function EnrollmentPeriodSnapshot({
  snapshot,
  stageId,
  onOpenRoutine,
}: {
  snapshot: ProductOutput<'enrollmentRevision'>
  stageId?: string
  onOpenRoutine?: (routine: RoutineReference) => void
}) {
  const { enrollment, actorId, recordedAt } = snapshot
  return (
    <section aria-label={`Período registrado r${enrollment.revision}`}>
      <h4>
        {enrollment.content.name} · período r{enrollment.revision}
      </h4>
      <p>Objetivo en esta revisión: {enrollment.content.goal || 'Sin objetivo indicado'}</p>
      <p>
        Inscripción {enrollment.id} · programa {enrollment.goalProgramId} · revisión del programa
        emitido {enrollment.issuedGoalRevision}
      </p>
      <p>Zona horaria de esta revisión: {enrollment.content.timeZone}</p>
      <p>
        Registrado {recordedAt} · actor {actorId}
      </p>
      <ol>
        {enrollment.content.stages.map((stage) => (
          <li key={stage.id}>
            <strong>
              {stage.name}
              {stage.id === stageId ? ' · Etapa original de este registro' : ''}
            </strong>
            <p>
              {stage.startDate} a {stage.endDate}
            </p>
            <ul>
              {stage.slots.map((slot) => (
                <li key={slot.id}>
                  Turno {slot.id} · día ISO {slot.weekday} ·{' '}
                  {onOpenRoutine ? (
                    <button className="button" onClick={() => onOpenRoutine(slot.routine)}>
                      Abrir rutina original {routineKey(slot.routine)}
                    </button>
                  ) : (
                    <span>Rutina original {routineKey(slot.routine)}</span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="small muted">
        Esta revisión inmutable conserva los períodos emitidos. La inclusión semanal vigente se
        consulta por separado.
      </p>
    </section>
  )
}
