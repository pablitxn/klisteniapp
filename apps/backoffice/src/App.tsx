import { b2bClient } from '@klisteniapp/b2b-client'
import { useState, type ReactNode } from 'react'
import type {
  BrandContext,
  EffectiveModules,
  Me,
  Membership,
  Organization,
} from '@klisteniapp/b2b-contracts'
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
import { BrandSettings } from './People'
import {
  CatalogPage,
  InventoryPage,
  PeoplePage,
  ProgramsPage,
  ReportsPage,
  WebsitePage,
} from './WorkspacePages'
import { MediaLibrary } from './MediaLibrary'
import { Heading } from './shared'
import { WhiteLabelSettings } from './WhiteLabelSettings'

type Page =
  | 'reports'
  | 'people'
  | 'programs'
  | 'catalog'
  | 'equipment'
  | 'brand'
  | 'preparation'
  | 'website'
  | 'media'
  | 'qr'
  | 'whiteLabel'
function Workspace({
  me,
  membership,
  dataRefresh,
  onSignOut,
  onOrganization,
  onBrand,
  contextUI,
  whiteLabel,
  branchId,
  branchSlug,
  onRefresh,
}: {
  me: Me
  membership: Membership
  dataRefresh: number
  onSignOut: () => void
  onOrganization: (id: string) => void
  onBrand: (organization: Organization) => void
  contextUI?: ReactNode
  whiteLabel?: BrandContext
  branchId?: string
  branchSlug?: string
  onRefresh?: () => void
}) {
  const client = useAccountClient()
  const capabilities = useLoad(
    (signal) =>
      whiteLabel
        ? client.withSignal(signal).modules.get(membership.organization.id)
        : Promise.resolve(null),
    `${membership.organization.id}/${branchId ?? 'legacy'}`,
    { refreshKey: dataRefresh },
  )
  const modules: EffectiveModules = capabilities.data?.modules ?? {
    website: !whiteLabel,
    equipment: !whiteLabel,
    floorPlan: !whiteLabel,
    media: !whiteLabel,
    voice: !whiteLabel,
  }
  const org = membership.organization,
    admin = membership.role === 'admin'
  const [page, setPage] = useState<Page>(admin ? 'preparation' : 'reports')
  const [websitePublished, setWebsitePublished] = useState(false)
  const context = { membership, dataRefresh }
  const navigation: Array<[Page, string, string]> = [
    ...(admin && whiteLabel
      ? ([['whiteLabel', '◈', 'Marca y sedes']] as Array<[Page, string, string]>)
      : []),
    ...(admin ? ([['preparation', '✓', 'Preparación']] as Array<[Page, string, string]>) : []),
    ['reports', '◷', 'Seguimiento'],
    ['people', '◎', 'Personas'],
    ['programs', '▤', 'Rutinas'],
    ['catalog', '↗', 'Ejercicios'],
    ['equipment', '◇', 'Equipamiento'],
    ['media', '▧', 'Archivos'],
    ...(admin
      ? ([
          ['brand', '◈', 'Identidad'],
          ['website', '⌂', 'Website'],
          ['qr', '▦', 'Etiquetas QR'],
        ] as Array<[Page, string, string]>)
      : []),
  ]
  const nav = (
    <>
      {navigation
        .filter(
          ([id]) =>
            !((id === 'equipment' || id === 'qr' || id === 'preparation') && !modules.equipment) &&
            !(id === 'media' && !modules.media) &&
            !(id === 'website' && !modules.website) &&
            !(id === 'brand' && whiteLabel),
        )
        .map(([id, icon, title]) => (
          <button
            key={id}
            aria-current={page === id ? 'page' : undefined}
            onClick={() => setPage(id)}
          >
            <span aria-hidden="true">{icon}</span>
            {title}
          </button>
        ))}
      {websitePublished && (
        <a
          href={branchSlug ? `/sedes/${encodeURIComponent(branchSlug)}` : `/g/${org.slug}`}
          target="_blank"
          rel="noreferrer"
        >
          ↗ Web pública
        </a>
      )}
    </>
  )
  return (
    <Shell
      name={org.brand.name}
      logoUrl={org.brand.logoUrl}
      color={org.brand.color}
      eyebrow="ESPACIO PROFESIONAL"
      navigation={nav}
      actions={
        <>
          <span className="muted small">
            {me.user.name} · {admin ? 'Administrador' : 'Entrenador'}
          </span>
          {contextUI}
          {me.memberships.filter((item) => item.role !== 'member').length > 1 && (
            <select
              aria-label="Gimnasio"
              value={org.id}
              onChange={(event) => onOrganization(event.target.value)}
            >
              {me.memberships
                .filter((item) => item.role !== 'member')
                .map((item) => (
                  <option key={item.organization.id} value={item.organization.id}>
                    {item.organization.brand.name}
                  </option>
                ))}
            </select>
          )}
          <button className="text-button small" onClick={onSignOut}>
            Salir
          </button>
        </>
      }
    >
      <Notice error>{capabilities.error}</Notice>
      {((['preparation', 'equipment', 'qr'].includes(page) && !modules.equipment) ||
        (page === 'media' && !modules.media) ||
        (page === 'website' && !modules.website)) && (
        <Notice>
          Esta función está deshabilitada en la sede actual. Podés consultar el seguimiento o
          cambiar la configuración de módulos.
        </Notice>
      )}
      {whiteLabel && (
        <p className="small muted">
          Tus borradores se guardan por sede. Volvé a la misma sede para recuperarlos.
        </p>
      )}
      {page === 'whiteLabel' && admin && whiteLabel && branchId && (
        <WhiteLabelSettings
          orgId={org.id}
          branchId={branchId}
          context={whiteLabel}
          onRefresh={onRefresh ?? (() => {})}
        />
      )}
      {!org.serviceActive && (
        <Notice>
          El servicio del gimnasio está pausado. Podés consultar la información; las nuevas
          publicaciones y cambios están deshabilitados.
        </Notice>
      )}
      {modules.equipment &&
        ((page === 'preparation' && admin) || (page === 'qr' && admin) || page === 'equipment') && (
          <InventoryPage
            key={page}
            {...context}
            page={page}
            userId={me.user.id}
            onPublication={setWebsitePublished}
            onGo={setPage}
          />
        )}
      {page === 'website' && modules.website && admin && (
        <WebsitePage
          {...context}
          userId={me.user.id}
          onPublication={setWebsitePublished}
          floorPlanEnabled={modules.floorPlan}
          publicPath={branchSlug ? `/sedes/${encodeURIComponent(branchSlug)}` : undefined}
        />
      )}
      {page === 'media' && modules.media && (
        <>
          <Heading
            title="Los recursos de tu gimnasio."
            description="Subí contenido real del espacio y reutilizalo en modelos, unidades, ejercicios y en la web."
          />
          <MediaLibrary orgId={org.id} disabled={!org.serviceActive} dataRefresh={dataRefresh} />
        </>
      )}
      {page === 'reports' && <ReportsPage {...context} />}
      {page === 'people' && <PeoplePage {...context} />}
      {page === 'catalog' && <CatalogPage {...context} />}
      {page === 'programs' && <ProgramsPage {...context} />}
      {page === 'brand' && admin && (
        <BrandSettings organization={org} active={org.serviceActive} onSaved={onBrand} />
      )}
    </Shell>
  )
}
function LegacyApp() {
  const { me, loading, error, orgId, setOrgId, dataRefresh, refresh, signOut, updateOrganization } =
    useB2BSession()
  if (loading)
    return (
      <Shell eyebrow="ESPACIO PROFESIONAL">
        <p className="loading" role="status">
          Preparando el acceso…
        </p>
      </Shell>
    )
  if (!me)
    return (
      <Shell
        eyebrow="ESPACIO PROFESIONAL"
        actions={
          <a className="text-button small" href="/app">
            Espacio de socios
          </a>
        }
      >
        <Notice error>{error}</Notice>
        <Login backoffice onSignIn={b2bClient.auth.signIn} onDone={() => void refresh()} />
      </Shell>
    )
  const membership =
    me.memberships.find((item) => item.organization.id === orgId && item.role !== 'member') ??
    me.memberships.find((item) => item.role !== 'member')
  if (!membership)
    return (
      <Shell
        eyebrow="ESPACIO PROFESIONAL"
        actions={
          <button className="text-button" onClick={() => void signOut()}>
            Salir
          </button>
        }
      >
        <Empty title="Este espacio es para el equipo del gimnasio">
          Tu cuenta no tiene permisos de entrenador o administrador.{' '}
          <a href="/app">Ir a mi espacio de socio</a>.
        </Empty>
      </Shell>
    )
  return (
    <>
      <Notice error>{error}</Notice>
      <AccountProvider userId={me.user.id}>
        <Workspace
          key={`${me.user.id}/${membership.organization.id}/${membership.role}`}
          dataRefresh={dataRefresh}
          me={me}
          membership={membership}
          onSignOut={() => void signOut()}
          onOrganization={setOrgId}
          onBrand={updateOrganization}
        />
      </AccountProvider>
    </>
  )
}

