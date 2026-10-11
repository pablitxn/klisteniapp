import { expect, test, type Locator } from '@playwright/test'
import { createDefaultPersonalData } from '@klisteniapp/scene-schema'

async function expectThumbnailLoaded(image: Locator) {
  await image.scrollIntoViewIfNeeded()
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate(element => ({
    width: (element as HTMLImageElement).naturalWidth,
    height: (element as HTMLImageElement).naturalHeight,
  }))).toEqual({ width: 256, height: 256 })
}

async function expectColorTokens(element: Locator, properties: Record<string, string>) {
  const colors = await element.evaluate((node, tokens) => {
    const probe = node.ownerDocument.createElement('span')
    probe.hidden = true
    node.ownerDocument.documentElement.append(probe)
    const resolved: Record<string, string> = {}
    for (const [property, token] of Object.entries(tokens)) {
      probe.style.color = `var(${token})`
      resolved[property] = getComputedStyle(probe).color
    }
    probe.remove()
    return resolved
  }, properties)
  for (const [property, color] of Object.entries(colors)) await expect(element).toHaveCSS(property, color)
}

test.beforeEach(async ({ page }) => {
  await page.route('**/models/*.glb', route => route.abort())
  await page.route('**/api/auth/get-session', route => route.fulfill({ json: null }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 740 })
})

test('the mobile atlas filters regions, distinguishes support and opens its related exercise', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Navegación móvil' }).getByRole('button', { name: 'Mi cuerpo', exact: true }).click()
  await expect(page.locator('.body-muscle')).toHaveCount(12)
  await page.getByRole('group', { name: 'Filtrar regiones del cuerpo' }).getByRole('button', { name: 'Centro', exact: true }).click()
  await expect(page.locator('.body-muscle')).toHaveCount(2)
  const obliques = page.locator('.body-muscle').filter({ has: page.locator('summary strong').filter({ hasText: /^Oblicuos$/ }) })
  await obliques.locator('summary').click()
  const roles = obliques.locator('.body-routine-roles')
  await expect(roles).toContainText('No hay un ejercicio con este papel en tu selección.')
  await expect(roles).toContainText('Participar como apoyo no equivale')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await roles.getByRole('button', { name: 'Dead bug', exact: true }).click()
  await expect(page.locator('.workbench-title')).toContainText('Dead bug alternado')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test('a custom routine containing a pull shows its actual role in the atlas', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('klisteniapp.preferences.v1', JSON.stringify({
      exerciseIds: ['row', 'squat'], sets: 2, weeklyGoal: 3, reducedMotion: true,
    }))
  })
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Navegación móvil' }).getByRole('button', { name: 'Mi cuerpo', exact: true }).click()
  await expect(page.locator('.body-muscle')).toHaveCount(12)
  const lats = page.locator('.body-muscle').filter({ has: page.locator('summary strong').filter({ hasText: /^Dorsales$/ }) })
  await lats.locator('summary').click()
  const primary = lats.locator('.body-routine-roles > div').filter({ has: page.getByText('Principal', { exact: true }) })
  await expect(primary.getByRole('button', { name: 'Remo', exact: true })).toBeVisible()
  await primary.getByRole('button', { name: 'Remo', exact: true }).click()
  await expect(page.locator('.workbench-title')).toContainText('Remo invertido')
})

