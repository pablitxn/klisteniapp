import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ProductStreamGuard } from '../src/app/productStreamGuard.ts'
import { healthClient } from '../src/features/health/healthClient.ts'

test('workspace transport aborts immediately on disconnect and requires a new validated lifetime', () => {
  const guard = new ProductStreamGuard()
  assert.throws(() => guard.requestSignal(), { name: 'AbortError' })
  guard.activate()
  const pending = guard.requestSignal()
  guard.suspend()
  assert.equal(pending.aborted, true)
  assert.throws(() => guard.requestSignal(), { name: 'AbortError' })
  guard.activate()
  assert.notEqual(guard.requestSignal(), pending)
  assert.equal(guard.requestSignal().aborted, false)
})

test('suspended product client calls reject asynchronously without issuing requests', async () => {
  const guard = new ProductStreamGuard()
  const client = healthClient(
    {
      accountId: 'actor',
      organizationId: 'gym',
      branchId: 'branch',
      hostBinding: 'realm',
      generation: 'scope',
      access: null,
      signal: new AbortController().signal,
      requestSignal: () => guard.requestSignal(),
    },
    new AbortController().signal,
  )
  let pending: Promise<unknown> | undefined
  assert.doesNotThrow(() => {
    pending = client.call('ownHealth', {})
  })
  await assert.rejects(pending!, { name: 'AbortError' })
})
