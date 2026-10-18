import { useLoad } from '@klisteniapp/b2b-react'
import { loadHistorySubjects } from '../training/routine-history/historyReads'
import type { RoutineReference } from '../training/routine-history/model'
import { useState } from 'react'
import type { ProductOutput } from '@klisteniapp/b2b-contracts/product-v2'
import { ProductHistoryPage } from '../training/routine-history/ProductHistoryPage'
import type { HistoryClientFactory } from '../training/routine-history/SessionHistory'

export function ProductReportsPage({
  members,
  organizationId,
  branchId,
  accessKey,
  createClient,
  onOpenRoutine,
}: {
  members: ProductOutput<'historySubjects'>['members']
  organizationId: string
  branchId: string
  accessKey: string
  createClient: HistoryClientFactory
  onOpenRoutine?: (routine: RoutineReference) => void
}) {
  // This list is the branch-scoped historical-subject response. Historical inactive targets remain selectable.
  const [selected, setSelected] = useState('')
  const member = members.find((item) => item.userId === selected)
  return (
    <>
      <h1>Historial de entrenamiento</h1>
      <p>
        Consultá períodos y registros de las personas autorizadas de esta sede, incluidas las
        membresías inactivas.
      </p>
      <label htmlFor="report-member">Persona</label>
      <select
        id="report-member"
        value={member?.userId ?? ''}
        onChange={(event) => setSelected(event.target.value)}
      >
        <option value="">Elegí una persona</option>
        {members.map((item) => (
          <option key={item.userId} value={item.userId}>
            {item.name}
            {item.active ? '' : ' · Inactiva'}
          </option>
        ))}
      </select>
      {member && (
        <section aria-label={`Historial de ${member.name}`}>
          <h2>
            {member.name}
            {member.active ? '' : ' · Membresía inactiva'}
          </h2>
          <ProductHistoryPage
            scope={{ organizationId, branchId, memberId: member.userId }}
            accessKey={accessKey}
            createClient={createClient}
            canReschedule={false}
            onOpenRoutine={onOpenRoutine}
          />
        </section>
      )}
    </>
  )
}

/** Optional owning-feature loader; INTEGRATION may replace its current root roster
 * wrapper with this component without creating another provider. */
export function ProductHistoryReportsPage(props: {
  organizationId: string
  branchId: string
  accessKey: string
  createClient: HistoryClientFactory
  onOpenRoutine?: (routine: RoutineReference) => void
}) {
  const roster = useLoad(
    (signal) => loadHistorySubjects(props.createClient(signal), props),
    JSON.stringify([props.accessKey, props.organizationId, props.branchId]),
  )
  return (
    <>
      {roster.loading && <p role="status">Cargando personas autorizadas…</p>}
      {roster.error && <p role="alert">{roster.error}</p>}
      {roster.error && (
        <button className="button" onClick={roster.reload}>
          Reintentar personas
        </button>
      )}
      {roster.data && !roster.error && (
        <ProductReportsPage
          key={JSON.stringify([props.accessKey, props.organizationId, props.branchId])}
          {...props}
          members={roster.data}
        />
      )}
    </>
  )
}
