#!/usr/bin/env node
/* global document, window */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { prepareCapture, captureSources, checkMedia, isolateCapture } from './capture-readme-context.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = join(root, 'docs/media')
const { values } = parseArgs({ options: {
  check: { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
  port: { type: 'string', default: '4197' },
  mode: { type: 'string', default: 'demo' },
} })
if (values.help) {
  console.log('node scripts/capture-readme.mjs [--mode demo|instance] [--port 4197 | --check]\nRequires installed workspace dependencies, Playwright Chromium, cwebp, and ffmpeg.\nInstance mode uses only the checked-in example profile. No user profile or account is used.')
  process.exit(0)
}
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const deployment = prepareCapture(root, values.mode)
const sources = await captureSources(root, 'scripts/capture-readme.mjs')
const sourceHash = sha256(JSON.stringify(sources))
const manifestPath = join(output, 'readme-media-manifest.json')
if (values.check) {
  await checkMedia(output, 'readme-media-manifest.json', sources, deployment, 6)
  process.exit(0)
}

const port = Number(values.port)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('--port must be an integer from 1024 to 65535')
const ffmpeg = process.env.FFMPEG_BIN ?? 'ffmpeg'
const cwebp = process.env.WEBP_CWEBP_BIN ?? 'cwebp'
const run = (binary, args) => execFileSync(binary, args, { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 })
const encoder = {
  ffmpeg: run(ffmpeg, ['-version']).toString().split('\n')[0],
  cwebp: run(cwebp, ['-version']).toString().trim(),
}
const repository = {
  head: run('git', ['-C', root, 'rev-parse', 'HEAD']).toString().trim(),
  workingTreeDirty: Boolean(run('git', ['-C', root, 'status', '--porcelain']).toString().trim()),
  note: 'Captured the working tree, including uncommitted sources. HEAD alone does not identify the captured application; use the source hashes below. This is not evidence of deployment.',
}
const requireWeb = createRequire(join(root, 'apps/web/package.json'))
const { createServer } = await import(requireWeb.resolve('vite'))
const { chromium } = requireWeb('@playwright/test')
const temporary = await mkdtemp(join(tmpdir(), 'klisteni-readme-'))
const assets = []
const errors = []
const unexpectedApiRequests = []
let browser, server
const fps = 8
try {
  server = await createServer({ root: join(root, 'apps/web'), server: { host: '127.0.0.1', port, strictPort: true }, logLevel: 'error' })
  await server.listen()
  browser = await chromium.launch({ args: process.platform === 'darwin' ? ['--enable-gpu', '--use-angle=metal'] : [] })
  await mkdir(output, { recursive: true })
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1, locale: 'es-AR', timezoneId: 'Europe/Paris', reducedMotion: 'no-preference' })
  await isolateCapture(context, values.mode, unexpectedApiRequests)
  const page = await context.newPage()
  await page.clock.setFixedTime(new Date('2026-10-04T12:00:00Z'))
  page.setDefaultTimeout(45_000)
  page.on('pageerror', (error) => errors.push(error.message))
  const ready = async () => {
    await page.waitForFunction(() => {
      const button = document.querySelector('.viewer-play')
      return button && !button.disabled
    }, null, { timeout: 90_000 })
    if (await page.locator('.viewer-fallback').count()) throw new Error('The 3D viewer fell back; refusing to publish captures.')
  }
  const scrollTo = async (selector, offset = 20) => page.locator(selector).first().evaluate((element, y) => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - y, behavior: 'instant' }), offset)
  const settle = async () => { await page.mouse.move(1, 1); await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(350) }
  const screenshot = async (file, description) => {
    await settle()
    const png = join(temporary, `${file}.png`)
    await page.screenshot({ path: png })
    run(cwebp, ['-quiet', '-lossless', '-m', '6', png, '-o', join(output, file)])
    assets.push({ file, kind: 'screenshot', description, viewport: page.viewportSize() })
    console.log(`Captured ${file}`)
  }
  const nav = async (name) => page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('button', { name, exact: true }).click()
  await page.goto(`http://127.0.0.1:${port}/`)
  await page.evaluate(() => document.fonts.ready)
  await ready()
  await page.getByRole('button', { name: 'Pausar demostración', exact: true }).click()
  await page.getByRole('slider', { name: 'Posición de la demostración' }).press('Home')
  await scrollTo('.section-heading', 26)
  await screenshot('hero-desktop.webp', 'Actual guest routine, six starter movements, anatomical viewer and educational instructions. Empty progress; no fabricated history.')

  await page.setViewportSize({ width: 430, height: 932 })
  await scrollTo('.workbench-title', 18)
  await screenshot('mobile-routine.webp', 'Actual 430 px mobile routine view, scrolled to the squat viewer; persistent bottom navigation.')

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Ampliar visor' }).click()
  await settle()
  async function recording(file, description, actions) {
    const dir = join(temporary, file)
    await mkdir(dir)
    let frame = 0
    const hold = async (seconds) => {
      const start = Date.now()
      for (let i = 0; i < Math.round(seconds * fps); i++) {
        await page.screenshot({ path: join(dir, `${String(frame++).padStart(4, '0')}.png`) })
        const wait = start + (i + 1) * 1000 / fps - Date.now()
        if (wait > 0) await page.waitForTimeout(wait)
      }
    }
    await actions(hold)
    run(ffmpeg, ['-v', 'error', '-y', '-framerate', String(fps), '-i', join(dir, '%04d.png'),
      '-filter_complex', '[0:v]split[a][b];[a]palettegen=stats_mode=diff:max_colors=192[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
      '-loop', '0', join(output, file)])
    assets.push({ file, kind: 'animation', description, viewport: page.viewportSize(), fps, frameCount: frame, durationSeconds: frame / fps })
    console.log(`Captured ${file}: ${frame} frames`)
  }
  await recording('anatomy-exploration.gif', 'Squat motion, anatomical pose, skin and skeleton layers, then muscular roles in motion. Captured from the real expanded viewer.', async (hold) => {
    await page.getByRole('button', { name: 'Reproducir demostración', exact: true }).click()
    await hold(3)
    await page.getByRole('button', { name: 'Anatomía', exact: true }).click()
    await page.getByRole('button', { name: 'Frente', exact: true }).click()
    await page.getByRole('button', { name: 'Piel', exact: true }).click()
    await settle(); await hold(1.5)
    await page.getByRole('button', { name: 'Huesos', exact: true }).click()
    await settle(); await hold(1.5)
    await page.getByRole('button', { name: 'Músculos', exact: true }).click()
    await settle(); await hold(1.5)
    await page.getByRole('button', { name: 'Mostrar trabajo muscular', exact: true }).click()
    await page.locator('.anatomy-camera').getByRole('button', { name: '3D', exact: true }).click()
    await page.getByRole('button', { name: 'Movimiento', exact: true }).click()
    await settle(); await hold(3)
  })
  await page.getByRole('button', { name: 'Cerrar vista ampliada' }).click()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await nav('Ejercicios')
  await scrollTo('.library-section', 40)
  await page.locator('.library-card').first().hover()
  await page.waitForTimeout(500)
  await screenshot('exercise-library.webp', 'The exercise catalogue with genuine anatomical previews and filters for movement, level and equipment.')
  await recording('exercise-library.gif', 'Filter the live catalogue to squats, search for a paused squat, then open its animated instructions.', async (hold) => {
    await page.locator('.library-card').first().hover(); await hold(1.5)
    await page.locator('.filter-pills').getByRole('button', { name: 'Sentadilla', exact: true }).click()
    await page.locator('.library-card').first().hover(); await hold(2)
    await page.getByRole('textbox', { name: 'Buscar ejercicio o músculo' }).fill('pausa')
    await page.locator('.library-card').first().hover(); await hold(2)
    await page.locator('.library-card').first().click()
    await ready(); await scrollTo('.workbench-title', 24); await settle()
    // Loading and navigation waits are omitted from the published sequence.
    await hold(3)
    await page.getByRole('tab', { name: 'Claves de técnica', exact: true }).click()
    await scrollTo('.lesson-tabs', 420)
    await settle(); await hold(2)
  })

  await nav('Mi rutina')
  await page.getByRole('button', { name: 'Personalizar', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await recording('routine-flow.gif', 'Customize a one-exercise, one-set demonstration routine, enter eight fictional squat repetitions, save through the real local UI, and inspect the resulting progress. Not an actual workout or a recommended complete routine.', async (hold) => {
    await dialog.getByLabel('Series por ejercicio').selectOption('1')
    await settle(); await hold(1.5)
    for (const name of ['Flexiones', 'Puente', 'Dead bug', 'W en el suelo', 'Talones']) {
      await dialog.getByRole('button', { name: `Quitar ${name}`, exact: true }).click()
    }
    await settle(); await hold(1.5)
    await dialog.getByRole('button', { name: 'Guardar mi rutina', exact: true }).click()
    await page.getByRole('button', { name: 'Empezar mi rutina', exact: true }).click()
    await ready(); await scrollTo('.workbench-title', 24); await settle()
    const session = page.getByRole('region', { name: 'Sesión en curso', exact: true })
    await session.getByRole('spinbutton', { name: 'Repeticiones', exact: true }).fill('8')
    await settle(); await hold(2)
    await session.getByRole('button', { name: 'Registrar serie', exact: true }).click()
    await settle(); await hold(2)
    await session.getByRole('button', { name: 'Guardar sesión', exact: true }).click()
    await page.locator('.activity-history').waitFor()
    await scrollTo('.page-heading', 28); await settle(); await hold(3)
  })
  const recorded = await page.evaluate(() => JSON.parse(localStorage.getItem('klisteniapp.progress.v1')))
  const logged = recorded?.workouts?.[0]?.exercises?.[0]
  if (recorded.workouts.length !== 1 || recorded.cardio.length !== 0 || logged?.exerciseId !== 'squat' || logged?.sets !== 1 || logged?.reps !== 8) throw new Error('Routine recording did not produce the expected single fictional squat set.')

  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`)
  if (unexpectedApiRequests.length) throw new Error(`Unexpected API requests: ${unexpectedApiRequests.join('; ')}`)
  const records = await Promise.all(assets.map(async (asset) => ({ ...asset, bytes: (await stat(join(output, asset.file))).size, sha256: sha256(await readFile(join(output, asset.file))) })))
  await writeFile(manifestPath, JSON.stringify({ version: 2, generatedAt: new Date().toISOString(), sourceHash, sources, deployment,
    repository, browser: await browser.version(), platform: process.platform, encoder,
    capture: 'Unmodified local Vite application in the recorded deployment mode; real controls and screenshots; external/API requests blocked. Instance preview only: anonymous session stubbed to null and public example profile. The routine-flow clip creates one fictional local workout through the UI, after all other assets have been captured.',
    demoRecord: { origin: 'Real UI input in the disposable guest browser; not a real workout', workouts: 1, exerciseId: 'squat', sets: 1, reps: 8, date: recorded.workouts[0].date },
    verification: { browserErrors: errors, unexpectedApiRequests, savedDemoRecordMatches: true },
    timing: 'Frames requested at 8 fps. Slow screenshot readback can compress wall-clock time. UI waits between steps are omitted. Not a performance benchmark.',
    license: 'CC BY-SA 4.0 for media containing anatomy; see NOTICE.md.', assets: records,
  }, null, 2) + '\n')
  console.log(`Published ${records.length} assets, ${(records.reduce((total, asset) => total + asset.bytes, 0) / 1024 / 1024).toFixed(2)} MiB. Review the screenshots and GIF contact sheets visually.`)
} finally {
  await browser?.close()
  await server?.close()
  await rm(temporary, { recursive: true, force: true })
}
