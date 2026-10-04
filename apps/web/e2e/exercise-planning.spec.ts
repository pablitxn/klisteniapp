import { expect, test } from '@playwright/test'

test('planning information distinguishes related progressions and opens them without editing the routine', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.exercise-row').filter({
    has: page.locator('.exercise-preview[data-exercise="pushup"]'),
  }).click()
  await page.getByText('Cómo encaja en tu rutina', { exact: true }).click()
  const planning = page.locator('.exercise-planning')
  await expect(planning).toContainText('Empuje horizontal')
  await expect(planning).toContainText('Usar sus propias series, repeticiones y descansos')
  await planning.getByRole('button', { name: 'Progresión: Flexiones completas', exact: false }).click()
  await expect(page.locator('.workbench-title')).toContainText('Flexiones completas')
  await expect(page.locator('.exercise-row')).toHaveCount(6)
  await page.getByText('Cómo encaja en tu rutina', { exact: true }).click()
  await expect(planning).toContainText('Controlar la flexión con rodillas')
  await expect(planning.getByRole('button', { name: 'Menor dificultad: Flexiones con rodillas', exact: false })).toBeVisible()
})

test('metadata and conditional alternatives fit a narrow screen', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  await page.getByText('Cómo encaja en tu rutina', { exact: true }).click()
  await expect(page.locator('.exercise-planning')).toContainText('Sentadilla con ambos pies apoyados')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
})

test('a unilateral exercise opened from the gallery explains each-side dosage and its reviewed regression', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('klisteniapp.preferences.v1', JSON.stringify({
      weeklyGoal: 2, sets: 2, exerciseIds: ['calf-raise', 'single-leg-calf-raise'], reducedMotion: true,
    }))
  })
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true })
    .getByRole('button', { name: 'Ejercicios', exact: true }).click()
  await page.locator('.library-card').filter({
    has: page.locator('.exercise-preview[data-exercise="single-leg-calf-raise"]'),
  }).click()
  await expect(page.locator('.workbench-title')).toContainText('Elevación de talón a una pierna')
  const selected = page.locator('.exercise-row[aria-pressed="true"]')
  await expect(selected).toContainText('2 × 6–10 / lado')
  await page.getByText('Cómo encaja en tu rutina', { exact: true }).click()
  const planning = page.locator('.exercise-planning')
  await expect(planning).toContainText('La demostración muestra un lado.')
  await expect(planning).toContainText('Completá las repeticiones de un lado y después cambiá.')
  await expect(planning).toContainText('Usar sus propias series, repeticiones y descansos')
  await planning.getByRole('button', { name: 'Menor dificultad: Elevación de talones', exact: false }).click()
  await expect(page.locator('.workbench-title')).toContainText('Elevación de talones')
  await expect(page.locator('.exercise-row')).toHaveCount(2)
  await expect(page.locator('.exercise-row[aria-pressed="true"]')).not.toContainText('/ lado')
})
