import { expect, test } from '@playwright/test'
import { exercises } from '../src/data/exercises'

test.use({ launchOptions: { args: ['--disable-webgl'] } })

test('device without WebGL keeps education and muscle information usable', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Hacé lugar al movimiento.' })).toBeVisible()
  await expect(page.locator('.viewer-fallback')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('tabpanel')).toContainText('Llevá la cadera atrás y abajo')
  await page.getByRole('button', { name: 'Cuádriceps', exact: true }).click()
  await expect(page.locator('.muscle-definition')).toContainText('Extienden las rodillas')
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('button', { name: 'Ejercicios', exact: true }).click()
  await expect(page.locator('.library-card')).toHaveCount(exercises.length)
})
