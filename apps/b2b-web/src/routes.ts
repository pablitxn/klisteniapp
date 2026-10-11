export type ManagementPage =
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
export type MemberPage = 'routine' | 'catalog' | 'history' | 'allHistory'
export type AppRoute =
  | { kind: 'home' }
  | { kind: 'gym'; slug: string; unitId?: string }
  | { kind: 'branch'; slug: string }
  | { kind: 'invitation' }
  | { kind: 'login' }
  | { kind: 'member'; page?: MemberPage }
  | { kind: 'management'; page?: ManagementPage }
  | { kind: 'notFound' }

const managementPages: ManagementPage[] = [
  'reports',
  'people',
  'programs',
  'catalog',
  'equipment',
  'brand',
  'preparation',
  'website',
  'media',
  'qr',
  'whiteLabel',
]
const memberPages: Record<string, MemberPage> = {
  routines: 'routine',
  catalog: 'catalog',
  history: 'history',
  'history/all': 'allHistory',
}

/** Keep existing gym URLs working while reserving the owner console's name. */
export function compatiblePath(pathname: string): string {
  return pathname === '/backoffice' || pathname.startsWith('/backoffice/')
    ? pathname.replace(/^\/backoffice/, '/manage')
    : pathname
}

export function resolveRoute(pathname: string): AppRoute {
  const path = compatiblePath(pathname).replace(/\/+$/, '') || '/'
  if (path === '/' || path === '/gimnasios') return { kind: 'home' }
  if (path === '/app/invite') return { kind: 'invitation' }
  if (path === '/login') return { kind: 'login' }
  if (path === '/app') return { kind: 'member' }
  if (path === '/manage') return { kind: 'management' }
  if (path.startsWith('/app/') && Object.hasOwn(memberPages, path.slice(5)))
    return { kind: 'member', page: memberPages[path.slice(5)] }
  if (path.startsWith('/manage/') && managementPages.includes(path.slice(8) as ManagementPage))
    return { kind: 'management', page: path.slice(8) as ManagementPage }
  const gym = /^\/g\/([^/]+)(?:\/units\/([^/]+))?$/.exec(path)
  if (gym) {
    try {
      return {
        kind: 'gym',
        slug: decodeURIComponent(gym[1]),
        unitId: gym[2] ? decodeURIComponent(gym[2]) : undefined,
      }
    } catch {
      return { kind: 'notFound' }
    }
  }
  const branch = /^\/sedes\/([a-z0-9-]+)$/.exec(path)
  return branch ? { kind: 'branch', slug: branch[1] } : { kind: 'notFound' }
}

export const managementPath = (page?: ManagementPage) => (page ? `/manage/${page}` : '/manage')
export function memberPath(page: MemberPage = 'routine'): string {
  return `/app/${page === 'allHistory' ? 'history/all' : page === 'routine' ? 'routines' : page}`
}
export const isWorkspaceRoute = (route: AppRoute) =>
  route.kind === 'login' || route.kind === 'member' || route.kind === 'management'

/** URL visibility is not authorization; the API independently enforces every operation. */
export function managementPageAllowed(page: ManagementPage, role: string): boolean {
  if (role !== 'admin' && role !== 'coach') return false
  return role === 'admin' || !['preparation', 'brand', 'website', 'qr', 'whiteLabel'].includes(page)
}
