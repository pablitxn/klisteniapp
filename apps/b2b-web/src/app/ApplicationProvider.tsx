import { useB2BSession, useBrandContext } from '@klisteniapp/b2b-react'
import { createContext, useContext, useRef, type ReactNode } from 'react'
import { isWorkspaceRoute, resolveRoute, type AppRoute } from '../routes'
import { navigate, useLocation } from './navigation'

type ApplicationContext = {
  brand: ReturnType<typeof useBrandContext>
  session: ReturnType<typeof useB2BSession>
  route: AppRoute
  href: string
  navigate: typeof navigate
}
const Context = createContext<ApplicationContext | null>(null)

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const href = useLocation()
  const route = resolveRoute(new URL(href, location.origin).pathname)
  const brand = useBrandContext()
  // Public entry does not fetch private data. Once needed, the same controller
  // survives internal navigation so changing views never creates another session.
  const started = useRef(false)
  if (isWorkspaceRoute(route)) started.current = true
  const session = useB2BSession({ enabled: started.current && !brand.loading && !brand.error })
  return (
    <Context.Provider value={{ brand, session, route, href, navigate }}>
      {children}
    </Context.Provider>
  )
}

export function useApplication() {
  const value = useContext(Context)
  if (!value) throw new Error('Missing B2B application context')
  return value
}
