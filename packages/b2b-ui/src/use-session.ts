import { useEffect, useState, useSyncExternalStore } from 'react'
import { b2bClient } from './client.ts'
import { createSessionController } from './session-controller.ts'
import { watchSessionChange } from './session-events.ts'

export function useB2BSession({ enabled = true }: { enabled?: boolean } = {}) {
  const [controller] = useState(() =>
    createSessionController({
      me: (signal) => b2bClient.withSignal(signal).me(),
      signOut: () => b2bClient.auth.signOut(),
    }),
  )
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)

  useEffect(() => {
    if (!enabled) return
    void controller.start()
    const unwatch = watchSessionChange((immediate) => {
      void controller.refresh(immediate)
    })
    return () => {
      unwatch()
      controller.stop()
    }
  }, [controller, enabled])

  return {
    ...state,
    loading: enabled && state.loading,
    refresh: controller.refresh,
    signOut: controller.signOut,
    setOrgId: controller.setOrgId,
    updateOrganization: controller.updateOrganization,
  }
}
