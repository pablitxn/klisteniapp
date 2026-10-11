import { useEffect, useState, useSyncExternalStore } from 'react'
import { b2bClient, watchSessionChange } from '@klisteniapp/b2b-client'
import { createSessionController } from './session-controller.ts'

export type SessionOptions = { enabled?: boolean }

export function useB2BSession({ enabled = true }: SessionOptions = {}) {
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
