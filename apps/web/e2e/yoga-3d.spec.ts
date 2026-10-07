import { expect, test, type Locator, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { createDefaultPersonalData, type YogaPractice } from '@klisteniapp/scene-schema'
import { asanas } from '../src/data/yoga'
import { openSettings } from './settings-helpers'

test.use({ video: { mode: 'on', size: { width: 1440, height: 1000 } } })

const practice: YogaPractice = {
  id: 'yoga-anatomy-sides', name: 'Lados de yoga', intention: 'Reconocer cada lado',
  steps: [
    { id: 'left', asanaId: 'virabhadrasana-ii', side: 'left', durationSeconds: 30 },
    { id: 'right', asanaId: 'virabhadrasana-ii', side: 'right', durationSeconds: 30 },
  ],
}

async function seed(page: Page) {
  const data = createDefaultPersonalData('Yoga 3D local', 'Europe/Tirane')
  data.settings.yoga = { practices: [practice], logs: [] }
  await page.addInitScript(value => localStorage.setItem('klisteniapp.personal.v2', JSON.stringify(value)), data)
}

async function openYoga(page: Page, mobile = false) {
  await page.goto('/')
  await page.getByRole('navigation', { name: mobile ? 'Navegación móvil' : 'Navegación principal', exact: true }).getByRole('button', { name: 'Yoga', exact: true }).click()
  await expect(page.locator('.yoga-asana-card')).toHaveCount(24)
}

async function selectModel(page: Page, model: 'male' | 'female') {
  const settings = await openSettings(page)
  await settings.getByRole('combobox', { name: 'Modelo corporal', exact: true }).selectOption(model)
  await expect(settings.getByRole('combobox', { name: 'Modelo corporal', exact: true })).toHaveValue(model)
  await settings.getByRole('button', { name: 'Cerrar', exact: true }).click()
}

async function expectLoaded(image: Locator) {
  await image.scrollIntoViewIfNeeded()
  await expect.poll(() => image.evaluate(node => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0)).toBe(true)
}

async function openTree(page: Page) {
  const card = page.locator('.yoga-asana-card').filter({ has: page.locator('.yoga-asana-preview[data-asana="vrksasana"]') })
  await card.getByRole('button', { name: 'Explorar asana', exact: true }).click()
  const detail = page.getByRole('dialog', { name: 'Árbol', exact: true })
  await expect(detail).toBeVisible()
  return detail
}

test.describe('3D source posters and the non-WebGL path', () => {
  test.use({ reducedMotion: 'reduce' })
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (/webgl|experimental-webgl/.test(type)) return null
        return Reflect.apply(getContext, this, [type, ...args])
      } as typeof getContext
    })
  })

  test('all 24 cards load the chosen anatomical variant without per-card canvases or vector figures', async ({ page }) => {
    await openYoga(page)
    for (const model of ['male', 'female'] as const) {
      if (model === 'female') await selectModel(page, model)
      for (const asana of asanas) {
        const preview = page.locator(`.yoga-asana-card .yoga-asana-preview[data-asana="${asana.id}"]`)
        const side = asana.bilateral ? 'both' : 'right'
        await expect(preview).toHaveAttribute('data-model', model)
        await expect(preview).toHaveAttribute('data-side', side)
        await expect(preview.locator('img')).toHaveAttribute('src', `/previews/yoga/${model}/${asana.id}-${side}.webp`)
        await expectLoaded(preview.locator('img'))
      }
      await expect(page.locator('.yoga-page canvas')).toHaveCount(0)
      await expect(page.locator('.yoga-asana-preview svg')).toHaveCount(0)
      if (model === 'female') {
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({ path: test.info().outputPath('yoga-library-female-desktop.png') })
      }
    }
    await page.reload()
    await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('button', { name: 'Yoga', exact: true }).click()
    const first = page.locator('.yoga-asana-card .yoga-asana-preview').first()
    await expect(first).toHaveAttribute('data-model', 'female')
    await expectLoaded(first.locator('img'))
  })

  test('the detail keeps a real render of its chosen side when interactive WebGL is unavailable', async ({ page }) => {
    await openYoga(page)
    await selectModel(page, 'female')
    const detail = await openTree(page)
    const viewer = detail.locator('.yoga-anatomy-viewer')
    await expect(viewer).toHaveAttribute('data-model', 'female')
    await viewer.getByRole('button', { name: 'Lado izquierdo', exact: true }).click()
    await expect(viewer).toHaveAttribute('data-side', 'left')
    const poster = viewer.locator('.yoga-asana-preview img')
    await expect(poster).toHaveAttribute('src', '/previews/yoga/female/vrksasana-left.webp')
    await expectLoaded(poster)
    await viewer.getByRole('button', { name: 'Explorar en 3D', exact: true }).click()
    await expect(viewer.locator('.yoga-viewer-fallback')).toContainText('El visor 3D no está disponible')
    await expectLoaded(poster)
    await expect(viewer.locator('canvas')).toHaveCount(0)
    await expect(viewer.locator('.yoga-asana-preview svg')).toHaveCount(0)
    await expect(detail).toContainText('Fuentes y lecturas')
    await viewer.getByRole('button', { name: 'Lado derecho', exact: true }).click()
    await expect(poster).toHaveAttribute('src', '/previews/yoga/female/vrksasana-right.webp')
    await expectLoaded(poster)
    expect(await poster.evaluate(node => getComputedStyle(node).transform)).toBe('none')
  })

  test('guided postures follow the saved global model and each explicit side without changing the practice', async ({ page }) => {
    await seed(page)
    await openYoga(page)
    for (const model of ['female', 'male'] as const) {
      await selectModel(page, model)
      await page.getByRole('navigation', { name: 'Secciones de yoga' }).getByRole('button', { name: 'Mis prácticas' }).click()
      await page.getByRole('button', { name: `Comenzar ${practice.name}`, exact: true }).click()
      const session = page.getByRole('dialog', { name: practice.name, exact: true })
      const viewer = session.locator('.yoga-anatomy-viewer')
      await expect(viewer).toHaveAttribute('data-model', model)
      await expect(viewer).toHaveAttribute('data-side', 'left')
      await expect(viewer.locator('.yoga-asana-preview img')).toHaveAttribute('src', `/previews/yoga/${model}/virabhadrasana-ii-left.webp`)
      await expectLoaded(viewer.locator('.yoga-asana-preview img'))
      await expect(viewer.getByRole('button', { name: 'Lado izquierdo', exact: true })).toHaveCount(0)
      await session.getByRole('button', { name: 'Saltar asana', exact: true }).click()
      await expect(viewer).toHaveAttribute('data-side', 'right')
      await expect(viewer.locator('.yoga-asana-preview img')).toHaveAttribute('src', `/previews/yoga/${model}/virabhadrasana-ii-right.webp`)
      await expectLoaded(viewer.locator('.yoga-asana-preview img'))
      await session.getByRole('button', { name: 'Terminar ahora', exact: true }).click()
      await session.getByRole('button', { name: 'Salir sin guardar', exact: true }).click()
      await expect(session).not.toBeVisible()
    }
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('klisteniapp.personal.v2')!).settings.yoga)
    expect(saved.practices).toEqual([practice])
    expect(saved.logs).toEqual([])
  })

  test('the anatomical poster and viewer controls fit a narrow mobile detail', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await page.emulateMedia({ colorScheme: 'dark' })
    await openYoga(page, true)
    await expectLoaded(page.locator('.yoga-asana-card .yoga-asana-preview img').first())
    await page.screenshot({ path: test.info().outputPath('yoga-library-mobile-cards.png') })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: test.info().outputPath('yoga-library-mobile.png') })
    const detail = await openTree(page)
    const viewer = detail.locator('.yoga-anatomy-viewer')
    await expectLoaded(viewer.locator('.yoga-asana-preview img'))
    await viewer.getByRole('button', { name: 'Explorar en 3D', exact: true }).click()
    await expect(viewer.locator('.yoga-viewer-fallback')).toContainText('El visor 3D no está disponible')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
    const bounds = await detail.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(321)
    expect(await detail.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: test.info().outputPath('yoga-3d-mobile-fallback.png') })
  })
})

