import type { Enrollment, Occurrence } from '@klisteniapp/b2b-contracts/product-v2'
import {
  routineAnchor,
  routineKey,
  routineReference,
  sessionAnchor,
  type RoutineReference,
  type SessionRecord,
} from './model'

export function OriginalRoutines({
  enrollments,
  records,
  occurrences = [],
  onOpenRoutine,
}: {
  enrollments: Enrollment[]
  records: SessionRecord[]
  occurrences?: Occurrence[]
  onOpenRoutine?: (routine: RoutineReference) => void
}) {
  const references = new Map<string, RoutineReference>()
  for (const plan of enrollments)
    for (const stage of plan.content.stages)
      for (const slot of stage.slots) references.set(routineKey(slot.routine), slot.routine)
  for (const occurrence of occurrences)
    references.set(routineKey(occurrence.routine), occurrence.routine)
  for (const record of records) {
    const ref = routineReference(record)
    references.set(routineKey(ref), ref)
  }
  return (
    <section aria-label="Rutinas originales y sus registros">
      <h2>Rutinas originales</h2>
      {[...references.values()].map((ref) => {
        const linked = records.filter(
          (record) => routineKey(routineReference(record)) === routineKey(ref),
        )
        return (
          <article
            className="card"
            key={routineKey(ref)}
            id={routineAnchor(ref)}
            style={{ marginBottom: 16, overflowWrap: 'anywhere' }}
          >
            <h3>Rutina {routineKey(ref)}</h3>
            {enrollments.flatMap((plan) =>
              plan.content.stages
                .filter((stage) =>
                  stage.slots.some((slot) => routineKey(slot.routine) === routineKey(ref)),
                )
                .map((stage) => (
                  <p key={`${plan.id}-${stage.id}`}>
                    Período vigente: {plan.content.name} · objetivo:{' '}
                    {plan.content.goal || 'Sin objetivo indicado'} · {stage.name} ({stage.startDate}{' '}
                    a {stage.endDate}) · período r{plan.revision}
                  </p>
                )),
            )}
            {onOpenRoutine && (
              <button className="button" onClick={() => onOpenRoutine(ref)}>
                Abrir esta versión original
              </button>
            )}
            {!linked.length && <p>Sin registros vinculados.</p>}
            {linked.map((record) => (
              <p key={sessionAnchor(record)}>
                <a href={`#${sessionAnchor(record)}`}>
                  Ver sesión {record.schemaVersion === 1 ? record.original.id : record.id}
                </a>
              </p>
            ))}
          </article>
        )
      })}
    </section>
  )
}
