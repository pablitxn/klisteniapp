import assert from 'node:assert/strict'
import test from 'node:test'
import { LocalWorkoutFlush } from '../src/features/training/sync/localWorkoutFlush.ts'
const gate = () => {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
test('ordinary local departure freezes new producers and coalesces the complete durability barrier', async () => {
  const lifecycle = new LocalWorkoutFlush(),
    write = gate(),
    pointer = gate(),
    events: string[] = []
  const flush = lifecycle.run(
    async () => {
      await write.promise
      events.push('write')
      await pointer.promise
      events.push('pointer')
    },
    () => true,
  )
  assert.equal(lifecycle.acceptingEdits, false)
  assert.equal(
    lifecycle.run(
      async () => {
        throw new Error('must coalesce')
      },
      () => true,
    ),
    flush,
  )
  write.release()
  await Promise.resolve()
  await Promise.resolve()
  assert.deepEqual(events, ['write'])
  pointer.release()
  await flush
  assert.deepEqual(events, ['write', 'pointer'])
  assert.equal(lifecycle.acceptingEdits, false)
})
test('a failed local barrier rejects every waiter and reopens only the same live context for an explicit retry', async () => {
  const lifecycle = new LocalWorkoutFlush()
  const failure = new DOMException('Synthetic quota', 'QuotaExceededError')
  const flush = lifecycle.run(
    async () => {
      throw failure
    },
    () => true,
  )
  const second = lifecycle.run(
    async () => {},
    () => true,
  )
  await assert.rejects(flush, (e) => e === failure)
  await assert.rejects(second, (e) => e === failure)
  assert.equal(lifecycle.acceptingEdits, true)
  let retry = false
  await lifecycle.run(
    async () => {
      retry = true
    },
    () => true,
  )
  assert.equal(retry, true)
})
test('cancellation during a held write cannot turn into a successful close or reopen editing', async () => {
  const lifecycle = new LocalWorkoutFlush(),
    write = gate()
  let closed = false
  const flush = lifecycle.run(
    async () => {
      await write.promise
    },
    () => true,
  )
  const completion = flush.then(() => {
    closed = true
  })
  lifecycle.cancel()
  write.release()
  await assert.rejects(completion, { name: 'AbortError' })
  assert.equal(closed, false)
  assert.equal(lifecycle.acceptingEdits, false)
  await assert.rejects(
    lifecycle.run(
      async () => {},
      () => true,
    ),
    { name: 'AbortError' },
  )
})
test('a changed identity is checked after the final pointer, even when no cleanup has run yet', async () => {
  const lifecycle = new LocalWorkoutFlush(),
    pointer = gate()
  let current = true,
    closed = false
  const flush = lifecycle
    .run(
      async () => {
        await pointer.promise
      },
      () => current,
    )
    .then(() => {
      closed = true
    })
  await Promise.resolve()
  current = false
  pointer.release()
  await assert.rejects(flush, { name: 'AbortError' })
  assert.equal(closed, false)
  assert.equal(lifecycle.acceptingEdits, false)
})
test('an already departed context cannot run local work', async () => {
  const lifecycle = new LocalWorkoutFlush()
  let writes = 0
  await assert.rejects(
    lifecycle.run(
      async () => {
        writes++
      },
      () => false,
    ),
    { name: 'AbortError' },
  )
  assert.equal(writes, 0)
})

test('a retained successful flush cannot authorize a departure after identity changes', async () => {
  const lifecycle = new LocalWorkoutFlush()
  let current = true
  await lifecycle.run(
    async () => {},
    () => current,
  )
  current = false
  await assert.rejects(
    lifecycle.run(
      async () => {},
      () => current,
    ),
    { name: 'AbortError' },
  )
})
