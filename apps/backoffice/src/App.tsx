import { b2bClient } from '@klisteniapp/b2b-client'
import { useState } from 'react'
import type { Me, Membership, Organization } from '@klisteniapp/b2b-contracts'
import { AccountProvider, useB2BSession } from '@klisteniapp/b2b-react'
import { Empty, Login, Notice, Shell } from '@klisteniapp/b2b-ui'
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
function Workspace({
  me,
  membership,
  dataRefresh,
  onSignOut,
  onOrganization,
  onBrand,
}: {
  me: Me
  membership: Membership
  dataRefresh: number
  onSignOut: () => void
  onOrganization: (id: string) => void
  onBrand: (organization: Organization) => void
}) {
  const org = membership.organization,
    admin = membership.role === 'admin'
  const [page, setPage] = useState<Page>(admin ? 'preparation' : 'reports')
  const [websitePublished, setWebsitePublished] = useState(false)
  const context = { membership, dataRefresh }
  const navigation: Array<[Page, string, string]> = [
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
      {navigation.map(([id, icon, title]) => (
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
        <a href={`/g/${org.slug}`} target="_blank" rel="noreferrer">
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
      {!org.serviceActive && (
        <Notice>
          El servicio del gimnasio está pausado. Podés consultar la información; las nuevas
          publicaciones y cambios están deshabilitados.
        </Notice>
      )}
      {((page === 'preparation' && admin) || (page === 'qr' && admin) || page === 'equipment') && (
        <InventoryPage
          key={page}
          {...context}
          page={page}
          userId={me.user.id}
          onPublication={setWebsitePublished}
          onGo={setPage}
        />
      )}
      {page === 'website' && admin && (
        <WebsitePage {...context} userId={me.user.id} onPublication={setWebsitePublished} />
      )}
      {page === 'media' && (
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
export default function App() {
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
