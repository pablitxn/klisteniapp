import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatRest,
  pauseRest,
  remainingRest,
  resumeRest,
  startRest,
} from '../src/features/training/restClock.ts'

test('rest deadlines track real elapsed time after background throttling without ticks', () => {
  const clock = startRest(90, 10_000)
  assert.equal(remainingRest(clock, 10_000), 90_000)
  assert.equal(remainingRest(clock, 47_400), 52_600)
  assert.equal(remainingRest(clock, 120_000), 0)
  assert.equal(formatRest(52_600), '0:53')
  assert.equal(formatRest(90_000), '1:30')
})

test('pausing retains the actual remaining duration and excludes paused time on resume', () => {
  const paused = pauseRest(startRest(60, 1_000), 16_750)
  assert.equal(remainingRest(paused, 50_000), 44_250)
  const resumed = resumeRest(paused, 100_000)
  assert.equal(remainingRest(resumed, 110_000), 34_250)
  assert.equal(resumeRest(resumed, 150_000), resumed)
  const ended = pauseRest(resumed, 200_000)
  assert.equal(ended.remainingMs, 0)
  assert.equal(resumeRest(ended, 300_000), ended)
})
