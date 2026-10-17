import {
  B2CInvitationSchema,
  ProductAccessSchema,
  type ProductAccess,
} from '@klisteniapp/b2b-contracts/product-v2'

export type MembershipIdentity = Readonly<{ userId: string; organizationId: string }>

/** Presentation gate only. The server must authorize every request separately. */
export function membershipMode(
  identity: MembershipIdentity,
  value: unknown,
  revalidating = false,
): 'checking' | 'denied' | 'restricted' | 'active' {
  if (revalidating || value === null) return 'checking'
  const parsed = ProductAccessSchema.safeParse(value)
  if (!parsed.success) return 'denied'
  const access = parsed.data
  if (access.userId !== identity.userId || access.organizationId !== identity.organizationId)
    return 'denied'
  if (access.accessMode === 'export-only')
    return access.branches.length === 0 && access.capabilities.includes('export-own-records')
      ? 'restricted'
      : 'denied'
  return 'active'
}

export function membershipKey(identity: MembershipIdentity, access: ProductAccess): string {
  return JSON.stringify([identity.userId, identity.organizationId, access.accessRevision])
}

/** No tokens, transfer parameters, same-product destinations or script URLs. */
export function invitationDestination(value: unknown, currentOrigin: string): string | null {
  const invitation = B2CInvitationSchema.parse(value)
  if (!invitation.url) return null
  const url = new URL(invitation.url)
  if (
    url.origin === new URL(currentOrigin).origin ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid separate-product destination')
  return url.href
}

/** Invalidated contexts cannot publish late downloads or refresh results. */
export function createActionScope(signal: AbortSignal) {
  let busy = false
  let disposed = false
  return {
    dispose() {
      disposed = true
    },
    async run<T>(work: () => Promise<T>, publish: (value: T) => void): Promise<boolean> {
      if (busy || disposed || signal.aborted) return false
      busy = true
      try {
        const value = await work()
        if (disposed || signal.aborted) return false
        publish(value)
        return true
      } finally {
        busy = false
      }
    },
  }
}
