import { createProductV2Client } from '@klisteniapp/b2b-client'
import type { HealthAccess } from './healthAccess.ts'

/** Use the frozen validating client. Neither health values nor responses enter
 * a query cache, service worker cache or durable browser store here. */
export function healthClient(context: HealthAccess, signal: AbortSignal) {
  return createProductV2Client(context.accountId, context.organizationId, {
    branchId: context.branchId,
    role: context.access?.role,
    contextSignal: context.signal,
    signal,
  })
}
