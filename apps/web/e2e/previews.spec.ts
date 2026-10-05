import { expect, test, type Locator, type Page } from '@playwright/test'
import { openSettings } from './settings-helpers'
import { exercises } from '../src/data/exercises'

test.use({ reducedMotion: 'no-preference' })
const rendererCase = 'expanded library combines name search and movement filters, then opens a new exercise'
test.beforeEach(async ({ page }, testInfo) => {
  // Raster preview behavior must not depend on compiling the separate full atlas.
  // Retain the gallery-to-live-viewer integration below and the anatomy suite.
  if (testInfo.title !== rendererCase) await page.route('**/models/*.glb', route => route.abort())
})

const exerciseIds = exercises.map(({ id }) => id)

function preview(page: Page, id: string) {
  return page.locator(`.exercise-preview[data-exercise="${id}"]`)
}

async function expectLoaded(image: Locator) {
  await expect(image).toHaveCount(1)
  await expect
    .poll(
      () =>
        image.evaluate(
          (element) =>
            element instanceof HTMLImageElement &&
            element.complete &&
            element.naturalWidth > 0 &&
            element.naturalHeight > 0,
        ),
      { timeout: 20_000 },
    )
    .toBe(true)
}

async function navigate(page: Page, name: string, mobile = false) {
  await page
    .getByRole('navigation', {
      name: mobile ? 'Navegación móvil' : 'Navegación principal',
      exact: true,
    })
    .getByRole('button', { name, exact: true })
    .click()
}

async function expectAtlasReady(page: Page) {
  await expect(page.locator('.viewer-play')).toBeEnabled({ timeout: process.env.CI ? 120_000 : 30_000 })
}

async function openPreviewPage(page: Page) {
  await page.goto('/')
  await expect(page.locator('.workbench-title')).toContainText('Sentadilla')
}

test('selected exercise, pointer and keyboard show loaded motion previews', async ({
  page,
}) => {
  await openPreviewPage(page)
  const squat = preview(page, 'squat')
  await squat.scrollIntoViewIfNeeded()
  await expectLoaded(squat.locator('.exercise-preview-poster'))
  await expectLoaded(squat.locator('.exercise-preview-motion'))

  const pushup = preview(page, 'pushup')
  const pushupCard = page.locator('.exercise-row').filter({ has: pushup })
  await expectLoaded(pushup.locator('.exercise-preview-poster'))
  await expect(pushup.locator('.exercise-preview-motion')).toHaveCount(0)
  await pushupCard.hover()
  await expectLoaded(pushup.locator('.exercise-preview-motion'))
  await page.mouse.move(0, 0)
  await expect(pushup.locator('.exercise-preview-motion')).toHaveCount(0)
  await pushupCard.focus()
  await expectLoaded(pushup.locator('.exercise-preview-motion'))
  await pushupCard.press('Enter')
  await expect(pushupCard).toHaveAttribute('aria-pressed', 'true')
  await expect(squat.locator('.exercise-preview-motion')).toHaveCount(0)

  // Changing the OS preference while the selected card is visible must stop it.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.exercise-preview-motion')).toHaveCount(0)
  await expectLoaded(pushup.locator('.exercise-preview-poster'))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expectLoaded(pushup.locator('.exercise-preview-motion'))
  await expect(page.locator('.exercise-preview canvas')).toHaveCount(0)
})

for (const preference of ['system', 'saved setting'] as const) {
  test(`initial reduced motion from ${preference} never requests animated assets`, async ({
    page,
  }) => {
    if (preference === 'system') {
      await page.emulateMedia({ reducedMotion: 'reduce' })
    } else {
      await page.addInitScript(() =>
        localStorage.setItem(
          'klisteniapp.preferences.v1',
          JSON.stringify({ reducedMotion: true }),
        ),
      )
    }
    const animationRequests: string[] = []
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname
      if (
        pathname.startsWith('/previews/') &&
        pathname.endsWith('.webp') &&
        !pathname.endsWith('-poster.webp')
      )
        animationRequests.push(pathname)
    })
    await page.goto('/')
    const selected = preview(page, 'squat')
    await selected.scrollIntoViewIfNeeded()
    await expectLoaded(selected.locator('.exercise-preview-poster'))
    const card = page.locator('.exercise-row').filter({ has: selected })
    await card.hover()
    await card.focus()
    await expect(page.locator('.exercise-preview-motion')).toHaveCount(0)
    await navigate(page, 'Ejercicios')
    const libraryCard = page.locator('.library-card').first()
    await libraryCard.hover()
    await libraryCard.focus()
    await expectLoaded(libraryCard.locator('.exercise-preview-poster'))
    await expect(page.locator('.exercise-preview-motion')).toHaveCount(0)
    expect(animationRequests).toEqual([])
  })
}

test('the app motion setting stops an already playing preview and persists', async ({
  page,
}) => {
  await openPreviewPage(page)
  const selected = preview(page, 'squat')
  await selected.scrollIntoViewIfNeeded()
  await expectLoaded(selected.locator('.exercise-preview-motion'))
  await openSettings(page, 'Apariencia')
  await page.getByRole('checkbox', { name: /Reducir movimiento/ }).check()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await selected.scrollIntoViewIfNeeded()
  await expect(page.locator('.exercise-preview-motion')).toHaveCount(0)
  await expectLoaded(selected.locator('.exercise-preview-poster'))
  await page.reload()
  await selected.scrollIntoViewIfNeeded()
  await expectLoaded(selected.locator('.exercise-preview-poster'))
  await expect(page.locator('.exercise-preview-motion')).toHaveCount(0)
})

