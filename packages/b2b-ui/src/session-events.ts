export function watchSessionChange(refresh: (immediate: boolean) => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === 'klisteni.b2b.auth-change') refresh(true)
  }
  const visibility = () => {
    if (document.visibilityState === 'visible') refresh(false)
  }
  const channel =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('klisteni.b2b.auth') : null
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
