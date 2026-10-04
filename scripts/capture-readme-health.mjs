#!/usr/bin/env node
/* global document, scrollTo, scrollY */
/**
 * Capture real local health/progress UI with deterministic, fictional records.
 * Run: node scripts/capture-readme-health.mjs [--port 4198] [--no-gif]
 * Requires workspace dependencies, Playwright Chromium and FFmpeg (unless --no-gif).
 * No account is signed in, no API/cloud state is written, no user browser is reused.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createDefaultPersonalData, PersonalDataSchema } from '../packages/scene-schema/src/index.ts'
import { prepareCapture, captureSources, checkMedia, isolateCapture } from './capture-readme-context.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const webRoot = join(root, 'apps/web')
const output = join(root, 'docs/media')
const { values } = parseArgs({ options: { port: { type: 'string', default: '4198' }, mode: { type: 'string', default: 'demo' }, check: { type: 'boolean', default: false }, 'no-gif': { type: 'boolean', default: false } } })
const deployment = prepareCapture(root, values.mode)
const port = Number(values.port)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('--port must be between 1024 and 65535')
const captureDate = '2026-10-04T12:00:00Z'
const timeZone = 'Europe/Paris'
const viewport = { width: 1600, height: 1300 }
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const day = offset => new Date(Date.parse('2026-09-05T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10)
const record = (id, date) => ({ id: `readme-fictional-${id}`, date, recordedAt: `${date}T09:00:00Z`, source: { kind: 'manual' }, timeZone })

// Deliberately synthetic data, unrelated to the user's health. Gaps and ordinary
// day-to-day variation demonstrate observed records, not medical predictions.
const fixture = createDefaultPersonalData('Demo ficticia del README', timeZone)
const health = fixture.settings.health
health.profile = { heightCm: 175, context: 'Demostración ficticia para el README. Registros inventados; no pertenecen a una persona real.' }
health.measurements = [72.6, 72.8, 72.5, 72.4, 72.6, 72.2, 72.3, 72.1, 72.4, 72.2].map((weightKg, index) => ({ ...record(`body-${index}`, day(index * 3)), weightKg, waistCm: [84, 84.2, 84, 83.8, 84, 83.6, 83.7, 83.5, 83.8, 83.6][index] }))
health.sleep = [405, 435, 420, 455, 395, 440, 450, 430, 420, 465, 440, 455, 410, 445, 460, 425, 450, 435, 455, 450].map((durationMinutes, index) => ({ ...record(`sleep-${index}`, day(index + 10)), durationMinutes }))
health.activity = [6400, 7200, 8100, 6800, 9200, 5400, 7800].map((steps, index) => ({ ...record(`activity-${index}`, day(index + 23)), steps, activeMinutes: [32, 38, 46, 35, 52, 28, 41][index], restingHeartRateBpm: [63, 61, 64, 62, 60, 63, 62][index] }))
health.nutrition = [17, 19, 21, 23, 24, 26, 28, 29].map((offset, index) => ({ ...record(`meal-${index}`, day(offset)), meal: ['Almuerzo · lentejas y verduras', 'Desayuno · yogur y fruta', 'Cena · arroz y verduras', 'Almuerzo · ensalada y garbanzos'][index % 4], energyKcal: [520, 340, 560, 480][index % 4], proteinG: [24, 18, 26, 22][index % 4] }))
health.goals = [
  { id: 'readme-fictional-goal-consistency', title: 'Hacer espacio para mi práctica', metric: 'weeklyTrainingDays', target: 3, startDate: '2026-09-07', targetDate: '2026-10-31', notes: 'Objetivo ficticio elegido para mostrar el seguimiento.' },
  { id: 'readme-fictional-goal-sleep', title: 'Observar mi descanso', metric: 'sleepMinutes', target: 480, startDate: '2026-09-15', targetDate: '2026-10-31' },
]
fixture.progress.workouts = [2, 5, 9, 12, 16, 19, 22, 24, 26, 28].map((offset, index) => ({
  id: `readme-fictional-workout-${index}`, date: day(offset), completedAt: `${day(offset)}T10:30:00Z`, timeZone, durationMinutes: [22, 24, 26, 23][index % 4],
  exercises: ['pushup', 'squat', 'glute-bridge', 'dead-bug', 'prone-w', 'calf-raise'].map(exerciseId => ({ exerciseId, sets: 2, reps: 8 + index % 3 })),
}))
fixture.progress.cardio = [3, 6, 10, 13, 17, 20, 23, 25, 29].map((offset, index) => ({ id: `readme-fictional-cardio-${index}`, date: day(offset), activity: 'walk', minutes: 25 + index % 4 * 5, distanceKm: 1.8 + index % 3 * .4, timeZone }))
const data = PersonalDataSchema.parse(fixture)
const sources = await captureSources(root, 'scripts/capture-readme-health.mjs')
const sourceHash = hash(JSON.stringify(sources))
if (values.check) {
  await checkMedia(output, 'health-media-manifest.json', sources, deployment, 4)
  process.exit(0)
}
const requireWeb = createRequire(join(webRoot, 'package.json'))
const { createServer } = await import(requireWeb.resolve('vite'))
const { chromium, expect } = requireWeb('@playwright/test')
const temporary = await mkdtemp(join(tmpdir(), 'klisteni-readme-health-'))
const ffmpeg = process.env.FFMPEG_BIN ?? 'ffmpeg'
if (!values['no-gif']) execFileSync(ffmpeg, ['-version'], { stdio: 'pipe' })
await mkdir(output, { recursive: true })
let server, browser
const browserErrors = []
const unexpectedRequests = []
const assets = []
try {
  server = await createServer({ root: webRoot, server: { host: '127.0.0.1', port, strictPort: true }, logLevel: 'error' })
  await server.listen()
  browser = await chromium.launch({ args: process.platform === 'darwin' ? ['--enable-gpu', '--use-angle=metal'] : [] })
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'es-AR', timezoneId: timeZone, reducedMotion: 'reduce' })
  await isolateCapture(context, values.mode, unexpectedRequests)
  await context.addInitScript(fixture => {
    localStorage.clear()
    localStorage.setItem('klisteniapp.personal.v2', JSON.stringify(fixture))
    localStorage.setItem('klisteniapp.progress.v1', JSON.stringify(fixture.progress))
    localStorage.setItem('klisteniapp.preferences.v1', JSON.stringify({ weeklyGoal: 3, sets: 2, exerciseIds: fixture.settings.routines[0].exerciseIds, reducedMotion: true }))
  }, data)
  const page = await context.newPage()
  page.setDefaultTimeout(30000)
  page.on('pageerror', error => browserErrors.push(error.message))
  await page.clock.setFixedTime(new Date(captureDate))
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle' })
  const nav = page.getByRole('navigation', { name: 'Navegación principal', exact: true })
  await nav.getByRole('button', { name: 'Mi salud', exact: true }).click()
  await expect(page.getByText(/Modo local gratuito:/)).toBeVisible()
  await expect(page.locator('.health-trend-value')).toContainText('72,2 kg')
  await page.evaluate(() => document.fonts.ready)
  const saveScreenshot = async (name, options = {}) => {
    const png = await page.screenshot({ path: join(output, name), animations: 'disabled', ...options })
    assets.push({ file: name, format: 'png', width: png.readUInt32BE(16), height: png.readUInt32BE(20), ...options })
  }
  await page.locator('.health-dashboard-toolbar').evaluate(element => scrollTo(0, element.getBoundingClientRect().top + scrollY - 32))
  await saveScreenshot('health-dashboard.png')
  await page.setViewportSize({ width: 430, height: 932 })
  await page.locator('.health-dashboard-charts').evaluate(element => scrollTo(0, element.getBoundingClientRect().top + scrollY - 20))
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(430)
  await saveScreenshot('health-dashboard-mobile.png')
  await page.setViewportSize(viewport)
  await nav.getByRole('button', { name: 'Mi progreso', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Una semana a tu ritmo' })).toBeVisible()
  await page.evaluate(() => scrollTo(0, 0))
  await saveScreenshot('progress.png')

  if (!values['no-gif']) {
    await page.setViewportSize({ width: 1440, height: 980 })
    await nav.getByRole('button', { name: 'Mi salud', exact: true }).click()
    await page.locator('.health-dashboard-toolbar').scrollIntoViewIfNeeded()
    const frames = []
    const hold = async seconds => {
      // Capture real frames after genuine UI actions. Do not compose mock cards,
      // conceal local-mode status, relabel claims or alter application styling.
      for (let i = 0; i < seconds * 6; i++) {
        const filename = join(temporary, `${String(frames.length).padStart(4, '0')}.png`)
        await page.screenshot({ path: filename, animations: 'disabled' })
        frames.push(filename)
        await page.waitForTimeout(1000 / 6)
      }
    }
    await hold(2)
    await page.getByRole('combobox', { name: 'Período del dashboard', exact: true }).selectOption('7')
    await hold(2)
    await page.getByRole('combobox', { name: 'Período del dashboard', exact: true }).selectOption('30')
    await page.getByRole('combobox', { name: 'Medida del gráfico', exact: true }).selectOption('waistCm')
    await page.locator('.health-dashboard-charts').scrollIntoViewIfNeeded()
    await hold(3)
    await page.getByRole('navigation', { name: 'Secciones de mi salud' }).getByRole('button', { name: 'Objetivos', exact: true }).click()
    await page.evaluate(() => scrollTo(0, 0))
    await hold(3)
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', '6', '-i', join(temporary, '%04d.png'), '-filter_complex', 'fps=6,scale=1000:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=192[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0', join(output, 'health-tour.gif')], { stdio: 'pipe', maxBuffer: 8 * 1024 * 1024 })
    assets.push({ file: 'health-tour.gif', format: 'gif', width: 1000, height: 681, frames: frames.length, framesPerSecond: 6, durationSeconds: frames.length / 6 })
  }
  if (unexpectedRequests.length) throw new Error(`Unexpected private API requests: ${unexpectedRequests.join(', ')}`)
  if (browserErrors.length) throw new Error(`Browser errors: ${browserErrors.join(', ')}`)
  const manifest = {
    version: 2, generatedAt: new Date().toISOString(), captureDate, timeZone, sourceHash, deployment,
    command: `node scripts/capture-readme-health.mjs --mode ${values.mode} --port ${port}${values['no-gif'] ? ' --no-gif' : ''}`,
    provenance: 'Real application UI served by local Vite. Isolated anonymous Playwright context. Schema-validated fictional localStorage fixture; no actual personal data, cloud account, account writes, watch connection or deployed-backend verification.',
    git: { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()), warning: 'Captured from the working tree, including uncommitted changes. The HEAD identifies the base only; source hashes identify the rendered files. This is not evidence of deployment.' },
    sessionIsolation: 'Demo mode blocks every API request. Instance preview only: GET /api/auth/get-session receives JSON null and the public example profile is used. Other API and external HTTP requests are blocked and cause capture failure.',
    fixtureSha256: hash(JSON.stringify(data)), fixtureCounts: { measurements: health.measurements.length, sleep: health.sleep.length, activity: health.activity.length, nutrition: health.nutrition.length, supplements: health.supplements.length, goals: health.goals.length, workouts: data.progress.workouts.length, cardio: data.progress.cardio.length },
    browser: await browser.version(), platform: process.platform, sources,
    assets: await Promise.all(assets.map(async asset => ({ ...asset, bytes: (await stat(join(output, asset.file))).size, sha256: hash(await readFile(join(output, asset.file))) }))),
    verification: { schema: 'PersonalDataSchema.parse', horizontalOverflowMobile: false, browserErrors, unexpectedPrivateRequests: unexpectedRequests },
  }
  await writeFile(join(output, 'health-media-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(JSON.stringify(manifest.assets, null, 2))
} finally {
  await browser?.close()
  await server?.close()
  await rm(temporary, { recursive: true, force: true })
}
