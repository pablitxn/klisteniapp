import { expect, test, type Locator, type Page } from '@playwright/test'
import { openSettings } from './settings-helpers'

async function selectModel(page: Page, model: 'female' | 'male') {
  const dialog = await openSettings(page)
  const setting = dialog.getByRole('combobox', { name: 'Modelo corporal', exact: true })
  await setting.selectOption(model)
  await expect(setting).toHaveValue(model)
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click()
}

async function navigate(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true })
    .getByRole('button', { name, exact: true }).click()
}

async function expectLoaded(image: Locator) {
  await image.scrollIntoViewIfNeeded()
  await expect.poll(() => image.evaluate(element => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0)).toBe(true)
}

test.beforeEach(async ({ page }) => {
  // Cross-surface preference and fallback acceptance do not require GPU timing.
  // Geometry, registered layers and actual captures have separate source-backed checks.
  await page.route('**/models/*.glb', route => route.abort())
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test('the chosen body applies to routine, catalog, atlas and its viewer and survives reload', async ({ page }) => {
  await page.goto('/')
  await selectModel(page, 'female')
  const routinePoster = page.locator('.exercise-preview[data-exercise="squat"] .exercise-preview-poster')
  await expect(routinePoster).toHaveAttribute('src', '/previews/female/squat-poster.webp')
  await expectLoaded(routinePoster)
  await expect(page.locator('.anatomy-viewer')).toHaveAttribute('data-model', 'female')

  await navigate(page, 'Ejercicios')
  const catalogPosters = page.locator('.exercise-preview-poster')
  expect(await catalogPosters.count()).toBeGreaterThan(6)
  for (const source of await catalogPosters.evaluateAll(images => images.map(image => image.getAttribute('src')))) {
    expect(source).toMatch(/^\/previews\/female\/.+-poster\.webp$/)
  }
  await navigate(page, 'Mi cuerpo')
  const thumbnails = page.locator('.body-muscle-thumbnail')
  await expect(thumbnails).toHaveCount(12)
  await expect(thumbnails.locator('img')).toHaveCount(12)
  for (const source of await thumbnails.locator('img').evaluateAll(images => images.map(image => image.getAttribute('src')))) {
    expect(source).toMatch(/^\/previews\/female\/body\/.+\.webp$/)
  }
  const pectorals = page.locator('.body-muscle').filter({ has: page.locator('summary strong').filter({ hasText: /^Pectorales$/ }) })
  await expectLoaded(pectorals.locator('img'))
  await pectorals.locator('summary').click()
  await pectorals.getByRole('button', { name: 'Ver Pectorales en 3D', exact: true }).click()
  const explorer = page.getByTestId('muscle-explorer')
  await expect(explorer.locator('.anatomy-viewer')).toHaveAttribute('data-model', 'female')
  await expect(explorer.getByText('Vista 3D no disponible', { exact: true })).toBeVisible()
  await page.getByRole('dialog', { name: 'Pectorales', exact: true }).getByRole('button', { name: 'Cerrar', exact: true }).click()

  await page.reload()
  const settings = await openSettings(page)
  await expect(settings.getByRole('combobox', { name: 'Modelo corporal', exact: true })).toHaveValue('female')
  await settings.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(page.locator('.anatomy-viewer')).toHaveAttribute('data-model', 'female')
  await selectModel(page, 'male')
  await expect(routinePoster).toHaveAttribute('src', '/previews/squat-poster.webp')
  await expectLoaded(routinePoster)
  await navigate(page, 'Mi cuerpo')
  await expect(pectorals.locator('img')).toHaveAttribute('src', '/previews/body/pectorals.webp')
  await expectLoaded(pectorals.locator('img'))
})

test('female animated examples retain reduced-motion behavior', async ({ page }) => {
  const animationRequests: string[] = []
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (/^\/previews\/female\/[^/]+\.webp$/.test(path) && !path.endsWith('-poster.webp')) animationRequests.push(path)
  })
  await page.goto('/')
  await selectModel(page, 'female')
  const squat = page.locator('.exercise-preview[data-exercise="squat"]')
  await expectLoaded(squat.locator('.exercise-preview-poster'))
  await expect(squat.locator('.exercise-preview-motion')).toHaveCount(0)
  expect(animationRequests).toEqual([])
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await squat.scrollIntoViewIfNeeded()
  await expect(squat.locator('.exercise-preview-motion')).toHaveAttribute('src', '/previews/female/squat.webp')
  await expectLoaded(squat.locator('.exercise-preview-motion'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(squat.locator('.exercise-preview-motion')).toHaveCount(0)
})

test('switching model recovers preview and atlas images after a variant asset fails', async ({ page }) => {
  await page.route('**/previews/female/squat-poster.webp', route => route.abort())
  await page.route('**/previews/female/body/pectorals.webp', route => route.abort())
  await page.goto('/')
  await selectModel(page, 'female')
  const squat = page.locator('.exercise-preview[data-exercise="squat"]')
  await squat.scrollIntoViewIfNeeded()
  await expect(squat.locator('.exercise-preview-fallback')).toBeVisible()
  await selectModel(page, 'male')
  await expectLoaded(squat.locator('.exercise-preview-poster'))
  await page.unroute('**/previews/female/squat-poster.webp')
  await selectModel(page, 'female')
  await expectLoaded(squat.locator('.exercise-preview-poster'))
  await navigate(page, 'Mi cuerpo')
  const pectorals = page.locator('.body-muscle').filter({ has: page.locator('summary strong').filter({ hasText: /^Pectorales$/ }) })
  await pectorals.scrollIntoViewIfNeeded()
  await expect(pectorals.locator('.body-muscle-thumbnail--fallback')).toBeVisible()
  await selectModel(page, 'male')
  await expect(pectorals.locator('.body-muscle-thumbnail--fallback')).toHaveCount(0)
  await expectLoaded(pectorals.locator('img'))
  await page.unroute('**/previews/female/body/pectorals.webp')
  await selectModel(page, 'female')
  await expectLoaded(pectorals.locator('img'))
})
