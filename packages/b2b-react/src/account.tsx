import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { createB2BClient } from '@klisteniapp/b2b-client'

const AccountContext = createContext<string | null>(null)
export function AccountProvider({ userId, children }: { userId: string; children: ReactNode }) {
  return <AccountContext.Provider value={userId}>{children}</AccountContext.Provider>
}
export function useAccountId() {
  const accountId = useContext(AccountContext)
  if (!accountId) throw new Error('Missing account context')
  return accountId
}
export function useAccountClient() {
  const accountId = useAccountId()
  return useMemo(() => createB2BClient(accountId), [accountId])
}
