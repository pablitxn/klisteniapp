import { AccountProvider, Empty, Login, Notice, Shell, useB2BSession } from '@klisteniapp/b2b-ui'
import { Invitation } from './features/invitations/Invitation'
import { PublicGym } from './features/public/PublicGym'
import { MemberSpace } from './features/workspace/MemberSpace'

export default function App() {
  const publicRoute = /^\/g\/([^/]+)(?:\/units\/([^/]+))?\/?$/.exec(location.pathname)
  const isInvitation = location.pathname === '/app/invite'
  const { me, loading, error, orgId, setOrgId, dataRefresh, refresh, signOut } = useB2BSession({
    enabled: !publicRoute && !isInvitation,
  })

  if (publicRoute) {
    return (
      <PublicGym
        slug={decodeURIComponent(publicRoute[1])}
        unitId={publicRoute[2] ? decodeURIComponent(publicRoute[2]) : undefined}
      />
    )
  }
  if (isInvitation) return <Invitation />

  const requestedGym = new URLSearchParams(location.search).get('gym')
  const membership = orgId
    ? me?.memberships.find((item) => item.organization.id === orgId)
    : requestedGym
      ? me?.memberships.find((item) => item.organization.slug === requestedGym)
      : me?.memberships[0]

  if (loading) {
    return (
      <Shell eyebrow="TU ESPACIO">
        <p className="loading" role="status">
          Preparando tu espacio…
        </p>
      </Shell>
    )
  }
  if (!me) {
    return (
      <Shell
        eyebrow="TU ESPACIO"
        actions={
          <a className="text-button small" href="/backoffice/">
            Equipo del gimnasio
          </a>
        }
      >
        <Notice error>{error}</Notice>
        <Login onDone={() => void refresh()} />
      </Shell>
    )
  }
  if (!membership) {
    return (
      <Shell
        eyebrow="TU ESPACIO"
        actions={
          <button className="text-button" onClick={() => void signOut()}>
            Salir
          </button>
        }
      >
        <Empty
          title={
            requestedGym
              ? 'Tu cuenta no tiene acceso a este gimnasio'
              : 'Tu cuenta todavía no tiene gimnasio'
          }
        >
          Pedile al equipo que revise tu invitación. <a href="/app">Ver mis gimnasios</a>
        </Empty>
      </Shell>
    )
  }
  return (
    <>
      <Notice error>{error}</Notice>
      <AccountProvider userId={me.user.id}>
        <MemberSpace
          key={`${me.user.id}/${membership.organization.id}/${membership.role}`}
          dataRefresh={dataRefresh}
          me={me}
          membership={membership}
          onSignOut={() => void signOut()}
          onOrganization={(id) => {
            history.replaceState(null, '', '/app')
            setOrgId(id)
          }}
        />
      </AccountProvider>
    </>
  )
}
