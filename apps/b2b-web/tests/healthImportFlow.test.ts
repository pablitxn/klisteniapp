import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '@klisteniapp/b2b-client'
import { previewIsConfirmable, recognizeHealthFile } from '../src/features/health/healthState.ts'
import { deferred, file, fixture, own, preview, raw } from './healthFixture.ts'

test('manual preview and explicit import use frozen fields and never grant consent', async () => {
  const { controller, calls } = fixture()
  await controller.loadOwner()
  await controller.previewFile(file)
  assert.deepEqual(
    calls.map((c) => c.key),
    ['ownHealth', 'healthConsents', 'previewHealthImport'],
  )
  assert.equal(controller.getSnapshot().preview?.duplicates, 2)
  assert.equal(controller.getSnapshot().preview?.additions.sleep, 1)
  assert.equal(controller.getSnapshot().own?.revision, 3)
  await controller.confirmImport()
  assert.equal(controller.getSnapshot().own?.revision, 4)
  assert.equal(controller.getSnapshot().importStatus, 'applied')
  assert.deepEqual(calls.at(-1)?.input, {
    ...(calls[2].input as object),
    previewHash: preview.previewHash,
  })
  assert.equal(
    calls.some((c) => c.key === 'grantHealthConsent'),
    false,
  )
})

test('confirm without a preview cannot write', async () => {
  const { controller, calls } = fixture()
  await controller.loadOwner()
  await controller.confirmImport()
  assert.equal(calls.length, 2)
})

for (const [name, content, size] of [
  ['samsung.csv', 'date,steps', 10],
  ['health.zip', 'zip', 3],
  ['vendor.json', '{"format":"vendor","version":1}', 32],
  ['future.json', '{"format":"klisteniapp.health","version":2}', 45],
  ['broken.json', '{', 1],
  ['large.json', raw, 2 * 1024 * 1024 + 1],
] as const) {
  test(`unsupported or invalid file ${name} rejects before API preview or writes`, async () => {
    const { controller, calls } = fixture()
    await controller.loadOwner()
    await controller.previewFile({ name, size, text: async () => content })
    await controller.confirmImport()
    assert.equal(calls.length, 2)
    assert.equal(controller.getSnapshot().preview, null)
    assert.ok(controller.getSnapshot().message)
  })
}

test('byte limit counts UTF-8 even when file metadata lies', () => {
  assert.throws(() => recognizeHealthFile('large.json', 1, 'é'.repeat(1024 * 1024 + 1)), /2 MiB/)
})

for (const rejected of [
  {
    ...preview,
    issues: [{ path: 'raw', message: 'Synthetic parser conflict; no partial import' }],
  },
  { ...preview, conflicts: [{ category: 'sleep' as const, recordId: 'synthetic' }] },
]) {
  test(`server ${rejected.issues.length ? 'issues' : 'conflicts'} disable confirmation without inventing conflict IDs`, async () => {
    const { controller, calls } = fixture(false, { previewHealthImport: () => rejected })
    await controller.loadOwner()
    await controller.previewFile(file)
    assert.equal(controller.canConfirmImport(), false)
    await controller.confirmImport()
    assert.equal(
      calls.some((c) => c.key === 'applyHealthImport'),
      false,
    )
  })
}

test('expired preview cannot be applied for the first time', async () => {
  const { controller, advance, calls } = fixture()
  await controller.loadOwner()
  await controller.previewFile(file)
  advance(300_000)
  assert.equal(previewIsConfirmable(preview, Date.parse(preview.expiresAt)), false)
  await controller.confirmImport()
  assert.equal(calls.length, 3)
})

test('uncertain delivery retries the identical operation after expiry', async () => {
  let attempt = 0
  const { controller, calls, advance } = fixture(false, {
    applyHealthImport: () => {
      if (++attempt === 1) throw new ApiError('Lost response', 0, 'NETWORK_ERROR')
      return { ...own, revision: 4 }
    },
  })
  await controller.loadOwner()
  await controller.previewFile(file)
  await controller.confirmImport()
  advance(600_000)
  assert.equal(controller.canConfirmImport(), true)
  await controller.confirmImport()
  const writes = calls.filter((c) => c.key === 'applyHealthImport')
  assert.equal(writes.length, 2)
  assert.deepEqual(writes[0].input, writes[1].input)
  assert.equal(controller.getSnapshot().own?.revision, 4)
})

test('revision conflict discards the obsolete preview and requires a fresh review', async () => {
  const { controller, calls } = fixture(false, {
    applyHealthImport: () => {
      throw new ApiError('Changed', 409, 'REVISION_CONFLICT')
    },
  })
  await controller.loadOwner()
  await controller.previewFile(file)
  await controller.confirmImport()
  await controller.confirmImport()
  assert.equal(controller.getSnapshot().preview, null)
  assert.equal(calls.filter((c) => c.key === 'applyHealthImport').length, 1)
})

test('file reader resolving after context cancellation cannot request a preview', async () => {
  const read = deferred<string>()
  const { controller, calls } = fixture()
  await controller.loadOwner()
  const pending = controller.previewFile({ ...file, text: () => read.promise })
  controller.hide()
  read.resolve(raw)
  await pending
  assert.equal(calls.length, 2)
  assert.equal(controller.getSnapshot().own, null)
})

test('a newer file selection wins over a delayed older preview', async () => {
  const first = deferred<typeof preview>()
  let count = 0
  const { controller } = fixture(false, {
    previewHealthImport: () => (++count === 1 ? first.promise : { ...preview, duplicates: 7 }),
  })
  await controller.loadOwner()
  const pending = controller.previewFile(file)
  await Promise.resolve()
  await controller.previewFile(file)
  first.resolve(preview)
  await pending
  assert.equal(controller.getSnapshot().preview?.duplicates, 7)
})
