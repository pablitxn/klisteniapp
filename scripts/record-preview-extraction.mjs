/** One-time, reviewed source extraction receipt. Run with the immutable pre-extraction commit. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { digest, receiptPath, normalizeExtractedSource, dependencyProof, verifyDependencies } from './preview-provenance.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const revision = process.argv[2]
if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('Supply the reviewed 40-character pre-extraction commit')
const original = path => execFileSync('git', ['show', `${revision}:${path}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 })
const moved = new Map([
  ...['anatomy-model','anatomy-rig','anatomy-variants','anatomy-variant-surface','anatomy-render-settings','exercise-preview-config','exercise-animation'].map(name => [`apps/web/src/lib/${name}.ts`, `packages/anatomy-viewer/src/${name}.ts`]),
  ...['AnatomicalModel','AnatomyStudio','ExerciseStage'].map(name => [`apps/web/src/components/${name}.tsx`, `packages/anatomy-viewer/src/${name}.tsx`]),
  ...['exercises','exercise-planning'].map(name => [`apps/web/src/data/${name}.ts`, `packages/catalog-base/src/${name}.ts`]),
])
const originalDependencies = dependencyProof(original('pnpm-lock.yaml').toString())
verifyDependencies(originalDependencies, dependencyProof(await readFile(join(root, 'pnpm-lock.yaml'), 'utf8')))
const receipt = { schemaVersion: 1, method: 'verified-source-extraction', originalRevision: revision, recordedAt: new Date().toISOString(), description: 'Exercise and yoga captures are retained byte-for-byte with their original generation timestamp, renderer and sourceHash. Only the finite mechanical source extraction below is accepted. Body previews were rendered again.', originalDependencies, previewPaths: [], families: {} }
for (const [family, manifestPath, script] of [
  ['exercise', 'apps/web/public/previews/manifest.json', 'scripts/generate-exercise-previews.mjs'],
  ['yoga', 'apps/web/public/previews/yoga/manifest.json', 'scripts/generate-yoga-previews.mjs'],
]) {
  const baseline = JSON.parse(original(manifestPath))
  const currentManifestPath = manifestPath.replace('apps/web/public/', 'packages/model-assets/public/')
  assert.deepEqual(JSON.parse(await readFile(join(root,currentManifestPath), 'utf8')), baseline, 'A retained manifest must be unchanged')
  const currentScript = await readFile(join(root, script), 'utf8')
  const paths = [...currentScript.match(/const sourcePaths = \[([\s\S]*?)\n\]/)[1].matchAll(/'([^']+)'/g)].map(match => match[1])
  const currentSources = Object.fromEntries(await Promise.all(paths.map(async path => [path, digest(await readFile(join(root, path)))])))
  const sourceProofs = []
  for (const [originalPath, expected] of Object.entries(baseline.sources)) {
    assert.equal(digest(original(originalPath)), expected, `Baseline source no longer matches capture: ${originalPath}`)
    if (originalPath === 'pnpm-lock.yaml' || originalPath.endsWith('/exercise-preview-assets.ts')) continue
    const currentPath = moved.get(originalPath) ?? originalPath.replace('apps/web/public/', 'packages/model-assets/public/')
    const normalization = originalPath === script ? 'capture-infrastructure'
      : originalPath.endsWith('/AnatomicalModel.tsx') ? 'anatomical-model'
      : originalPath.endsWith('/ExerciseStage.tsx') ? 'exercise-stage'
      : originalPath.endsWith('/exercise-animation.ts') ? 'animation-import' : 'identity'
    const bytes = await readFile(join(root,currentPath))
    const normalized = normalization === 'identity' ? bytes : normalizeExtractedSource(bytes.toString(), normalization, Object.keys(baseline.sources))
    if (digest(normalized) !== expected) {
      await writeFile(`/tmp/klisteni-proof-${family}-${normalization}.txt`, normalized)
      throw new Error(`Not a mechanical extraction: ${originalPath}; inspect /tmp/klisteni-proof-${family}-${normalization}.txt`)
    }
    sourceProofs.push({ originalPath, currentPath, normalization })
  }
  const entries = family === 'exercise' ? Object.fromEntries(Object.entries(baseline.variants).flatMap(([model, value]) => Object.entries(value.exercises).map(([id, entry]) => {
    receipt.previewPaths.push({ id, model, files: { poster: entry.poster.file, animation: entry.animation.file, gif: entry.gif.file } })
    return [`${model}/${id}`, digest(JSON.stringify(entry))]
  }))) : Object.fromEntries(Object.entries(baseline.poses).map(([file, entry]) => [file, digest(JSON.stringify(entry))]))
  receipt.families[family] = { originalManifestHash: digest(JSON.stringify(baseline)), originalSources: baseline.sources, originalSourceHash: digest(JSON.stringify(baseline.sources)), currentSources, sourceProofs, entries }
}
await mkdir(dirname(join(root,receiptPath)), { recursive: true })
await writeFile(join(root,receiptPath), `${JSON.stringify(receipt,null,2)}\n`)
console.log(`Recorded reviewed extraction proof for ${Object.keys(receipt.families).join(', ')}; original capture manifests were not modified.`)
