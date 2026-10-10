/** Explicit retention of pre-extraction captures; never changes their capture timestamp or source hash. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const digest = value => createHash('sha256').update(value).digest('hex')
export const receiptPath = 'packages/model-assets/provenance/extraction-2026-10-10.json'

/** Only the listed mechanical extraction edits may disappear from this comparison. */
export function normalizeExtractedSource(source, kind, originalPaths = []) {
  if (kind === 'identity') return source
  if (kind === 'anatomical-model') return source
    .replace("import type { AssetResolver } from '@klisteniapp/model-assets'\n", '')
    .replace("import { isSupportedAnatomyPose } from './movement-library.ts'\n", '')
    .replace("  assetResolver: AssetResolver\n", '')
    .replace("  if (!isSupportedAnatomyPose(props.exerciseId)) throw new Error(`No authored movement for ${props.exerciseId}`)\n", '')
    .replace("from './anatomy-rig'", "from '../lib/anatomy-rig'")
    .replace("from './anatomy-model'", "from '../lib/anatomy-model'")
    .replace("props.assetResolver('models/anatomy.glb')", "'/models/anatomy.glb'")
    .replace("props.assetResolver('models/rig-landmarks.json')", "'/models/rig-landmarks.json'")
  if (kind === 'exercise-stage') return source
    .replace("import { isSupportedAnatomyPose } from './movement-library.ts'\n", '')
    .replace("  if (!isSupportedAnatomyPose(props.exerciseId)) throw new Error(`No authored movement for ${props.exerciseId}`)\n", '')
  if (kind === 'animation-import') return source.replace("'@klisteniapp/catalog-base/exercise-planning'", "'../data/exercise-planning.ts'")
  if (kind === 'capture-infrastructure') {
    // Source inventory, artifact location and the explicit retained-capture check only.
    return source
      .replace("import { loadRetainedCaptures } from './preview-provenance.mjs'\n", '')
      .replace(/ {2}const retained = await loadRetainedCaptures[^\n]*\n/, '')
      .replace("(entry.sourceHash !== sourceHash && !retained(label, entry))", "entry.sourceHash !== sourceHash")
      .replace("assert.ok(entry.sourceHash === sourceHash || retained(file, entry), 'stale sources; regenerate')", "assert.equal(entry.sourceHash, sourceHash, 'stale sources; regenerate')")
      .replace("const assetRoot = join(root, 'packages/model-assets')\n", '')
      .replaceAll("join(assetRoot, 'public/", "join(webRoot, 'public/")
      .replaceAll('packages/model-assets/public/models', 'apps/web/public/models')
      .replaceAll('packages/model-assets/public/previews', 'apps/web/public/previews')
      .replace(/const sourcePaths = \[\n[\s\S]*?\n\](?=\nconst hash)/, `const sourcePaths = [\n${originalPaths.map(path => `  '${path}',`).join('\n')}\n]`)
  }
  throw new Error(`Unknown extraction proof: ${kind}`)
}

/** Pnpm lock entries at one exact indentation level; no YAML execution or inferred versions. */
export function lockBlocks(source, section, indent = 2) {
  const start = source.lastIndexOf(`\n${section}:\n`)
  assert.ok(start >= 0, `Missing lock section ${section}`)
  const body = source.slice(start + section.length + 3).split(/\n(?=\S)/)[0]
  const pattern = new RegExp(`^ {${indent}}(\\S.*?):(?: \\{\\})?$`, 'gm')
  const matches = [...body.matchAll(pattern)]
  assert.ok(matches.length, `Empty lock section ${section}`)
  return Object.fromEntries(matches.map((match, index) => [match[1], digest(body.slice(match.index, matches[index + 1]?.index ?? body.length).trimEnd())]))
}

