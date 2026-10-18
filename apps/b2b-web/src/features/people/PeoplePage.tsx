import { createB2BClient, createProductV2Client } from '@klisteniapp/b2b-client'
import { useAccountClient, useAccountId, useAccountScope, useLoad } from '@klisteniapp/b2b-react'
import {
  SectionResources,
  type WorkspaceViewContext as Context,
} from '../../shared/SectionResources'
import { People } from './People'
import { ProductPeople } from './ProductPeople'
import { useEffect, useMemo } from 'react'

export function PeoplePage(context: Context) {
  const accountId = useAccountId(),
    scope = useAccountScope()
  const orgId = context.membership.organization.id
  const key = `${orgId}/${accountId}/${scope.branchId ?? ''}/${scope.role ?? ''}`
  const lifetime = useMemo(() => ({ controller: new AbortController(), retained: 0 }), [key])
  useEffect(() => {
    lifetime.retained++
    return () => {
      lifetime.retained--
      queueMicrotask(() => {
        if (!lifetime.retained) lifetime.controller.abort()
      })
    }
  }, [lifetime])
  const client = useMemo(
    () =>
      createProductV2Client(accountId, orgId, {
        branchId: scope.branchId,
        role: scope.role === 'admin' ? undefined : scope.role,
        contextSignal: lifetime.controller.signal,
      }),
    [accountId, orgId, scope.branchId, scope.role, lifetime],
  )
  const discovery = useLoad(() => client.call('capabilities', {}), key, {
    refreshKey: context.dataRefresh,
  })
  return (
    <SectionResources resources={[discovery]}>
      {discovery.data &&
        (discovery.data.activated ? (
          <ProductPeoplePage key={key} {...context} client={client} branchId={scope.branchId} />
        ) : (
          <LegacyPeoplePage {...context} />
        ))}
    </SectionResources>
  )
}

function ProductPeoplePage({
  membership,
  dataRefresh,
  client,
  branchId,
}: Context & {
  client: ReturnType<typeof createProductV2Client>
  branchId?: string
}) {
  const people = useLoad(() => client.call('people', {}), membership.organization.id, {
    refreshKey: dataRefresh,
  })
  const access = useLoad(() => client.call('access', {}), membership.organization.id, {
    refreshKey: dataRefresh,
  })
  return (
    <SectionResources resources={[people, access]}>
      {people.data && access.data && (
        <ProductPeople
          client={client}
          people={people.data}
          access={access.data}
          branchId={branchId ?? access.data.branches[0]?.branchId ?? ''}
          active={membership.organization.serviceActive}
          reload={() => {
            people.reload()
            access.reload()
          }}
        />
      )}
    </SectionResources>
  )
}

function LegacyPeoplePage({ membership, dataRefresh }: Context) {
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
