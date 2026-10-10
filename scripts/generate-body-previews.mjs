#!/usr/bin/env node
/* global window */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { bodyRegions } from '../apps/web/src/data/body-guide.ts'
import { bodyPreviewCameras, bodyPreviewPadding } from '../apps/web/src/lib/body-preview-config.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const webRoot = join(root, 'apps/web')
const assetRoot = join(root, 'packages/model-assets')
const outputFor = model => join(assetRoot, 'public/previews', model === 'female' ? 'female/body' : 'body')
const { values } = parseArgs({ options: {
  model: { type: 'string', multiple: true },
  region: { type: 'string', multiple: true },
  size: { type: 'string', default: '256' },
  check: { type: 'boolean', default: false },
  'contact-sheet': { type: 'string' },
  help: { type: 'boolean', default: false },
} })
if (values.help) {
  console.log(`Usage: node scripts/generate-body-previews.mjs [--model female] [--region pectorals] [--size 256]
       node scripts/generate-body-previews.mjs --contact-sheet /tmp/body-regions.png
       node scripts/generate-body-previews.mjs --check

Renders the twelve isolated atlas regions from each model variant with natural tissue colours.
Outputs: packages/model-assets/public/previews/body/{MuscleId}.webp and female/body/{MuscleId}.webp, each with a manifest.
Defaults to both male and female variants; repeat --model to select variants.
Repeat --region to regenerate a subset. Default 256px, transparent background.
--check validates BOTH models and ALL source/output hashes, dimensions, structure selections and provenance.
--contact-sheet saves a labelled light/dark visual review at large and thumbnail sizes.
Requires installed Playwright Chromium and cwebp; WEBP_CWEBP_BIN can override the encoder.
Starts and closes its own Vite server on an available port; leaves running app servers alone.`)
  process.exit(0)
}
const size = Number(values.size)
if (!Number.isInteger(size) || size < 64 || size > 1024) throw new Error('--size must be 64..1024')
const models = [...new Set(values.model ?? ['male', 'female'])]
for (const model of models) if (!['male', 'female'].includes(model)) throw new Error(`Unknown model: ${model}`)
const allIds = bodyRegions.flatMap(region => region.muscles)
assert.deepEqual(Object.keys(bodyPreviewCameras).sort(), allIds.slice().sort(), 'Capture configuration must cover every atlas region exactly once')
const ids = [...new Set(values.region ?? allIds)]
for (const id of ids) if (!allIds.includes(id)) throw new Error(`Unknown region: ${id}`)

const sourcePaths = [
  'packages/anatomy-viewer/package.json',
  'packages/model-assets/package.json',
  'packages/catalog-base/package.json',
  'packages/anatomy-viewer/src/anatomy-model.ts',
  'packages/anatomy-viewer/src/anatomy-rig.ts',
  'packages/anatomy-viewer/src/anatomy-variants.ts',
  'packages/anatomy-viewer/src/anatomy-variant-surface.ts',
  'packages/anatomy-viewer/src/anatomy-render-settings.ts',
  'packages/model-assets/src/index.ts',
  'packages/model-assets/src/vite.ts',

  'scripts/generate-body-previews.mjs',
  'apps/web/body-preview-capture.html',
  'apps/web/src/body-preview-capture.ts',
  'apps/web/src/lib/body-preview-config.ts',
  'apps/web/src/lib/anatomy-model.ts',
  'apps/web/src/lib/anatomy-rig.ts',
  'apps/web/src/lib/anatomy-variants.ts',
  'apps/web/src/lib/anatomy-variant-surface.ts',
  'apps/web/src/lib/anatomy-render-settings.ts',
  'apps/web/src/data/body-guide.ts',
  'packages/model-assets/public/models/anatomy.glb',
  'packages/model-assets/public/models/rig-landmarks.json',
  'packages/model-assets/public/models/anatomy-manifest.json',
  'packages/model-assets/public/previews/body/NOTICE.md',
  'packages/model-assets/public/previews/female/body/NOTICE.md',
  'packages/geometry/src/index.ts',
  'packages/scene-schema/src/index.ts',
  'pnpm-lock.yaml',
]
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const sources = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, hash(await readFile(join(root, path)))])))
const sourceHash = hash(JSON.stringify(sources))
const modelManifest = JSON.parse(await readFile(join(assetRoot, 'public/models/anatomy-manifest.json'), 'utf8'))
const provenanceFor = model => ({
  modelVariant: model,
  model: '/models/anatomy.glb',
  modelSha256: sources['packages/model-assets/public/models/anatomy.glb'],
  creator: modelManifest.creator,
  sourceRepository: modelManifest.sourceRepository,
  sourceCommit: modelManifest.sourceCommit,
  license: modelManifest.license,
  licenseUrl: modelManifest.licenseUrl,
  notice: `/previews/${model === 'female' ? 'female/' : ''}body/NOTICE.md`,
  method: `${model === 'female' ? 'Parametrically adapted' : 'Original'} muscle-region faces in the anatomical bind position; natural vertex colours and live atlas material, isolated side selection, fitted orthographic camera, fixed local lights, transparent background.`,
})
async function readManifest(model) {
  try { return JSON.parse(await readFile(join(outputFor(model), 'manifest.json'), 'utf8')) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  return { version: 1, modelVariant: model, sources: {}, regions: {} }
}

function webpDimensions(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error('Invalid WebP container')
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4)
    const length = bytes.readUInt32LE(offset + 4)
    const start = offset + 8
    if (start + length > bytes.length) throw new Error('Truncated WebP chunk')
    if (kind === 'VP8X' && length >= 10) return { width: bytes.readUIntLE(start + 4, 3) + 1, height: bytes.readUIntLE(start + 7, 3) + 1 }
    if (kind === 'VP8 ' && length >= 10) return { width: bytes.readUInt16LE(start + 6) & 0x3fff, height: bytes.readUInt16LE(start + 8) & 0x3fff }
    if (kind === 'VP8L' && length >= 5) {
      const bits = bytes.readUInt32LE(start + 1)
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
    }
    offset = start + length + (length % 2)
  }
  throw new Error('WebP has no image dimensions')
}

