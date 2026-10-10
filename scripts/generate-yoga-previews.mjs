#!/usr/bin/env node
/* global window */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { loadRetainedCaptures } from './preview-provenance.mjs'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { AnatomicalModelVariantSchema } from '@klisteniapp/scene-schema'
import { asanas } from '../apps/web/src/data/yoga.ts'
import { yogaPreviewAnimationFile, yogaPreviewFile } from '../apps/web/src/lib/yoga-preview-assets.ts'
import { YOGA_HOLD_PHASE, YOGA_MOTION_DURATION_SECONDS } from '../apps/web/src/lib/yoga-motion.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const webRoot = join(root, 'apps/web')
const assetRoot = join(root, 'packages/model-assets')
const output = join(assetRoot, 'public/previews/yoga')
const manifestPath = join(output, 'manifest.json')
const { values } = parseArgs({ options: {
  asana: { type: 'string', multiple: true },
  model: { type: 'string', default: 'all' },
  size: { type: 'string', default: '512' },
  fps: { type: 'string', default: '20' },
  check: { type: 'boolean', default: false },
  'contact-sheets': { type: 'string' },
  help: { type: 'boolean', default: false },
} })
if (values.help) {
  console.log(`Usage: pnpm yoga-previews:generate [--asana vrksasana] [--model male|female|all] [--size 512] [--fps 20]
       pnpm yoga-previews:generate --contact-sheets artifacts/yoga-3d
       pnpm yoga-previews:check

Captures a poster and full movement cycle from the live YogaStage with a fixed camera.
Both models and both anatomical sides of unilateral asanas are rendered separately.
Requires Playwright Chromium, cwebp and img2webp; WEBP_CWEBP_BIN / WEBP_IMG2WEBP_BIN override paths.
Uses an isolated Vite server; never touches existing app servers.
--check verifies every source/output hash, pose/model/side identity, size and provenance.
--contact-sheets exports paginated labelled PNGs for visual review.`)
  process.exit(0)
}
const size = Number(values.size)
const height = Math.round(size * 3 / 4)
const fps = Number(values.fps)
const frameCount = Math.round(YOGA_MOTION_DURATION_SECONDS * fps)
const frameDuration = 1000 / fps
const motionWidth = Math.min(size, 384), motionHeight = Math.round(motionWidth * 3 / 4)
if (!Number.isInteger(size) || size < 128 || size > 1024) throw new Error('--size must be 128..1024')
if (![4, 5, 8, 10, 20, 25].includes(fps)) throw new Error('--fps must be 4, 5, 8, 10, 20 or 25')
const allModels = AnatomicalModelVariantSchema.options
if (values.model !== 'all' && !allModels.includes(values.model)) throw new Error('Unknown model')
const models = values.model === 'all' ? allModels : [values.model]
const ids = [...new Set(values.asana ?? asanas.map(asana => asana.id))]
for (const id of ids) if (!asanas.some(asana => asana.id === id)) throw new Error(`Unknown asana: ${id}`)
const variants = (selectedModels, selectedIds) => selectedModels.flatMap(model => asanas
  .filter(asana => selectedIds.includes(asana.id))
  .flatMap(asana => (asana.bilateral ? ['both'] : ['right', 'left']).map(side => ({ asana, model, side, file: yogaPreviewFile(asana.id, model, side) }))))