test.describe('interactive anatomical yoga', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the live model renders both variants and camera controls change the actual canvas', async ({ page }) => {
    test.setTimeout(process.env.CI ? 300_000 : 150_000)
    const errors: string[] = []
    let loadedAtlas = false
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => {
      if (!response.url().endsWith('/models/anatomy.glb') || !response.ok()) return
      void response.body().then(bytes => {
        // The production GLB actually arrived; a canvas or poster alone cannot satisfy this.
        loadedAtlas = bytes.length > 100_000 && bytes.subarray(0, 4).toString() === 'glTF'
      }).catch(() => { /* A cancelled initial viewer may be followed by the yoga load. */ })
    })
    await openYoga(page)
    let maleFront: Buffer | undefined
    for (const model of ['male', 'female'] as const) {
      if (model === 'female') await selectModel(page, model)
      const detail = await openTree(page)
      const viewer = detail.locator('.yoga-anatomy-viewer')
      await expect(viewer).toHaveAttribute('data-model', model)
      await viewer.getByRole('button', { name: 'Explorar en 3D', exact: true }).click()
      const canvas = viewer.locator('canvas')
      await expect(canvas).toBeVisible()
      await expect(viewer.getByRole('button', { name: 'Restablecer vista', exact: true })).toBeEnabled({ timeout: process.env.CI ? 120_000 : 45_000 })
      await expect(viewer.locator('.yoga-viewer-stage')).toHaveClass(/is-ready/)
      await expect.poll(() => loadedAtlas).toBe(true)
      await viewer.getByRole('combobox', { name: 'Capa del modelo', exact: true }).selectOption({ label: 'Piel' })
      await viewer.getByRole('button', { name: 'Frontal', exact: true }).click()
      const front = await canvas.screenshot({ path: test.info().outputPath(`yoga-${model}-front.png`) })
      await detail.evaluate(node => { node.scrollTop = 0 })
      await page.screenshot({ path: test.info().outputPath(`yoga-${model}-detail.png`) })
      await viewer.getByRole('button', { name: 'Lateral', exact: true }).click()
      const lateral = await canvas.screenshot({ path: test.info().outputPath(`yoga-${model}-side.png`) })
      expect(front.equals(lateral)).toBe(false)
      if (model === 'male') maleFront = front
      else expect(front.equals(maleFront!)).toBe(false)
      await expect(viewer.locator('.yoga-viewer-fallback')).toHaveCount(0)
      await detail.getByRole('button', { name: 'Cerrar', exact: true }).click()
    }
    expect(errors).toEqual([])
  })
})

