/** Isolated component harness. No application routes, auth or real transport. */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { ProductV2Client } from '@klisteniapp/b2b-client'
import type { ProductAccess } from '@klisteniapp/b2b-contracts/product-v2'
import { MembershipAccessBoundary } from '../../src/features/membership/RestrictedMembership.tsx'

const identity = { userId: 'member', organizationId: 'atlas' }
const initial: ProductAccess = {
  schemaVersion: 2,
  ...identity,
  role: 'member',
  accessMode: 'export-only',
  accessRevision: 4,
  branches: [],
  capabilities: ['export-own-records'],
}
const state = {
  failExport: false,
  failInvitation: false,
  configured: false,
  reactivate: false,
  calls: [] as string[],
  downloads: [] as { filename: string; json: string }[],
  local: false,
  transition: (mode: 'active' | 'inactive' | 'foreign') => {
    void mode
  },
}
Object.assign(window, { wp11: state })

function Harness() {
  const [access, setAccess] = useState(initial)
  const [signal, setSignal] = useState(new AbortController())
  function transition(mode: 'active' | 'inactive' | 'foreign') {
    signal.abort()
    setSignal(new AbortController())
    setAccess({
      ...initial,
      accessMode: mode === 'active' ? 'active' : 'export-only',
      userId: mode === 'foreign' ? 'foreign' : identity.userId,
      accessRevision: access.accessRevision + 1,
    })
  }
  state.transition = transition
  const client = {
    async call(key: string) {
      state.calls.push(key)
      if (key === 'personalExport') {
        if (state.failExport) throw new Error('Synthetic offline')
        return (await fetch('/export.json')).json()
      }
      if (key === 'b2cInvitation') {
        if (state.failInvitation) throw new Error('Synthetic unavailable')
        return {
          separateProduct: true,
          paid: true,
          automaticConversion: false,
          url: state.configured ? 'https://personal.example.test/start' : null,
        }
      }
      throw new Error('Unexpected endpoint')
    },
  } as ProductV2Client
  return (
    <MembershipAccessBoundary
      identity={identity}
      access={access}
      client={client}
      contextSignal={signal.signal}
      currentOrigin={location.origin}
      refreshAccess={async () => {
        state.calls.push('access')
        if (state.reactivate) transition('active')
      }}
      download={(file) => state.downloads.push(file)}
      localExport={
        state.local
          ? {
              exportOwnPending: async () =>
                JSON.stringify({
                  format: 'klisteniapp.local-workout-recovery',
                  version: 2,
                  serverConfirmed: false,
                  owner: {
                    accountId: 'member',
                    memberId: 'member',
                    organizationId: 'atlas',
                    branchId: 'atlas-principal',
                  },
                  sessionId: 'session',
                  localContent: { ownerOpaquePendingWork: true },
                  operations: [],
                }),
            }
          : undefined
      }
    >
      <main>
        <h1>Current gym history</h1>
      </main>
    </MembershipAccessBoundary>
  )
}
createRoot(document.getElementById('root')!).render(<Harness />)
