import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { readPreviewSources, relocationReceipt } from './preview-workspace-relocation.mjs'

test('relocation retains capture identity only for the exact verified inputs; new captures use current paths', async t => {
  const root = await mkdtemp(join(tmpdir(), 'klisteni-relocation-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const path = 'apps/b2c-web/renderer.ts'
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), 'original renderer')
  const current = { [path]: createHash('sha256').update('original renderer').digest('hex') }
  const original = { 'apps/web/renderer.ts': current[path] }
  await mkdir(dirname(join(root, relocationReceipt)), { recursive: true })
  await writeFile(join(root, relocationReceipt), JSON.stringify({ schemaVersion: 1,
    families: { exercise: { originalSources: original, relocatedSources: current } } }))
  assert.deepEqual(await readPreviewSources(root, [path], 'exercise', true), original)
  assert.deepEqual(await readPreviewSources(root, [path], 'exercise', false), current)
  await writeFile(join(root, path), 'changed renderer')
  assert.notDeepEqual(await readPreviewSources(root, [path], 'exercise', true), original)
  assert.deepEqual(await readPreviewSources(root, [path], 'exercise', true),
    await readPreviewSources(root, [path], 'exercise', false))
})
