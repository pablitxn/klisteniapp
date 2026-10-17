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
  members: (ProductOutput<'historySubjects'>['members'][number] | ProductOutput<'people'>[number])[]
  organizationId: string
  branchId: string
  accessKey: string
  createClient: HistoryClientFactory
  onOpenRoutine?: import('../training/routine-history/model').RoutineReference extends infer T
    ? (routine: T) => void
    : never
}) {
  // This list is the authorized people response. Historical inactive targets remain selectable.
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
