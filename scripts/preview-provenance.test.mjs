import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { dependencyProof, digest, loadRetainedCaptures, normalizeExtractedSource, receiptPath, retainedEntryMatches, verifyDependencies } from './preview-provenance.mjs'
import { previewBrowserOptions } from './preview-browser.mjs'
import { publishCapture, reusableCapture } from './preview-capture-state.mjs'

// Preserve the old/current extraction boundary after actual new renders replace
// the historical manifests. No repository capture or receipt is modified here.
const fixtureLock = `lockfileVersion: '9.0'

importers:

  apps/b2c-web:
    dependencies:
      renderer:
        specifier: 1.0.0
        version: 1.0.0
    devDependencies:
      tooling:
        specifier: 2.0.0
        version: 2.0.0

packages:

  renderer@1.0.0:
    resolution: {integrity: sha512-renderer}

  tooling@2.0.0:
    resolution: {integrity: sha512-tooling}

snapshots:

  renderer@1.0.0: {}

  tooling@2.0.0: {}
`

async function retainedFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'klisteni-preview-provenance-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const write = async (path, value) => {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), typeof value === 'string' ? value : JSON.stringify(value))
  }
  const renderer = 'export const angle = 1\n'
  const sources = { 'renderer.ts': digest(renderer) }
  const originalSources = { 'original/renderer.ts': digest(renderer) }
  const originalSourceHash = digest(JSON.stringify(originalSources))
  const entry = { sourceHash: originalSourceHash, generatedAt: '2026-01-01T00:00:00.000Z', poster: { file: 'squat-poster.webp', sha256: digest('poster') } }
  const manifest = { variants: { male: { exercises: { squat: entry } } } }
  const files = { poster: 'squat-poster.webp', animation: 'squat.webp', gif: 'squat.gif' }
  const receipt = {
    schemaVersion: 1,
    originalDependencies: dependencyProof(fixtureLock),
    previewPaths: [{ id: 'squat', model: 'male', files }],
    families: {
      exercise: {
        originalSources,
        originalSourceHash,
        currentSources: sources,
        originalManifestHash: digest(JSON.stringify(manifest)),
        sourceProofs: [{ currentPath: 'renderer.ts', originalPath: 'original/renderer.ts', normalization: 'identity' }],
        entries: { 'male/squat': digest(JSON.stringify(entry)) },
      },
    },
  }
  await write('renderer.ts', renderer)
  await write('pnpm-lock.yaml', fixtureLock)
  await write(receiptPath, receipt)
  await write('packages/model-assets/src/index.ts', `
export const localAssets = path => '/' + path
export const exercisePreviewFiles = (id, model) => {
  if (id !== 'squat' || model !== 'male') throw new Error('Unknown fixture capture')
  return ${JSON.stringify(files)}
}
export const exercisePreviewUrls = (id, model) => Object.fromEntries(Object.entries(exercisePreviewFiles(id, model)).map(([kind, file]) => [kind, '/previews/' + file]))
`)
  return { root, sources, manifest, entry, renderer, write, family: 'exercise', sourceHash: digest(JSON.stringify(sources)) }
}

test('retained captures preserve exact entries and reject changed inventories or manifest metadata', async t => {
  const fixture = await retainedFixture(t)
  const accepted = await loadRetainedCaptures(fixture)
  assert.equal(accepted('male/squat', fixture.entry), true)
  assert.equal(accepted('male/squat', { ...fixture.entry, generatedAt: 'changed' }), false)
  assert.equal(accepted('male/squat', { ...fixture.entry, poster: { ...fixture.entry.poster, sha256: 'changed' } }), false)
  assert.equal(accepted('male/missing', fixture.entry), false)
  await assert.rejects(loadRetainedCaptures({ ...fixture, sources: { ...fixture.sources, 'unexpected.ts': 'changed' } }), /receipt is stale/)
  await assert.rejects(loadRetainedCaptures({ ...fixture, manifest: { ...fixture.manifest, generatedAt: 'changed' } }), /manifest metadata changed/)
})

