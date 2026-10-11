import { useAccountClient, useLoad } from '@klisteniapp/b2b-react'
import {
  SectionResources,
  type WorkspaceViewContext as Context,
} from '../../shared/SectionResources'
import { Catalog } from './Catalog'

export function CatalogPage({ membership, dataRefresh }: Context) {
  const client = useAccountClient(),
    org = membership.organization,
    key = org.id
  const exercises = useLoad(
    (signal) => client.withSignal(signal).catalog.listExercises(org.id),
    key,
    { refreshKey: dataRefresh },
  )
  const machines = useLoad(
    (signal) => client.withSignal(signal).equipment.listMachines(org.id),
    key,
    { refreshKey: dataRefresh },
  )
  return (
    <SectionResources resources={[exercises, machines]}>
      {exercises.data && machines.data && (
        <Catalog
          orgId={org.id}
          exercises={exercises.data.exercises}
          machines={machines.data.machines}
          active={org.serviceActive}
          reload={exercises.reload}
        />
      )}
    </SectionResources>
  )
}
