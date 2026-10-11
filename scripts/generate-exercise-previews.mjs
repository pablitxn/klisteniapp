#!/usr/bin/env node
/* global window */
import { createHash } from 'node:crypto'
import { readPreviewSources } from './preview-workspace-relocation.mjs'
import { previewBrowserOptions } from './preview-browser.mjs'
import { publishCapture, reusableCapture } from './preview-capture-state.mjs'
import { loadRetainedCaptures } from './preview-provenance.mjs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { AnatomicalModelVariantSchema } from '@klisteniapp/scene-schema'
import { exercises } from '../apps/b2c-web/src/data/exercises.ts'
import { previewCameras } from '../apps/b2c-web/src/lib/exercise-preview-config.ts'
import { exercisePreviewFiles } from '../apps/b2c-web/src/lib/exercise-preview-assets.ts'
import { exerciseCycleSeconds } from '../apps/b2c-web/src/lib/exercise-animation.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const webRoot = join(root, 'apps/b2c-web')
const assetRoot = join(root, 'packages/model-assets')
const output = join(assetRoot, 'public/previews')
const manifestPath = join(output, 'manifest.json')
const { values } = parseArgs({ options: {
  exercise: { type: 'string', multiple: true },
  model: { type: 'string', default: 'all' },
  size: { type: 'string', default: '256' },
  fps: { type: 'string', default: '12' },
  gif: { type: 'boolean', default: false },
  check: { type: 'boolean', default: false },
  'only-stale': { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
} })
if (values.help) {
  console.log(`Usage: pnpm previews:generate [--exercise squat] [--model male|female|all] [--gif] [--size 256] [--fps 12]
       pnpm previews:check

Captures the application's actual atlas, rig and studio at deterministic phases.
Requires Playwright Chromium, cwebp and img2webp (WebP tools); --gif also needs FFmpeg.
The script starts and closes its own local Vite server on an available port.
Outputs: packages/model-assets/public/previews/{id}.webp and {id}-poster.webp (male), female/{id}... (female).
Both anatomical models are captured by default. --model selects one while iterating.
Repeat --exercise to regenerate a subset. --check validates source/output hashes for ALL exercises and models.
--only-stale resumes matching captures only after verifying settings, renderer and every saved file hash.
WEBP_CWEBP_BIN, WEBP_IMG2WEBP_BIN and FFMPEG_BIN can override executable paths.`)
  process.exit(0)
}
const size = Number(values.size), fps = Number(values.fps)
if (!Number.isInteger(size) || size < 64 || size > 1024) throw new Error('--size must be 64..1024')
if (!Number.isInteger(fps) || fps < 1 || fps > 60) throw new Error('--fps must be 1..60')
const ids = values.exercise ?? exercises.map(({ id }) => id)
for (const id of ids) if (!exercises.some((exercise) => exercise.id === id)) throw new Error(`Unknown exercise: ${id}`)
const allModels = AnatomicalModelVariantSchema.options
if (values.model !== 'all' && !allModels.includes(values.model)) throw new Error('--model must be male, female or all')
const models = values.model === 'all' ? allModels : [values.model]

const sourcePaths = [
  'scripts/preview-workspace-relocation.mjs',
  'scripts/preview-browser.mjs',
  'scripts/preview-capture-state.mjs',
  'scripts/preview-provenance.mjs',
  'packages/anatomy-viewer/package.json',
  'packages/model-assets/package.json',
  'packages/catalog-base/package.json',
  'packages/anatomy-viewer/src/movement-library.ts',
  'packages/anatomy-viewer/src/index.ts',
  'packages/anatomy-viewer/src/anatomy-model.ts',
  'packages/anatomy-viewer/src/anatomy-rig.ts',
  'packages/anatomy-viewer/src/anatomy-variants.ts',
  'packages/anatomy-viewer/src/anatomy-variant-surface.ts',
  'packages/anatomy-viewer/src/anatomy-render-settings.ts',
  'packages/anatomy-viewer/src/exercise-preview-config.ts',
  'packages/anatomy-viewer/src/exercise-animation.ts',
  'packages/anatomy-viewer/src/AnatomicalModel.tsx',
  'packages/anatomy-viewer/src/AnatomyStudio.tsx',
  'packages/anatomy-viewer/src/ExerciseStage.tsx',
  'packages/catalog-base/src/exercises.ts',
  'packages/catalog-base/src/exercise-planning.ts',
  'packages/model-assets/src/index.ts',
  'packages/model-assets/src/vite.ts',
  'packages/catalog-base/src/index.ts',

  'scripts/generate-exercise-previews.mjs',
  'apps/b2c-web/preview-capture.html',
  'apps/b2c-web/src/preview-capture.tsx',
  'apps/b2c-web/src/lib/exercise-preview-config.ts',
  'apps/b2c-web/src/lib/exercise-preview-assets.ts',
  'apps/b2c-web/src/lib/exercise-animation.ts',
  'apps/b2c-web/src/lib/anatomy-render-settings.ts',
  'apps/b2c-web/src/components/ExerciseStage.tsx',
  'apps/b2c-web/src/components/AnatomicalModel.tsx',
  'apps/b2c-web/src/components/AnatomyStudio.tsx',
  'apps/b2c-web/src/lib/anatomy-model.ts',
  'apps/b2c-web/src/lib/anatomy-variants.ts',
  'apps/b2c-web/src/lib/anatomy-variant-surface.ts',
  'apps/b2c-web/src/lib/anatomy-rig.ts',
  'apps/b2c-web/src/data/exercises.ts',
  'apps/b2c-web/src/data/exercise-planning.ts',
  'packages/geometry/src/index.ts',
  'packages/scene-schema/src/index.ts',
  'packages/scene-schema/src/exercise-planning.ts',
  'packages/model-assets/public/models/anatomy.glb',
  'packages/model-assets/public/models/rig-landmarks.json',
  'pnpm-lock.yaml',
]
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const sources = await readPreviewSources(root, sourcePaths, 'exercise', values.check)
const sourceHash = hash(JSON.stringify(sources))
let manifest = { version: 2, sources: {}, variants: {} }
try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')) } catch (error) {
  if (error.code !== 'ENOENT') throw error
}
// Legacy assets remain at their existing URLs; retain their provenance until regenerated.
manifest.variants ??= {}
manifest.variants.male ??= { exercises: manifest.exercises ?? {} }
for (const model of allModels) manifest.variants[model] ??= { exercises: {} }
manifest.version = 2
delete manifest.exercises
delete manifest.renderer // Older manifests stored this globally; provenance is per exercise.
if (values.check) {
  const retained = await loadRetainedCaptures({ root, family: 'exercise', manifest, sources, sourceHash })
  const failures = []
  for (const modelVariant of allModels) {
    for (const { id } of exercises) {
      const entry = manifest.variants[modelVariant].exercises[id]
      const label = `${modelVariant}/${id}`
      if (!entry || (entry.sourceHash !== sourceHash && !retained(label, entry)) || entry.modelVariant !== modelVariant) {
        failures.push(`${label}: missing or stale sources; regenerate`)
        continue
      }
      const files = exercisePreviewFiles(id, modelVariant)
      for (const format of ['poster', 'animation', ...(entry.gif ? ['gif'] : [])]) {
        const asset = entry[format]
        if (asset?.file !== files[format]) {
          failures.push(`${label}: missing or incorrect ${format} reference`)
          continue
        }
        try {
          if (hash(await readFile(join(output, asset.file))) !== asset.sha256) failures.push(`${label}: modified ${asset.file}`)
        } catch { failures.push(`${label}: missing ${asset.file}`) }
      }
    }
  }
  if (failures.length) throw new Error(failures.join('\n'))
  console.log(`All ${exercises.length * allModels.length} previews (${exercises.length} exercises × ${allModels.length} models) match the current morphology, motion, renderer and generated files.`)
  process.exit(0)
}

