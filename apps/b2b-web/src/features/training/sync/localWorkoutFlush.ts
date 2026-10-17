export type LocalWorkoutFlushOptions = { retry?: boolean }
export type FlushLocalWorkout = (options?: LocalWorkoutFlushOptions) => Promise<void>

/** Ordinary departure freezes new producers, but never replaces authorization
 * cancellation. The work must reject on any local durability failure. */
export class LocalWorkoutFlush {
  private pending: Promise<void> | null = null
  private cancelled = false
  private frozen = false
  get acceptingEdits() {
    return !this.frozen && !this.cancelled
  }
  cancel() {
    this.cancelled = true
    this.frozen = true
  }
  run(work: () => Promise<void>, isCurrent: () => boolean): Promise<void> {
    if (this.cancelled || !isCurrent())
      return Promise.reject(new DOMException('Departed workout context', 'AbortError'))
    if (this.pending) return this.pending
    this.frozen = true
    const live = () => {
      if (this.cancelled || !isCurrent())
        throw new DOMException('Departed workout context', 'AbortError')
    }
    this.pending = Promise.resolve()
      .then(async () => {
        live()
        await work()
        live()
      })
      .catch((error) => {
        if (!this.cancelled && isCurrent()) this.frozen = false
        this.pending = null
        throw error
      })
    return this.pending
  }
}
