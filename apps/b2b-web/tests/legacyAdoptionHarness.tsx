// Isolated synthetic component harness; this is not a product route or a QA cross-feature fixture.
import '@klisteniapp/b2b-ui/styles.css'
import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createProductV2Client } from '@klisteniapp/b2b-client'
import { ProductEndpoints, type ProductInput } from '@klisteniapp/b2b-contracts/product-v2'
import { LegacyAdoptionAssignments } from '../src/features/programs/legacy-adoption/LegacyAdoptionAssignments'
import {
  confirmedLegacyReview,
  legacyAdoptionFixture,
  syntheticLegacySupplement,
} from './legacyAdoptionFixture.ts'
import { prepareLegacyAdoption } from '../src/features/programs/legacy-adoption/legacyAdoptionModel.ts'

type Mode =
  | 'normal'
  | 'conflict'
  | 'server-error'
  | 'lost-response'
  | 'revoked'
  | 'refresh-revoked'
  | 'existing'
  | 'wrong-preview'
type Control = {
  reset: (mode: Mode) => void
  revoke: () => void
  state: () => {
    posts: ProductInput<'adoptLegacySupplement'>[]
    accepted: number
    previews: number
    originalUnchanged: boolean
    refreshedVersion: number
    refreshedSupplement: number
  }
}
declare global {
  interface Window {
    legacyAdoptionHarness: Control
  }
}
function Harness() {
  const [selection, setSelection] = useState<{ mode: Mode; epoch: number }>({
    mode: 'normal',
    epoch: 0,
  })
  const runtime = useMemo(() => {
    const fixture = legacyAdoptionFixture()
    const original = JSON.stringify(fixture.preview.original)
    const controller = new AbortController()
    const posts: ProductInput<'adoptLegacySupplement'>[] = []
    let accepted: ReturnType<typeof syntheticLegacySupplement> | null = null
    let acceptedCount = 0,
      previews = 0,
      refreshedVersion = 0,
      refreshedSupplement = 0
    let lastOperation = ''
    if (selection.mode === 'existing') {
      const ready = prepareLegacyAdoption(
        fixture.preview,
        confirmedLegacyReview(fixture.preview),
        null,
        () => 'existing-operation',
      )
      if (!ready.ok) throw new Error('Invalid synthetic fixture')
      accepted = syntheticLegacySupplement(fixture.preview, ready.attempt.input)
    }
    const json = (value: unknown, status = 200) => Response.json(value, { status })
    const request: typeof fetch = async (path, init) => {
      const pathname = new URL(String(path), location.origin).pathname
      const headers = new Headers(init?.headers)
      if (
        headers.get('X-Klisteni-B2B-Contract') !== '2' ||
        headers.get('X-Klisteni-B2B-Branch') !== 'center'
      )
        return json({ error: 'Invalid synthetic scope', code: 'CONTEXT_REVOKED' }, 403)
      if (pathname.endsWith('/history-subjects'))
        return json({
          schemaVersion: 2,
          scope: { organizationId: 'brand', branchId: 'center' },
          members: [{ userId: 'member', name: 'Synthetic member', active: false }],
        })
      if (pathname.endsWith('/legacy-assignments')) return json([fixture.assignment])
      if (pathname.endsWith('/supplement-preview')) {
        previews++
        const value = structuredClone(fixture.preview)
        value.supplement = accepted
        if (selection.mode === 'wrong-preview') value.scope.memberId = 'other-member'
        return json(value)
      }
      if (pathname.endsWith('/legacy-assignments/assignment/supplement')) {
        const input = ProductEndpoints.adoptLegacySupplement.input.parse(
          JSON.parse(String(init?.body)),
        )
        posts.push(input)
        if (selection.mode === 'revoked')
          return json({ error: 'Access revoked', code: 'CONTEXT_REVOKED' }, 403)
        if (selection.mode === 'conflict' && posts.length === 1) {
          fixture.preview.proposals[0].hash = '8'.repeat(64)
          fixture.preview.proposals[0].relation.targetDose.durationSeconds = {
            kind: 'range',
            min: 20,
            max: 50,
          }
          return json({ error: 'Changed proposals', code: 'REVISION_CONFLICT' }, 409)
        }
        if (selection.mode === 'server-error' && posts.length === 1)
          return json({ error: 'Synthetic server failure', code: 'REQUEST_FAILED' }, 500)
        if (!accepted) {
          accepted = syntheticLegacySupplement(fixture.preview, input)
          acceptedCount++
          lastOperation = input.operationId
        } else if (input.operationId !== lastOperation)
          return json({ error: 'Already adopted', code: 'REVISION_CONFLICT' }, 409)
        if (selection.mode === 'lost-response' && posts.length === 1)
          throw new TypeError('Synthetic response loss')
        return json(accepted)
      }
      if (pathname.endsWith('/routine/versions/1/supplement')) {
        refreshedSupplement++
        return json(accepted?.supplement ?? null)
      }
      if (pathname.endsWith('/routine/versions/1')) {
        refreshedVersion++
        if (selection.mode === 'refresh-revoked')
          return json({ error: 'Revoked after acceptance', code: 'CONTEXT_REVOKED' }, 403)
        return json({ schemaVersion: 1, snapshot: fixture.preview.original })
      }
      throw new Error(`Unexpected synthetic component request: ${pathname}`)
    }
    return {
      fixture,
      controller,
      createClient: (signal?: AbortSignal) =>
        createProductV2Client('coach', 'brand', {
          branchId: 'center',
          role: 'coach',
          signal,
          contextSignal: controller.signal,
          fetch: request,
          onAuthChange: () => {},
        }),
      state: () => ({
        posts,
        accepted: acceptedCount,
        previews,
        originalUnchanged: JSON.stringify(fixture.preview.original) === original,
        refreshedVersion,
        refreshedSupplement,
      }),
    }
  }, [selection])
  window.legacyAdoptionHarness = {
    reset: (mode) => {
      runtime.controller.abort()
      setSelection((current) => ({ mode, epoch: current.epoch + 1 }))
    },
    revoke: () => runtime.controller.abort(),
    state: runtime.state,
  }
  return (
    <LegacyAdoptionAssignments
      key={selection.epoch}
      accountId="coach"
      branchId="center"
      access={runtime.fixture.access}
      accessKey={`scope-${selection.epoch}`}
      contextSignal={runtime.controller.signal}
      createClient={runtime.createClient}
      onClose={() => {
        document.body.dataset.closed = 'true'
      }}
    />
  )
}
createRoot(document.getElementById('root')!).render(<Harness />)
