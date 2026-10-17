import { ProductAccessSchema, type ProductAccess } from '@klisteniapp/b2b-contracts/product-v2'
import type { MembershipIdentity } from './restrictedAccess.ts'

/** WP09 owns storage and payloads. INTEGRATION binds its published function:
 * exportOwnerLocalWorkout(store, { scope, access, signal }, sessionId).
 * This seam cannot inspect or replay the store and preserves the returned bytes. */
export type OwnerLocalExportAdapter = {
  exportOwnPending(context: {
    identity: MembershipIdentity
    access: ProductAccess
    signal: AbortSignal
  }): Promise<string | null>
}

export async function ownerLocalDownload(
  adapter: OwnerLocalExportAdapter,
  identity: MembershipIdentity,
  access: ProductAccess,
  signal: AbortSignal,
) {
  if (signal.aborted) throw new Error('Local export context changed')
  const current = ProductAccessSchema.parse(access)
  if (
    current.userId !== identity.userId ||
    current.organizationId !== identity.organizationId ||
    !current.capabilities.includes('export-own-records')
  )
    throw new Error('Local export context changed')
  const json = await adapter.exportOwnPending({ identity, access: current, signal })
  if (signal.aborted) throw new Error('Local export context changed')
  if (json === null) return null
  // Check only WP09's published envelope labels and owner, never store fields.
  const envelope = JSON.parse(json)
  if (
    envelope?.format !== 'klisteniapp.local-workout-recovery' ||
    envelope.version !== 2 ||
    envelope.serverConfirmed !== false ||
    envelope.owner?.accountId !== identity.userId ||
    envelope.owner?.memberId !== identity.userId ||
    envelope.owner?.organizationId !== identity.organizationId ||
    typeof envelope.owner?.branchId !== 'string' ||
    typeof envelope.sessionId !== 'string'
  )
    throw new Error('Local export identity mismatch')
  return { filename: 'klisteni-local-workout-recovery-v2.json', json }
}
