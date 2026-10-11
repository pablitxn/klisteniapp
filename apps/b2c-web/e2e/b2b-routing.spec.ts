import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page, role: 'admin' | 'coach' | 'member') {
  await page.getByLabel('Email', { exact: true }).fill(`${role}@atlas.example.test`)
  await page.getByLabel('Contraseña', { exact: true }).fill('browser-tests-only-password-2026')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
}

test('gym section URLs support compatibility, direct entry, history and reload without reloading the session', async ({ page }) => {
  await page.goto('/backoffice/people?gym=atlas-demo')
  await expect(page).toHaveURL(/\/manage\/people\?gym=atlas-demo$/)
  await signIn(page, 'admin')
  await expect(page.getByRole('heading', { name: 'Personas antes que números.' })).toBeVisible()
  await page.evaluate(() => Object.assign(window, { b2bDocumentMarker: 'same-document' }))
  const contexts: string[] = []
  page.on('request', request => { if (/\/api\/b2b\/(me|context)$/.test(new URL(request.url()).pathname)) contexts.push(request.url()) })
  await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
  await expect(page).toHaveURL(/\/manage\/programs$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/manage\/people\?gym=atlas-demo$/)
  await expect(page.getByRole('heading', { name: 'Personas antes que números.' })).toBeVisible()
  expect(await page.evaluate(() => (window as Window & { b2bDocumentMarker?: string }).b2bDocumentMarker)).toBe('same-document')
  expect(contexts).toEqual([])
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Personas antes que números.' })).toBeVisible()
})

test('member and coach cannot obtain administrative screens by entering their URLs', async ({ page }) => {
  await page.goto('/manage/whiteLabel')
  await signIn(page, 'coach')
  await expect(page.getByRole('heading', { name: 'No tenés permisos para esta sección' })).toBeVisible()
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await signIn(page, 'member')
  await expect(page.getByRole('heading', { name: 'Este espacio es para el equipo del gimnasio' })).toBeVisible()
  await page.getByRole('link', { name: 'Ir a mi espacio de socio' }).click()
  await page.getByRole('button', { name: 'Movimientos', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/catalog$/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Conocé cada movimiento.' })).toBeVisible()
})
