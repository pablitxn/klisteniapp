import assert from 'node:assert/strict'
import test from 'node:test'
import { ProductStreamRetry } from '../src/app/productStreamRetry.ts'
test('admission rejection backs off to bounded attempts instead of retrying each second', () => {
  const retry = new ProductStreamRetry()
  let now = 0,
    attempts = 0
  while (now < 60_000) {
    attempts++
    now += retry.failed(429, null, now)
  }
  assert.ok(attempts <= 7)
  assert.ok(retry.remaining(now - 1) > 0)
  retry.validated()
  assert.equal(retry.remaining(now), 0)
  assert.equal(retry.failed(undefined, null, now), 1000)
})
test('Retry-After dates and seconds survive repeated visibility or online wake-ups', () => {
  const retry = new ProductStreamRetry(),
    now = Date.UTC(2026, 9, 17)
  assert.equal(retry.failed(429, '60', now), 60_000)
  assert.equal(retry.failed(undefined, null, now + 1000), 59_000)
  assert.equal(retry.failed(undefined, null, now + 2000), 58_000)
  for (let elapsed = 0; elapsed < 60_000; elapsed += 1000)
    assert.equal(retry.remaining(now + elapsed), 60_000 - elapsed)
  assert.equal(retry.failed(429, new Date(now + 120_000).toUTCString(), now), 120_000)
  assert.ok(retry.failed(429, 'invalid', now) >= 5000)
})
