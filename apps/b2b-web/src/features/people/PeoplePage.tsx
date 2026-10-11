import { useAccountClient, useLoad } from '@klisteniapp/b2b-react'
import {
  SectionResources,
  type WorkspaceViewContext as Context,
} from '../../shared/SectionResources'
import { People } from './People'

export function PeoplePage({ membership, dataRefresh }: Context) {
  const client = useAccountClient(),
    org = membership.organization
  const members = useLoad((signal) => client.withSignal(signal).members.list(org.id), org.id, {
    refreshKey: dataRefresh,
  })
  return (
    <SectionResources resources={[members]}>
      {members.data && (
        <People
          orgId={org.id}
          members={members.data.members}
          admin={membership.role === 'admin'}
          active={org.serviceActive}
          reload={members.reload}
        />
      )}
    </SectionResources>
  )
}
