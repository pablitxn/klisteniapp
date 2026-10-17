export type NavigationEntry = { href: string; index: number }
export type NavigationGuard = {
  signal: AbortSignal
  beforeLeave: () => Promise<void>
  departed: () => void
  failed: (error: unknown) => void
}
type Intent = { entry: NavigationEntry; kind: 'push' | 'replace' | 'pop'; reset: boolean }
type Ticket = { guard: NavigationGuard; intent: Intent; promise: Promise<boolean> }
type NavigationHost = {
  write: (entry: NavigationEntry, replace: boolean) => void
  restore: (entry: NavigationEntry, observed: NavigationEntry) => void
}
const page = (href: string) => href.split('#')[0]

/** Publish a route only after its current editor has durably left. Native history
 * moves first; a failed barrier restores the original indexed entry, not its URL. */
export class NavigationState {
  private current: NavigationEntry
  private observed: NavigationEntry
  private guard: NavigationGuard | null = null
  private pending: Ticket | null = null
  private restoring: { entry: NavigationEntry; done: () => void; promise: Promise<void> } | null =
    null
  private listeners = new Set<() => void>()
  private epoch = 0
  private readonly host: NavigationHost
  constructor(initial: NavigationEntry, host: NavigationHost) {
    this.current = this.observed = initial
    this.host = host
  }
  entry = () => this.current
  snapshot = () => this.current.href
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  register(guard: NavigationGuard) {
    this.cancelPending()
    this.guard = guard
    const cancel = () => {
      if (this.guard === guard) this.cancelPending()
    }
    guard.signal.addEventListener('abort', cancel, { once: true })
    return () => {
      guard.signal.removeEventListener('abort', cancel)
      if (this.guard !== guard) return
      this.cancelPending()
      this.guard = null
    }
  }
  navigate(href: string, replace = false, reset = false): Promise<boolean> {
    if (this.restoring) {
      const epoch = this.epoch
      return this.restoring.promise.then(() =>
        this.epoch === epoch ? this.navigate(href, replace, reset) : false,
      )
    }
    if (href === this.current.href && !reset) return Promise.resolve(false)
    return this.request({
      entry: { href, index: this.current.index + (replace ? 0 : 1) },
      kind: replace ? 'replace' : 'push',
      reset,
    })
  }
  pop(entry: NavigationEntry): Promise<boolean> {
    this.observed = entry
    if (this.restoring) {
      if (entry.index === this.restoring.entry.index && entry.href === this.restoring.entry.href) {
        const restoration = this.restoring
        this.restoring = null
        restoration.done()
      } else this.host.restore(this.restoring.entry, entry)
      return Promise.resolve(false)
    }
    return this.request({ entry, kind: 'pop', reset: false })
  }
  private restore() {
    if (this.observed.index === this.current.index && this.observed.href === this.current.href)
      return
    if (this.restoring) return
    if (!this.restoring) {
      let done!: () => void
      const promise = new Promise<void>((resolve) => {
        done = resolve
      })
      this.restoring = { entry: this.current, done, promise }
    }
    this.host.restore(this.current, this.observed)
  }
  private cancelPending() {
    this.epoch++
    this.pending = null
    this.restore()
  }
  private commit(intent: Intent, guard?: NavigationGuard) {
    if (intent.kind !== 'pop') {
      // Explicit same-view section navigation resets the visit without adding a
      // duplicate history entry. A hash-only move never freezes the editor.
      if (intent.entry.href !== this.current.href)
        this.host.write(intent.entry, intent.kind === 'replace')
      else intent.entry = this.current
    }
    this.current = this.observed = intent.entry
    guard?.departed()
    for (const listener of this.listeners) listener()
  }
  private request(intent: Intent): Promise<boolean> {
    if (this.pending) {
      // Native Back/Forward already moved the browser; one flush serves the most
      // recent native target. Repeated application clicks keep the first intent.
      if (intent.kind === 'pop') this.pending.intent = intent
      return this.pending.promise
    }
    const guard = this.guard
    if (guard?.signal.aborted) {
      this.restore()
      return Promise.resolve(false)
    }
    if (!guard || (!intent.reset && page(intent.entry.href) === page(this.current.href))) {
      this.commit(intent)
      return Promise.resolve(true)
    }
    const ticket: Ticket = { guard, intent, promise: Promise.resolve(false) }
    this.pending = ticket
    ticket.promise = Promise.resolve()
      .then(() => {
        if (this.pending !== ticket || this.guard !== guard || guard.signal.aborted)
          throw new DOMException('Departed navigation context', 'AbortError')
        return guard.beforeLeave()
      })
      .then(() => {
        if (this.pending !== ticket || this.guard !== guard || guard.signal.aborted) return false
        this.pending = null
        this.commit(ticket.intent, guard)
        return true
      })
      .catch((error: unknown) => {
        if (this.pending !== ticket || this.guard !== guard || guard.signal.aborted) return false
        this.pending = null
        this.restore()
        guard.failed(error)
        return false
      })
    return ticket.promise
  }
}
