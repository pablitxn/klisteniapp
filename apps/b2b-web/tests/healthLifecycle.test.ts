import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bindHealthLifecycle,
  broadcastHealthInvalidation,
  HEALTH_INVALIDATION_EVENT,
} from '../src/features/health/healthLifecycle.ts'
import { healthRecordFields } from '../src/features/health/healthRecord.ts'
import { deferred, fixture, projection } from './healthFixture.ts'

test('browser lifecycle clears pending responses on cross-tab invalidation, focus loss, offline and cleanup without persisting health', async () => {
  const original = Object.fromEntries(
    [
      'window',
      'document',
      'navigator',
      'BroadcastChannel',
      'localStorage',
      'indexedDB',
      'caches',
    ].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  )
  const intervals = new Map<number, () => void>()
  let nextTimer = 0
  const windowTarget = Object.assign(new EventTarget(), {
    setInterval: (fn: () => void) => {
      intervals.set(++nextTimer, fn)
      return nextTimer
    },
    clearInterval: (id: number) => {
      intervals.delete(id)
    },
  })
  const documentTarget = Object.assign(new EventTarget(), {
    visibilityState: 'visible',
    hasFocus: () => true,
  })
  const navigatorTarget = { onLine: true }
  class Channel {
    static open = new Set<Channel>()
    static messages: unknown[] = []
    name: string
    onmessage: ((event: { data: unknown }) => void) | null = null
    constructor(name: string) {
      this.name = name
      Channel.open.add(this)
    }
    postMessage(data: unknown) {
      Channel.messages.push(data)
      for (const channel of Channel.open)
        if (channel !== this && channel.name === this.name) channel.onmessage?.({ data })
    }
    close() {
      Channel.open.delete(this)
    }
  }
  Object.defineProperties(globalThis, {
    window: { value: windowTarget, configurable: true },
    document: { value: documentTarget, configurable: true },
    navigator: { value: navigatorTarget, configurable: true },
    BroadcastChannel: { value: Channel, configurable: true },
    localStorage: {
      get: () => {
        throw new Error('Health must not read or write storage')
      },
      configurable: true,
    },
    indexedDB: {
      get: () => {
        throw new Error('Health must not persist projections')
      },
      configurable: true,
    },
    caches: {
      get: () => {
        throw new Error('Health must not cache projections')
      },
      configurable: true,
    },
  })
  const late = deferred<typeof projection>()
  const { controller, handlers, calls } = fixture(true, { consentedHealth: () => late.promise })
  let cleanup: (() => void) | undefined
  try {
    cleanup = bindHealthLifecycle(controller, 'owner')
    assert.equal(calls.length, 1)
    const remote = new Channel('klisteni-b2b-health-invalidation-v1')
    remote.postMessage('invalidate')
    remote.close()
    assert.equal(calls[0].signal.aborted, true)
    late.resolve(projection)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(controller.getSnapshot().trainer, null)
    handlers.consentedHealth = () => structuredClone(projection)
    windowTarget.dispatchEvent(new Event('focus'))
    await new Promise((resolve) => setImmediate(resolve))
    assert.ok(controller.getSnapshot().trainer)
    broadcastHealthInvalidation()
    assert.equal(controller.getSnapshot().trainer, null)
    assert.deepEqual(Channel.messages, ['invalidate', 'invalidate'])
    windowTarget.dispatchEvent(new Event('focus'))
    await new Promise((resolve) => setImmediate(resolve))
    windowTarget.dispatchEvent(new Event('blur'))
    const count = calls.length
    for (const interval of intervals.values()) interval()
    assert.equal(calls.length, count, 'background polling must never remount a blurred view')
    assert.equal(controller.getSnapshot().trainer, null)
    navigatorTarget.onLine = false
    windowTarget.dispatchEvent(new Event('offline'))
    windowTarget.dispatchEvent(new Event('focus'))
    assert.equal(calls.length, count)
    navigatorTarget.onLine = true
    windowTarget.dispatchEvent(new Event('online'))
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(calls.length, count + 1)
    assert.ok(controller.getSnapshot().trainer)
    documentTarget.visibilityState = 'hidden'
    documentTarget.dispatchEvent(new Event('visibilitychange'))
    assert.equal(controller.getSnapshot().trainer, null)
    const owner = fixture()
    const stopOwner = bindHealthLifecycle(owner.controller)
    try {
      documentTarget.visibilityState = 'visible'
      documentTarget.dispatchEvent(new Event('visibilitychange'))
      await new Promise((resolve) => setImmediate(resolve))
      assert.equal(owner.controller.getSnapshot().own?.revision, 3)
      const ownerCalls = owner.calls.length
      windowTarget.dispatchEvent(new Event('blur'))
      windowTarget.dispatchEvent(new Event('focus'))
      assert.equal(
        owner.calls.length,
        ownerCalls,
        'native file picker focus must not reset the owner workflow',
      )
      assert.equal(owner.controller.getSnapshot().own?.revision, 3)
    } finally {
      stopOwner()
    }
    cleanup()
    cleanup = undefined
    assert.equal(intervals.size, 0)
    assert.equal(Channel.open.size, 0)
    windowTarget.dispatchEvent(new Event(HEALTH_INVALIDATION_EVENT))
  } finally {
    cleanup?.()
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})

test('record presentation retains original units and provenance without exposing technical IDs or inferring missing values', () => {
  const record = {
    ...projection.categories[0].records[0],
    weightKg: 70,
    taken: false,
    dose: 10,
    unit: 'mg',
    source: {
      kind: 'manual' as const,
      externalId: 'private-provider-id',
      device: 'Synthetic device',
    },
  }
  const fields = healthRecordFields(record)
  assert.ok(fields.some((f) => f.label === 'Peso (kg)' && f.value === '70'))
  assert.ok(fields.some((f) => f.label === 'Tomado' && f.value === 'No'))
  assert.ok(fields.some((f) => f.label === 'Dosis registrada' && f.value === '10 mg'))
  assert.equal(
    fields.some((f) => f.value === 'private-provider-id'),
    false,
  )
  assert.equal(
    fields.some((f) => f.label.includes('Frecuencia cardíaca')),
    false,
  )
})
