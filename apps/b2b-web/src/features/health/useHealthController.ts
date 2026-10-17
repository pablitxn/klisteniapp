import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { healthAccessKey, type HealthAccess } from './healthAccess.ts'
import { bindHealthLifecycle, broadcastHealthInvalidation } from './healthLifecycle.ts'
import { HealthController } from './healthState.ts'

export function useHealthController(context: HealthAccess, memberId?: string) {
  const key = healthAccessKey(context)
  // A new context/target selects a blank store in this render, before effects.
  const controller = useMemo(
    () => new HealthController(context, { invalidateViews: broadcastHealthInvalidation }),
    // The serialized context includes all access claims; signal identity also matters.
    // eslint has no hooks dependency plugin in this repository.
    [key, context.signal, memberId],
  )
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )
  useEffect(() => bindHealthLifecycle(controller, memberId), [controller, memberId])
  return { controller, state }
}
