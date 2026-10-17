import { useState, useSyncExternalStore } from 'react'
import { ApiError, type ProductV2Client } from '@klisteniapp/b2b-client'
import { useLoad } from '@klisteniapp/b2b-react'
import type { ProductAccess } from '@klisteniapp/b2b-contracts/product-v2'
import { Field } from '@klisteniapp/b2b-ui'
import { canEditPlanning } from '../product/programmingModel'
import { LegacyAdoption } from './LegacyAdoption'
import type { LegacyAssignment } from './legacyAdoptionModel'
import './legacyAdoption.css'

export type LegacyAdoptionAssignmentsProps = {
  accountId: string
  branchId: string
  access: ProductAccess
  accessKey: string
  contextSignal: AbortSignal
  createClient: (signal?: AbortSignal) => ProductV2Client
  onClose: () => void
}
/** Own feature entry: selects a member's actual issued row instead of inventing an assignment from a routine. */
export function LegacyAdoptionAssignments(props: LegacyAdoptionAssignmentsProps) {
  const aborted = useSyncExternalStore(
    (notify) => {
      props.contextSignal.addEventListener('abort', notify)
      return () => props.contextSignal.removeEventListener('abort', notify)
    },
    () => props.contextSignal.aborted,
    () => props.contextSignal.aborted,
  )
  if (
    aborted ||
    props.access.role === 'member' ||
    !canEditPlanning(props.access, props.accountId, props.access.organizationId, props.branchId)
  )
    return (
      <section>
        <p role="alert">No tenés permiso vigente para revisar versiones anteriores en esta sede.</p>
        <button type="button" className="button" onClick={props.onClose}>
          Volver
        </button>
      </section>
    )
  return (
    <AssignmentPicker
      key={JSON.stringify([
        props.accountId,
        props.branchId,
        props.accessKey,
        props.access.accessRevision,
      ])}
      {...props}
    />
  )
}
function AssignmentPicker(props: LegacyAdoptionAssignmentsProps) {
  const { createClient, accessKey, contextSignal, access, branchId } = props
  const [memberId, setMemberId] = useState('')
  const [selected, setSelected] = useState<LegacyAssignment | null>(null)
  const roster = useLoad(async (signal) => {
    const result = await createClient(AbortSignal.any([contextSignal, signal])).call(
      'historySubjects',
      {},
    )
    if (result.scope.organizationId !== access.organizationId || result.scope.branchId !== branchId)
      throw new ApiError('La lista no corresponde a esta sede.', 502, 'INVALID_RESPONSE')
    return result
  }, accessKey)
  const assignments = useLoad(
    async (signal) => {
      if (!memberId) return []
      const result = await createClient(AbortSignal.any([contextSignal, signal])).call(
        'legacyAssignments',
        { memberId },
      )
      if (
        result.some(
          (row) =>
            row.scope.organizationId !== access.organizationId ||
            row.scope.branchId !== branchId ||
            row.scope.memberId !== memberId,
        )
      )
        throw new ApiError(
          'Las asignaciones no corresponden a esta persona y sede.',
          502,
          'INVALID_RESPONSE',
        )
      return result
    },
    JSON.stringify([accessKey, memberId]),
  )
  const error = roster.error || assignments.error
  if (error)
    return (
      <section className="legacy-adoption">
        <p role="alert">{error}</p>
        <button
          type="button"
          className="button"
          onClick={() => {
            setSelected(null)
            roster.reload()
            assignments.reload()
          }}
        >
          Volver a consultar
        </button>
        <button type="button" className="button" onClick={props.onClose}>
          Volver
        </button>
      </section>
    )
  const member = roster.data?.members.find((row) => row.userId === memberId)
  if (selected && member)
    return (
      <LegacyAdoption
        {...props}
        assignment={selected}
        onClose={() => setSelected(null)}
        onAdopted={async (accepted) => {
          const client = createClient(contextSignal)
          const [original, supplement] = await Promise.all([
            client.call('routineVersion', { id: accepted.programId, version: accepted.version }),
            client.call('routineSupplement', { id: accepted.programId, version: accepted.version }),
          ])
          if (contextSignal.aborted) return
          if (
            original.schemaVersion !== 1 ||
            original.snapshot.programId !== accepted.programId ||
            original.snapshot.version !== accepted.version ||
            !supplement ||
            JSON.stringify(supplement) !== JSON.stringify(accepted.supplement)
          )
            throw new ApiError(
              'No pudimos confirmar la versión original y su revisión guardada.',
              502,
              'INVALID_RESPONSE',
            )
          assignments.reload()
        }}
      />
    )
  const legacy =
    assignments.data?.filter(
      (row) => row.scope.memberId === memberId && row.routine.schemaVersion === 1,
    ) ?? []
  return (
    <section className="legacy-adoption legacy-adoption-stack">
      <h1>Revisiones explícitas de rutinas anteriores</h1>
      <p>
        Seleccioná una persona y una asignación original. Se revisa una versión por vez; los
        registros y las variantes manuales anteriores se conservan.
      </p>
      <button type="button" className="button" onClick={props.onClose}>
        Volver a programación
      </button>
      {roster.loading && <p role="status">Consultando personas autorizadas…</p>}
      {roster.data && (
        <Field label="Persona de esta sede">
          <select
            value={member?.userId ?? ''}
            onChange={(e) => {
              setSelected(null)
              setMemberId(e.target.value)
            }}
          >
            <option value="">Elegí una persona</option>
            {roster.data.members.map((person) => (
              <option key={person.userId} value={person.userId}>
                {person.name}
                {person.active ? '' : ' · Inactiva'}
              </option>
            ))}
          </select>
        </Field>
      )}
      {member && (
        <section aria-label={`Asignaciones anteriores de ${member.name}`}>
          <h2>{member.name}</h2>
          {assignments.loading ? (
            <p role="status">Consultando asignaciones originales…</p>
          ) : legacy.length ? (
            <ul>
              {legacy.map((row) => (
                <li key={row.id}>
                  <p>
                    {row.name} · versión {row.routine.version} · asignación {row.id}
                    {row.active ? '' : ' · Histórica'}
                    {row.archivedAt ? ' · Archivada' : ''}
                  </p>
                  <button type="button" className="button" onClick={() => setSelected(row)}>
                    Revisar esta asignación de {row.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status">No hay asignaciones de formato anterior para esta persona.</p>
          )}
        </section>
      )}
    </section>
  )
}