for (const width of [320, 486]) {
  test(`the atlas opens first and loads twelve static regional thumbnails that fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 926 })
    await page.goto('/')
    await page.getByRole('navigation', { name: 'Navegación móvil', exact: true }).getByRole('button', { name: 'Mi cuerpo', exact: true }).click()
    const guide = page.locator('.body-guide')
    await expect(guide.getByRole('region', { name: 'Tu atlas, explicado sin vueltas.', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading').first()).toHaveText('Tren superior')
    await expect(guide.getByRole('heading', { name: 'Tu atlas, explicado sin vueltas.', exact: true })).toHaveCount(0)
    await expect(guide.getByText('DE LA REGIÓN AL MOVIMIENTO', { exact: true })).toHaveCount(0)
    await expect(guide.locator('.body-movements, .body-complement')).toHaveCount(0)
    const cards = guide.locator('.body-muscle')
    await expect(cards).toHaveCount(12)
    const sources = new Set<string>()
    for (let index = 0; index < 12; index++) {
      const summary = cards.nth(index).locator('summary')
      const image = summary.locator('img')
      await expectThumbnailLoaded(image)
      const source = await image.getAttribute('src')
      expect(source).toMatch(/^\/previews\/body\/[a-z-]+\.webp$/)
      sources.add(source!)
      await expect(summary.locator('.body-role-dot')).toHaveCount(0)
      await expect(summary).not.toContainText(/Principal en tu selección|Apoyo en tu selección|Sin ejercicio asociado/)
      const summaryBox = (await summary.boundingBox())!
      const imageBox = (await image.boundingBox())!
      const nameBox = (await summary.locator('strong').boundingBox())!
      expect(imageBox.x).toBeGreaterThanOrEqual(summaryBox.x)
      expect(imageBox.x + imageBox.width).toBeLessThanOrEqual(summaryBox.x + summaryBox.width)
      expect(nameBox.x).toBeGreaterThanOrEqual(imageBox.x + imageBox.width)
      expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(summaryBox.x + summaryBox.width)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await expect(guide.locator('.anatomy-viewer')).toHaveCount(0)
    }
    expect(sources.size).toBe(12)
  })
}

test('the selected female model loads its twelve regional thumbnails in the atlas', async ({ page }) => {
  const data = createDefaultPersonalData('Atlas local', 'UTC')
  data.settings.anatomicalModel = 'female'
  await page.addInitScript(value => localStorage.setItem('klisteniapp.personal.v2', JSON.stringify(value)), data)
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Navegación móvil', exact: true }).getByRole('button', { name: 'Mi cuerpo', exact: true }).click()
  const thumbnails = page.locator('.body-muscle summary img')
  await expect(thumbnails).toHaveCount(12)
  const sources = new Set<string>()
  for (const image of await thumbnails.all()) {
    await expectThumbnailLoaded(image)
    const source = await image.getAttribute('src')
    expect(source).toMatch(/^\/previews\/female\/body\/[a-z-]+\.webp$/)
    sources.add(source!)
  }
  expect(sources.size).toBe(12)
  await expect(page.locator('.body-muscle-thumbnail--fallback')).toHaveCount(0)
  await expect(page.locator('.body-guide .anatomy-viewer')).toHaveCount(0)
})

test('all twelve atlas cards explain their structure and function without mounting a viewer', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Navegación móvil', exact: true }).getByRole('button', { name: 'Mi cuerpo', exact: true }).click()
  const cards = page.locator('.body-muscle')
  await expect(cards).toHaveCount(12)
  await expect(page.locator('.body-model-guide, .body-reading-steps, .body-next-step')).toHaveCount(0)
  for (let index = 0; index < 12; index++) {
    const card = cards.nth(index)
    await card.locator('summary').click()
    for (const fact of ['Dónde está', 'Partes de esta región', 'Qué hace', 'Articulaciones y movimientos', 'Cómo colabora', 'Conectalo con un gesto', 'Una pista para observar']) {
      const content = card.locator('.body-muscle-facts > div').filter({ has: page.getByText(fact, { exact: true }) }).locator('dd')
      await expect(content).toBeVisible()
      await expect(content).not.toHaveText('')
    }
    expect(await card.locator('.body-muscle-parts li').count()).toBeGreaterThan(0)
    await expect(card.getByRole('heading', { name: 'Fuentes de esta ficha', exact: true })).toBeVisible()
    await expect(card.locator('.body-fiche-sources').getByRole('link').first()).toHaveAttribute('href', /^https:\/\/openstax\.org\/books\/anatomy-and-physiology-2e\/pages\//)
    await expect(card.getByRole('button', { name: /^Ver .+ en 3D$/ })).toBeVisible()
    await expect(page.getByTestId('muscle-explorer')).toHaveCount(0)
    await expect(page.locator('.anatomy-viewer')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    await card.locator('summary').click()
  }
})

test('opening a muscle mounts one paused anatomical detail and keeps education available without WebGL', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Navegación móvil', exact: true }).getByRole('button', { name: 'Mi cuerpo', exact: true }).click()
  await expect(page.locator('.anatomy-viewer')).toHaveCount(0)
  for (const muscle of ['Pectorales', 'Gemelos y sóleo']) {
    const card = page.locator('.body-muscle').filter({ has: page.locator('summary strong').filter({ hasText: muscle === 'Pectorales' ? /^Pectorales$/ : /^Gemelos y sóleo$/ }) })
    await card.locator('summary').click()
    const opener = card.getByRole('button', { name: `Ver ${muscle} en 3D`, exact: true })
    await opener.click()
    const dialog = page.getByRole('dialog', { name: muscle, exact: true })
    await expect(dialog).toBeVisible()
    await expect(page.locator('dialog:visible')).toHaveCount(1)
    const explorer = dialog.getByTestId('muscle-explorer')
    await expect(explorer).toBeVisible()
    await expect(page.locator('.anatomy-viewer')).toHaveCount(1)
    await expect(explorer.getByRole('button', { name: 'Anatomía', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(explorer.getByRole('button', { name: muscle === 'Pectorales' ? 'Frente' : 'Espalda', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(explorer.getByText('Vista 3D no disponible', { exact: true })).toBeVisible()
    await expect(explorer.locator('.body-model-selection')).toContainText(muscle)
    await expect(explorer.getByRole('heading', { name: 'Movimientos relacionados', exact: true })).toBeVisible()
    await expect(explorer.locator('.body-explorer-facts dd').first()).not.toHaveText('')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click()
    await expect(page.getByTestId('muscle-explorer')).toHaveCount(0)
    await expect(page.locator('.anatomy-viewer')).toHaveCount(0)
    await expect(opener).toBeFocused()
  }
})

for (const appearance of [
  { theme: 'light', colorTheme: 'graphite' },
  { theme: 'dark', colorTheme: 'rose' },
] as const) {
  test(`the muscle modal and its controls follow the ${appearance.colorTheme} ${appearance.theme} palette without WebGL`, async ({ page }) => {
    const data = createDefaultPersonalData('Atlas local', 'UTC')
    Object.assign(data.settings.profile, appearance)
    await page.addInitScript(value => {
      localStorage.setItem('klisteniapp.personal.v2', JSON.stringify(value.data))
      localStorage.setItem('klisteniapp.display.v1', JSON.stringify({
        ...value.appearance, language: 'es', reducedMotion: true,
      }))
    }, { data, appearance })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', appearance.theme)
    await expect(page.locator('html')).toHaveAttribute('data-color-theme', appearance.colorTheme)
    await page.getByRole('navigation', { name: 'Navegación móvil', exact: true }).getByRole('button', { name: 'Mi cuerpo', exact: true }).click()
    const card = page.locator('.body-muscle').filter({ has: page.locator('summary strong').filter({ hasText: /^Pectorales$/ }) })
    await card.locator('summary').click()
    await card.getByRole('button', { name: 'Ver Pectorales en 3D', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Pectorales', exact: true })
    const viewer = dialog.locator('.anatomy-viewer')
    await expect(viewer.getByText('Vista 3D no disponible', { exact: true })).toBeVisible()
    await expectColorTokens(dialog, { 'background-color': '--surface', color: '--ink' })
    await expectColorTokens(viewer, { 'background-color': '--surface-soft', color: '--ink', 'border-top-color': '--line' })
    await expectColorTokens(viewer.locator('.anatomy-toolbar'), { 'background-color': '--surface-soft' })
    await expectColorTokens(viewer.locator('.anatomy-stage'), { 'background-color': '--surface-soft' })
    await expectColorTokens(viewer.locator('.viewer-fallback'), { 'background-color': '--surface-soft', color: '--muted' })
    await expectColorTokens(viewer.locator('.viewer-fallback strong'), { color: '--ink' })
    await expectColorTokens(viewer.locator('.anatomy-provenance'), { 'background-color': '--surface' })
    const layers = viewer.getByRole('group', { name: 'Capas anatómicas', exact: true })
    await expectColorTokens(layers, { 'background-color': '--surface', 'border-top-color': '--line' })
    const selectedLayer = layers.getByRole('button', { name: 'Huesos', exact: true })
    await selectedLayer.click()
    await expect(selectedLayer).toHaveAttribute('aria-pressed', 'true')
    const selectedCamera = viewer.getByRole('button', { name: 'Espalda', exact: true })
    await selectedCamera.click()
    await expect(selectedCamera).toHaveAttribute('aria-pressed', 'true')
    await page.mouse.move(1, 1)
    for (const selected of [selectedLayer, selectedCamera, viewer.getByRole('button', { name: 'Anatomía', exact: true })]) {
      await expectColorTokens(selected, { 'background-color': '--purple-soft', color: '--ink' })
    }
    await selectedCamera.focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(selectedCamera).toBeFocused()
    await expectColorTokens(selectedCamera, { 'outline-color': '--purple-dark' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  })
}
