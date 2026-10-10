import assert from 'node:assert/strict'
import test from 'node:test'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createAssetResolver, exercisePreviewUrls, modelResourceManifest } from '../src/index.ts'
import { sharedAssetDirectory, sharedAssetFile } from '../src/vite.ts'

test('resource manifest points to distributable files and preserves anatomy provenance', async () => {
  for (const resource of modelResourceManifest.resources) {
    if (resource.rendering === 'procedural') continue
    for (const file of [resource.modelPath, resource.landmarksPath, resource.provenancePath, resource.noticePath]) await access(join(sharedAssetDirectory, file))
  }
  const provenance = JSON.parse(await readFile(join(sharedAssetDirectory, 'models/anatomy-manifest.json'), 'utf8'))
  assert.equal(provenance.license, 'CC-BY-SA-4.0')
  assert.ok(provenance.sourceCommit)
})

test('each application can use local assets or explicitly resolve a deployment base', () => {
  assert.equal(exercisePreviewUrls('squat').poster, '/previews/squat-poster.webp')
  assert.equal(exercisePreviewUrls('squat', 'female', createAssetResolver('/gym/')).animation, '/gym/previews/female/squat.webp')
  assert.throws(() => createAssetResolver()('../private.txt'))
})

test('dev serving never exposes neighboring package files or path traversal', () => {
  assert.equal(sharedAssetFile('/models/anatomy.glb'), join(sharedAssetDirectory, 'models/anatomy.glb'))
  for (const path of ['/src/index.ts', '/models/../../package.json', '/models/%2e%2e/%2e%2e/package.json', '/models/..\\package.json', '/models/%']) assert.equal(sharedAssetFile(path), undefined)
})