const cwebp = process.env.WEBP_CWEBP_BIN ?? 'cwebp'
const img2webp = process.env.WEBP_IMG2WEBP_BIN ?? 'img2webp'
const ffmpeg = process.env.FFMPEG_BIN ?? 'ffmpeg'
const run = (binary, args) => execFileSync(binary, args, { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 })
for (const [binary, args] of [[cwebp, ['-version']], [img2webp, ['-version']], ...(values.gif ? [[ffmpeg, ['-version']]] : [])]) {
  try { run(binary, args) } catch { throw new Error(`Required encoder unavailable: ${binary}. See --help.`) }
}
const requireWeb = createRequire(join(webRoot, 'package.json'))
const { createServer } = await import(requireWeb.resolve('vite'))
const { chromium } = requireWeb('@playwright/test')
await mkdir(output, { recursive: true })
await mkdir(join(root, '.cache'), { recursive: true })
const temporary = await mkdtemp(join(root, '.cache/exercise-previews-'))
let server, browser
try {
  server = await createServer({ root: webRoot, server: { host: '127.0.0.1', port: 0, strictPort: true }, logLevel: 'error' })
  await server.listen()
  const port = server.httpServer.address().port
  browser = await chromium.launch(previewBrowserOptions())
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  page.setDefaultTimeout(90_000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const renderer = { browser: await browser.version(), platform: process.platform, launchArgs: previewBrowserOptions().args,
    cwebp: run(cwebp, ['-version']).toString().trim(), img2webp: run(img2webp, ['-version']).toString().trim(),
    ...(values.gif ? { ffmpeg: run(ffmpeg, ['-version']).toString().split('\n')[0] } : {}) }
  const assetRecord = async (file, staged) => {
    const bytes = await readFile(staged)
    return { file, bytes: bytes.length, sha256: hash(bytes) }
  }
  const captures = models.flatMap((modelVariant) => [...new Set(ids)].map((id) => ({ id, modelVariant })))
  for (const { id, modelVariant } of captures) {
    const files = exercisePreviewFiles(id, modelVariant)
    const duration = exerciseCycleSeconds(id)
    const frameCount = Math.round(duration * fps)
    const formats = ['poster', 'animation', ...(values.gif ? ['gif'] : [])]
    const existing = manifest.variants[modelVariant].exercises[id]
    if (values['only-stale'] && await reusableCapture({
      entry: existing, output,
      expected: { sourceHash, modelVariant, size, fps, duration, frameCount, renderer, camera: previewCameras[id], layer: 'muscles' },
      files: Object.fromEntries([...new Set([...formats, ...(existing?.gif ? ['gif'] : [])])].map(format => [format, files[format]])),
    })) {
      console.log(`Verified current ${modelVariant}/${id}; preserving capture timestamp.`)
      continue
    }
    console.log(`Capturing ${modelVariant}/${id}…`)
    const framesDir = join(temporary, modelVariant, id)
    await mkdir(framesDir, { recursive: true })
    await page.goto(`http://127.0.0.1:${port}/preview-capture.html?exercise=${id}&model=${modelVariant}`)
    await page.waitForFunction(() => Boolean(window.__exerciseCapture))
    const capture = async (phase, path) => {
      let timer
      let png
      try {
        png = await Promise.race([
          page.evaluate((value) => window.__exerciseCapture.frame(value), phase),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Render timed out: ${modelVariant}/${id}, phase ${phase}`)), 30_000)
          }),
        ])
      } finally { clearTimeout(timer) }
      if (!png.startsWith('data:image/png;base64,')) throw new Error(`Invalid capture for ${modelVariant}/${id}`)
      await writeFile(path, Buffer.from(png.split(',')[1], 'base64'))
    }
    // Warm the local environment map and compiled materials before the saved frame.
    await capture(0, join(framesDir, 'warmup.png'))
    await capture(previewCameras[id].posterPhase, join(framesDir, 'poster.png'))
    const frameArgs = []
    for (let frame = 0; frame < frameCount; frame++) {
      const path = join(framesDir, `${String(frame).padStart(4, '0')}.png`)
      // Exclude the duplicated endpoint so the loop has no pause at its seam.
      await capture(frame / frameCount, path)
      const milliseconds = Math.round((frame + 1) * 1000 / fps) - Math.round(frame * 1000 / fps)
      frameArgs.push('-d', String(milliseconds), path)
    }
    if (errors.length) throw new Error(errors.join('\n'))
    const encoded = { poster: join(framesDir, 'poster.webp'), animation: join(framesDir, 'animation.webp'), gif: join(framesDir, 'animation.gif') }
    run(cwebp, ['-quiet', '-q', '86', '-m', '6', join(framesDir, 'poster.png'), '-o', encoded.poster])
    run(img2webp, ['-loop', '0', '-lossy', '-q', '78', '-m', '6', ...frameArgs, '-o', encoded.animation])
    if (values.gif) run(ffmpeg, ['-v', 'error', '-y', '-framerate', String(fps), '-i', join(framesDir, '%04d.png'),
      '-filter_complex', '[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a', '-loop', '0', encoded.gif])
    // Vite can apply edits during a capture; never publish mixed source revisions.
    for (const path of sourcePaths) {
      if (hash(await readFile(join(root, path))) !== sources[path]) {
        throw new Error(`Capture sources changed during generation: ${path}. Stop editing and regenerate.`)
      }
    }
    // Publish only after every frame and requested encoding for this exercise succeeded.
    await mkdir(dirname(join(output, files.poster)), { recursive: true })
    const entry = { modelVariant, sourceHash, generatedAt: new Date().toISOString(), size, fps, duration, frameCount, renderer,
      camera: previewCameras[id], layer: 'muscles',
      poster: await assetRecord(files.poster, encoded.poster), animation: await assetRecord(files.animation, encoded.animation),
      ...(values.gif ? { gif: await assetRecord(files.gif, encoded.gif) } : {}),
    }
    manifest.variants[modelVariant].exercises[id] = entry
    manifest.sources = sources
    manifest.generatedAt = new Date().toISOString()
    await publishCapture({ manifest, manifestPath, stagedManifestPath: join(temporary, 'manifest.json'),
      assets: formats.map(format => ({ staged: encoded[format], published: join(output, files[format]) })),
      removedFiles: values.gif ? [] : [join(output, files.gif)],
    })
    // Keep disk use bounded to one capture even for a full catalog regeneration.
    await rm(framesDir, { recursive: true })
    console.log(`  ${frameCount} frames · ${duration}s · ${(entry.animation.bytes / 1024).toFixed(0)} KiB WebP`)
  }
} finally {
  await browser?.close()
  await server?.close()
  await rm(temporary, { recursive: true, force: true })
}