export function dependencyProof(lock) {
  const importerSection = lock.match(/\n {2}apps\/web:\n([\s\S]*?)(?=\n {2}\S|\n\S)/)?.[1]
  assert.ok(importerSection, 'B2C renderer importer is required')
  const dependencies = importerSection.match(/ {4}dependencies:\n([\s\S]*?)(?=\n {4}devDependencies:|$)/)?.[1]
  assert.ok(dependencies)
  const matches = [...dependencies.matchAll(/^ {6}(\S.*):$/gm)]
  const runtime = Object.fromEntries(matches.map((match, index) => [match[1], digest(dependencies.slice(match.index, matches[index + 1]?.index ?? dependencies.length).trimEnd())]))
  return { packages: lockBlocks(lock, 'packages'), snapshots: lockBlocks(lock, 'snapshots'), runtime }
}

export function verifyDependencies(original, current) {
  for (const section of ['packages', 'snapshots', 'runtime']) for (const [key, expected] of Object.entries(original[section])) {
    assert.equal(current[section][key], expected, `Original renderer dependency changed: ${section}/${key}`)
  }
}

export function retainedEntryMatches(entry, expectedHash) {
  return Boolean(entry && expectedHash && digest(JSON.stringify(entry)) === expectedHash)
}

export async function loadRetainedCaptures({ root, family, manifest, sources, sourceHash }) {
  const entries = family === 'exercise'
    ? Object.fromEntries(Object.entries(manifest.variants).flatMap(([model, value]) => Object.entries(value.exercises).map(([id, entry]) => [`${model}/${id}`, entry])))
    : manifest.poses
  if (Object.values(entries).every(entry => entry.sourceHash === sourceHash)) return () => false
  let receipt
  try { receipt = JSON.parse(await readFile(join(root, receiptPath), 'utf8')) }
  catch { throw new Error('Stale capture sources: regenerate, or provide the reviewed extraction receipt.') }
  assert.equal(receipt.schemaVersion, 1)
  const proof = receipt.families[family]
  assert.ok(proof, `No retained-capture proof for ${family}`)
  assert.deepEqual(sources, proof.currentSources, 'Extraction receipt is stale. Source changes require new captures; do not update recorded capture hashes.')
  assert.equal(digest(JSON.stringify(proof.originalSources)), proof.originalSourceHash)
  if (Object.values(entries).every(entry => entry.sourceHash !== sourceHash)) {
    assert.equal(digest(JSON.stringify(manifest)), proof.originalManifestHash, 'Retained capture manifest metadata changed')
  }
  for (const input of proof.sourceProofs) {
    const content = await readFile(join(root, input.currentPath))
    const normalized = input.normalization === 'identity' ? content : normalizeExtractedSource(content.toString(), input.normalization, Object.keys(proof.originalSources))
    assert.equal(digest(normalized), proof.originalSources[input.originalPath], `Extraction differs from original renderer: ${input.originalPath}`)
  }
  verifyDependencies(receipt.originalDependencies, dependencyProof(await readFile(join(root, 'pnpm-lock.yaml'), 'utf8')))
  // The finite filename adapter domain is checked against actual original artifact references.
  const assets = await import(pathToFileURL(join(root, 'packages/model-assets/src/index.ts')).href)
  for (const item of receipt.previewPaths) {
    assert.deepEqual(assets.exercisePreviewFiles(item.id, item.model), item.files)
    assert.deepEqual(assets.exercisePreviewUrls(item.id, item.model), Object.fromEntries(Object.entries(item.files).map(([kind, file]) => [kind, `/previews/${file}`])))
  }
  assert.equal(assets.localAssets('models/anatomy.glb'), '/models/anatomy.glb')
  assert.equal(assets.localAssets('models/rig-landmarks.json'), '/models/rig-landmarks.json')
  console.log(`${family}: retaining original capture timestamps and hashes; exact source extraction, dependencies and artifact entries verified.`)
  return (key, entry) => entry?.sourceHash === proof.originalSourceHash && retainedEntryMatches(entry, proof.entries[key])
}
