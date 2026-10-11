const storageKey = 'klisteni.b2b.auth-change'
const channelName = 'klisteni.b2b.auth'

function openChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(channelName)
  } catch {
    // Cross-tab notifications are optional in restricted browser contexts.
    return null
  }
}

export function broadcastSessionChange(): void {
  try {
    localStorage.setItem(storageKey, crypto.randomUUID())
  } catch {
    // The channel remains independent of storage availability.
  }
  const channel = openChannel()
  try {
    channel?.postMessage('changed')
  } catch {
    // A notification failure must not turn successful authentication into an error.
  } finally {
    channel?.close()
  }
}

export function watchSessionChange(refresh: (immediate: boolean) => void) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  const storage = (event: StorageEvent) => {
    if (event.key === storageKey) refresh(true)
  }
  const visibility = () => {
    if (document.visibilityState === 'visible') refresh(false)
  }
  const channel = openChannel()
  if (channel) channel.onmessage = () => refresh(true)
  const focus = () => refresh(false)
  window.addEventListener('storage', storage)
  window.addEventListener('focus', focus)
  document.addEventListener('visibilitychange', visibility)
  return () => {
    channel?.close()
    window.removeEventListener('storage', storage)
    window.removeEventListener('focus', focus)
    document.removeEventListener('visibilitychange', visibility)
  }
}
