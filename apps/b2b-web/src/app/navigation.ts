import { useSyncExternalStore } from 'react'

const subscribe = (listener: () => void) => {
  window.addEventListener('popstate', listener)
  return () => window.removeEventListener('popstate', listener)
}
const snapshot = () => location.pathname + location.search + location.hash
export const useLocation = () => useSyncExternalStore(subscribe, snapshot)

export function navigate(to: string, replace = false): void {
  const url = new URL(to, location.origin)
  if (url.origin !== location.origin)
    throw new Error('Internal navigation must stay on the same origin')
  if (url.pathname + url.search + url.hash === snapshot()) return
  history[replace ? 'replaceState' : 'pushState'](null, '', url.pathname + url.search + url.hash)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
