import { expect, test } from '@playwright/test'
import { createDefaultPersonalData } from '@klisteniapp/scene-schema'

for (const profile of [{ name: 'María Elena Pérez', initials: 'MP' }, { name: 'Lucía', initials: 'L' }]) {
  test(`the settings opener uses saved account initials for ${profile.name}`, async ({ page }) => {
    const user = { id: 'ui-annotations-account', name: 'Fallback Auth Name', email: 'ui-annotations@example.test' }
    const state = { data: createDefaultPersonalData(profile.name, 'UTC'), revision: 0 }
    await page.route('**/models/*.glb', route => route.abort())
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/get-session') return route.fulfill({ json: { user } })
      if (path === '/api/me/state') return route.fulfill({ json: state })
      if (path === '/api/me/access') return route.fulfill({ json: { status: 'lifetime', cloudWrite: true, trialEndsAt: null, paidThrough: null } })
      return route.fulfill({ status: 404, json: { error: 'Not found' } })
    })
    await page.goto('/')
    await expect(page.locator('.local-badge')).toContainText('Sincronizado con tu cuenta')
    const opener = page.getByRole('button', { name: 'Abrir ajustes', exact: true })
    await expect(opener).toHaveText(profile.initials)
    await expect(opener.locator('svg')).toHaveCount(0)
    await expect(page.locator('.account-login')).toHaveCount(0)
    await opener.click()
    await expect(page.getByRole('dialog', { name: 'Configuración', exact: true })).toBeVisible()
  })
}
