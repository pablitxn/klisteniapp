import type {
  ProductBootstrap,
  ProductAccess,
  OrganizationRoleV2,
} from '@klisteniapp/b2b-contracts/product-v2'
import type { Me, Organization, Role } from '@klisteniapp/b2b-contracts'
import { ApiError, errorMessage } from '@klisteniapp/b2b-client'

export type SessionState = {
  bootstrap: ProductBootstrap | null
  productAccess: ProductAccess | null
  productRole: OrganizationRoleV2 | ''
  contextSignal: AbortSignal
  me: Me | null
  loading: boolean
  error: string
  orgId: string
  dataRefresh: number
  branchId: string
  workRole: Role | ''
  workContextKey: string
}

type SessionClient = {
  bootstrap?: (signal: AbortSignal) => Promise<ProductBootstrap>
  productAccess?: (
    actor: string,
    organization: string,
    branch: string,
    role: OrganizationRoleV2 | '',
    signal: AbortSignal,
  ) => Promise<ProductAccess>
  me: (signal: AbortSignal) => Promise<Me>
  signOut: () => Promise<unknown>
  readWorkContext?: (
    organizationId: string,
    userId: string,
  ) => { branchId: string; role: Role } | null
  writeWorkContext?: (
    organizationId: string,
    userId: string,
    selection: { branchId: string; role: Role } | null,
  ) => void
}

