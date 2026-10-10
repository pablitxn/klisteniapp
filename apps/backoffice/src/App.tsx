import { useEffect, useRef, useState } from 'react'
import type { Assignment, Exercise, Machine, Me, Member, Membership, Organization, Program, Report, SetupProgress, Unit, Website } from '@klisteniapp/b2b-contracts'
import { watchSessionChange, AccountProvider, useAccountApi, api, ApiError, Empty, errorMessage, Login, Notice, Shell, useLoad } from '@klisteniapp/b2b-ui'
import { Catalog, Equipment } from './Catalog'
import { Programs } from './Programs'
import { BrandSettings, People, Reports } from './People'
import { Preparation } from './Preparation'
import { WebsiteEditor } from './Website'
import { QRCodes } from './QRCodes'
import { MediaLibrary } from './MediaLibrary'
import { Heading } from './shared'

type Page = 'reports' | 'people' | 'programs' | 'catalog' | 'equipment' | 'brand' | 'preparation' | 'website' | 'media' | 'qr'
function Workspace({ me, membership, dataRefresh, onSignOut, onOrganization, onBrand }: { me: Me; membership: Membership; dataRefresh: number; onSignOut: () => void; onOrganization: (id: string) => void; onBrand: (organization: Organization) => void }) {
  const api = useAccountApi()
  const org = membership.organization, admin = membership.role === 'admin'
  const [page, setPage] = useState<Page>(admin ? 'preparation' : 'reports')
  const { data, loading, error, reload } = useLoad(async () => {
    const [members, exercises, machines, units, programs, assignments, report, setup, website] = await Promise.all([
      api<{ members: Member[] }>(`/orgs/${org.id}/members`), api<{ exercises: Exercise[] }>(`/orgs/${org.id}/exercises`), api<{ machines: Machine[] }>(`/orgs/${org.id}/machines`), api<{ units: Unit[] }>(`/orgs/${org.id}/units`), api<{ programs: Program[] }>(`/orgs/${org.id}/programs`), api<{ assignments: Assignment[] }>(`/orgs/${org.id}/assignments`), api<Report>(`/orgs/${org.id}/reports`), api<SetupProgress>(`/orgs/${org.id}/setup-progress`), admin ? api<{ website: Website }>(`/orgs/${org.id}/website`) : Promise.resolve({ website: null }),
    ]); return { ...members, ...exercises, ...machines, ...units, ...programs, ...assignments, report, setup, website: website.website }
  }, `${org.id}/${dataRefresh}`)
  const websitePublished = data?.website ? data.website.publishedRevision !== null : Boolean(data?.setup.websitePublished)
  const qrUnits = websitePublished ? data?.units.filter(unit => unit.public && !unit.archived && data.machines.find(machine => machine.id === unit.machineId)?.status === 'published') ?? [] : []
  const navigation: Array<[Page, string, string]> = [
    ...(admin ? [['preparation', '✓', 'Preparación']] as Array<[Page, string, string]> : []),
    ['reports', '◷', 'Seguimiento'], ['people', '◎', 'Personas'], ['programs', '▤', 'Rutinas'], ['catalog', '↗', 'Ejercicios'], ['equipment', '◇', 'Equipamiento'], ['media', '▧', 'Archivos'],
    ...(admin ? [['brand', '◈', 'Identidad'], ['website', '⌂', 'Website'], ['qr', '▦', 'Etiquetas QR']] as Array<[Page, string, string]> : []),
  ]
  const nav = <>{navigation.map(([id, icon, title]) => <button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)}><span aria-hidden="true">{icon}</span>{title}</button>)}{websitePublished && <a href={`/g/${org.slug}`} target="_blank" rel="noreferrer">↗ Web pública</a>}</>
  return <Shell name={org.brand.name} logoUrl={org.brand.logoUrl} color={org.brand.color} eyebrow="ESPACIO PROFESIONAL" navigation={nav} actions={<><span className="muted small">{me.user.name} · {admin ? 'Administrador' : 'Entrenador'}</span>{me.memberships.filter(item => item.role !== 'member').length > 1 && <select aria-label="Gimnasio" value={org.id} onChange={event => onOrganization(event.target.value)}>{me.memberships.filter(item => item.role !== 'member').map(item => <option key={item.organization.id} value={item.organization.id}>{item.organization.brand.name}</option>)}</select>}<button className="text-button small" onClick={onSignOut}>Salir</button></>}>
    {!org.serviceActive && <Notice>El servicio del gimnasio está pausado. Podés consultar la información; las nuevas publicaciones y cambios están deshabilitados.</Notice>}
    <Notice error>{error}</Notice>{error && <button className="button" onClick={reload}>Reintentar carga</button>}{loading && !data && <p className="loading" role="status">Preparando el espacio del gimnasio…</p>}
    {data && <>{page === 'preparation' && admin && <Preparation progress={data.setup} readyQrCount={qrUnits.length} onGo={setPage} />}{page === 'website' && admin && data.website && <WebsiteEditor userId={me.user.id} organization={org} website={data.website} active={org.serviceActive} reload={reload} />}{page === 'media' && <><Heading title="Los recursos de tu gimnasio." description="Subí contenido real del espacio y reutilizalo en modelos, unidades, ejercicios y en la web." /><MediaLibrary orgId={org.id} disabled={!org.serviceActive} /></>}{page === 'qr' && admin && <QRCodes units={qrUnits} gymName={org.brand.name} />}{page === 'reports' && <Reports report={data.report} />}{page === 'people' && <People orgId={org.id} members={data.members} admin={admin} active={org.serviceActive} reload={reload} />}{page === 'catalog' && <Catalog orgId={org.id} exercises={data.exercises} machines={data.machines} active={org.serviceActive} reload={reload} />}{page === 'equipment' && <Equipment userId={me.user.id} orgId={org.id} machines={data.machines} units={data.units} active={org.serviceActive} admin={admin} websitePublished={websitePublished} reload={reload} />}{page === 'programs' && <Programs orgId={org.id} exercises={data.exercises} programs={data.programs} members={data.members} assignments={data.assignments} active={org.serviceActive} reload={reload} />}{page === 'brand' && admin && <BrandSettings organization={org} active={org.serviceActive} onSaved={organization => { onBrand(organization); reload() }} />}</>}
  </Shell>
}
export default function App() {
  const [me, setMe] = useState<Me | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [orgId, setOrgId] = useState('')
  const requestGeneration = useRef(0), signingOut = useRef(false)
  const [dataRefresh, setDataRefresh] = useState(0)
  async function refresh(immediate = true) {
    if (signingOut.current) return
    const generation = ++requestGeneration.current
    if (immediate) { setMe(null); setOrgId(''); setLoading(true) }
    setError('')
    try { const value = await api<Me>('/me'); if (generation === requestGeneration.current) { setMe(value); setDataRefresh(value => value + 1) } }
    catch (error) { if (generation === requestGeneration.current) { setMe(null); setOrgId(''); if (!(error instanceof ApiError && error.status === 401)) setError(errorMessage(error)) } }
    finally { if (generation === requestGeneration.current) setLoading(false) }
  }
  useEffect(() => { void refresh(); return watchSessionChange(immediate => { void refresh(immediate) }) }, [])
  async function signOut() {
    signingOut.current = true; ++requestGeneration.current; setLoading(true)
    try { await api('/auth/sign-out', 'POST', {}); setMe(null); setOrgId('') }
    catch (error) { setError(errorMessage(error)) }
    finally { ++requestGeneration.current; signingOut.current = false; setLoading(false) }
  }
  if (loading) return <Shell eyebrow="ESPACIO PROFESIONAL"><p className="loading" role="status">Preparando el acceso…</p></Shell>
  if (!me) return <Shell eyebrow="ESPACIO PROFESIONAL" actions={<a className="text-button small" href="/app">Espacio de socios</a>}><Notice error>{error}</Notice><Login backoffice onDone={() => void refresh()} /></Shell>
  const membership = me.memberships.find(item => item.organization.id === orgId && item.role !== 'member') ?? me.memberships.find(item => item.role !== 'member')
  if (!membership) return <Shell eyebrow="ESPACIO PROFESIONAL" actions={<button className="text-button" onClick={() => void signOut()}>Salir</button>}><Empty title="Este espacio es para el equipo del gimnasio">Tu cuenta no tiene permisos de entrenador o administrador. <a href="/app">Ir a mi espacio de socio</a>.</Empty></Shell>
  return <><Notice error>{error}</Notice><AccountProvider userId={me.user.id}><Workspace key={`${me.user.id}/${membership.organization.id}/${membership.role}`} dataRefresh={dataRefresh} me={me} membership={membership} onSignOut={() => void signOut()} onOrganization={setOrgId} onBrand={organization => setMe({ ...me, memberships: me.memberships.map(item => item.organization.id === organization.id ? { ...item, organization } : item) })} /></AccountProvider></>
}