function BrandBackoffice({
  context,
  refreshBrand,
}: {
  context: BrandContext
  refreshBrand: () => void
}) {
  const session = useB2BSession()
  const { me, loading, error, branchId, workRole, workContextKey, setWorkContext } = session
  const access = me?.whiteLabel
  const selected = access?.branches.find(
    (item) =>
      item.branch.id === branchId && item.roles.includes(workRole as 'admin' | 'coach' | 'member'),
  )
  const selector = access ? (
    <WorkContextSelector
      access={access}
      branchId={branchId}
      role={workRole}
      onChange={(id, role) => {
        if (setWorkContext(id, role) && role === 'member') location.assign('/app')
      }}
    />
  ) : null
  const membership = me?.memberships.find(
    (item) => item.organization.id === context.organization.id,
  )
  if (loading)
    return (
      <Shell name={context.organization.brand.name} eyebrow="TU MARCA">
        <p role="status">Preparando el acceso…</p>
      </Shell>
    )
  if (!me)
    return (
      <Shell
        name={context.organization.brand.name}
        logoUrl={context.organization.brand.logoUrl}
        eyebrow="TU MARCA"
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
      <Shell name={context.organization.brand.name} eyebrow="TU MARCA">
        <Notice error>{error || 'Tu cuenta no tiene acceso a esta marca.'}</Notice>
        <button className="button" onClick={() => void session.signOut()}>
          Salir
        </button>
      </Shell>
    )
  if (!selected && access.brandAdmin)
    return (
      <AccountProvider userId={me.user.id}>
        <Shell
          name={context.theme.brand.name}
          eyebrow="MARCA Y SEDES"
          actions={
            <>
              {selector}
              <button className="text-button" onClick={() => void session.signOut()}>
                Salir
              </button>
            </>
          }
        >
          <h1>Elegí una sede para operar</h1>
          <WhiteLabelSettings
            orgId={membership.organization.id}
            branchId=""
            context={context}
            onRefresh={() => {
              void session.refresh(false)
              refreshBrand()
            }}
          />
        </Shell>
      </AccountProvider>
    )
  if (!selected || !workRole || workRole === 'member')
    return (
      <Shell
        name={context.organization.brand.name}
        eyebrow="ELEGÍ TU ESPACIO"
        actions={
          <button className="text-button" onClick={() => void session.signOut()}>
            Salir
          </button>
        }
      >
        <h1>Elegí sede y función</h1>
        <Notice error>{error}</Notice>
        {selector}
        {workRole === 'member' && (
          <a className="button" href="/app">
            Abrir mi espacio de socio
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
      <Workspace
        key={workContextKey}
        me={me}
        membership={{
          ...membership,
          role: workRole,
          organization: {
            ...membership.organization,
            brand: { ...context.theme.brand, color: context.theme.palette.primary },
          },
        }}
        dataRefresh={session.dataRefresh}
        onSignOut={() => void session.signOut()}
        onOrganization={session.setOrgId}
        onBrand={session.updateOrganization}
        contextUI={selector}
        whiteLabel={context}
        branchId={branchId}
        branchSlug={selected.branch.slug}
        onRefresh={() => {
          void session.refresh(false)
          refreshBrand()
        }}
      />
    </AccountProvider>
  )
}

export default function App() {
  const brand = useBrandContext()
  if (brand.loading)
    return (
      <Shell eyebrow="TU MARCA">
        <p role="status">Preparando el acceso…</p>
      </Shell>
    )
  if (brand.error)
    return (
      <Shell eyebrow="ACCESO">
        <Notice error>{brand.error}</Notice>
      </Shell>
    )
  return brand.context ? (
    <BrandThemeProvider context={brand.context}>
      <BrandBackoffice context={brand.context} refreshBrand={brand.refresh} />
    </BrandThemeProvider>
  ) : (
    <LegacyApp />
  )
}
