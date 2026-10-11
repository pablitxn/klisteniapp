import { expect, test } from '@playwright/test'
import { exercises } from '../src/data/exercises'

test.use({ reducedMotion: 'reduce' })
// This suite validates catalogue and saved routine data. Actual model loading
// and every exercise pose remain covered by anatomy.spec.ts.
test.beforeEach(async ({ page }) => { await page.route('**/models/*.glb', route => route.abort()) })

test('the expanded gallery combines level, equipment and bilingual search and can reset an empty result', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true })
    .getByRole('button', { name: 'Ejercicios', exact: true }).click()
  await expect(page.locator('.library-card')).toHaveCount(37)
  const status = page.locator('.library-count')
  await expect(status).toHaveText('37 de 37 ejercicios')
  await expect.poll(() => page.locator('.library-card .exercise-preview-poster').first()
    .evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await page.screenshot({ path: test.info().outputPath('catalog-desktop.png') })
  await page.getByRole('combobox', { name: 'Equipo', exact: true }).selectOption('bar-or-rings')
  await expect(page.locator('.library-card')).toHaveCount(2)
  await expect(page.locator('.exercise-preview[data-exercise="bent-knee-row"]')).toBeVisible()
  await page.getByRole('combobox', { name: 'Nivel', exact: true }).selectOption('Inicial')
  const initialRows = exercises.filter((exercise) => exercise.equipment === 'bar-or-rings' && exercise.difficulty === 'Inicial')
  await expect(page.locator('.library-card')).toHaveCount(initialRows.length)
  await page.getByRole('textbox', { name: 'Buscar ejercicio o músculo' }).fill('sumo')
  await expect(status).toHaveText('0 de 37 ejercicios')
  await expect(page.getByRole('heading', { name: 'No encontramos ese movimiento.' })).toBeVisible()
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click()
  await expect(page.locator('.library-card')).toHaveCount(37)
  const exercise = exercises.find(({ id }) => id === 'single-leg-deadlift')!
  await page.getByRole('textbox', { name: 'Buscar ejercicio o músculo' }).fill(`  ${exercise.englishName.toUpperCase()}  `)
  await expect(page.locator('.library-card')).toHaveCount(1)
  await page.locator('.library-card').click()
  await expect(page.locator('.workbench-title')).toContainText(exercise.name)
  await page.getByText('Cómo encaja en tu rutina', { exact: true }).click()
  await expect(page.locator('.exercise-planning')).toContainText('Completá las repeticiones de un lado y después cambiá.')
  await expect(page.locator('.exercise-row')).toHaveCount(6)
})

test('new catalog controls and the last new card fit a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Navegación móvil', exact: true })
    .getByRole('button', { name: 'Ejercicios', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Nivel', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Equipo', exact: true }).selectOption('none')
  await expect(page.locator('.library-card')).toHaveCount(35)
  const exercise = exercises.find(({ id }) => id === 'plank-shoulder-tap')!
  await page.getByRole('textbox', { name: 'Buscar ejercicio o músculo' }).fill(exercise.englishName)
  const poster = page.locator('.exercise-preview[data-exercise="plank-shoulder-tap"] .exercise-preview-poster')
  await expect(poster).toBeVisible()
  await expect.poll(() => poster.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  expect((await page.locator('.library-card').boundingBox())!.width).toBeGreaterThan(260)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
  await expect(page.locator('.exercise-preview-motion')).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('catalog-mobile.png'), fullPage: true })
})

test('an equipped exercise can be added deliberately and survives a local routine reload', async ({ page }) => {
  await page.goto('/')
  const exercise = exercises.find(({ id }) => id === 'bent-knee-row')!
  await page.getByRole('button', { name: 'Personalizar', exact: true }).click()
  await page.getByRole('button', { name: `Agregar ${exercise.shortName} · requiere barra o anillas`, exact: true }).click()
  await page.getByRole('button', { name: 'Guardar mi rutina', exact: false }).click()
  await expect(page.locator('.exercise-row')).toHaveCount(7)
  await page.reload()
  const row = page.locator('.exercise-row').filter({ has: page.locator('.exercise-preview[data-exercise="bent-knee-row"]') })
  await expect(row).toBeVisible()
  await row.click()
  await expect(page.locator('.workbench-title')).toContainText(exercise.name)
  await expect(page.getByRole('tabpanel')).toContainText(exercise.steps[0]!)
  await expect(page.locator('.exercise-row')).toHaveCount(7)
})

test('a long valid routine saves every set, including different repetitions, after crossing fifty entries', async ({ page }) => {
  test.setTimeout(180_000)
  const ids = exercises.map(({ id }) => id)
  await page.addInitScript((exerciseIds) => {
    localStorage.setItem('klisteniapp.preferences.v1', JSON.stringify({ exerciseIds, sets: 2, reducedMotion: true }))
  }, ids)
  await page.goto('/')
  await page.getByRole('button', { name: 'Empezar mi rutina', exact: false }).click()
  const session = page.getByRole('region', { name: 'Sesión en curso', exact: true })
  for (let index = 0; index < ids.length * 2; index++) {
    if (index > 0) await session.getByRole('button', { name: 'Omitir descanso' }).click()
    await session.getByRole('spinbutton', { name: 'Repeticiones', exact: true }).fill(String(index % 2 === 0 ? 6 : 8))
    await session.getByRole('button', { name: 'Registrar serie' }).click()
  }
  await expect(session).toContainText('74 series registradas')
  await session.getByRole('button', { name: 'Guardar sesión' }).click()
  await expect(session).not.toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('klisteniapp.progress.v1')!))
  expect(saved.workouts).toHaveLength(1)
  expect(saved.workouts[0].exercises).toEqual(ids.flatMap((exerciseId) => [
    { exerciseId, sets: 1, reps: 6 }, { exerciseId, sets: 1, reps: 8 },
  ]))
})
