import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  b2bClient,
  productBootstrap,
  createProductV2Client,
  watchSessionChange,
} from '@klisteniapp/b2b-client'
import { createSessionController } from './session-controller.ts'
import { IdSchema, RoleSchema } from '@klisteniapp/b2b-contracts'
import { OrganizationRoleV2Schema } from '@klisteniapp/b2b-contracts/product-v2'

export type SessionOptions = { enabled?: boolean }

export function useB2BSession({ enabled = true }: SessionOptions = {}) {
  const [controller] = useState(() =>
    createSessionController({
      readProductWorkContext: (bootstrap) => {
        try {
          const value = JSON.parse(
            sessionStorage.getItem(
              `klisteni.b2b.product-context.${bootstrap.realm.key}.${bootstrap.user.id}`,
            ) ?? 'null',
          )
          return value &&
            IdSchema.safeParse(value.organizationId).success &&
            (value.branchId === '' || IdSchema.safeParse(value.branchId).success) &&
            (value.role === '' || OrganizationRoleV2Schema.safeParse(value.role).success)
            ? value
            : null
        } catch {
          return null
        }
      },
      writeProductWorkContext: (bootstrap, selection) => {
        try {
          const key = `klisteni.b2b.product-context.${bootstrap.realm.key}.${bootstrap.user.id}`
          if (selection) sessionStorage.setItem(key, JSON.stringify(selection))
          else sessionStorage.removeItem(key)
        } catch {
          /* A preference is optional and never grants access. */
        }
      },
      bootstrap: (signal) => productBootstrap({ signal }),
      productAccess: (actor, org, branch, role, signal) =>
        createProductV2Client(actor, org, {
          branchId: branch || undefined,
          role: role || undefined,
          signal,
        }).call('access', {}),
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
    revalidateProduct: controller.revalidateProduct,
    signOut: controller.signOut,
    setOrgId: controller.setOrgId,
    setWorkContext: controller.setWorkContext,
    setProductWorkContext: controller.setProductWorkContext,
    updateOrganization: controller.updateOrganization,
  }
}
