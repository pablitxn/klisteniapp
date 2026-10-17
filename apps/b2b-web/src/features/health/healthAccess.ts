import type { ProductAccess } from '@klisteniapp/b2b-contracts/product-v2'

/** The shell supplies current server-derived access, never a form's claimed role.
 * Change generation on session, host, role, branch or consent invalidation. */
export type HealthAccess = {
  accountId: string
  organizationId: string
  branchId: string
  hostBinding: string
  generation: string
  access: ProductAccess | null
  signal: AbortSignal
}

export function healthAccessKey(context: HealthAccess): string {
  return JSON.stringify([
    context.accountId,
    context.organizationId,
    context.branchId,
    context.hostBinding,
    context.generation,
    context.access,
  ])
}

export function hasHealthCapability(
  context: HealthAccess,
  capability: ProductAccess['capabilities'][number],
): boolean {
  const access = context.access
  return Boolean(
    !context.signal.aborted &&
      context.hostBinding &&
      context.generation &&
      context.branchId &&
      access &&
      access.userId === context.accountId &&
      access.organizationId === context.organizationId &&
      access.capabilities.includes(capability) &&
      (capability === 'export-own-records' || access.accessMode === 'active'),
  )
}

export function canReadTrainerHealth(context: HealthAccess): boolean {
  return (
    hasHealthCapability(context, 'read-consented-health') &&
    context.access?.role === 'coach' &&
    context.access.branches.some(
      (grant) => grant.branchId === context.branchId && grant.role === 'coach',
    )
  )
}