type CameraMatrices = { view: number[]; projection: number[]; mainDraws: number }

/** Observe the matrices sent to the GPU, independently of the viewer's UI state. */
async function observeCamera(page: Page) {
  await page.addInitScript(() => {
    const matrices: CameraMatrices = { view: [], projection: [], mainDraws: 0 }
    Object.assign(window, { __yogaCameraMatrices: matrices })
    const names = new WeakMap<WebGLUniformLocation, { name: string; program: WebGLProgram }>()
    const programs = new WeakMap<WebGLProgram, { view?: number[]; projection?: number[] }>()
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const locate = prototype.getUniformLocation
      const matrix = prototype.uniformMatrix4fv
      prototype.getUniformLocation = function (program: WebGLProgram, name: string) {
        const location = locate.call(this, program, name)
        if (location) names.set(location, { name, program })
        return location
      }
      prototype.uniformMatrix4fv = function (location: WebGLUniformLocation | null, transpose: boolean, data: Float32List, ...rest: number[]) {
        const uniform = location && names.get(location)
        if (uniform && (uniform.name === 'viewMatrix' || uniform.name === 'projectionMatrix')) {
          const camera = programs.get(uniform.program) ?? {}
          camera[uniform.name === 'viewMatrix' ? 'view' : 'projection'] = Array.from(data)
          programs.set(uniform.program, camera)
        }
        Reflect.apply(matrix, this, [location, transpose, data, ...rest])
      }
      const methods = prototype as unknown as Record<string, unknown>
      for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const draw = methods[name]
        if (typeof draw !== 'function') continue
        methods[name] = function (this: WebGLRenderingContext, ...args: unknown[]) {
          // Exclude the initial exercise viewer, shadow maps and environment captures.
          if (this.canvas instanceof HTMLCanvasElement && this.canvas.closest('.yoga-anatomy-viewer') && this.getParameter(this.FRAMEBUFFER_BINDING) === null) {
            const camera = programs.get(this.getParameter(this.CURRENT_PROGRAM) as WebGLProgram)
            if (camera?.view && camera.projection) {
              matrices.view = [...camera.view]
              matrices.projection = [...camera.projection]
              matrices.mainDraws++
            }
          }
          return Reflect.apply(draw, this, args)
        }
      }
    }
  })
}

