/** A deadline follows elapsed time even when a background tab stops receiving ticks. */
export type RestClock = { remainingMs: number; deadline: number | null }

export function startRest(seconds: number, now: number): RestClock {
  const remainingMs = Math.max(0, seconds * 1000)
  return { remainingMs, deadline: now + remainingMs }
}

export function remainingRest(clock: RestClock, now: number): number {
  return clock.deadline === null ? clock.remainingMs : Math.max(0, clock.deadline - now)
}

export function pauseRest(clock: RestClock, now: number): RestClock {
  return { remainingMs: remainingRest(clock, now), deadline: null }
}

export function resumeRest(clock: RestClock, now: number): RestClock {
  return clock.deadline === null && clock.remainingMs > 0
    ? { ...clock, deadline: now + clock.remainingMs }
    : clock
}

export function formatRest(milliseconds: number): string {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