/** Session lifecycle is shared by all B2B views and testable without rendering React. */
export function createSessionController(client: SessionClient) {
  let authority = new AbortController()
  let state: SessionState = {
    bootstrap: null,
    productAccess: null,
    productRole: '',
    contextSignal: authority.signal,
    me: null,
    loading: true,
    error: '',
    orgId: '',
    dataRefresh: 0,
    branchId: '',
    workRole: '',
    workContextKey: '',
  }
  const listeners = new Set<() => void>()
  let active = false
  let signingOut = false
  let generation = 0
  let request: AbortController | null = null
  let contextRevision = 0

  function patch(value: Partial<SessionState>) {
    state = { ...state, ...value }
    state.workContextKey = state.bootstrap
      ? JSON.stringify([
          state.bootstrap.user.id,
          state.bootstrap.realm.key,
          state.orgId,
          state.branchId,
          state.productRole,
          state.productAccess?.accessRevision,
          state.productAccess?.accessMode,
          contextRevision,
        ])
      : state.me
        ? `${state.me.whiteLabel?.organizationId ?? state.orgId}:${state.me.user.id}:${state.branchId}:${state.workRole}:${contextRevision}`
        : ''
    for (const listener of listeners) listener()
  }

  function invalidateAuthority() {
    authority.abort()
    if (client.bootstrap) ++contextRevision
  }
  async function selectProduct(
    organizationId: string,
    branchId = '',
    role: OrganizationRoleV2 | '' = '',
  ): Promise<boolean> {
    const boot = state.bootstrap
    const membership = boot?.memberships.find((m) => m.organizationId === organizationId)
    if (!boot || !membership || !client.productAccess) return false
    if (
      membership.accessMode === 'active' &&
      !membership.choices.some((c) => c.branchId === branchId && c.role === role)
    )
      return false
    const current = ++generation
    request?.abort()
    invalidateAuthority()
    const controller = new AbortController()
    request = controller
    patch({
      orgId: organizationId,
      branchId,
      productRole: role,
      productAccess: null,
      loading: true,
      error: '',
    })
    try {
      const access = await client.productAccess(
        boot.user.id,
        organizationId,
        branchId,
        role,
        controller.signal,
      )
      if (!active || current !== generation || controller.signal.aborted) return false
      if (
        access.userId !== boot.user.id ||
        access.organizationId !== organizationId ||
        (access.accessMode === 'active' && access.role !== role)
      )
        throw new Error('El contexto autorizado cambió.')
      authority = new AbortController()
      patch({
        productAccess: access,
        contextSignal: authority.signal,
        loading: false,
        dataRefresh: state.dataRefresh + 1,
      })
      return true
    } catch (error) {
      if (active && current === generation)
        patch({ productAccess: null, loading: false, error: errorMessage(error) })
      return false
    }
  }
  async function refresh(immediate = true): Promise<void> {
    if (!active || signingOut) return
    const current = ++generation
    const previous = state
    request?.abort()
    invalidateAuthority()
    const controller = new AbortController()
    request = controller
    patch(
      immediate || state.bootstrap
        ? {
            me: null,
            bootstrap: previous.bootstrap,
            productAccess: null,
            productRole: '',
            orgId: '',
            branchId: '',
            workRole: '',
            loading: true,
            error: '',
          }
        : { error: '' },
    )
    try {
      if (client.bootstrap) {
        const bootstrap = await client.bootstrap(controller.signal)
        if (!active || current !== generation || controller.signal.aborted) return
        if (bootstrap.memberships.some((m) => m.activated) || bootstrap.realm.mode === 'unified') {
          const membership =
            bootstrap.memberships.find((m) => m.organizationId === previous.orgId) ??
            bootstrap.memberships[0]
          patch({
            bootstrap,
            me: null,
            productAccess: null,
            orgId: membership?.organizationId ?? '',
            branchId: '',
            productRole: '',
            loading: false,
          })
          if (membership?.activated) {
            const selected =
              membership.choices.find(
                (c) => c.branchId === previous.branchId && c.role === previous.productRole,
              ) ?? (membership.choices.length === 1 ? membership.choices[0] : undefined)
            if (membership.accessMode === 'export-only' || selected)
              await selectProduct(
                membership.organizationId,
                selected?.branchId ?? '',
                selected?.role ?? '',
              )
          }
          return
        }
      }
      const me = await client.me(controller.signal)
      if (active && current === generation) {
        const access = me.whiteLabel
        const choices =
          access?.branches
            .filter(({ branch }) => branch.status === 'active')
            .flatMap(({ branch, roles }) =>
              roles.map((role) => ({ branchId: branch.id, workRole: role })),
            ) ?? []
        const retained =
          previous.me?.user.id === me.user.id &&
          previous.me.whiteLabel?.organizationId === access?.organizationId
            ? choices.find(
                (choice) =>
                  choice.branchId === previous.branchId && choice.workRole === previous.workRole,
              )
            : undefined
        const stored = access ? client.readWorkContext?.(access.organizationId, me.user.id) : null
        const restored = stored
          ? choices.find(
              (choice) => choice.branchId === stored.branchId && choice.workRole === stored.role,
            )
          : undefined
        const selected = retained ?? restored ?? (choices.length === 1 ? choices[0] : undefined)
        if (access && stored && !restored)
          client.writeWorkContext?.(access.organizationId, me.user.id, null)
        patch({
          me,
          loading: false,
          dataRefresh: state.dataRefresh + 1,
          ...(access
            ? {
                orgId: access.organizationId,
                branchId: selected?.branchId ?? '',
                workRole: selected?.workRole ?? '',
              }
            : {}),
        })
      }
    } catch (error) {
      if (active && current === generation) {
        patch({
          me: null,
          bootstrap: null,
          productAccess: null,
          productRole: '',
          orgId: '',
          branchId: '',
          workRole: '',
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
    invalidateAuthority()
    patch({ loading: true, error: '', productAccess: null })
    try {
      await client.signOut()
      if (state.me?.whiteLabel)
        client.writeWorkContext?.(state.me.whiteLabel.organizationId, state.me.user.id, null)
      if (active && current === generation)
        patch({
          me: null,
          bootstrap: null,
          productAccess: null,
          productRole: '',
          orgId: '',
          branchId: '',
          workRole: '',
        })
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
      invalidateAuthority()
    },
    refresh,
    signOut,
    setProductWorkContext: selectProduct,
    setOrgId(orgId: string) {
      if (state.bootstrap) {
        const membership = state.bootstrap.memberships.find((m) => m.organizationId === orgId)
        if (!membership) return
        ++generation
        request?.abort()
        invalidateAuthority()
        patch({
          orgId,
          branchId: '',
          productRole: '',
          productAccess: null,
          loading: false,
          error: '',
        })
        if (
          membership.activated &&
          (membership.accessMode === 'export-only' || membership.choices.length === 1)
        ) {
          const choice = membership.choices[0]
          void selectProduct(orgId, choice?.branchId ?? '', choice?.role ?? '')
        }
        return
      }
      if (state.me?.whiteLabel && state.me.whiteLabel.organizationId !== orgId) return
      patch({ orgId })
    },
    setWorkContext(branchId: string, role: Role): boolean {
      const access = state.me?.whiteLabel
      const allowed = access?.branches.some(
        ({ branch, roles }) =>
          branch.id === branchId && branch.status === 'active' && roles.includes(role),
      )
      if (!allowed) return false
      if (state.branchId === branchId && state.workRole === role) return true
      ++generation
      ++contextRevision
      request?.abort()
      client.writeWorkContext?.(access!.organizationId, state.me!.user.id, { branchId, role })
      patch({
        branchId,
        workRole: role,
        orgId: access!.organizationId,
        loading: false,
        error: '',
        dataRefresh: state.dataRefresh + 1,
      })
      return true
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
