import '@klisteniapp/b2b-ui/styles.css'
import { createRoot } from 'react-dom/client'
import { useCallback, useMemo, useState } from 'react'
import { createProductV2Client, type ProductV2Client } from '@klisteniapp/b2b-client'
import { Shell } from '@klisteniapp/b2b-ui'
import { ProductViews } from '/workspace/klisteniapp/apps/b2b-web/src/app/ProductWorkspace'
import { useProductStream } from '/workspace/klisteniapp/apps/b2b-web/src/app/productStream'
import { access } from '/workspace/klisteniapp/apps/b2b-web/tests/healthFixture'
import { IndexedDBWorkoutStore } from '/workspace/klisteniapp/apps/b2b-web/src/features/training/storage/workoutStore'
import { recoveryContext } from '/workspace/klisteniapp/apps/b2b-web/tests/fixtures/workoutRecovery'
const context = access(true)
const store = new IndexedDBWorkoutStore(indexedDB, 'synthetic-health-readiness')
const events: object[] = []
let state: object = {}
const revalidate = async () => {
  events.push({ event: 'outer-revalidation-start' })
  const value = await (await fetch('/authority', { cache: 'no-store', signal: context.signal })).json()
  events.push({ event: 'outer-revalidation-finish', accepted: value.accepted })
  return value.accepted
}
function Probe() {
  const [href, setHref] = useState(new URL(location.href).searchParams.has('startOther') ? '/manage?view=unknown' : '/manage?view=shared-health')
  const outer = useProductStream(context, undefined, () => {
    events.push({ event: 'outer-invalidated' })
  }, { revalidate })
  const protectedContext = useMemo(() => ({ ...context, requestSignal: () => outer.guard.requestSignal() }), [outer.guard])
  const client = useCallback((signal?: AbortSignal): ProductV2Client => ({ call: async (key, input) => {
    const network = outer.guard.requestSignal()
    return createProductV2Client(context.accountId, context.organizationId, { branchId: context.branchId, role: 'coach', contextSignal: AbortSignal.any([context.signal, network]), signal }).call(key, input)
  } }), [outer.guard])
  state = { outerReady: outer.ready, outerValidated: outer.validated, events }
  return <Shell name="Synthetic health gate" eyebrow="LOCAL SYNTHETIC VALIDATION">
    {context.signal.aborted ? <p>Context invalidated</p> : outer.validated ? <ProductViews
      createClient={client} accessKey={context.generation} context={protectedContext}
      workspaceReady={outer.ready} organizationName="Atlas" branchName="East"
      href={href} navigate={setHref}
      store={store} onSelected={()=>{}} recoveryContext={recoveryContext()} recoverable={null}
    /> : <p role="status">Waiting for initial workspace authority</p>}
  </Shell>
}
Object.assign(window, { healthProof: { state: () => state, start: () => createRoot(document.getElementById('root')!).render(<Probe/>) } })
