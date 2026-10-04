export type AccountAccessMode = 'activate' | 'recover' | 'forgot-password'
export type AccountAccessRoute = { mode: AccountAccessMode; token: string; navigationId: number }
let accessSequence = 0

export function accountAccessMode(path: string): AccountAccessMode | null {
  const match = path.match(/^\/account\/(activate|recover|forgot-password)\/?$/)
  return match ? match[1] as AccountAccessMode : null
}

/** Capture once before analytics initializes. Never put this capability in storage. */
function captureAccountAccess(): AccountAccessRoute | null {
  if (typeof window === 'undefined') return null
  const mode = accountAccessMode(window.location.pathname)
  if (!mode) return null
  const params = new URLSearchParams(window.location.hash.slice(1))
  const raw = params.get('token') ?? ''
  const token = mode !== 'forgot-password' && raw.length <= 512 ? raw : ''
  window.history.replaceState(window.history.state, '', `/account/${mode}`)
  return { mode, token, navigationId: ++accessSequence }
}

let access = captureAccountAccess()
export function initialAccountAccess() { return access }
export function readAccountAccessNavigation() {
  // The same hash navigation can dispatch popstate and hashchange. Its token was
  // already removed by the first event; keep that in-memory capture for the second.
  if (!window.location.hash && access?.mode === accountAccessMode(window.location.pathname)) return access
  access = captureAccountAccess()
  return access
}
export function clearAccountAccessToken() { if (access) access = { ...access, token: '' } }