test('every catalog preview loads without creating miniature WebGL scenes', async ({
  page,
}) => {
  await page.goto('/')
  await navigate(page, 'Ejercicios')
  await expect(page.locator('.library-card')).toHaveCount(exerciseIds.length)
  await expect(page.locator('canvas')).toHaveCount(0)
  for (const id of exerciseIds) {
    const item = preview(page, id)
    const card = page.locator('.library-card').filter({ has: item })
    await card.hover()
    await expectLoaded(item.locator('.exercise-preview-poster'))
    await expectLoaded(item.locator('.exercise-preview-motion'))
    await page.mouse.move(0, 0)
    await expect(item.locator('.exercise-preview-motion')).toHaveCount(0)
  }
  await expect(page.locator('.exercise-preview-fallback')).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveCount(0)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(1441)
  await navigate(page, 'Mi cuerpo')
  const bodyThumbnails = page.locator('.body-muscle summary img')
  await expect(bodyThumbnails).toHaveCount(12)
  for (const thumbnail of await bodyThumbnails.all()) {
    await thumbnail.scrollIntoViewIfNeeded()
    await expectLoaded(thumbnail)
  }
  await expect(page.locator('.body-guide canvas')).toHaveCount(0)
})

test('expanded library combines name search and movement filters, then opens a new exercise', async ({
  page,
}) => {
  if (process.env.CI) test.setTimeout(240_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await navigate(page, 'Ejercicios')
  const search = page.getByRole('textbox', { name: 'Buscar ejercicio o músculo' })
  for (const pattern of new Set(exercises.map((exercise) => exercise.pattern))) {
    await page.locator('.filter-pills').getByRole('button', { name: pattern, exact: true }).click()
    const expected = exercises.filter((exercise) => exercise.pattern === pattern)
    await expect(page.locator('.library-card')).toHaveCount(expected.length)
    for (const exercise of expected) {
      await expect(preview(page, exercise.id)).toHaveCount(1)
    }
  }
  await page.locator('.filter-pills').getByRole('button', { name: 'Todos', exact: true }).click()
  const crunch = exercises.find(({ id }) => id === 'crunch')!
  await search.fill(crunch.name.normalize('NFD').replace(/\p{Diacritic}/gu, ''))
  await expect(page.locator('.library-card')).toHaveCount(1)
  await expectLoaded(preview(page, crunch.id).locator('.exercise-preview-poster'))
  await page.locator('.filter-pills').getByRole('button', { name: 'Tracción', exact: true }).click()
  await expect(page.locator('.library-card')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No encontramos ese movimiento.' })).toBeVisible()
  await page.locator('.filter-pills').getByRole('button', { name: 'Todos', exact: true }).click()
  await page.locator('.library-card').click()
  await expect(page.locator('.workbench-title')).toContainText(crunch.name)
  await expectAtlasReady(page)
  await expect(page.locator('.viewer-fallback')).toHaveCount(0)
  await expect(page.getByRole('tabpanel')).toContainText(crunch.steps[0]!)
  await page.getByRole('tab', { name: 'A tu nivel' }).click()
  await expect(page.getByRole('tabpanel')).toContainText(crunch.easier.name)
})

test('failed preview files retain a usable exercise card and a visible fallback', async ({
  page,
}) => {
  await page.route('**/previews/squat.webp', (route) => route.abort())
  await page.route('**/previews/pushup-poster.webp', (route) => route.abort())
  const animationFailure = page.waitForEvent('requestfailed', (request) =>
    request.url().endsWith('/previews/squat.webp'),
  )
  await openPreviewPage(page)
  const squat = preview(page, 'squat')
  await squat.scrollIntoViewIfNeeded()
  await expectLoaded(squat.locator('.exercise-preview-poster'))
  await animationFailure
  await expect(squat).toHaveAttribute('data-state', 'still')
  await expect(squat.locator('.exercise-preview-motion')).toHaveCount(0)
  const pushup = preview(page, 'pushup')
  await pushup.scrollIntoViewIfNeeded()
  await expect(pushup.locator('.exercise-preview-fallback')).toBeVisible()
  await expect(pushup.locator('.exercise-preview-poster')).toHaveCount(0)
  await page.locator('.exercise-row').filter({ has: pushup }).click()
  await expect(page.locator('.workbench-title')).toContainText(
    'Flexiones con rodillas',
  )
  await expectLoaded(pushup.locator('.exercise-preview-motion'))
})

test('previews fit mobile routine, library and body cards without page overflow', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    for (const name of ['Mi rutina', 'Ejercicios', 'Mi cuerpo']) {
      await navigate(page, name, true)
      const firstImage = name === 'Mi cuerpo'
        ? page.locator('.body-muscle-thumbnail img').first()
        : page.locator('.exercise-preview-poster').first()
      await firstImage.scrollIntoViewIfNeeded()
      await expectLoaded(firstImage)
      if (name === 'Mi cuerpo') await expect(page.locator('.body-muscle-thumbnail img')).toHaveCount(12)
      if (name === 'Ejercicios') {
        await expect(page.locator('.library-card')).toHaveCount(exercises.length)
        const lastPreview = page.locator('.exercise-preview').last()
        await lastPreview.scrollIntoViewIfNeeded()
        await expectLoaded(lastPreview.locator('.exercise-preview-poster'))
      }
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      )
      expect(scrollWidth).toBeLessThanOrEqual(width + 1)
      await expect(page.locator('.exercise-preview canvas')).toHaveCount(0)
    }
  }
})
