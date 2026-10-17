import { useSyncExternalStore } from 'react'
import { NavigationState, type NavigationGuard } from './navigationState'

const indexKey = 'klisteniNavigationIndex'
const snapshot = () => location.pathname + location.search + location.hash
let state: NavigationState | undefined
function browserNavigation() {
  if (state) return state
  const initialIndex = Number.isSafeInteger(history.state?.[indexKey])
    ? (history.state[indexKey] as number)
    : 0
  history.replaceState({ ...history.state, [indexKey]: initialIndex }, '', snapshot())
  let publishedEvent: PopStateEvent | null = null
  const current = new NavigationState(
    { href: snapshot(), index: initialIndex },
    {
      write: (entry, replace) => {
        history[replace ? 'replaceState' : 'pushState'](
          { ...history.state, [indexKey]: entry.index },
          '',
          entry.href,
        )
        // Existing URL-local consumers (including invitation tokens) observe
        // only committed application navigation, never an unflushed intent.
        publishedEvent = new PopStateEvent('popstate', { state: history.state })
        window.dispatchEvent(publishedEvent)
        publishedEvent = null
      },
      restore: (entry, observed) => {
        const delta = entry.index - observed.index
        if (delta) history.go(delta)
        else {
          history.replaceState({ ...history.state, [indexKey]: entry.index }, '', entry.href)
          queueMicrotask(() => void current.pop(entry))
        }
      },
    },
  )
  state = current
  window.addEventListener('popstate', (event) => {
    if (event === publishedEvent) return
    const indexed = Number.isSafeInteger(history.state?.[indexKey])
    let index = indexed ? (history.state[indexKey] as number) : current.entry().index - 1
    const href = snapshot()
    // Native anchors can create null state or clone the previous entry's state.
    // Give new hash entries an index without freezing or remounting the workout.
    const hashMove =
      href !== current.snapshot() && href.split('#')[0] === current.snapshot().split('#')[0]
    if (hashMove && (!indexed || index === current.entry().index)) {
      index = current.entry().index + 1
      history.replaceState({ ...history.state, [indexKey]: index }, '', href)
    } else if (!indexed) {
      history.replaceState({ ...history.state, [indexKey]: index }, '', href)
    }
    void current.pop({ href, index })
  })
  return current
}
export const useLocation = () => {
  const current = browserNavigation()
  return useSyncExternalStore(current.subscribe, current.snapshot)
}

export function registerNavigationGuard(guard: NavigationGuard) {
  return browserNavigation().register(guard)
}

export function navigate(to: string, replace = false, options: { resetView?: boolean } = {}): void {
  const url = new URL(to, location.origin)
  if (url.origin !== location.origin)
    throw new Error('Internal navigation must stay on the same origin')
  void browserNavigation().navigate(
    url.pathname + url.search + url.hash,
    replace,
    options.resetView,
  )
}