test('retention rereads actual renderer content and dependencies instead of trusting supplied hashes', async t => {
  const fixture = await retainedFixture(t)
  await fixture.write('renderer.ts', 'export const angle = 2\n')
  await assert.rejects(loadRetainedCaptures(fixture), /Extraction differs from original renderer/)
  await fixture.write('renderer.ts', fixture.renderer)
  await fixture.write('pnpm-lock.yaml', fixtureLock.replace('sha512-renderer', 'sha512-changed'))
  await assert.rejects(loadRetainedCaptures(fixture), /dependency changed/)
})

test('fresh exercise and yoga captures need no historical receipt', async () => {
  for (const family of ['exercise', 'yoga']) {
    const sourceHash = digest('new renderer and dependencies')
    const entry = { sourceHash, generatedAt: '2026-10-11T00:00:00.000Z' }
    const manifest = family === 'exercise'
      ? { variants: { male: { exercises: { squat: entry } }, female: { exercises: { squat: entry } } } }
      : { poses: { 'tadasana.webp': entry } }
    const accepted = await loadRetainedCaptures({ root: '/no-historical-receipt', family, manifest, sources: {}, sourceHash })
    assert.equal(accepted('any', entry), false)
  }
})

test('mixed old and fresh captures still validate retained source and exact old entries', async t => {
  const fixture = await retainedFixture(t)
  const fresh = { sourceHash: fixture.sourceHash, generatedAt: '2026-10-11T00:00:00.000Z' }
  const manifest = { variants: { male: { exercises: { squat: fixture.entry, row: fresh } } } }
  const accepted = await loadRetainedCaptures({ ...fixture, manifest })
  assert.equal(accepted('male/squat', fixture.entry), true)
  assert.equal(accepted('male/row', fresh), false)
  await fixture.write('renderer.ts', `${fixture.renderer}// changed\n`)
  await assert.rejects(loadRetainedCaptures({ ...fixture, manifest }), /Extraction differs from original renderer/)
})

test('limited normalization removes only documented extraction mechanics', () => {
  const source = `import type { AssetResolver } from '@klisteniapp/model-assets'
import { isSupportedAnatomyPose } from './movement-library.ts'
import { rig } from './anatomy-rig'
import { model } from './anatomy-model'
  assetResolver: AssetResolver
  if (!isSupportedAnatomyPose(props.exerciseId)) throw new Error(\`No authored movement for \${props.exerciseId}\`)
const modelUrl = props.assetResolver('models/anatomy.glb')
const landmarks = props.assetResolver('models/rig-landmarks.json')
const angle = 1
`
  const original = `import { rig } from '../lib/anatomy-rig'
import { model } from '../lib/anatomy-model'
const modelUrl = '/models/anatomy.glb'
const landmarks = '/models/rig-landmarks.json'
const angle = 1
`
  assert.equal(normalizeExtractedSource(source, 'anatomical-model'), original)
  assert.notEqual(normalizeExtractedSource(source.replace('angle = 1', 'angle = 2'), 'anatomical-model'), original)
  const guard = "import { isSupportedAnatomyPose } from './movement-library.ts'\n  if (!isSupportedAnatomyPose(props.exerciseId)) throw new Error(`No authored movement for ${props.exerciseId}`)\n"
  assert.equal(normalizeExtractedSource(`${guard}const angle = 1\n`, 'exercise-stage'), 'const angle = 1\n')
  assert.equal(normalizeExtractedSource("import { plan } from '@klisteniapp/catalog-base/exercise-planning'", 'animation-import'), "import { plan } from '../data/exercise-planning.ts'")
  const capture = "import { loadRetainedCaptures } from './preview-provenance.mjs'\nconst assetRoot = join(root, 'packages/model-assets')\nconst sourcePaths = [\n  'new/path',\n]\nconst hash = bytes => digest(bytes)\n  const retained = await loadRetainedCaptures({ root })\nassert.ok(entry.sourceHash === sourceHash || retained(file, entry), 'stale sources; regenerate')\nconst output = join(assetRoot, 'public/previews')\n"
  assert.equal(normalizeExtractedSource(capture, 'capture-infrastructure', ['old/path']), "const sourcePaths = [\n  'old/path',\n]\nconst hash = bytes => digest(bytes)\nassert.equal(entry.sourceHash, sourceHash, 'stale sources; regenerate')\nconst output = join(webRoot, 'public/previews')\n")
  assert.equal(normalizeExtractedSource(source, 'identity'), source)
  assert.throws(() => normalizeExtractedSource('anything', 'unknown'))
  assert.equal(retainedEntryMatches({}, undefined), false)
})

