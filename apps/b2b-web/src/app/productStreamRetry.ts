/** One retry deadline per authorized stream lifetime. Browser visibility/online
 * events may wake a connection, but cannot bypass admission backoff. */
export class ProductStreamRetry {
  private failures = 0
  private deadline = 0
  remaining(now = Date.now()) {
    return Math.max(0, this.deadline - now)
  }
  failed(status?: number, retryAfter: string | null = null, now = Date.now()) {
    const base = Math.min(30_000, 1000 * 2 ** Math.min(this.failures++, 5))
    const seconds =
      retryAfter !== null && /^\d+(?:\.\d+)?$/.test(retryAfter.trim())
        ? Number(retryAfter) * 1000
        : null
    const date = retryAfter !== null && seconds === null ? Date.parse(retryAfter) - now : NaN
    const requested = seconds ?? (Number.isFinite(date) ? date : 0)
    const delay = Math.max(base, status === 429 ? 5000 : 0, requested)
    this.deadline = Math.max(this.deadline, now + Math.min(delay, 2_147_483_647))
    return this.remaining(now)
  }
  validated() {
    this.failures = 0
    this.deadline = 0
  }
}
