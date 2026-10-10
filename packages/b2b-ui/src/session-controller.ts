import type { Me, Organization } from '@klisteniapp/b2b-contracts'
import { ApiError } from './transport.ts'
import { errorMessage } from './messages.ts'

export type SessionState = {
  me: Me | null
  loading: boolean
  error: string
  orgId: string
  dataRefresh: number
}

type SessionClient = {
  me: (signal: AbortSignal) => Promise<Me>
  signOut: () => Promise<unknown>
}

/** Session lifecycle is shared by both apps and testable without rendering React. */
export function createSessionController(client: SessionClient) {
  let state: SessionState = { me: null, loading: true, error: '', orgId: '', dataRefresh: 0 }
  const listeners = new Set<() => void>()
  let active = false
  let signingOut = false
  let generation = 0
  let request: AbortController | null = null

  function patch(value: Partial<SessionState>) {
    state = { ...state, ...value }
    for (const listener of listeners) listener()
  }

  async function refresh(immediate = true): Promise<void> {
    if (!active || signingOut) return
    const current = ++generation
    request?.abort()
    const controller = new AbortController()
    request = controller
    patch(immediate ? { me: null, orgId: '', loading: true, error: '' } : { error: '' })
    try {
      const me = await client.me(controller.signal)
      if (active && current === generation) {
        patch({ me, loading: false, dataRefresh: state.dataRefresh + 1 })
      }
    } catch (error) {
      if (active && current === generation) {
        patch({
          me: null,
          orgId: '',
          loading: false,
          error: error instanceof ApiError && error.status === 401 ? '' : errorMessage(error),
        })
      }
    }
  }

  async function signOut(): Promise<void> {
    if (!active || signingOut) return
    signingOut = true
    const current = ++generation
    request?.abort()
    patch({ loading: true, error: '' })
    try {
      await client.signOut()
      if (active && current === generation) patch({ me: null, orgId: '' })
    } catch (error) {
      if (active && current === generation) patch({ error: errorMessage(error) })
    } finally {
      if (current === generation) {
        signingOut = false
        if (active) patch({ loading: false })
      }
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start() {
      active = true
      return refresh()
    },
    stop() {
      active = false
      signingOut = false
      ++generation
      request?.abort()
    },
    refresh,
    signOut,
    setOrgId(orgId: string) {
      patch({ orgId })
    },
    updateOrganization(organization: Organization) {
      if (!state.me) return
      patch({
        me: {
          ...state.me,
          memberships: state.me.memberships.map((membership) =>
            membership.organization.id === organization.id
              ? { ...membership, organization }
              : membership,
          ),
        },
      })
    },
  }
}
