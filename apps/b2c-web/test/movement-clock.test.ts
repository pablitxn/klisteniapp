import assert from 'node:assert/strict'
import test from 'node:test'
import { createMovementClock } from '../src/lib/movement-clock.ts'

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} must equal ${expected}`)
}

test('a demonstration keeps its duration at low frame rates and across complete cycles', () => {
  const clock = createMovementClock(12)
  clock.configure(0, true, 1)
  let phase = 0
  for (const now of [250, 1500, 4000, 6500, 9000]) phase = clock.advance(phase, now)
  close(phase, 0.75)
  close(clock.advance(phase, 27000), 0.25)
})

test('pause, resume and speed changes exclude paused time and preserve a sought phase', () => {
  const clock = createMovementClock(12)
  clock.configure(0, true, 1)
  close(clock.advance(0, 3000), 0.25)
  clock.configure(3000, false, 1)
  close(clock.advance(0.25, 63000), 0.25)
  // Seeking is owned by the viewer; the clock must use the supplied phase.
  close(clock.advance(0.7, 65000), 0.7)
  clock.configure(65000, true, 0.5)
  close(clock.advance(0.7, 67400), 0.8)
  clock.configure(67400, true, 1)
  close(clock.advance(0.8, 69800), 0)
})

test('resetting the frame baseline drops hidden time without modifying the pose', () => {
  const clock = createMovementClock(12)
  clock.configure(1000, true, 1)
  clock.reset(61000)
  close(clock.advance(0.4, 62200), 0.5)
})

test('restarting between slow frames only advances by time since the restart action', () => {
  const clock = createMovementClock(12)
  clock.configure(0, true, 1)
  close(clock.advance(0, 1000), 1 / 12)
  clock.reset(2000)
  close(clock.advance(0, 2100), 0.1 / 12)
})
