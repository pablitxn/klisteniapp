import { createB2BClient } from '@klisteniapp/b2b-client'
import { useAccountClient, useAccountId, useAccountScope, useLoad } from '@klisteniapp/b2b-react'
import {
  SectionResources,
  type WorkspaceViewContext as Context,
} from '../../shared/SectionResources'
import { People } from './People'

export function PeoplePage({ membership, dataRefresh }: Context) {
  const client = useAccountClient(),
    org = membership.organization
  const accountId = useAccountId()
  const { branchId } = useAccountScope()
  const brandWide = membership.role === 'admin' && Boolean(branchId)
  // Membership administration belongs to the brand; coaching remains scoped.
  const roster = useLoad(
    (signal) =>
      brandWide
        ? createB2BClient(accountId).withSignal(signal).members.list(org.id)
        : Promise.resolve(null),
    `${org.id}/${accountId}/${brandWide}`,
    { refreshKey: dataRefresh },
  )
  const members = useLoad((signal) => client.withSignal(signal).members.list(org.id), org.id, {
    refreshKey: dataRefresh,
  })
  return (
    <SectionResources resources={[members, roster]}>
      {members.data && (!brandWide || roster.data) && (
        <People
          orgId={org.id}
          members={members.data.members}
          brandMembers={roster.data?.members}
          admin={membership.role === 'admin'}
          active={org.serviceActive}
          reload={() => {
            members.reload()
            roster.reload()
          }}
        />
      )}
    </SectionResources>
  )
}