async function cameraMatrices(page: Page) {
  const matrices = await page.evaluate(() => (window as typeof window & { __yogaCameraMatrices: CameraMatrices }).__yogaCameraMatrices)
  expect(matrices.view).toHaveLength(16)
  expect(matrices.projection).toHaveLength(16)
  expect(matrices.mainDraws).toBeGreaterThan(0)
  return { view: matrices.view, projection: matrices.projection }
}

async function seekMotion(viewer: Locator, phase: number) {
  const slider = viewer.getByRole('slider', { name: 'Recorrido del movimiento', exact: true })
  await slider.evaluate((node, value) => {
    const input = node as HTMLInputElement
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, phase)
  await expect(slider).toHaveValue(String(phase))
  await expect(viewer.getByRole('button', { name: 'Reproducir movimiento', exact: true })).toBeVisible()
  return slider
}

async function readyMotion(viewer: Locator) {
  await viewer.getByRole('button', { name: 'Explorar en 3D', exact: true }).click()
  await expect(viewer.getByRole('button', { name: 'Restablecer vista', exact: true })).toBeEnabled({ timeout: process.env.CI ? 120_000 : 45_000 })
  await expect(viewer.locator('.yoga-viewer-stage')).toHaveClass(/is-ready/)
}

async function pauseMotion(viewer: Locator) {
  const pause = viewer.getByRole('button', { name: 'Pausar movimiento', exact: true })
  if (await pause.isVisible()) await pause.click()
  await expect(viewer.getByRole('button', { name: 'Reproducir movimiento', exact: true })).toBeVisible()
}

test.describe('anatomical movement playback', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('both bodies and sides move under a fixed camera; pause freezes the raster and seeking changes the pose', async ({ page }) => {
    test.setTimeout(process.env.CI ? 360_000 : 180_000)
    const recordedAt = Date.now()
    const clips: { model: string; side: string; startSeconds: number; durationSeconds: number; canvas: { x: number; y: number; width: number; height: number } }[] = []
    await observeCamera(page)
    await openYoga(page)
    for (const model of ['male', 'female'] as const) {
      if (model === 'female') await selectModel(page, model)
      const detail = await openTree(page)
      const viewer = detail.locator('.yoga-anatomy-viewer')
      await readyMotion(viewer)
      await expect(viewer.getByRole('button', { name: 'Pausar movimiento', exact: true })).toBeVisible()
      await pauseMotion(viewer)
      await viewer.getByRole('combobox', { name: 'Capa del modelo', exact: true }).selectOption({ label: 'Piel' })
      await viewer.getByRole('button', { name: 'Frontal', exact: true }).click()
      const canvas = viewer.locator('canvas')
      for (const side of ['left', 'right'] as const) {
        await viewer.getByRole('button', { name: side === 'left' ? 'Lado izquierdo' : 'Lado derecho', exact: true }).click()
        await expect(viewer).toHaveAttribute('data-side', side)
        await expect(viewer.getByRole('button', { name: 'Restablecer vista', exact: true })).toBeEnabled()
        const slider = await seekMotion(viewer, 0)
        await expect(viewer).toContainText('Preparación')
        const prepared = await canvas.screenshot({ path: test.info().outputPath(`motion-${model}-${side}-prepare.png`) })
        const fixedCamera = await cameraMatrices(page)
        await seekMotion(viewer, 0.5)
        await expect(viewer).toContainText('Permanencia')
        const hold = await canvas.screenshot({ path: test.info().outputPath(`motion-${model}-${side}-hold.png`) })
        expect(prepared.equals(hold)).toBe(false)
        expect(await cameraMatrices(page)).toEqual(fixedCamera)
        await page.waitForTimeout(500)
        expect((await canvas.screenshot()).equals(hold)).toBe(true)
        await seekMotion(viewer, 0.1)
        const before = await canvas.screenshot()
        await viewer.getByRole('button', { name: 'Reproducir movimiento', exact: true }).click()
        await canvas.scrollIntoViewIfNeeded()
        const clipStart = Date.now()
        const canvasBounds = await canvas.boundingBox()
        await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(0.25)
        const moving = await canvas.screenshot({ path: test.info().outputPath(`motion-${model}-${side}-playing.png`) })
        expect(moving.equals(before)).toBe(false)
        expect(await cameraMatrices(page)).toEqual(fixedCamera)
        clips.push({ model, side, startSeconds: (clipStart - recordedAt) / 1000, durationSeconds: (Date.now() - clipStart) / 1000, canvas: canvasBounds! })
        await pauseMotion(viewer)
        const paused = await canvas.screenshot()
        const phase = await slider.inputValue()
        await page.waitForTimeout(700)
        await expect(slider).toHaveValue(phase)
        expect((await canvas.screenshot()).equals(paused)).toBe(true)
      }
      await detail.getByRole('button', { name: 'Cerrar', exact: true }).click()
    }
    await writeFile(test.info().outputPath('motion-video-clips.json'), JSON.stringify(clips, null, 2))
  })

  test('speed changes movement timing and hidden or suspended views stay paused when restored', async ({ page }) => {
    test.setTimeout(process.env.CI ? 240_000 : 120_000)
    await openYoga(page)
    const detail = await openTree(page)
    const viewer = detail.locator('.yoga-anatomy-viewer')
    await readyMotion(viewer)
    await pauseMotion(viewer)
    const slider = viewer.getByRole('slider', { name: 'Recorrido del movimiento', exact: true })
    const rates: number[] = []
    for (const speed of ['0.5', '1']) {
      await seekMotion(viewer, 0.05)
      await viewer.getByRole('combobox', { name: 'Velocidad del movimiento', exact: true }).selectOption(speed)
      const started = Date.now()
      await viewer.getByRole('button', { name: 'Reproducir movimiento', exact: true }).click()
      await page.waitForTimeout(1200)
      await pauseMotion(viewer)
      rates.push((Number(await slider.inputValue()) - 0.05) / (Date.now() - started))
      const expectedRate = Number(speed) / 12 / 1000
      expect(rates.at(-1)!).toBeGreaterThan(expectedRate * 0.65)
      expect(rates.at(-1)!).toBeLessThan(expectedRate * 1.35)
    }
    expect(rates[1] / rates[0]).toBeGreaterThan(1.5)
    expect(rates[1] / rates[0]).toBeLessThan(2.6)
    await viewer.getByRole('button', { name: 'Reproducir movimiento', exact: true }).click()
    await detail.evaluate(node => { node.scrollTop = node.scrollHeight })
    await expect(viewer.getByRole('button', { name: 'Reproducir movimiento', exact: true })).toBeVisible()
    const offscreenPhase = await slider.inputValue()
    await page.waitForTimeout(600)
    await expect(slider).toHaveValue(offscreenPhase)
    await detail.evaluate(node => { node.scrollTop = 0 })
    await expect(viewer.getByRole('button', { name: 'Reproducir movimiento', exact: true })).toBeVisible()
    await viewer.getByRole('button', { name: 'Reproducir movimiento', exact: true }).click()
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect(viewer.getByRole('button', { name: 'Reproducir movimiento', exact: true })).toBeVisible()
    const hiddenPhase = await slider.inputValue()
    await page.waitForTimeout(600)
    await expect(slider).toHaveValue(hiddenPhase)
    await page.evaluate(() => {
      Reflect.deleteProperty(document, 'hidden')
      Reflect.deleteProperty(document, 'visibilityState')
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect(viewer.getByRole('button', { name: 'Reproducir movimiento', exact: true })).toBeVisible()
    await viewer.getByRole('button', { name: 'Reproducir movimiento', exact: true }).click()
    await page.evaluate(() => { history.pushState(null, '', '/privacy'); window.dispatchEvent(new PopStateEvent('popstate')) })
    await expect(detail).not.toBeVisible()
    const suspendedSlider = page.locator('.yoga-anatomy-viewer input[type="range"]')
    const suspendedPhase = await suspendedSlider.inputValue()
    await page.waitForTimeout(600)
    expect(await suspendedSlider.inputValue()).toBe(suspendedPhase)
    await page.evaluate(() => { history.pushState(null, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')) })
    await expect(detail).toBeVisible()
    await expect(viewer.getByRole('button', { name: 'Reproducir movimiento', exact: true })).toBeVisible()
    await viewer.getByRole('button', { name: 'Reiniciar movimiento', exact: true }).click()
    await expect(slider).toHaveValue('0')
    await expect(viewer.getByRole('button', { name: 'Reproducir movimiento', exact: true })).toBeVisible()
  })

  test('reduced motion prevents autoplay and watching a saved practice never starts its timer or creates a log', async ({ page }) => {
    test.setTimeout(process.env.CI ? 240_000 : 120_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seed(page)
    await openYoga(page)
    await page.getByRole('navigation', { name: 'Secciones de yoga' }).getByRole('button', { name: 'Mis prácticas' }).click()
    await page.getByRole('button', { name: `Comenzar ${practice.name}`, exact: true }).click()
    const session = page.getByRole('dialog', { name: practice.name, exact: true })
    const viewer = session.locator('.yoga-anatomy-viewer')
    await readyMotion(viewer)
    const slider = viewer.getByRole('slider', { name: 'Recorrido del movimiento', exact: true })
    await expect(viewer.getByRole('button', { name: 'Reproducir movimiento', exact: true })).toBeVisible()
    const initial = await slider.inputValue()
    await page.waitForTimeout(700)
    await expect(slider).toHaveValue(initial)
    await seekMotion(viewer, 0)
    await viewer.getByRole('button', { name: 'Reproducir movimiento', exact: true }).click()
    await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(0.08)
    await expect(session.getByRole('timer', { name: 'Tiempo restante', exact: true })).toHaveText('0:30')
    await expect(session.getByRole('button', { name: 'Comenzar asana', exact: true })).toBeVisible()
    await session.getByRole('button', { name: 'Terminar ahora', exact: true }).click()
    await session.getByRole('button', { name: 'Revisar y guardar', exact: true }).click()
    await expect(session).toContainText('No hubo tiempo realizado para registrar')
    await expect(session.getByRole('button', { name: 'Guardar registro', exact: true })).toHaveCount(0)
    const yoga = await page.evaluate(() => JSON.parse(localStorage.getItem('klisteniapp.personal.v2')!).settings.yoga)
    expect(yoga).toEqual({ practices: [practice], logs: [] })
  })
})

test.describe('animated anatomical previews', () => {
  test.use({ reducedMotion: 'no-preference' })
  test.beforeEach(async ({ page }) => { await page.route('**/models/*.glb', route => route.abort()) })

  test('hover and keyboard load real moving previews for both models, and inactive views return to their poster', async ({ page }) => {
    await openYoga(page)
    for (const model of ['male', 'female'] as const) {
      if (model === 'female') await selectModel(page, model)
      const card = page.locator('.yoga-asana-card').filter({ has: page.locator('.yoga-asana-preview[data-asana="vrksasana"]') })
      const preview = card.locator('.yoga-asana-preview')
      const motion = preview.locator('.yoga-preview-motion')
      await card.hover()
      await expect(motion).toHaveAttribute('src', `/previews/yoga/${model}/vrksasana-right-motion.webp`)
      await expectLoaded(motion)
      const first = await motion.screenshot()
      await page.waitForTimeout(1500)
      expect((await motion.screenshot()).equals(first)).toBe(false)
      await page.mouse.move(0, 0)
      await expect(motion).toHaveCount(0)
      await expectLoaded(preview.locator('.yoga-preview-poster'))
      await card.getByRole('button', { name: 'Explorar asana', exact: true }).focus()
      await expectLoaded(motion)
      await page.evaluate(() => window.scrollTo(0, 0))
      await expect(motion).toHaveCount(0)
      await card.scrollIntoViewIfNeeded()
      await expectLoaded(motion)
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await expect(motion).toHaveCount(0)
      await page.evaluate(() => {
        Reflect.deleteProperty(document, 'hidden')
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await expectLoaded(motion)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await expect(motion).toHaveCount(0)
      await expectLoaded(preview.locator('.yoga-preview-poster'))
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await expectLoaded(motion)
      await expect(page.locator('.yoga-page canvas')).toHaveCount(0)
    }
  })

  for (const preference of ['system', 'saved setting'] as const) {
    test(`reduced motion from ${preference} never requests yoga animations`, async ({ page }) => {
      if (preference === 'system') await page.emulateMedia({ reducedMotion: 'reduce' })
      else await page.addInitScript(() => localStorage.setItem('klisteniapp.preferences.v1', JSON.stringify({ reducedMotion: true })))
      const requests: string[] = []
      page.on('request', request => {
        const url = new URL(request.url())
        if (url.pathname.startsWith('/previews/yoga/') && url.pathname.endsWith('-motion.webp')) requests.push(url.pathname)
      })
      await openYoga(page)
      const card = page.locator('.yoga-asana-card').first()
      await card.hover()
      await card.getByRole('button', { name: 'Explorar asana', exact: true }).focus()
      await expectLoaded(card.locator('.yoga-preview-poster'))
      await expect(card.locator('.yoga-preview-motion')).toHaveCount(0)
      expect(requests).toEqual([])
    })
  }
})
