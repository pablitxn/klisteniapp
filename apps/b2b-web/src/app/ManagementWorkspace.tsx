import type {
  BrandContext,
  EffectiveModules,
  Me,
  Membership,
  Organization,
} from '@klisteniapp/b2b-contracts'
import { useAccountClient, useLoad } from '@klisteniapp/b2b-react'
import { Notice, Shell } from '@klisteniapp/b2b-ui'
import { lazy, useState, type ReactNode } from 'react'
import { managementPath, type ManagementPage } from '../routes'
import { useApplication } from './ApplicationProvider'

const CatalogPage = lazy(() =>
  import('../features/catalog/CatalogPage').then((module) => ({ default: module.CatalogPage })),
)
const InventoryPage = lazy(() =>
  import('../features/equipment/InventoryPage').then((module) => ({
    default: module.InventoryPage,
  })),
)
const PeoplePage = lazy(() =>
  import('../features/people/PeoplePage').then((module) => ({ default: module.PeoplePage })),
)
const ProgramsPage = lazy(() =>
  import('../features/programs/ProgramsPage').then((module) => ({ default: module.ProgramsPage })),
)
const ReportsPage = lazy(() =>
  import('../features/reports/ReportsPage').then((module) => ({ default: module.ReportsPage })),
)
const WebsitePage = lazy(() =>
  import('../features/website/WebsitePage').then((module) => ({ default: module.WebsitePage })),
)
const BrandSettings = lazy(() =>
  import('../features/organization/BrandSettings').then((module) => ({
    default: module.BrandSettings,
  })),
)
const WhiteLabelSettings = lazy(() =>
  import('../features/organization/WhiteLabelSettings').then((module) => ({
    default: module.WhiteLabelSettings,
  })),
)
const MediaPage = lazy(() =>
  import('../features/media/MediaPage').then((module) => ({ default: module.MediaPage })),
)

export function ManagementWorkspace({
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
  const { route, navigate } = useApplication()
  const page =
    route.kind === 'management' && route.page
      ? route.page
      : admin && modules.equipment
        ? 'preparation'
        : 'reports'
  const setPage = (next: ManagementPage) => navigate(managementPath(next))
  const [websitePublished, setWebsitePublished] = useState(false)
  const context = { membership, dataRefresh }
  const navigation: Array<[ManagementPage, string, string]> = [
    ...(admin && whiteLabel
      ? ([['whiteLabel', '◈', 'Marca y sedes']] as Array<[ManagementPage, string, string]>)
      : []),
    ...(admin
      ? ([['preparation', '✓', 'Preparación']] as Array<[ManagementPage, string, string]>)
      : []),
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
        ] as Array<[ManagementPage, string, string]>)
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
        <MediaPage orgId={org.id} active={org.serviceActive} dataRefresh={dataRefresh} />
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
