/** Elapsed time for a visual demonstration; it does not record training or practice. */
export function createMovementClock(durationSeconds: number) {
  let previousTime = 0
  let playing = false
  let speed = 1
  return {
    configure(now: number, nextPlaying: boolean, nextSpeed: number) {
      previousTime = now
      playing = nextPlaying
      speed = nextSpeed
    },
    reset(now: number) { previousTime = now },
    advance(phase: number, now: number) {
      const elapsed = Math.max(0, now - previousTime)
      previousTime = now
      return playing ? (phase + elapsed * speed / (durationSeconds * 1000)) % 1 : phase
    },
  }
}
