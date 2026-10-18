import '@klisteniapp/b2b-ui/styles.css'
import { createRoot } from 'react-dom/client'
import App from '/workspace/klisteniapp/apps/b2b-web/src/App'
import { ApplicationProvider, useApplication } from '/workspace/klisteniapp/apps/b2b-web/src/app/ApplicationProvider'
let snapshot: object = {}, refresh = () => {}
function Inspector() {
  const { brand, session, route } = useApplication()
  snapshot = { route: route.kind, brandLoading: brand.loading, error: brand.error, failure: 'errorResponse' in brand ? brand.errorResponse : undefined, bootstrap: Boolean(session.bootstrap), access: session.productAccess?.accessMode }
  refresh = brand.refresh
  return <App />
}
Object.assign(window, { publicProof: { state: () => snapshot, refresh: () => refresh(), start: () => createRoot(document.getElementById('root')!).render(<ApplicationProvider><Inspector /></ApplicationProvider>) } })
