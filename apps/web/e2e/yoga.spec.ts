import { expect, test, type Page } from '@playwright/test'
import { createDefaultPersonalData, type YogaPractice } from '@klisteniapp/scene-schema'

const personalKey = 'klisteniapp.personal.v2'
test.use({ reducedMotion: 'reduce' })
test.beforeEach(async ({ page }) => { await page.route('**/models/*.glb', route => route.abort()) })

async function yogaPage(page: Page, mobile = false) {
  await page.goto('/')
  await page.getByRole('navigation', { name: mobile ? 'Navegación móvil' : 'Navegación principal', exact: true }).getByRole('button', { name: 'Yoga', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Hacé espacio para tu práctica.' })).toBeVisible()
}

const timedPractice: YogaPractice = {
  id: 'timer-fixture', name: 'Pausa de prueba', intention: 'Escuchar el cuerpo',
  steps: [
    { id: 'one', asanaId: 'tadasana', durationSeconds: 5, side: 'both' },
    { id: 'two', asanaId: 'sukhasana', durationSeconds: 5, side: 'both' },
    { id: 'three', asanaId: 'savasana', durationSeconds: 5, side: 'both' },
  ],
}
async function seed(page: Page) {
  const data = createDefaultPersonalData('Yoga local', 'Europe/Tirane')
  data.settings.yoga = { practices: [timedPractice], logs: [] }
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: personalKey, value: data })
}