const allVariants = variants(allModels, asanas.map(asana => asana.id))
const sourcePaths = [
  'scripts/preview-provenance.mjs',
  'packages/anatomy-viewer/package.json',
  'packages/model-assets/package.json',
  'packages/catalog-base/package.json',
  'packages/anatomy-viewer/src/anatomy-model.ts',
  'packages/anatomy-viewer/src/anatomy-rig.ts',
  'packages/anatomy-viewer/src/anatomy-variants.ts',
  'packages/anatomy-viewer/src/anatomy-variant-surface.ts',
  'packages/anatomy-viewer/src/anatomy-render-settings.ts',
  'packages/anatomy-viewer/src/AnatomyStudio.tsx',
  'packages/model-assets/src/index.ts',
  'packages/model-assets/src/vite.ts',

  'scripts/generate-yoga-previews.mjs',
  'apps/web/yoga-preview-capture.html',
  'apps/web/src/yoga-preview-capture.tsx',
  'apps/web/src/components/YogaStage.tsx',
  'apps/web/src/lib/yoga-rig.ts',
  'apps/web/src/lib/yoga-anatomy.ts',
  'apps/web/src/lib/yoga-motion.ts',
  'apps/web/src/lib/yoga-rendering.ts',
  'apps/web/src/lib/yoga-preview-assets.ts',
  'apps/web/src/data/yoga.ts',
  'apps/web/src/components/AnatomyStudio.tsx',
  'apps/web/src/lib/anatomy-model.ts',
  'apps/web/src/lib/anatomy-rig.ts',
  'apps/web/src/lib/anatomy-variants.ts',
  'apps/web/src/lib/anatomy-variant-surface.ts',
  'apps/web/src/lib/anatomy-render-settings.ts',
  'packages/model-assets/public/models/anatomy.glb',
  'packages/model-assets/public/models/rig-landmarks.json',
  'packages/model-assets/public/models/anatomy-manifest.json',
  'packages/model-assets/public/previews/yoga/NOTICE.md',
  'packages/geometry/src/index.ts',
  'packages/scene-schema/src/index.ts',
  'packages/scene-schema/src/yoga.ts',
  'pnpm-lock.yaml',
]
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const sources = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, hash(await readFile(join(root, path)))])))
const sourceHash = hash(JSON.stringify(sources))
const anatomy = JSON.parse(await readFile(join(assetRoot, 'public/models/anatomy-manifest.json'), 'utf8'))
const provenance = {
  model: '/models/anatomy.glb', modelSha256: sources['packages/model-assets/public/models/anatomy.glb'],
  creator: anatomy.creator, sourceRepository: anatomy.sourceRepository, sourceCommit: anatomy.sourceCommit,
  license: anatomy.license, licenseUrl: anatomy.licenseUrl, notice: '/previews/yoga/NOTICE.md',
  method: 'Source anatomical atlas, selected morphology, source-length yoga movement cycle (preparation, entry, hold, exit); shared live YogaStage, muscles layer, local studio and orthographic camera fitted once to the whole cycle. Anatomical sides rendered independently.',
}
let manifest = { version: 2, sources: {}, poses: {} }
try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')) }
catch (error) { if (error.code !== 'ENOENT') throw error }
function webpDimensions(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF')
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP')
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length)
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4), length = bytes.readUInt32LE(offset + 4), start = offset + 8
    assert.ok(start + length <= bytes.length)
    if (kind === 'VP8X' && length >= 10) return { width: bytes.readUIntLE(start + 4, 3) + 1, height: bytes.readUIntLE(start + 7, 3) + 1 }
    if (kind === 'VP8 ' && length >= 10) return { width: bytes.readUInt16LE(start + 6) & 0x3fff, height: bytes.readUInt16LE(start + 8) & 0x3fff }
    if (kind === 'VP8L' && length >= 5) { const bits = bytes.readUInt32LE(start + 1); return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 } }
    offset = start + length + length % 2
  }
  throw new Error('Missing WebP dimensions')
}
function webpAnimation(bytes) {
  let frames = 0, durationMs = 0, loops = null
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4), length = bytes.readUInt32LE(offset + 4), start = offset + 8
    assert.ok(start + length <= bytes.length, 'truncated WebP chunk')
    if (kind === 'ANIM') { assert.ok(length >= 6); loops = bytes.readUInt16LE(start + 4) }
    if (kind === 'ANMF') { assert.ok(length >= 16); frames++; durationMs += bytes.readUIntLE(start + 12, 3) }
    offset = start + length + length % 2
  }
  return { frames, durationMs, loops }
}
if (values.check) {
  const retained = await loadRetainedCaptures({ root, family: 'yoga', manifest, sources, sourceHash })
  const failures = []
  for (const { asana, model, side, file } of allVariants) {
    try {
      const entry = manifest.poses[file]
      assert.ok(entry, 'missing entry')
      assert.ok(entry.sourceHash === sourceHash || retained(file, entry), 'stale sources; regenerate')
      assert.equal(entry.asanaId, asana.id); assert.equal(entry.modelVariant, model); assert.equal(entry.side, side)
      assert.deepEqual(entry.provenance, provenance)
      assert.equal(entry.image.file, file)
      assert.ok(Number.isInteger(entry.size) && entry.size >= 128 && entry.size <= 1024)
      const bytes = await readFile(join(output, file))
      assert.equal(hash(bytes), entry.image.sha256)
      assert.equal(bytes.length, entry.image.bytes)
      assert.deepEqual(webpDimensions(bytes), { width: entry.size, height: Math.round(entry.size * 3 / 4) })
      assert.ok([...entry.bounds.min, ...entry.bounds.max, ...entry.camera.position, ...entry.camera.quaternion, entry.camera.zoom].every(Number.isFinite))
      assert.ok(entry.camera.zoom > 0)
      const animation = entry.animation
      assert.equal(animation.file, yogaPreviewAnimationFile(asana.id, model, side))
      assert.equal(animation.durationSeconds, YOGA_MOTION_DURATION_SECONDS)
      assert.ok(animation.uniqueFrames > 1, 'movement must change the body raster')
      assert.equal(animation.frameCount, animation.fps * YOGA_MOTION_DURATION_SECONDS)
      const motionBytes = await readFile(join(output, animation.file))
      assert.equal(hash(motionBytes), animation.sha256)
      assert.equal(motionBytes.length, animation.bytes)
      assert.deepEqual(webpDimensions(motionBytes), { width: animation.width, height: animation.height })
      const stream = webpAnimation(motionBytes)
      assert.ok(stream.frames > 1 && stream.frames <= animation.frameCount)
      assert.equal(stream.durationMs, YOGA_MOTION_DURATION_SECONDS * 1000)
      assert.equal(stream.loops, 0)
    } catch (error) { failures.push(`${file}: ${error.message}`) }
  }
  if (failures.length) throw new Error(failures.join('\n'))
  console.log(`All ${allVariants.length} yoga posters and ${allVariants.length} movement loops (${asanas.length} asanas, both models and every anatomical side) match source motion, morphology, fixed camera, provenance and WebP files.`)
  process.exit(0)
}
const cwebp = process.env.WEBP_CWEBP_BIN ?? 'cwebp'
const encode = args => execFileSync(cwebp, args, { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 })
const encoderVersion = encode(['-version']).toString().trim()
const img2webp = process.env.WEBP_IMG2WEBP_BIN ?? 'img2webp'
const animate = args => execFileSync(img2webp, args, { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 })
const animationEncoderVersion = animate(['-version']).toString().trim()
const requireWeb = createRequire(join(webRoot, 'package.json'))
const { createServer } = await import(requireWeb.resolve('vite'))
const { chromium } = requireWeb('@playwright/test')
await mkdir(output, { recursive: true })
await mkdir(join(root, '.cache'), { recursive: true })
const temporary = await mkdtemp(join(root, '.cache/yoga-previews-'))
let server, browser
try {
  server = await createServer({ root: webRoot, server: { host: '127.0.0.1', port: 0, strictPort: true }, logLevel: 'error' })
  await server.listen()
  const port = server.httpServer.address().port
  browser = await chromium.launch({ args: process.platform === 'darwin' ? ['--enable-gpu', '--use-angle=metal'] : [] })
  const page = await browser.newPage({ viewport: { width: size, height }, deviceScaleFactor: 1 })
  page.setDefaultTimeout(90_000)
  const errors = []
  const motionReview = new Map()
  page.on('pageerror', error => errors.push(error.message))
  const renderer = { browser: await browser.version(), platform: process.platform, cwebp: encoderVersion, img2webp: animationEncoderVersion }
  async function captureFrame(label, phase = YOGA_HOLD_PHASE) {
    let timeout
    try {
      return await Promise.race([
        page.evaluate(value => window.__yogaCapture.frame(value), phase),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`Render timed out: ${label}`)), 30_000) }),
      ])
    } finally { clearTimeout(timeout) }
  }
  for (const { asana, model, side, file } of variants(models, ids)) {
    console.log(`Capturing ${file}…`)
    await page.goto(`http://127.0.0.1:${port}/yoga-preview-capture.html?asana=${asana.id}&model=${model}&side=${side}`)
    await page.waitForFunction(() => Boolean(window.__yogaCapture))
    await captureFrame(file) // Warm shaders/environment once.
    const capture = await captureFrame(file)
    if (errors.length) throw new Error(errors.join('\n'))
    assert.equal(capture.asanaId, asana.id); assert.equal(capture.modelVariant, model); assert.equal(capture.side, side)
    assert.ok(capture.png.startsWith('data:image/png;base64,'))
    const png = join(temporary, 'pose.png'), webp = join(temporary, 'pose.webp')
    await writeFile(png, Buffer.from(capture.png.split(',')[1], 'base64'))
    encode(['-quiet', '-q', '90', '-m', '6', png, '-o', webp])
    const bytes = await readFile(webp)
    assert.deepEqual(webpDimensions(bytes), { width: size, height })
    const frames = [], frameHashes = new Set(), reviewFrames = []
    for (let frame = 0; frame < frameCount; frame++) {
      const phase = frame / frameCount
      const animated = await captureFrame(`${file} frame ${frame}`, phase)
      assert.deepEqual(animated.camera, capture.camera, 'camera moved during body animation')
      assert.deepEqual(animated.bounds, capture.bounds, 'cycle bounds changed during capture')
      assert.equal(animated.phase, phase)
      const frameBytes = Buffer.from(animated.png.split(',')[1], 'base64')
      if (values['contact-sheets'] && [0, Math.round(frameCount / 4), Math.round(frameCount / 2)].includes(frame)) reviewFrames.push(animated.png)
      frameHashes.add(hash(frameBytes))
      const framePng = join(temporary, `frame-${String(frame).padStart(3, '0')}.png`)
      const frameWebp = join(temporary, `frame-${String(frame).padStart(3, '0')}.webp`)
      await writeFile(framePng, frameBytes)
      encode(['-quiet', '-q', '82', '-m', '4', '-resize', String(motionWidth), String(motionHeight), framePng, '-o', frameWebp])
      frames.push(frameWebp)
    }
    assert.ok(frameHashes.size > 1, `No body movement: ${file}`)
    const animatedFile = yogaPreviewAnimationFile(asana.id, model, side)
    const animatedPath = join(temporary, 'motion.webp')
    animate(['-loop', '0', '-lossy', '-q', '82', '-m', '4', '-d', String(frameDuration), ...frames, '-o', animatedPath])
    const motionBytes = await readFile(animatedPath)
    const stream = webpAnimation(motionBytes)
    assert.ok(stream.frames > 1, 'animation encoder produced a still image')
    assert.equal(stream.durationMs, YOGA_MOTION_DURATION_SECONDS * 1000)
    assert.deepEqual(webpDimensions(motionBytes), { width: motionWidth, height: motionHeight })
    if (errors.length) throw new Error(errors.join('\n'))
    for (const [path, expected] of Object.entries(sources)) {
      assert.equal(hash(await readFile(join(root, path))), expected, `Source changed during capture: ${path}; rerun after it stabilises`)
    }
    await mkdir(dirname(join(output, file)), { recursive: true })
    await rename(webp, join(output, file))
    await rename(animatedPath, join(output, animatedFile))
    motionReview.set(file, reviewFrames)
    manifest.poses[file] = {
      asanaId: asana.id, modelVariant: model, side, size, sourceHash, generatedAt: new Date().toISOString(),
      bounds: capture.bounds, camera: capture.camera, renderer, provenance,
      image: { file, bytes: bytes.length, sha256: hash(bytes), width: size, height },
      animation: { file: animatedFile, bytes: motionBytes.length, sha256: hash(motionBytes), width: motionWidth, height: motionHeight,
        durationSeconds: YOGA_MOTION_DURATION_SECONDS, fps, frameCount, uniqueFrames: frameHashes.size },
    }
    manifest.version = 2; manifest.sources = sources; manifest.generatedAt = new Date().toISOString()
    const next = join(temporary, 'manifest.json')
    await writeFile(next, `${JSON.stringify(manifest, null, 2)}\n`)
    await rename(next, manifestPath)
    console.log(`  ${(bytes.length / 1024).toFixed(1)} KiB poster + ${(motionBytes.length / 1024).toFixed(1)} KiB motion · ${frameHashes.size} distinct frames · ${YOGA_MOTION_DURATION_SECONDS}s`)
  }
  if (values['contact-sheets']) {
    const destination = resolve(values['contact-sheets'])
    await mkdir(destination, { recursive: true })
    const sheet = await browser.newPage({ viewport: { width: 1120, height: 1000 }, deviceScaleFactor: 1 })
    for (const model of models) {
      const entries = variants([model], ids)
      for (let start = 0; start < entries.length; start += 12) {
        const cards = await Promise.all(entries.slice(start, start + 12).map(async ({ asana, side, file }) => {
          const image = `data:image/webp;base64,${(await readFile(join(output, file))).toString('base64')}`
          return `<article><img src="${image}"><h2>${asana.name}</h2><p>${asana.id} · ${side}</p></article>`
        }))
        await sheet.setContent(`<style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#edf0eb;color:#23312d;font:13px system-ui}h1{font-size:22px;margin:0 0 14px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}article{background:white;border-radius:10px;overflow:hidden}img{width:100%;display:block}h2{font-size:15px;margin:10px 12px 3px}p{font-size:10px;margin:0 12px 12px;color:#627067}</style><h1>Yoga 3D · ${model === 'female' ? 'Mujer' : 'Hombre'} · ${start + 1}–${Math.min(start + 12, entries.length)}</h1><div class="grid">${cards.join('')}</div>`)
        await sheet.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())))
        await sheet.screenshot({ path: join(destination, `yoga-${model}-${1 + start / 12}.png`), fullPage: true })
      }
      for (let start = 0; start < entries.length; start += 8) {
        const cards = entries.slice(start, start + 8).map(({ asana, side, file }) => `<article><h2>${asana.name} · ${side}</h2><div>${motionReview.get(file).map((image, i) => `<figure><img src="${image}"><figcaption>${['Preparación', 'Entrada', 'Permanencia'][i]}</figcaption></figure>`).join('')}</div></article>`)
        await sheet.setContent(`<style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#edf0eb;color:#23312d;font:12px system-ui}h1{font-size:22px;margin:0 0 14px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}article{background:white;border-radius:10px;overflow:hidden}article>div{display:flex}figure{margin:0;width:33.333%}img{width:100%;display:block}h2{font-size:14px;margin:8px 12px}figcaption{text-align:center;padding:5px}</style><h1>Movimiento yoga · ${model === 'female' ? 'Mujer' : 'Hombre'} · cámara fija</h1><div class="grid">${cards.join('')}</div>`)
        await sheet.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())))
        await sheet.screenshot({ path: join(destination, `yoga-motion-${model}-${1 + start / 8}.png`), fullPage: true })
      }
    }
    await sheet.close()
  }
} finally {
  await browser?.close()
  await server?.close()
  await rm(temporary, { recursive: true, force: true })
}