test('lock comparison covers runtime, packages, and empty snapshots while allowing additions', () => {
  const original = dependencyProof(fixtureLock)
  assert.deepEqual(Object.keys(original.runtime), ['renderer'])
  assert.deepEqual(Object.keys(original.snapshots), ['renderer@1.0.0', 'tooling@2.0.0'])
  const current = Object.fromEntries(Object.entries(original).map(([section, values]) => [section, { ...values, added: digest('extra') }]))
  verifyDependencies(original, current)
  for (const section of ['packages', 'snapshots', 'runtime']) {
    const key = Object.keys(original[section])[0]
    assert.throws(() => verifyDependencies(original, { ...current, [section]: { ...current[section], [key]: 'changed' } }), /dependency changed/)
    const omitted = { ...current[section] }
    delete omitted[key]
    assert.throws(() => verifyDependencies(original, { ...current, [section]: omitted }), /dependency changed/)
  }
  assert.notDeepEqual(dependencyProof(fixtureLock.replace('version: 1.0.0', 'version: 1.0.1')).runtime, original.runtime)
  assert.notDeepEqual(dependencyProof(fixtureLock.replace('renderer@1.0.0: {}', 'renderer@1.0.0:\n    optional: true')).snapshots, original.snapshots)
})

test('software WebGL is explicit and native platform defaults remain available', () => {
  assert.deepEqual(previewBrowserOptions('linux', {}), { args: [] })
  assert.deepEqual(previewBrowserOptions('darwin', {}), { args: ['--enable-gpu', '--use-angle=metal'] })
  assert.deepEqual(previewBrowserOptions('linux', { PREVIEW_SOFTWARE_WEBGL: '1' }), { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
})

test('capture resume checks source, renderer, settings, requested formats and actual artifact bytes', async t => {
  const output = await mkdtemp(join(tmpdir(), 'klisteni-capture-resume-'))
  t.after(() => rm(output, { recursive: true, force: true }))
  const bytes = Buffer.from('captured pixels')
  await writeFile(join(output, 'poster.webp'), bytes)
  const entry = {
    sourceHash: digest('current source'), generatedAt: '2026-10-11T00:00:00.000Z', size: 256,
    renderer: { browser: '143', launchArgs: ['--use-angle=swiftshader'], cwebp: '1.3.2' },
    animation: { fps: 12, frameCount: 72 },
    poster: { file: 'poster.webp', bytes: bytes.length, sha256: digest(bytes) },
  }
  const expected = { sourceHash: entry.sourceHash, size: 256, renderer: entry.renderer, animation: { fps: 12, frameCount: 72 } }
  const args = { entry, expected, files: { poster: 'poster.webp' }, output, now: Date.parse('2026-10-11T01:00:00.000Z') }
  const before = JSON.stringify(entry)
  assert.equal(await reusableCapture(args), true)
  assert.equal(JSON.stringify(entry), before, 'verification cannot rewrite capture timestamps or records')
  for (const settings of [
    { sourceHash: 'stale' }, { size: 512 }, { animation: { fps: 20 } },
    { renderer: { ...entry.renderer, launchArgs: [] } },
    { renderer: { ...entry.renderer, browser: '144' } },
    { renderer: { ...entry.renderer, cwebp: '1.4.0' } },
  ]) assert.equal(await reusableCapture({ ...args, expected: { ...expected, ...settings } }), false)
  assert.equal(await reusableCapture({ ...args, files: { ...args.files, gif: 'loop.gif' } }), false)
  assert.equal(await reusableCapture({ ...args, files: { poster: 'another.webp' } }), false)
  assert.equal(await reusableCapture({ ...args, entry: undefined }), false)
  assert.equal(await reusableCapture({ ...args, files: {} }), false)
  for (const generatedAt of [undefined, 'invalid', '2999-01-01T00:00:00.000Z', '2026-02-30T00:00:00.000Z', '2026-10-11T01:05:00.001Z']) {
    assert.equal(await reusableCapture({ ...args, entry: { ...entry, generatedAt } }), false, `invalid capture timestamp ${generatedAt}`)
  }
  assert.equal(await reusableCapture({ ...args, entry: { ...entry, generatedAt: '2026-10-11T01:04:00.000Z' } }), true, 'permit bounded clock skew between capture hosts')
  await writeFile(join(output, 'poster.webp'), Buffer.alloc(bytes.length))
  assert.equal(await reusableCapture(args), false, 'equal-length corruption must not resume')
  await rm(join(output, 'poster.webp'))
  assert.equal(await reusableCapture(args), false, 'missing output must be regenerated')
})

test('capture publication stages provenance before replacing artifacts and preserves the old manifest on failure', async t => {
  const output = await mkdtemp(join(tmpdir(), 'klisteni-capture-publish-'))
  t.after(() => rm(output, { recursive: true, force: true }))
  const manifestPath = join(output, 'manifest.json'), stagedManifestPath = join(output, 'next.json')
  const staged = join(output, 'staged.webp'), published = join(output, 'poster.webp')
  const obsolete = join(output, 'old.gif')
  const manifest = { generatedAt: '2026-10-11T00:00:00.000Z', image: { sha256: digest('new pixels') } }
  await writeFile(manifestPath, 'previous manifest')
  await writeFile(published, 'previous pixels')
  await writeFile(staged, 'new pixels')
  await writeFile(obsolete, 'previous gif')
  const args = { manifest, manifestPath, stagedManifestPath, assets: [{ staged, published }], removedFiles: [obsolete] }
  await assert.rejects(publishCapture({ ...args, stagedManifestPath: join(output, 'missing-directory', 'next.json') }), { code: 'ENOENT' })
  assert.equal(await readFile(manifestPath, 'utf8'), 'previous manifest')
  assert.equal(await readFile(published, 'utf8'), 'previous pixels', 'failed provenance write cannot replace a published image')
  assert.equal(await readFile(obsolete, 'utf8'), 'previous gif', 'failed provenance write cannot remove a published format')
  await assert.rejects(publishCapture({ ...args, assets: [...args.assets, { staged: join(output, 'missing.webp'), published: join(output, 'motion.webp') }] }), { code: 'ENOENT' })
  assert.equal(await readFile(manifestPath, 'utf8'), 'previous manifest', 'partial rename cannot publish new provenance')
  assert.equal(await readFile(published, 'utf8'), 'new pixels', 'multiple public URLs are not one filesystem transaction; hashes detect interruption')
  await assert.rejects(readFile(stagedManifestPath), { code: 'ENOENT' })
  await writeFile(staged, 'new pixels')
  await publishCapture(args)
  assert.deepEqual(JSON.parse(await readFile(manifestPath, 'utf8')), manifest)
  assert.equal(await readFile(published, 'utf8'), 'new pixels')
  await assert.rejects(readFile(obsolete), { code: 'ENOENT' })
  await assert.rejects(readFile(stagedManifestPath), { code: 'ENOENT' })
})