if (values.check) {
  const failures = []
  for (const model of ['male', 'female']) {
  const output = outputFor(model)
  const manifest = await readManifest(model)
  const provenance = provenanceFor(model)
  for (const id of allIds) {
    const entry = manifest.regions?.[id]
    if (!entry || entry.sourceHash !== sourceHash || entry.modelVariant !== model || manifest.modelVariant !== model) {
      failures.push(`${model}/${id}: missing or stale sources; regenerate`)
      continue
    }
    try {
      assert.equal(entry.image.file, `${id}.webp`)
      assert.deepEqual(entry.selection, bodyPreviewCameras[id])
      assert.deepEqual(entry.provenance, provenance)
      assert.ok(entry.structures.length > 0 && entry.triangles > 0)
      if (entry.selection.side === 'left') assert.ok(entry.structures.every(name => name.endsWith('.l')))
      const bytes = await readFile(join(output, entry.image.file))
      assert.equal(hash(bytes), entry.image.sha256)
      assert.equal(bytes.length, entry.image.bytes)
      assert.deepEqual(webpDimensions(bytes), { width: entry.size, height: entry.size })
      assert.equal(entry.background, 'transparent')
    } catch (error) { failures.push(`${model}/${id}: missing, modified or invalid image/provenance (${error.message})`) }
  }
  }
  if (failures.length) throw new Error(failures.join('\n'))
  console.log(`All ${allIds.length * 2} isolated muscle previews match current model variants, capture settings, provenance and WebP files.`)
  process.exit(0)
}

