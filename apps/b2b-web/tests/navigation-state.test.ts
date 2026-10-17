import assert from 'node:assert/strict'
import test from 'node:test'
import { NavigationState, type NavigationEntry } from '../src/app/navigationState.ts'

function deferred() {
  let resolve!: () => void, reject!: (reason: unknown) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function fixture() {
  const entries = ['/public', '/app?view=history', '/app?view=health'].map((href, index) => ({
    href,
    index,
  }))
  let position = 1
  const writes: NavigationEntry[] = [],
    restores: number[] = []
  const state = new NavigationState(entries[position], {
    write(entry, replace) {
      if (replace) entries[position] = entry
      else entries.splice(++position, entries.length, entry)
      writes.push(entry)
    },
    restore(entry, observed) {
      restores.push(entry.index - observed.index)
      position = entries.findIndex((value) => value.index === entry.index)
      queueMicrotask(() => void state.pop(entries[position]))
    },
  })
  const native = (index: number) => {
    position = index
    return state.pop(entries[position])
  }
  return { state, entries, writes, restores, native, visible: () => entries[position] }
}
function install(state: NavigationState, flush: () => Promise<void>) {
  const controller = new AbortController()
  let commits = 0
  const failures: unknown[] = []
  const off = state.register({
    signal: controller.signal,
    beforeLeave: flush,
    departed: () => commits++,
    failed: (error) => failures.push(error),
  })
  return { controller, off, commits: () => commits, failures }
}

test('ordinary navigation awaits durability and coalesces repeated clicks to one departure', async () => {
  const f = fixture(),
    gate = deferred()
  let calls = 0
  const owner = install(f.state, () => {
    calls++
    return gate.promise
  })
  const first = f.state.navigate('/app?view=health')
  assert.equal(f.state.navigate('/public'), first)
  await Promise.resolve()
  assert.equal(calls, 1)
  assert.equal(f.state.snapshot(), '/app?view=history')
  assert.equal(f.writes.length, 0)
  gate.resolve()
  assert.equal(await first, true)
  assert.equal(f.state.snapshot(), '/app?view=health')
  assert.equal(owner.commits(), 1)
  assert.equal(f.writes.length, 1)
})
test('a failed local flush retains the route and permits an explicit later retry', async () => {
  const f = fixture(),
    gate = deferred()
  let result = gate.promise
  const owner = install(f.state, () => result)
  const pending = f.state.navigate('/public')
  gate.reject(new Error('Local quota failure'))
  assert.equal(await pending, false)
  assert.equal(f.state.snapshot(), '/app?view=history')
  assert.equal(owner.commits(), 0)
  assert.equal(owner.failures.length, 1)
  result = Promise.resolve()
  assert.equal(await f.state.navigate('/public'), true)
})
test('failed Back restores the original history entry without replacing either entry', async () => {
  const f = fixture(),
    gate = deferred(),
    original = structuredClone(f.entries)
  install(f.state, () => gate.promise)
  const pending = f.native(0)
  assert.equal(f.visible().href, '/public')
  assert.equal(f.state.snapshot(), '/app?view=history')
  gate.reject(new Error('Pointer failed'))
  assert.equal(await pending, false)
  await Promise.resolve()
  assert.deepEqual(f.restores, [1])
  assert.deepEqual(f.entries, original)
  assert.equal(f.visible().href, f.state.snapshot())
  assert.equal(f.writes.length, 0)
})
test('rapid native Back and Forward share one flush and publish the latest native destination', async () => {
  const f = fixture(),
    gate = deferred()
  let calls = 0
  const owner = install(f.state, () => {
    calls++
    return gate.promise
  })
  const pending = f.native(0)
  assert.equal(f.native(2), pending)
  await Promise.resolve()
  gate.resolve()
  assert.equal(await pending, true)
  assert.equal(calls, 1)
  assert.equal(owner.commits(), 1)
  assert.equal(f.state.snapshot(), '/app?view=health')
  assert.equal(f.visible().href, f.state.snapshot())
})
test('revocation cancels a pending route immediately and stale completion cannot navigate a new owner', async () => {
  const f = fixture(),
    gate = deferred()
  const old = install(f.state, () => gate.promise)
  const pending = f.native(0)
  await Promise.resolve()
  old.controller.abort()
  const next = install(f.state, async () => {})
  await Promise.resolve()
  assert.equal(await f.state.navigate('/new-owner'), true)
  gate.resolve()
  assert.equal(await pending, false)
  assert.equal(old.commits(), 0)
  assert.equal(next.commits(), 1)
  assert.equal(f.state.snapshot(), '/new-owner')
  assert.deepEqual(f.restores, [1])
})

test('a request queued during history restoration cannot enter a replacement account', async () => {
  const initial = { href: '/app?view=history', index: 1 }
  let restores = 0
  const state = new NavigationState(initial, {
    write() {
      assert.fail('Stale restoration request must not write history')
    },
    restore() {
      restores++
    },
  })
  const owner = install(state, async () => {
    throw new Error('Pointer failed')
  })
  assert.equal(await state.pop({ href: '/', index: 0 }), false)
  const queued = state.navigate('/old-context-target')
  owner.controller.abort()
  const next = install(state, async () => {})
  await state.pop(initial)
  assert.equal(await queued, false)
  assert.equal(next.commits(), 0)
  assert.equal(restores, 1)
  assert.equal(state.snapshot(), initial.href)
})
test('replacement before flush starts skips stale work and old unregister cannot remove its successor', async () => {
  const f = fixture()
  let calls = 0
  const old = install(f.state, async () => {
    calls++
  })
  const pending = f.state.navigate('/old-target')
  const next = install(f.state, async () => {})
  old.off()
  assert.equal(await pending, false)
  assert.equal(calls, 0)
  assert.equal(await f.state.navigate('/new-target'), true)
  assert.equal(next.commits(), 1)
})
test('no-op and hash navigation retain the editor; explicit same-view reset flushes without duplicate history', async () => {
  const f = fixture()
  let calls = 0
  const owner = install(f.state, async () => {
    calls++
  })
  assert.equal(await f.state.navigate('/app?view=history'), false)
  assert.equal(await f.state.navigate('/app?view=history#notes'), true)
  assert.equal(calls, 0)
  assert.equal(owner.commits(), 0)
  const before = f.entries.length
  assert.equal(await f.state.navigate('/app?view=history#notes', false, true), true)
  assert.equal(calls, 1)
  assert.equal(owner.commits(), 1)
  assert.equal(f.entries.length, before)
})
