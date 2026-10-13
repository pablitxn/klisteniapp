import { expect, test } from '@playwright/test'
import { exercises } from '../src/data/exercises'

test.beforeEach(async ({ page }) => {
  // Exercise the same unavailable-WebGL boundary on both browser engines,
  // without overriding their executable or relying on Chromium-only flags.
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null
      return Reflect.apply(getContext, this, [type, ...args])
    } as typeof getContext
  })
})

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
