import { useEffect, useState, useSyncExternalStore } from 'react'
import { b2bClient, watchSessionChange } from '@klisteniapp/b2b-client'
import { createSessionController } from './session-controller.ts'
import { IdSchema, RoleSchema } from '@klisteniapp/b2b-contracts'

export type SessionOptions = { enabled?: boolean }

export function useB2BSession({ enabled = true }: SessionOptions = {}) {
  const [controller] = useState(() =>
    createSessionController({
      me: (signal) => b2bClient.withSignal(signal).me(),
      signOut: () => b2bClient.auth.signOut(),
      readWorkContext: (organizationId, userId) => {
        try {
          const value = JSON.parse(
            sessionStorage.getItem(`klisteni.b2b.work-context.${organizationId}.${userId}`) ??
              'null',
          )
          return value &&
            IdSchema.safeParse(value.branchId).success &&
            RoleSchema.safeParse(value.role).success
            ? { branchId: value.branchId, role: value.role }
            : null
        } catch {
          return null
        }
      },
      writeWorkContext: (organizationId, userId, selection) => {
        try {
          const key = `klisteni.b2b.work-context.${organizationId}.${userId}`
          if (selection) sessionStorage.setItem(key, JSON.stringify(selection))
          else sessionStorage.removeItem(key)
        } catch {
          /* Selection still works when session storage is unavailable. */
        }
      },
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
    setWorkContext: controller.setWorkContext,
    updateOrganization: controller.updateOrganization,
  }
}
