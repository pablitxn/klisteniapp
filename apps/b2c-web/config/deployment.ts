import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface PublicProfile {
  operatorName: string
  contactEmail: string
  hosting: string
  accountRetention: string
  backupRetention: string
  logRetention: string
  analyticsRetention: string
  emailProvider: string
  updatedAt: string
}
const limits: Record<keyof PublicProfile, number> = {
  operatorName: 120, contactEmail: 254, hosting: 1000, accountRetention: 1000,
  backupRetention: 1000, logRetention: 1000, analyticsRetention: 1000,
  emailProvider: 200, updatedAt: 10,
}
export function parsePublicProfile(input: unknown): PublicProfile {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('The public instance profile must be a JSON object.')
  const value = input as Record<string, unknown>
  if (Object.keys(value).some(key => !Object.hasOwn(limits, key))) throw new Error('The public instance profile contains an unknown field. Supply public disclosure fields only.')
  const profile = {} as PublicProfile
  for (const [key, max] of Object.entries(limits) as [keyof PublicProfile, number][]) {
    const item = value[key]
    if (typeof item !== 'string' || !item.trim() || item.length > max || [...item].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new Error(`Invalid public instance profile field: ${key}.`)
    profile[key] = item.trim()
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(profile.contactEmail)) throw new Error('Invalid public instance contactEmail.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(profile.updatedAt) || !Number.isFinite(Date.parse(`${profile.updatedAt}T00:00:00Z`)) || new Date(`${profile.updatedAt}T00:00:00Z`).toISOString().slice(0, 10) !== profile.updatedAt) throw new Error('Invalid public instance updatedAt; use a calendar date YYYY-MM-DD.')
  return profile
}
export function loadDeployment(env: Record<string, string | undefined>, root: string) {
  const mode = env.VITE_APP_MODE || 'demo'
  if (mode !== 'demo' && mode !== 'instance') throw new Error('VITE_APP_MODE must be demo or instance.')
  if (mode === 'demo') return { instanceMode: false, publicProfile: null }
  const path = env.KLISTENI_PUBLIC_PROFILE_FILE
  if (!path) throw new Error('An instance build requires KLISTENI_PUBLIC_PROFILE_FILE with its public operator profile.')
  let input: unknown
  try { input = JSON.parse(readFileSync(resolve(root, path), 'utf8')) }
  catch { throw new Error('Cannot read the public instance profile JSON. Check KLISTENI_PUBLIC_PROFILE_FILE.') }
  return { instanceMode: true, publicProfile: parsePublicProfile(input) }
}
