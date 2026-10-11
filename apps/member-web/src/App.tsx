import { useEffect, useState } from 'react'
import type { BrandContext } from '@klisteniapp/b2b-contracts'
import { b2bClient } from '@klisteniapp/b2b-client'
import {
  AccountProvider,
  useB2BSession,
  useBrandContext,
  useAccountClient,
  useLoad,
} from '@klisteniapp/b2b-react'
import {
  BrandThemeProvider,
  WorkContextSelector,
  Empty,
  Login,
  Notice,
  Shell,
} from '@klisteniapp/b2b-ui'
import { Invitation } from './features/invitations/Invitation'
import { PublicGym, GymWebsite } from './features/public/PublicGym'
import { GymEntry } from './features/public/GymEntry'
import { MemberSpace } from './features/workspace/MemberSpace'
import { ExecutionHistory } from './features/workspace/ExecutionHistory'

function LegacyApp() {
  const publicRoute = /^\/g\/([^/]+)(?:\/units\/([^/]+))?\/?$/.exec(location.pathname)
  const isInvitation = location.pathname === '/app/invite'
  const isEntry = location.pathname === '/' || location.pathname === '/gimnasios'
  const { me, loading, error, orgId, setOrgId, dataRefresh, refresh, signOut } = useB2BSession({
    enabled: !publicRoute && !isInvitation && !isEntry,
  })

  if (isEntry) return <GymEntry />

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
        <Login onSignIn={b2bClient.auth.signIn} onDone={() => void refresh()} />
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

function BrandEntry({ context }: { context: BrandContext }) {
  const website = useLoad(
    (signal) =>
      context.websitePublished
        ? b2bClient.withSignal(signal).public.site(context.organization.slug)
        : Promise.resolve(null),
    context.organization.id,
  )
  return (
    <Shell
      name={context.theme.brand.name}
      logoUrl={context.theme.brand.logoUrl}
      eyebrow="TU MARCA"
      actions={
        <a className="button small" href="/login">
          Ingresar
        </a>
      }
    >
      <section className="hero">
        <p className="eyebrow">UN ESPACIO PARA VOS</p>
        <h1>
          {website.data?.website.headline || context.theme.loginTitle || context.theme.brand.name}
        </h1>
        <p>
          {website.data?.website.introduction ||
            context.theme.loginDescription ||
            context.theme.brand.description}
        </p>
        <a className="button primary" href="/login">
          Entrar a mi espacio →
        </a>
      </section>
      <section style={{ marginTop: 30 }}>
        <Notice error>{website.error}</Notice>
        <h2>Nuestras sedes</h2>
        <div className="grid two">
          {context.branches.map((branch) => (
            <article className="card" key={branch.id}>
              <h3>{branch.name}</h3>
              <p>{branch.address}</p>
              <p>{branch.contact}</p>
              <a className="button" href={`/sedes/${encodeURIComponent(branch.slug)}`}>
                Conocer {branch.name}
              </a>
            </article>
          ))}
        </div>
        {!context.branches.length && (
          <p>El equipo está preparando la información de sus sedes. Tu acceso sigue disponible.</p>
        )}
      </section>
      {website.data && <GymWebsite site={website.data} />}
    </Shell>
  )
}

function OwnHistory({
  orgId,
  branchNames,
}: {
  orgId: string
  branchNames: Record<string, string>
}) {
  const client = useAccountClient()
  const history = useLoad((signal) => client.withSignal(signal).executions.history(), orgId)
  function download() {
    if (!history.data) return
    const href = URL.createObjectURL(
      new Blob([JSON.stringify(history.data, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = href
    link.download = 'mi-historial.json'
    link.click()
    URL.revokeObjectURL(href)
  }
  return (
    <>
      <h1>Mi historial en la marca</h1>
      <p>Conservás tus registros de sedes anteriores mientras mantengas acceso a la marca.</p>
      <Notice error>{history.error}</Notice>
      {history.loading && <p role="status">Cargando historial…</p>}
      {history.data && (
        <>
          <button className="button" onClick={download}>
            Exportar mi historial
          </button>
          <ExecutionHistory executions={history.data.executions} branchNames={branchNames} />
        </>
      )}
    </>
  )
}

function BrandMember({ context }: { context: BrandContext }) {
  const session = useB2BSession()
  const { me, loading, error, branchId, workRole, workContextKey, setWorkContext } = session
  const [historyOnly, setHistoryOnly] = useState(false)
  const access = me?.whiteLabel
  const selected = access?.branches.find(
    (item) =>
      item.branch.id === branchId && item.roles.includes(workRole as 'admin' | 'coach' | 'member'),
  )
  const membership = me?.memberships.find(
    (item) => item.organization.id === context.organization.id,
  )
  useEffect(() => {
    if (location.pathname === '/login' && selected && workRole)
      location.replace(workRole === 'member' ? '/app' : '/backoffice/')
  }, [selected, workRole])
  const selector = access ? (
    <WorkContextSelector
      access={access}
      branchId={branchId}
      role={workRole}
      onChange={(id, role) => {
        if (setWorkContext(id, role)) {
          setHistoryOnly(false)
          if (role !== 'member') location.assign('/backoffice/')
        }
      }}
    />
  ) : null
  if (loading)
    return (
      <Shell name={context.theme.brand.name} eyebrow="TU ESPACIO">
        <p role="status">Preparando tu espacio…</p>
      </Shell>
    )
  if (!me)
    return (
      <Shell
        name={context.theme.brand.name}
        logoUrl={context.theme.brand.logoUrl}
        eyebrow="TU ESPACIO"
      >
        <Notice error>{error}</Notice>
        <Login
          context={context}
          onSignIn={b2bClient.auth.signIn}
          onDone={() => void session.refresh()}
        />
      </Shell>
    )
  if (!membership || !access)
    return (
      <Shell name={context.theme.brand.name} eyebrow="TU ESPACIO">
        <Notice error>{error || 'Tu cuenta no tiene acceso a esta marca.'}</Notice>
        <button className="button" onClick={() => void session.signOut()}>
          Salir
        </button>
      </Shell>
    )
  const actions = (
    <>
      {selector}
      <button className="text-button" onClick={() => setHistoryOnly((value) => !value)}>
        {historyOnly ? 'Volver a mi sede' : 'Todo mi historial'}
      </button>
    </>
  )
  if (historyOnly || !access.branches.length)
    return (
      <AccountProvider userId={me.user.id}>
        <Shell
          name={context.theme.brand.name}
          eyebrow="MI HISTORIAL"
          actions={
            <>
              {actions}
              <button className="text-button" onClick={() => void session.signOut()}>
                Salir
              </button>
            </>
          }
        >
          <OwnHistory
            orgId={membership.organization.id}
            branchNames={Object.fromEntries(
              access.branches.map((item) => [item.branch.id, item.branch.name]),
            )}
          />
        </Shell>
      </AccountProvider>
    )
  if (!selected || !workRole || workRole !== 'member')
    return (
      <Shell
        name={context.theme.brand.name}
        eyebrow="ELEGÍ TU ESPACIO"
        actions={
          <button className="text-button" onClick={() => void session.signOut()}>
            Salir
          </button>
        }
      >
        <h1>Elegí sede y función</h1>
        <Notice error>{error}</Notice>
        {actions}
        {workRole && workRole !== 'member' && (
          <a className="button" href="/backoffice/">
            Abrir espacio profesional
          </a>
        )}
      </Shell>
    )
  return (
    <AccountProvider
      userId={me.user.id}
      branchId={branchId}
      role={workRole}
      contextKey={workContextKey}
    >
      <Notice error>{error}</Notice>
      <MemberSpace
        key={workContextKey}
        dataRefresh={session.dataRefresh}
        me={me}
        membership={{
          ...membership,
          role: workRole,
          organization: {
            ...membership.organization,
            brand: { ...context.theme.brand, color: context.theme.palette.primary },
          },
        }}
        onSignOut={() => void session.signOut()}
        onOrganization={session.setOrgId}
        contextUI={actions}
        branchName={selected.branch.name}
        whiteLabel
      />
    </AccountProvider>
  )
}

export default function App() {
  const brand = useBrandContext()
  if (brand.loading)
    return (
      <Shell eyebrow="TU MARCA">
        <p role="status">Conociendo tu gimnasio…</p>
      </Shell>
    )
  if (brand.error)
    return (
      <Shell eyebrow="ACCESO">
        <Notice error>{brand.error}</Notice>
      </Shell>
    )
  const context = brand.context
  if (!context) return <LegacyApp />
  const branchRoute = /^\/sedes\/([a-z0-9-]+)\/?$/.exec(location.pathname)
  const publicRoute = /^\/g\/([^/]+)(?:\/units\/([^/]+))?\/?$/.exec(location.pathname)
  return (
    <BrandThemeProvider context={context}>
      {location.pathname === '/app/invite' ? (
        <Invitation whiteLabel context={context} />
      ) : branchRoute ? (
        <PublicGym
          slug={context.organization.slug}
          themeColor={context.theme.palette.primary}
          branchSlug={branchRoute[1]}
          branchId={context.branches.find((branch) => branch.slug === branchRoute[1])?.id}
        />
      ) : publicRoute ? (
        <PublicGym
          slug={publicRoute[1]}
          unitId={publicRoute[2]}
          themeColor={context.theme.palette.primary}
        />
      ) : ['/', '/gimnasios'].includes(location.pathname) ? (
        <BrandEntry context={context} />
      ) : (
        <BrandMember context={context} />
      )}
    </BrandThemeProvider>
  )
}