test('library searches Sanskrit and English and exposes cultural context and sources', async ({ page }) => {
  await yogaPage(page)
  await page.getByRole('navigation', { name: 'Secciones de yoga' }).getByRole('button', { name: 'Biblioteca' }).click()
  await expect(page.locator('.yoga-asana-card')).toHaveCount(24)
  await page.screenshot({ path: test.info().outputPath('yoga-desktop.png') })
  const search = page.getByRole('textbox', { name: 'Buscar asanas' })
  await search.fill('tree')
  await expect(page.locator('.yoga-asana-card')).toHaveCount(1)
  await page.locator('.yoga-asana-card').getByRole('button', { name: 'Explorar asana', exact: true }).click()
  const detail = page.getByRole('dialog')
  await expect(detail).toContainText('Vṛkṣāsana')
  await expect(detail).toContainText('HISTORIA')
  expect(await detail.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(800)
  await expect(detail.getByRole('link').first()).toHaveAttribute('href', /^https:\/\//)
  await page.keyboard.press('Escape')
  await expect(detail).not.toBeVisible()
  await search.fill('no existe esta postura')
  await expect(page.locator('.yoga-asana-card')).toHaveCount(0)
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await expect(page.locator('.yoga-asana-card')).toHaveCount(24)
})

test('practice editor preserves repeated asanas, order, explicit sides and durations across reload', async ({ page }) => {
  await yogaPage(page)
  await page.getByRole('button', { name: 'Crear práctica', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Nombre de la práctica' }).fill('Mi pausa consciente')
  await dialog.getByRole('textbox', { name: 'Intención (opcional)' }).fill('Explorar sin apuro')
  await dialog.getByRole('button', { name: 'Agregar Montaña', exact: true }).click()
  await dialog.getByRole('button', { name: 'Agregar Guerrero II', exact: true }).click()
  await dialog.getByRole('button', { name: 'Repetir tramo 1', exact: true }).click()
  await dialog.getByRole('button', { name: 'Bajar tramo 1', exact: true }).click()
  await dialog.getByRole('spinbutton').first().fill('25')
  await dialog.getByRole('button', { name: 'Guardar práctica', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).settings.yoga, personalKey)
  expect(stored.practices[0].name).toBe('Mi pausa consciente')
  expect(stored.practices[0].steps.map((step: { side: string }) => step.side)).toEqual(['both', 'both', 'left', 'right'])
  expect(stored.practices[0].steps[0].durationSeconds).toBe(25)
  expect(new Set(stored.practices[0].steps.map((step: { id: string }) => step.id)).size).toBe(4)
  await yogaPage(page)
  await page.getByRole('navigation', { name: 'Secciones de yoga' }).getByRole('button', { name: 'Mis prácticas' }).click()
  await expect(page.getByRole('heading', { name: 'Mi pausa consciente' })).toBeVisible()
})

test('timer excludes pauses and skips, saves a partial snapshot and appears in global history', async ({ page }) => {
  await seed(page)
  await yogaPage(page)
  await page.clock.install()
  await page.getByRole('navigation', { name: 'Secciones de yoga' }).getByRole('button', { name: 'Mis prácticas' }).click()
  await page.getByRole('button', { name: 'Comenzar Pausa de prueba', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Comenzar asana', exact: true }).click()
  await page.clock.runFor(2100)
  await dialog.getByRole('button', { name: 'Pausar', exact: true }).click()
  const paused = await dialog.getByRole('timer').textContent()
  await page.clock.runFor(10_000)
  await expect(dialog.getByRole('timer')).toHaveText(paused!)
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.clock.runFor(3100)
  await expect(dialog).toContainText('Tramo 2 de 3')
  await dialog.getByRole('button', { name: 'Saltar asana', exact: true }).click()
  await expect(dialog).toContainText('Tramo 3 de 3')
  await dialog.getByRole('button', { name: 'Comenzar asana', exact: true }).click()
  await page.clock.runFor(2100)
  await dialog.getByRole('button', { name: 'Terminar ahora', exact: true }).click()
  await dialog.getByRole('button', { name: 'Revisar y guardar', exact: true }).click()
  await dialog.getByRole('textbox', { name: '¿Cómo te sentís? (opcional)' }).fill('Usé una manta')
  await dialog.getByRole('button', { name: 'Guardar registro', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const logs = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).settings.yoga.logs, personalKey)
  expect(logs).toHaveLength(1)
  expect(logs[0].durationSeconds).toBe(7)
  expect(logs[0].completedSteps.map((step: { stepId: string }) => step.stepId)).toEqual(['one', 'three'])
  expect(logs[0].practiceSnapshot.steps).toHaveLength(3)
  expect(logs[0].notes).toBe('Usé una manta')
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('button', { name: 'Mi progreso', exact: true }).click()
  await expect(page.locator('.activity-history')).toContainText('Yoga · Pausa de prueba')
  await page.getByText('Ver práctica', { exact: true }).click()
  await expect(page.locator('.activity-history')).toContainText('Usé una manta')
})

test('Escape preserves an unsaved editor until discard is confirmed', async ({ page }) => {
  await yogaPage(page)
  await page.getByRole('button', { name: 'Crear práctica', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Nombre de la práctica' }).fill('Todavía un borrador')
  await page.keyboard.press('Escape')
  await expect(dialog.getByRole('heading', { name: '¿Descartar los cambios?' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Seguir editando', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: 'Nombre de la práctica' })).toHaveValue('Todavía un borrador')
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: 'Descartar cambios', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(await page.evaluate(key => localStorage.getItem(key), personalKey)).toBeNull()
})

test('storage failure retains the practice draft and reports failure', async ({ page }) => {
  await yogaPage(page)
  await page.getByRole('button', { name: 'Crear práctica', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Nombre de la práctica' }).fill('Guardar después')
  await dialog.getByRole('button', { name: 'Agregar Montaña', exact: true }).click()
  await page.evaluate(key => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name: string, value: string) {
      if (name === key) throw new DOMException('Quota exceeded', 'QuotaExceededError')
      original.call(this, name, value)
    }
  }, personalKey)
  await dialog.getByRole('button', { name: 'Guardar práctica', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Nombre de la práctica' })).toHaveValue('Guardar después')
  expect(await page.evaluate(key => localStorage.getItem(key), personalKey)).toBeNull()
})

test('narrow dark layout keeps library and practice editor within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await yogaPage(page, true)
  await page.getByRole('navigation', { name: 'Secciones de yoga' }).getByRole('button', { name: 'Biblioteca' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
  await page.screenshot({ path: test.info().outputPath('yoga-mobile-dark.png'), fullPage: true })
  await page.getByRole('button', { name: 'Crear práctica', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Agregar Guerrero II', exact: true }).click()
  const dimensions = await dialog.evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1)
  await page.screenshot({ path: test.info().outputPath('yoga-editor-mobile-dark.png') })
})

for (const language of ['en', 'fr']) {
  test(`${language} controls keep the all-levels filter usable and identify Spanish catalog content`, async ({ page }) => {
    await page.addInitScript(lang => localStorage.setItem('klisteniapp.display.v1', JSON.stringify({ language: lang })), language)
    await page.goto('/')
    await page.locator('.sidebar').getByRole('button', { name: 'Yoga', exact: true }).click()
    await expect(page.locator('.yoga-asana-card')).toHaveCount(24)
    await page.locator('.yoga-level select').selectOption('Intermedio')
    expect(await page.locator('.yoga-asana-card').count()).toBeLessThan(24)
    await page.locator('.yoga-level select').selectOption('Todos los niveles')
    await expect(page.locator('.yoga-asana-card')).toHaveCount(24)
    await expect(page.locator('.yoga-page')).toContainText(language === 'en' ? 'available in Spanish' : 'disponibles en espagnol')
  })
}
