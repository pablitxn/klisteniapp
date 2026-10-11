import type { AccountAccess } from './account-api'

export function cloudWriteAllowed(access: AccountAccess | null) {
  if (!access) return true // The server still authorizes every write if status is temporarily unavailable.
  if (!access.cloudWrite) return false
  const until = access.status === 'trial' ? access.trialEndsAt : access.status === 'active' ? access.paidThrough : null
  return !until || Date.parse(until) > Date.now()
}