const cwebp = process.env.WEBP_CWEBP_BIN ?? 'cwebp'
const run = (binary, args) => execFileSync(binary, args, { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 })
let encoderVersion
try { encoderVersion = run(cwebp, ['-version']).toString().trim() } catch { throw new Error(`Required encoder unavailable: ${cwebp}. See --help.`) }
const requireWeb = createRequire(join(webRoot, 'package.json'))
const { createServer } = await import(requireWeb.resolve('vite'))
const { chromium } = requireWeb('@playwright/test')
await mkdir(join(root, '.cache'), { recursive: true })
const temporary = await mkdtemp(join(root, '.cache/body-previews-'))
let server, browser
try {
  server = await createServer({ root: webRoot, server: { host: '127.0.0.1', port: 0, strictPort: true }, logLevel: 'error' })
  await server.listen()
  const port = server.httpServer.address().port
  browser = await chromium.launch({ args: process.platform === 'darwin' ? ['--enable-gpu', '--use-angle=metal'] : [] })
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  page.setDefaultTimeout(90_000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const renderer = { browser: await browser.version(), platform: process.platform, cwebp: encoderVersion }
  for (const model of models) {
  const output = outputFor(model)
  const manifestPath = join(output, 'manifest.json')
  const manifest = await readManifest(model)
  manifest.modelVariant = model
  manifest.regions ??= {}
  const provenance = provenanceFor(model)
  await mkdir(output, { recursive: true })
  await page.goto(`http://127.0.0.1:${port}/body-preview-capture.html?model=${model}`)
  await page.waitForFunction(() => Boolean(window.__bodyCapture))
  for (const id of ids) {
    console.log(`Capturing ${model}/${id}…`)
    let timer
    let capture
    try {
      capture = await Promise.race([
        page.evaluate(value => window.__bodyCapture.frame(value), id),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Render timed out: ${id}`)), 30_000) }),
      ])
    } finally { clearTimeout(timer) }
    if (errors.length) throw new Error(errors.join('\n'))
    assert.equal(capture.modelVariant, model, 'Capture must use the requested model variant')
    if (!capture.png.startsWith('data:image/png;base64,')) throw new Error(`Invalid capture for ${id}`)
    const png = join(temporary, `${id}.png`)
    const file = `${id}.webp`
    await writeFile(png, Buffer.from(capture.png.split(',')[1], 'base64'))
    run(cwebp, ['-quiet', '-q', '90', '-m', '6', '-alpha_q', '100', png, '-o', join(temporary, file)])
    const bytes = await readFile(join(temporary, file))
    assert.deepEqual(webpDimensions(bytes), { width: size, height: size })
    // Refuse a mixed snapshot if another task changes a parser/model during capture.
    for (const [path, expected] of Object.entries(sources)) {
      assert.equal(hash(await readFile(join(root, path))), expected, `Source changed during capture: ${path}; rerun after it stabilises`)
    }
    await rename(join(temporary, file), join(output, file))
    manifest.regions[id] = {
      sourceHash, modelVariant: model, generatedAt: new Date().toISOString(), size, background: 'transparent',
      selection: bodyPreviewCameras[id], padding: bodyPreviewPadding,
      structures: capture.structures, triangles: capture.triangles, bounds: capture.bounds, camera: capture.camera,
      renderer, provenance,
      image: { file, bytes: (await stat(join(output, file))).size, sha256: hash(bytes), width: size, height: size },
    }
    manifest.sources = sources
    manifest.generatedAt = new Date().toISOString()
    const nextManifest = join(temporary, 'manifest.json')
    await writeFile(nextManifest, `${JSON.stringify(manifest, null, 2)}\n`)
    await rename(nextManifest, manifestPath)
    console.log(`  ${capture.structures.length} structures · ${capture.triangles} source faces · ${(bytes.length / 1024).toFixed(1)} KiB`)
  }
  if (values['contact-sheet']) {
    const sheet = await browser.newPage({ viewport: { width: 1080, height: 1000 }, deviceScaleFactor: 1 })
    // Read saved assets directly: the dev server may not yet have indexed newly written public files.
    const imageData = Object.fromEntries(await Promise.all(ids.map(async id => [id, `data:image/webp;base64,${(await readFile(join(output, `${id}.webp`))).toString('base64')}`])))
    const image = id => imageData[id]
    await sheet.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#edf0eb;font:13px system-ui;color:#23312d;padding:20px}h1{font-size:20px;margin:0 0 7px}p{margin:0 0 16px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.card{background:white;border:1px solid #ccd4cc;border-radius:10px;padding:10px}.card h2{font-size:14px;margin:0 0 8px}.pair{display:flex;justify-content:center;gap:6px}.surface{display:flex;align-items:center;justify-content:center;width:112px;height:120px;border-radius:5px}.light{background:#f0f2ec}.dark{background:#142624}.large img{width:112px;height:112px;object-fit:contain}.small{margin-top:8px}.small .surface{height:82px}.small img{width:76px;height:76px;object-fit:contain}.caption{font-size:10px;color:#627067;margin-top:7px}</style><h1>Regiones musculares aisladas · ${model === 'female' ? 'mujer' : 'hombre'}</h1><p>Izquierda: superficie clara. Derecha: oscura. Captura 256px; abajo, tamaño de miniatura 76px.</p><div class="grid">${ids.map(id => `<article class="card"><h2>${id}</h2><div class="pair large"><div class="surface light"><img src="${image(id)}"></div><div class="surface dark"><img src="${image(id)}"></div></div><div class="pair small"><div class="surface light"><img src="${image(id)}"></div><div class="surface dark"><img src="${image(id)}"></div></div><div class="caption">${bodyPreviewCameras[id].view} · ${bodyPreviewCameras[id].side} · ${manifest.regions[id].structures.length} estructuras</div></article>`).join('')}</div>`)
    await sheet.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())))
    const requested = resolve(values['contact-sheet'])
    const extension = extname(requested)
    const path = models.length > 1 && model === 'female' ? `${requested.slice(0, -extension.length)}-female${extension}` : requested
    await mkdir(dirname(path), { recursive: true })
    await sheet.screenshot({ path, fullPage: true })
    await sheet.close()
    console.log(`Contact sheet: ${path}`)
  }
  }
} finally {
  await browser?.close()
  await server?.close()
  await rm(temporary, { recursive: true, force: true })
}
