import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dependencyProof, digest, loadRetainedCaptures, normalizeExtractedSource, receiptPath, retainedEntryMatches, verifyDependencies } from './preview-provenance.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const receipt = JSON.parse(await readFile(join(root,receiptPath), 'utf8'))

test('retained exercise captures verify without reading Git and reject changed source inventories or entries', async () => {
  const manifest = JSON.parse(await readFile(join(root,'packages/model-assets/public/previews/manifest.json'), 'utf8'))
  const sources = receipt.families.exercise.currentSources
  const accepted = await loadRetainedCaptures({ root, family: 'exercise', manifest, sources, sourceHash: digest(JSON.stringify(sources)) })
  const entry = manifest.variants.male.exercises.squat
  assert.equal(accepted('male/squat', entry), true)
  assert.equal(accepted('male/squat', { ...entry, generatedAt: 'changed' }), false)
  assert.equal(accepted('male/squat', { ...entry, poster: { ...entry.poster, sha256: 'changed' } }), false)
  await assert.rejects(loadRetainedCaptures({ root, family: 'exercise', manifest, sources: { ...sources, 'unexpected.ts': 'changed' }, sourceHash: 'changed' }), /receipt is stale/)
  await assert.rejects(loadRetainedCaptures({ root, family: 'exercise', manifest: { ...manifest, generatedAt: 'changed' }, sources, sourceHash: digest(JSON.stringify(sources)) }), /manifest metadata changed/)
})

test('limited normalization accepts the extraction but preserves any geometry or renderer change', async () => {
  const proof = receipt.families.exercise
  for (const input of proof.sourceProofs.filter(value => value.normalization !== 'identity')) {
    const source = await readFile(join(root,input.currentPath), 'utf8')
    assert.equal(digest(normalizeExtractedSource(source,input.normalization,Object.keys(proof.originalSources))), proof.originalSources[input.originalPath])
    assert.notEqual(digest(normalizeExtractedSource(`${source}\n// changed after review\n`,input.normalization,Object.keys(proof.originalSources))), proof.originalSources[input.originalPath])
  }
  assert.throws(() => normalizeExtractedSource('anything', 'unknown'))
  assert.equal(retainedEntryMatches({}, undefined), false)
})

test('lock comparison covers the application document, empty snapshots, runtime and transitives', async () => {
  const lock = await readFile(join(root,'pnpm-lock.yaml'), 'utf8')
  const current = dependencyProof(lock)
  assert.ok(Object.keys(current.packages).length > 200)
  assert.ok(current.snapshots['zod@4.6.5'])
  verifyDependencies(receipt.originalDependencies,current)
  for (const section of ['packages','snapshots','runtime']) {
    const key = Object.keys(receipt.originalDependencies[section])[0]
    assert.throws(() => verifyDependencies(receipt.originalDependencies, { ...current, [section]: { ...current[section], [key]: 'changed' } }), /dependency changed/)
  }
})
