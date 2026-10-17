import { createB2BClient } from '@klisteniapp/b2b-client'
import type { Membership, Role } from '@klisteniapp/b2b-contracts'
import { AccountProvider } from '@klisteniapp/b2b-react'
import { Empty, Login, Notice, Shell, WorkContextSelector } from '@klisteniapp/b2b-ui'
import { lazy, Suspense, useEffect } from 'react'
import { managementPageAllowed, managementPath, memberPath } from '../routes'
import { useApplication } from './ApplicationProvider'

const ProductWorkspace = lazy(() => import('./ProductWorkspace'))
const ManagementWorkspace = lazy(() =>
  import('./ManagementWorkspace').then((module) => ({ default: module.ManagementWorkspace })),
)
const MemberWorkspace = lazy(() =>
  import('./MemberWorkspace').then((module) => ({
    default: module.MemberWorkspace,
  })),
)
const HistoryPage = lazy(() =>
  import('../features/training/HistoryPage').then((module) => ({ default: module.HistoryPage })),
)
const WhiteLabelSettings = lazy(() =>
  import('../features/organization/WhiteLabelSettings').then((module) => ({
    default: module.WhiteLabelSettings,
  })),
)

/** All protected views use the same session, brand and explicit branch/role selection. */
export default function Workspace() {
  const { brand, session, route, href, navigate } = useApplication()
  const { me, loading, error, orgId, branchId, workRole, workContextKey } = session
  const context = brand.context
  const management = route.kind === 'management'
  const access = me?.whiteLabel
  const selected = access?.branches.find(
    (item) => item.branch.id === branchId && item.roles.includes(workRole as Role),
  )
  const requestedUrl = new URL(href, location.origin)
  const requestedGym = requestedUrl.searchParams.get('gym')
  const requestedBranch = requestedUrl.searchParams.get('branch')
  const equipmentContext = requestedUrl.searchParams.get('machine')
  const membership = context
    ? me?.memberships.find((item) => item.organization.id === context.organization.id)
    : orgId
      ? me?.memberships.find((item) => item.organization.id === orgId)
      : requestedGym
        ? me?.memberships.find((item) => item.organization.slug === requestedGym)
        : management
          ? (me?.memberships.find((item) => item.role !== 'member') ?? me?.memberships[0])
          : me?.memberships[0]
  const role = context ? workRole : membership?.role
  const organization = membership?.organization
  const name = context?.theme.brand.name ?? organization?.brand.name
  const logoUrl = context?.theme.brand.logoUrl ?? organization?.brand.logoUrl

  useEffect(() => {
    if (!me || !role) return
    // The common login and workspace entry route choose the selected function.
    // Explicit section URLs remain guarded rather than silently changing roles.
    if (route.kind === 'login' || (route.kind === 'member' && !route.page && role !== 'member'))
      navigate(role === 'member' ? '/app' : managementPath(), true)
  }, [me, role, route.kind, route.kind === 'member' ? route.page : undefined, navigate])

  function selectContext(id: string, nextRole: Role) {
    if (session.setWorkContext(id, nextRole))
      navigate(
        nextRole === 'member'
          ? `/app${id === requestedBranch ? requestedUrl.search : ''}`
          : managementPath(),
      )
  }
  function selectOrganization(id: string) {
    session.setOrgId(id)
    navigate(management ? managementPath() : '/app')
  }
  function refreshBrand() {
    void session.refresh(false)
    brand.refresh()
  }
  const selector = access ? (
    <WorkContextSelector
      access={access}
      branchId={branchId}
      role={workRole}
      onChange={selectContext}
    />
  ) : null
  const exit = (
    <button className="text-button small" onClick={() => void session.signOut()}>
      Salir
    </button>
  )

  if (loading)
    return (
      <Shell name={name} eyebrow="TU ESPACIO">
        <p role="status">Preparando tu espacio…</p>
      </Shell>
    )
  if (session.bootstrap) return <ProductWorkspace />
  if (!me)
    return (
      <Shell
        name={name}
        logoUrl={logoUrl}
        eyebrow="TU ESPACIO"
        actions={
          !context ? (
            <a className="text-button small" href={management ? '/app' : managementPath()}>
              {management ? 'Espacio de socios' : 'Equipo del gimnasio'}
            </a>
          ) : undefined
        }
      >
        <Notice error>{error}</Notice>
        <Login
          context={context ?? undefined}
          professional={!context && management}
          onSignIn={createB2BClient(undefined, { contractVersion: 2 }).auth.signIn}
          onDone={() => void session.refresh()}
        />
      </Shell>
    )
  if (!membership || (context && !access))
    return (
      <Shell name={name} eyebrow="TU ESPACIO" actions={exit}>
        <Notice error>{error}</Notice>
        <Empty
          title={
            context
              ? 'Tu cuenta no tiene acceso a esta marca.'
              : requestedGym
                ? 'Tu cuenta no tiene acceso a este gimnasio'
                : 'Tu cuenta todavía no tiene gimnasio'
          }
        >
          Pedile al equipo que revise tu invitación. <a href="/app">Ver mis gimnasios</a>
        </Empty>
      </Shell>
    )
  const scopedMembership: Membership =
    context && role
      ? {
          ...membership,
          role,
          organization: {
            ...membership.organization,
            brand: { ...context.theme.brand, color: context.theme.palette.primary },
          },
        }
      : membership
  const contextKey = context
    ? workContextKey
    : `${me.user.id}/${membership.organization.id}/${role}`
  const content = () => {
    if (
      context &&
      access &&
      route.kind === 'member' &&
      equipmentContext &&
      requestedBranch &&
      (requestedBranch !== branchId || role !== 'member')
    ) {
      const equipmentBranch = access.branches.find(
        ({ branch, roles }) =>
          branch.id === requestedBranch && branch.status === 'active' && roles.includes('member'),
      )
      return (
        <Shell name={name} eyebrow="EL EQUIPO Y TU SEDE" actions={exit}>
          <Empty
            title={
              equipmentBranch
                ? 'Elegí la sede de este equipo'
                : 'Tu cuenta no tiene acceso a la sede de este equipo'
            }
          >
            {equipmentBranch ? (
              <button
                className="button primary"
                onClick={() => selectContext(requestedBranch, 'member')}
              >
                Abrir mi rutina en {equipmentBranch.branch.name}
              </button>
            ) : (
              <span>Consultá al equipo del gimnasio antes de entrenar en esta sede. </span>
            )}
            <a className="button" href="/app">
              Ver todas mis rutinas
            </a>
          </Empty>
        </Shell>
      )
    }
    if (context && access && !selected) {
      if (management && access.brandAdmin)
        return (
          <Shell
            name={name}
            eyebrow="MARCA Y SEDES"
            actions={
              <>
                {selector}
                {exit}
              </>
            }
          >
            <h1>Elegí una sede para operar</h1>
            <WhiteLabelSettings
              orgId={membership.organization.id}
              branchId=""
              context={context}
              onRefresh={refreshBrand}
            />
          </Shell>
        )
      if (!access.branches.length && !management)
        return (
          <Shell name={name} eyebrow="MI HISTORIAL" actions={exit}>
            <HistoryPage orgId={membership.organization.id} branchNames={{}} />
          </Shell>
        )
      return (
        <Shell name={name} eyebrow="ELEGÍ TU ESPACIO" actions={exit}>
          <h1>Elegí sede y función</h1>
          <Notice error>{error}</Notice>
          {selector}
        </Shell>
      )
    }
    if (management && (role === 'member' || !role))
      return (
        <Shell
          name={name}
          eyebrow="TU ESPACIO"
          actions={
            <>
              {selector}
              {exit}
            </>
          }
        >
          <Empty title="Este espacio es para el equipo del gimnasio">
            Tu cuenta no tiene permisos de entrenador o administrador.{' '}
            <a href="/app">Ir a mi espacio de socio</a>.
          </Empty>
        </Shell>
      )
    if (
      management &&
      route.kind === 'management' &&
      route.page &&
      !managementPageAllowed(route.page, role ?? '')
    )
      return (
        <Shell
          name={name}
          eyebrow="ESPACIO PROFESIONAL"
          actions={
            <>
              {selector}
              {exit}
            </>
          }
        >
          <Empty title="No tenés permisos para esta sección">
            <a href="/manage">Volver a mi espacio</a>
          </Empty>
        </Shell>
      )
    if (management)
      return (
        <ManagementWorkspace
          key={contextKey}
          me={me}
          membership={scopedMembership}
          dataRefresh={session.dataRefresh}
          onSignOut={() => void session.signOut()}
          onOrganization={selectOrganization}
          onBrand={session.updateOrganization}
          contextUI={selector}
          whiteLabel={context ?? undefined}
          branchId={branchId}
          branchSlug={selected?.branch.slug}
          onRefresh={refreshBrand}
        />
      )
    if (role !== 'member')
      return (
        <Shell
          name={name}
          eyebrow="ELEGÍ TU ESPACIO"
          actions={
            <>
              {selector}
              {exit}
            </>
          }
        >
          <h1>Elegí sede y función</h1>
          <a className="button" href="/manage">
            Abrir espacio profesional
          </a>
        </Shell>
      )
    const allHistory = route.kind === 'member' && route.page === 'allHistory'
    const actions = (
      <>
        {selector}
        {context && (
          <a className="text-button" href={allHistory ? '/app' : memberPath('allHistory')}>
            {allHistory ? 'Volver a mi sede' : 'Todo mi historial'}
          </a>
        )}
      </>
    )
    if (allHistory && context && access)
      return (
        <Shell
          name={name}
          eyebrow="MI HISTORIAL"
          actions={
            <>
              {actions}
              {exit}
            </>
          }
        >
          <HistoryPage
            orgId={membership.organization.id}
            branchNames={Object.fromEntries(
              access.branches.map((item) => [item.branch.id, item.branch.name]),
            )}
          />
        </Shell>
      )
    return (
      <MemberWorkspace
        key={contextKey}
        me={me}
        membership={scopedMembership}
        dataRefresh={session.dataRefresh}
        onSignOut={() => void session.signOut()}
        onOrganization={selectOrganization}
        contextUI={actions}
        branchName={selected?.branch.name}
        whiteLabel={Boolean(context)}
      />
    )
  }
  return (
    <AccountProvider
      userId={me.user.id}
      branchId={context ? branchId || undefined : undefined}
      role={context ? role || undefined : undefined}
      contextKey={contextKey}
    >
      <Notice error>{error}</Notice>
      <Suspense fallback={<p role="status">Cargando tu espacio…</p>}>{content()}</Suspense>
    </AccountProvider>
  )
}
