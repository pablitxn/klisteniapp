import { expect, test, type Locator, type Page } from '@playwright/test'

test.use({ reducedMotion: 'no-preference' })

const exerciseIds = [
  'pushup',
  'squat',
  'glute-bridge',
  'dead-bug',
  'prone-w',
  'calf-raise',
  'row',
]

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

async function openWithAtlasPaused(page: Page) {
  await page.goto('/')
  // Card motion stays enabled; pause the separate full atlas through its UI.
  await expect(page.locator('.viewer-play')).toBeEnabled({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Pausar demostración', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Reproducir demostración', exact: true }),
  ).toBeVisible()
}

test('selected exercise, pointer and keyboard show loaded motion previews', async ({
  page,
}) => {
  await openWithAtlasPaused(page)
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
  await openWithAtlasPaused(page)
  const selected = preview(page, 'squat')
  await selected.scrollIntoViewIfNeeded()
  await expectLoaded(selected.locator('.exercise-preview-motion'))
  await page.getByRole('button', { name: 'Abrir ajustes' }).click()
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

test('all seven library previews load without creating miniature WebGL scenes', async ({
  page,
}) => {
  await page.goto('/')
  await navigate(page, 'Ejercicios')
  await expect(page.locator('.library-card')).toHaveCount(7)
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
  await navigate(page, 'Mi cuerpo')
  await expect(page.locator('.pattern-grid .exercise-preview')).toHaveCount(6)
  await expect(page.locator('.pattern-grid canvas')).toHaveCount(0)
})

test('failed preview files retain a usable exercise card and a visible fallback', async ({
  page,
}) => {
  await page.route('**/previews/squat.webp', (route) => route.abort())
  await page.route('**/previews/pushup-poster.webp', (route) => route.abort())
  const animationFailure = page.waitForEvent('requestfailed', (request) =>
    request.url().endsWith('/previews/squat.webp'),
  )
  await openWithAtlasPaused(page)
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
      const firstPreview = page.locator('.exercise-preview').first()
      await firstPreview.scrollIntoViewIfNeeded()
      await expectLoaded(firstPreview.locator('.exercise-preview-poster'))
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      )
      expect(scrollWidth).toBeLessThanOrEqual(width + 1)
      await expect(page.locator('.exercise-preview canvas')).toHaveCount(0)
    }
  }
})
