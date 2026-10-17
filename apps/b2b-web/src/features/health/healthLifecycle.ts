import { watchSessionChange } from '@klisteniapp/b2b-client'
import type { HealthController } from './healthState.ts'

export const HEALTH_INVALIDATION_EVENT = 'klisteni:b2b-health-invalidated'
const CHANNEL = 'klisteni-b2b-health-invalidation-v1'

function openChannel() {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL)
  } catch {
    return null
  }
}

/** Invalidation carries no health, identity or consent payload and persists nothing. */
export function broadcastHealthInvalidation() {
  window.dispatchEvent(new Event(HEALTH_INVALIDATION_EVENT))
  const channel = openChannel()
  try {
    channel?.postMessage('invalidate')
  } catch {
    // Focus/reconnect and periodic server checks remain available. Immediate
    // cross-device invalidation requires the shell's authority event stream.
  } finally {
    channel?.close()
  }
}

/** Remote consent/authority events must also reach the injected context signal
 * or this event. Polling is a bounded freshness fallback, not a push guarantee. */
export function bindHealthLifecycle(controller: HealthController, memberId?: string) {
  controller.start()
  let focused = document.hasFocus()
  let mountedPage = true
  const environment = () =>
    controller.setEnvironment(
      navigator.onLine,
      mountedPage && (!memberId || focused) && document.visibilityState === 'visible',
    )
  const refresh = () => {
    environment()
    if (
      navigator.onLine &&
      mountedPage &&
      (!memberId || focused) &&
      document.visibilityState === 'visible'
    ) {
      if (memberId) void controller.loadTrainer(memberId)
      else void controller.loadOwner()
    }
  }
  const hide = () => controller.hide()
  const blur = () => {
    focused = false
    environment()
  }
  const focus = () => {
    focused = true
    // Native file pickers can blur/refocus the owner window. Keep a reviewed
    // import intact; trainer projections always require a new online read.
    if (memberId) refresh()
    else environment()
  }
  const pagehide = () => {
    mountedPage = false
    environment()
  }
  const pageshow = () => {
    mountedPage = true
    focused = document.hasFocus()
    refresh()
  }
  const visibility = () => {
    if (document.visibilityState === 'visible') refresh()
    else environment()
  }
  const invalidate = () => {
    if (memberId) hide()
  }
  const unwatchSession = watchSessionChange((immediate) => {
    if (immediate) hide()
  })
  const channel = openChannel()
  if (channel)
    channel.onmessage = (event) => {
      if (event.data === 'invalidate') invalidate()
    }
  window.addEventListener('offline', environment)
  window.addEventListener('online', refresh)
  window.addEventListener('blur', blur)
  window.addEventListener('focus', focus)
  window.addEventListener('pagehide', pagehide)
  window.addEventListener('pageshow', pageshow)
  window.addEventListener(HEALTH_INVALIDATION_EVENT, invalidate)
  document.addEventListener('visibilitychange', visibility)
  // Each check first hides data, so a failure never leaves a stale projection.
  const timer = memberId ? window.setInterval(refresh, 15_000) : null
  refresh()
  return () => {
    if (timer !== null) window.clearInterval(timer)
    channel?.close()
    unwatchSession()
    window.removeEventListener('offline', environment)
    window.removeEventListener('online', refresh)
    window.removeEventListener('blur', blur)
    window.removeEventListener('focus', focus)
    window.removeEventListener('pagehide', pagehide)
    window.removeEventListener('pageshow', pageshow)
    window.removeEventListener(HEALTH_INVALIDATION_EVENT, invalidate)
    document.removeEventListener('visibilitychange', visibility)
    controller.stop()
  }
}
