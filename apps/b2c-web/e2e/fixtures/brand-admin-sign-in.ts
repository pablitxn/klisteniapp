import { expect, type Page } from '@playwright/test'

/** Keep production auth limits intact; honor the real retry window. */
export async function brandAdminSignIn(page: Page, email = 'admin@atlas.example.test') {
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill('browser-tests-only-password-2026')
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/b2b/auth/sign-in/email') &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
    const response = await result
    if (response.status() !== 429) {
      expect(response.status()).toBe(200)
      break
    }
    await page.waitForTimeout(
      (Math.max(1, Number(response.headers()['retry-after']) || 60) + 1) * 1000,
    )
  }
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
}
