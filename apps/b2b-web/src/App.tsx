import { BrandThemeProvider, Empty, Notice, Shell } from '@klisteniapp/b2b-ui'
import { lazy, Suspense, useEffect } from 'react'
import { useApplication } from './app/ApplicationProvider'
import { compatiblePath, isWorkspaceRoute } from './routes'
import { followApplicationLink } from './app/navigationLinks'

const ProductWorkspace = lazy(() => import('./app/ProductWorkspace'))
const Workspace = lazy(() => import('./app/Workspace'))
const GymEntry = lazy(() =>
  import('./features/public/GymEntry').then((module) => ({ default: module.GymEntry })),
)
const BrandEntry = lazy(() =>
  import('./features/public/BrandEntry').then((module) => ({ default: module.BrandEntry })),
)
const PublicGym = lazy(() =>
  import('./features/public/PublicGym').then((module) => ({ default: module.PublicGym })),
)
const Invitation = lazy(() =>
  import('./features/invitations/Invitation').then((module) => ({ default: module.Invitation })),
)

export default function App() {
  const { brand, session, route, href, navigate } = useApplication()
  const context = brand.context
  useEffect(() => {
    const url = new URL(href, location.origin)
    const canonical = compatiblePath(url.pathname)
    if (canonical !== url.pathname) navigate(canonical + url.search + url.hash, true)
    document.title =
      route.kind === 'management'
        ? 'Gestión del gimnasio'
        : context?.theme.brand.name || 'Mi gimnasio'
  }, [href, route.kind, context, navigate])

  if (brand.loading)
    return (
      <Shell eyebrow="TU MARCA">
        <p role="status">Conociendo tu gimnasio…</p>
      </Shell>
    )
  if (brand.error && !session.bootstrap && !['login', 'member', 'management'].includes(route.kind))
    return (
      <Shell eyebrow="ACCESO">
        <Notice error>{brand.error}</Notice>
        <button className="button" onClick={brand.refresh}>
          Reintentar
        </button>
      </Shell>
    )
  const routeContent =
    route.kind === 'home' ? (
      context ? (
        <BrandEntry context={context} />
      ) : (
        <GymEntry />
      )
    ) : route.kind === 'gym' ? (
      <PublicGym
        slug={route.slug}
        unitId={route.unitId}
        themeColor={context?.theme.palette.primary}
        branches={context?.branches}
      />
    ) : route.kind === 'branch' && context ? (
      <PublicGym
        slug={context.organization.slug}
        themeColor={context.theme.palette.primary}
        branchSlug={route.slug}
        branchId={context.branches.find((branch) => branch.slug === route.slug)?.id}
        branches={context.branches}
      />
    ) : route.kind === 'invitation' ? (
      <Invitation
        context={context ?? undefined}
        replaceLocation={(href) => navigate(href, true)}
        onAuthenticated={() => {
          void session.refresh()
          navigate('/app')
        }}
      />
    ) : ['login', 'member', 'management'].includes(route.kind) ? (
      <Workspace />
    ) : (
      <Shell eyebrow="TU GIMNASIO">
        <Empty title="Esta página no existe">
          <a href="/">Volver al inicio</a>
        </Empty>
      </Shell>
    )
  const content = (
    <div onClick={(event) => followApplicationLink(event, href)}>
      <Suspense fallback={<p role="status">Cargando…</p>}>
        {session.bootstrap ? (
          <ProductWorkspace publicContent={isWorkspaceRoute(route) ? undefined : routeContent} />
        ) : (
          routeContent
        )}
      </Suspense>
    </div>
  )
  return context ? <BrandThemeProvider context={context}>{content}</BrandThemeProvider> : content
}
