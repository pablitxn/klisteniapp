import { expect, test, type Locator, type Page } from '@playwright/test'
import { createDefaultPersonalData } from '@klisteniapp/scene-schema'
import { openSettings } from './settings-helpers'

test.beforeEach(async ({ page }) => {
  await page.route('**/models/*.glb', route => route.abort())
  await page.route('**/api/auth/get-session', route => route.fulfill({ json: null }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test('statistics stay on the routine while every page header and footer stays clear of actions', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Mi rutina de hoy', exact: true })).toBeVisible()
  const start = page.locator('.routine-selection').getByRole('button', { name: 'Empezar mi rutina', exact: true })
  await expect(start).toBeVisible()
  await expect(page.locator('.exercise-list .routine-start')).toHaveCount(0)
  await expect(page.locator('.exercise-list .exercise-row')).toHaveCount(6)
  await expect(page.getByText('Consejos antes de empezar', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abrir ajustes', exact: true }).locator('svg')).toBeVisible()
  for (const name of ['Mi rutina', 'Ejercicios', 'Mi cuerpo', 'Mi progreso', 'Mi salud']) {
    await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('button', { name, exact: true }).click()
    await expect(page.locator('.page-heading')).toBeVisible()
    await expect(page.locator('.page-heading').getByRole('button')).toHaveCount(0)
    await expect(page.locator('.stats-bar')).toHaveCount(name === 'Mi rutina' ? 1 : 0)
    await expect(page.locator('.page-footer')).toHaveCount(0)
  }
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('button', { name: 'Mi rutina', exact: true }).click()
  await start.click()
  await expect(page.getByRole('region', { name: 'Sesión en curso', exact: true })).toBeVisible()
  await expect(start).toBeDisabled()
})

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

for (const appearance of [
  { theme: 'light', colorTheme: 'graphite' },
  { theme: 'dark', colorTheme: 'graphite' },
  { theme: 'dark', colorTheme: 'rose' },
] as const) {
  test(`routine, health and progress keep neutral surfaces and distinct selections in ${appearance.colorTheme} ${appearance.theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 486, height: 926 })
    await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'))
    const data = createDefaultPersonalData('Mi práctica de prueba', 'UTC')
    Object.assign(data.settings.profile, appearance)
    await page.addInitScript(value => {
      localStorage.setItem('klisteniapp.personal.v2', JSON.stringify(value.data))
      localStorage.setItem('klisteniapp.progress.v1', JSON.stringify(value.data.progress))
      localStorage.setItem('klisteniapp.display.v1', JSON.stringify({
        ...value.appearance, language: 'es', reducedMotion: true,
      }))
    }, { data, appearance })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', appearance.theme)
    await expect(page.locator('html')).toHaveAttribute('data-color-theme', appearance.colorTheme)
    const navigation = page.getByRole('navigation', { name: 'Navegación móvil', exact: true })
    const warmup = page.locator('.warmup-note')
    await warmup.locator('summary').click()
    await expect(warmup.locator('p').first()).toBeVisible()
    await expectColorTokens(warmup, { 'background-color': '--surface', color: '--muted' })
    const rows = page.getByRole('complementary', { name: 'Ejercicios de tu rutina', exact: true }).locator('.exercise-row')
    await expect(rows).toHaveCount(6)
    await rows.last().click()
    await page.mouse.move(1, 1)
    await expect(rows.last()).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.exercise-row[aria-pressed="true"]')).toHaveCount(1)
    await expectColorTokens(rows.last(), { 'background-color': '--purple-soft', 'border-top-color': '--purple-line' })
    await expectColorTokens(rows.first(), { 'background-color': '--surface' })
    expect(await rows.last().evaluate(node => getComputedStyle(node).backgroundColor))
      .not.toBe(await rows.first().evaluate(node => getComputedStyle(node).backgroundColor))
    for (const card of [page.locator('.balance-card'), page.locator('.cardio-card')]) {
      await expectColorTokens(card, { 'background-color': '--surface' })
      await expectColorTokens(card.locator('.stat-icon'), { 'background-color': '--purple-soft', color: '--purple-dark' })
    }

    await navigation.getByRole('button', { name: 'Mi salud', exact: true }).click()
    const tabs = page.getByRole('navigation', { name: 'Secciones de mi salud', exact: true })
    await expectColorTokens(tabs, { 'background-color': '--surface-soft' })
    const body = tabs.getByRole('button', { name: 'Cuerpo', exact: true })
    const overview = tabs.getByRole('button', { name: 'Resumen', exact: true })
    await body.click()
    await page.mouse.move(1, 1)
    await expect(body).toHaveAttribute('aria-current', 'page')
    await expect(overview).not.toHaveAttribute('aria-current', 'page')
    await expectColorTokens(body, { 'background-color': '--purple-soft', color: '--purple-dark' })
    await expectColorTokens(overview, { color: '--muted' })
    await expectColorTokens(page.locator('.health-callout').first(), { 'background-color': '--surface-soft' })
    await overview.click()
    await expect(overview).toHaveAttribute('aria-current', 'page')
    await expectColorTokens(overview, { 'background-color': '--purple-soft', color: '--purple-dark' })
    await expectColorTokens(page.getByRole('combobox', { name: 'Período del dashboard', exact: true }), { 'background-color': '--surface', color: '--ink' })

    await navigation.getByRole('button', { name: 'Mi progreso', exact: true }).click()
    const empty = page.locator('.empty-state')
    await expect(empty).toBeVisible()
    await expectColorTokens(empty, { 'background-color': '--surface' })
    await expectColorTokens(empty.locator('.empty-illustration'), { 'background-color': '--purple-soft', color: '--purple-dark' })
    await expectColorTokens(page.locator('.week-days > div > span').first(), { 'background-color': '--surface-soft' })
    await page.getByRole('button', { name: 'Agregar actividad', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Cada movimiento suma', exact: true })
    await dialog.getByLabel('Duración (minutos)', { exact: true }).fill('25')
    await dialog.getByRole('button', { name: 'Guardar actividad', exact: true }).click()
    await expect(dialog).toBeHidden()
    const history = page.locator('.activity-history')
    await expect(history.locator('article')).toHaveCount(1)
    await expect(history).toContainText('25 min')
    await expectColorTokens(history, { 'background-color': '--surface' })
    const completedDay = page.locator('.week-days > div.done > span')
    await expect(completedDay).toHaveCount(1)
    await expectColorTokens(completedDay, { 'background-color': '--purple', color: '--purple-dark' })
    expect(await completedDay.evaluate(node => getComputedStyle(node).backgroundColor))
      .not.toBe(await page.locator('.week-days > div:not(.done) > span').first().evaluate(node => getComputedStyle(node).backgroundColor))
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(486)
  })
}

async function backgroundPosition(page: Page) {
  return page.locator('.page-heading').evaluate(element => ({
    top: element.getBoundingClientRect().top,
    scrollY: window.scrollY,
  }))
}

async function expectStationaryBackground(page: Page, position: Awaited<ReturnType<typeof backgroundPosition>>) {
  // Observe several rendered frames: mouse.wheel returns before scrolling settles.
  const movement = await page.locator('.page-heading').evaluate(async (element, before) => {
    let topDelta = 0
    let scrollDelta = 0
    const start = performance.now()
    do {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      topDelta = Math.max(topDelta, Math.abs(element.getBoundingClientRect().top - before.top))
      scrollDelta = Math.max(scrollDelta, Math.abs(window.scrollY - before.scrollY))
    } while (performance.now() - start < 250)
    return { topDelta, scrollDelta }
  }, position)
  expect(movement.topDelta).toBeLessThanOrEqual(1)
  expect(movement.scrollDelta).toBeLessThanOrEqual(1)
}

async function wheelInsideDialog(page: Page, dialog: Locator, deltaY: number) {
  const box = await dialog.boundingBox()
  if (!box) throw new Error('Settings dialog has no visible bounds')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.7)
  await page.mouse.wheel(0, deltaY)
}

async function expectDialogScrollsAlone(page: Page, dialog: Locator) {
  const position = await backgroundPosition(page)
  const start = await dialog.evaluate(element => element.scrollTop)
  expect(await dialog.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(40)
  await wheelInsideDialog(page, dialog, 180)
  await expect.poll(() => dialog.evaluate(element => element.scrollTop)).toBeGreaterThan(start)
  await expectStationaryBackground(page, position)

  // Once the inner scroll reaches its end, further wheel input must not chain to the page.
  await dialog.evaluate(element => { element.scrollTop = element.scrollHeight })
  await wheelInsideDialog(page, dialog, 700)
  await expectStationaryBackground(page, position)
}

async function expectPageScrolls(page: Page) {
  const before = await page.evaluate(() => window.scrollY)
  const viewport = page.viewportSize()!
  await page.mouse.move(viewport.width / 2, viewport.height / 2)
  await page.mouse.wheel(0, 450)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100)
}

for (const viewport of [{ width: 486, height: 926 }, { width: 320, height: 740 }]) {
  test(`the routine start stays below its horizontal exercise selection at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    const selection = page.locator('.routine-selection')
    const list = selection.locator('.exercise-list')
    const start = selection.getByRole('button', { name: 'Empezar mi rutina', exact: true })
    await expect(list.locator('.exercise-row')).toHaveCount(6)
    await expect(list.locator('.routine-start')).toHaveCount(0)
    await start.scrollIntoViewIfNeeded()
    await expect(start).toBeInViewport()
    const listBox = await list.boundingBox()
    const buttonBox = await start.boundingBox()
    expect(buttonBox!.y).toBeGreaterThanOrEqual(listBox!.y + listBox!.height - 1)
    expect(buttonBox!.x).toBeGreaterThanOrEqual(0)
    expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(viewport.width)
  })

  test(`settings isolates scrolling and restores the page after close and Escape at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Hacé lugar al movimiento.', exact: true })).toBeVisible()

    // Keep the header opener fully visible while exercising a nonzero document offset.
    await page.evaluate(() => window.scrollTo({ top: 12, behavior: 'instant' }))
    const before = await backgroundPosition(page)
    expect(before.scrollY).toBe(12)
    const dialog = await openSettings(page)
    expect((await backgroundPosition(page)).top).toBeCloseTo(before.top, 0)
    await expectDialogScrollsAlone(page, dialog)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)

    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('button', { name: 'Abrir ajustes', exact: true })).toBeFocused()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before.scrollY)
    expect((await backgroundPosition(page)).top).toBeCloseTo(before.top, 0)
    await expectPageScrolls(page)

    await page.evaluate(() => window.scrollTo({ top: 12, behavior: 'instant' }))
    await openSettings(page)
    await expectDialogScrollsAlone(page, dialog)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('button', { name: 'Abrir ajustes', exact: true })).toBeFocused()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before.scrollY)
    await expectPageScrolls(page)
  })

  test(`privacy round trip releases and restores the settings scroll lock at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Hacé lugar al movimiento.', exact: true })).toBeVisible()
    await page.evaluate(() => window.scrollTo({ top: 12, behavior: 'instant' }))
    expect(await page.evaluate(() => window.scrollY)).toBe(12)
    const dialog = await openSettings(page, 'Privacidad')
    await dialog.getByTestId('privacy-policy').click()
    await expect(page).toHaveURL(/\/privacy$/)
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Tu práctica, bajo tu control.', exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await expectPageScrolls(page)

    await page.getByRole('link', { name: '← Volver a Klisteni', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(dialog).toBeVisible()
    await openSettings(page, 'Apariencia')
    await expectDialogScrollsAlone(page, dialog)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await expectPageScrolls(page)
  })

  test(`saving cardio from a scrolled routine opens progress at the top at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    const register = page.getByRole('button', { name: 'Registrar actividad', exact: true })
    await register.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
    await register.click()
    const dialog = page.getByRole('dialog', { name: 'Cada movimiento suma', exact: true })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Duración (minutos)', { exact: true }).fill('25')
    await dialog.getByRole('button', { name: 'Guardar actividad', exact: true }).click()

    await expect(dialog).toBeHidden()
    await expect(page.getByRole('navigation', { name: 'Navegación móvil', exact: true })
      .getByRole('button', { name: 'Mi progreso', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('heading', { name: 'Cada paso cuenta.', exact: true })).toBeInViewport()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await expect(page.locator('.activity-history')).toContainText('25 min')
  })
}
