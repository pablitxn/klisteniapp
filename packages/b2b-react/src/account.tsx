import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { createB2BClient } from '@klisteniapp/b2b-client'
import type { Role } from '@klisteniapp/b2b-contracts'

type AccountScope = { userId: string; branchId?: string; role?: Role; signal: AbortSignal }
const AccountContext = createContext<AccountScope | null>(null)
export function AccountProvider({
  userId,
  branchId,
  role,
  contextKey = '',
  children,
}: {
  userId: string
  branchId?: string
  role?: Role
  contextKey?: string
  children: ReactNode
}) {
  const scope = useMemo(
    () => ({ userId, branchId, role, controller: new AbortController(), retained: 0 }),
    [userId, branchId, role, contextKey],
  )
  useEffect(() => {
    scope.retained++
    return () => {
      scope.retained--
      // StrictMode replays an effect immediately; only a genuinely departed scope is cancelled.
      queueMicrotask(() => {
        if (scope.retained === 0) scope.controller.abort()
      })
    }
  }, [scope])
  const value = useMemo(
    () => ({ userId, branchId, role, signal: scope.controller.signal }),
    [userId, branchId, role, scope],
  )
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}
export function useAccountId() {
  const account = useContext(AccountContext)
  if (!account) throw new Error('Missing account context')
  return account.userId
}
export function useAccountScope() {
  const account = useContext(AccountContext)
  if (!account) throw new Error('Missing account context')
  return { userId: account.userId, branchId: account.branchId, role: account.role }
}
export function useAccountClient() {
  const account = useContext(AccountContext)
  if (!account) throw new Error('Missing account context')
  return useMemo(
    () =>
      createB2BClient(account.userId, {
        branchId: account.branchId,
        role: account.role,
        contextSignal: account.signal,
      }),
    [account],
  )
}
