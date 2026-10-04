import { expect, test } from '@playwright/test'
import { createDefaultPersonalData } from '@klisteniapp/scene-schema'

const token = 'public-test-token-with-no-secret-12345'
const expiresAt = '2026-12-31T12:00:00.000Z'

test('activation verifies its in-memory token, clears the address bar and returns to login', async ({ page }, testInfo) => {
  const requests: { path: string; body: unknown }[] = []
  const media: string[] = []
  page.on('request', request => { if (request.url().endsWith('.glb')) media.push(request.url()) })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    requests.push({ path, body: route.request().method() === 'POST' ? route.request().postDataJSON() : null })
    if (path === '/api/account/token-info') return route.fulfill({ json: { kind: 'activation', email: 'invited@example.test', name: 'Persona invitada', expiresAt } })
    if (path === '/api/account/activate') return route.fulfill({ json: { ok: true, user: { id: 'created', email: 'invited@example.test', name: 'Mi nombre' } } })
    return route.fulfill({ json: null })
  })
  await page.goto(`/account/activate#token=${token}`)
  await expect(page).toHaveURL(/\/account\/activate$/)
  await expect(page.getByRole('heading', { name: 'Bienvenido a tu práctica.' })).toBeVisible()
  await expect(page.getByLabel('Email de la invitación')).toHaveValue('invited@example.test')
  await expect(page.getByLabel('Email de la invitación')).toHaveAttribute('readonly', '')
  await page.getByLabel('Tu nombre', { exact: true }).fill('Mi nombre')
  await page.getByLabel('Elegí una contraseña', { exact: true }).fill('private-test-password')
  await page.getByLabel('Repetí la contraseña', { exact: true }).fill('private-test-password')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391)
  await page.screenshot({ path: testInfo.outputPath('account-activation-mobile.png') })
  await page.getByRole('button', { name: 'Activar mi cuenta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tu cuenta está lista.' })).toBeVisible()
  expect(requests.filter(request => request.path === '/api/account/activate').map(request => request.body)).toEqual([{ token, name: 'Mi nombre', password: 'private-test-password' }])
  expect(requests.some(request => request.path.startsWith('/api/auth/'))).toBe(false)
  expect(media).toHaveLength(0)
  expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).not.toContain(token)
  await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Entrar a Klisteni' })).toBeVisible()
})

test('recovery requires matching passwords, submits the fragment token and cannot reuse it after reload', async ({ page }) => {
  const submitted: unknown[] = []
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/account/token-info') return route.fulfill({ json: { kind: 'recovery', email: 'member@example.test', name: 'Persona', expiresAt } })
    if (path === '/api/account/reset-password') { submitted.push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }) }
    return route.fulfill({ json: null })
  })
  await page.goto(`/account/recover#token=${token}`)
  await expect(page).toHaveURL(/\/account\/recover$/)
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('new-password-for-test')
  await page.getByLabel('Repetí la contraseña', { exact: true }).fill('other-password-for-test')
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click()
  await expect(page.getByRole('alert')).toContainText('no coinciden')
  expect(submitted).toHaveLength(0)
  await page.getByLabel('Repetí la contraseña', { exact: true }).fill('new-password-for-test')
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click()
  await expect(page.getByRole('heading', { name: 'Contraseña actualizada.' })).toBeVisible()
  expect(submitted).toEqual([{ token, password: 'new-password-for-test' }])
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('incompleto')
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
})

test('invalid and wrong-purpose invitation links never offer account mutation', async ({ page }) => {
  await page.route('**/api/account/token-info', route => route.fulfill({ status: 400, json: { error: 'Enlace inválido', code: 'INVALID_TOKEN' } }))
  await page.goto(`/account/activate#token=${token}`)
  await expect(page.getByRole('alert')).toContainText('ya no está disponible')
  await expect(page.getByRole('button', { name: 'Activar mi cuenta' })).toHaveCount(0)
  await page.unroute('**/api/account/token-info')
  await page.route('**/api/account/token-info', route => route.fulfill({ json: { kind: 'recovery', email: 'member@example.test', name: null, expiresAt } }))
  await page.goto(`/account/activate#token=${token}`)
  await expect(page.getByRole('alert')).toContainText('otra acción')
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
})

test('admin creates an invitation, revokes its link and controls access without showing passwords', async ({ page }, testInfo) => {
  const origin = new URL(String(testInfo.project.use.baseURL)).origin
  const admin = { id: 'admin-a', email: 'admin@example.test', name: 'Administración', role: 'admin', disabled: false, createdAt: '2026-10-01T12:00:00Z' }
  const member = { id: 'member-b', email: 'member@example.test', name: 'Persona invitada', role: 'user', disabled: false, createdAt: '2026-10-01T12:00:00Z' }
  const invitation = { id: 'invite-1', email: 'new@example.test', name: 'Nueva persona', kind: 'activation', role: 'user', createdAt: '2026-10-04T12:00:00Z', expiresAt, status: 'pending', deliveryStatus: 'not_requested' }
  let exists = false
  const mutations: { path: string; body: unknown }[] = []
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/get-session') return route.fulfill({ json: { user: admin, session: { id: 's' } } })
    if (path === '/api/me/state') return route.fulfill({ json: { data: createDefaultPersonalData(admin.name), revision: 0 } })
    if (path.startsWith('/api/admin/')) expect(route.request().headers()['x-klisteni-account']).toBe(admin.id)
    if (route.request().method() === 'POST') mutations.push({ path, body: route.request().postDataJSON() })
    if (path === '/api/admin/users' && route.request().method() === 'GET') return route.fulfill({ json: { users: [admin, member] } })
    if (path === '/api/admin/invitations' && route.request().method() === 'GET') return route.fulfill({ json: { invitations: exists ? [invitation] : [], mailConfigured: false } })
    if (path === '/api/admin/invitations' && route.request().method() === 'POST') { exists = true; return route.fulfill({ json: { invitation, url: `${origin}/account/activate#token=${token}`, delivery: { status: 'not_requested' } } }) }
    if (path === '/api/admin/invitations/invite-1/revoke') { invitation.status = 'revoked'; return route.fulfill({ json: { ok: true } }) }
    if (path === '/api/admin/users/member-b/disable') { member.disabled = true; return route.fulfill({ json: { ok: true } }) }
    return route.fulfill({ status: 404, json: { error: 'Not found' } })
  })
  await page.goto('/')
  await page.locator('.account-login').click()
  const dialog = page.getByRole('dialog', { name: 'Mi cuenta y planificación' })
  await dialog.getByText('Usuarios e invitaciones', { exact: true }).click()
  await expect(dialog.getByText('Personas con acceso', { exact: true })).toBeVisible()
  await dialog.getByLabel('Email de la persona').fill('new@example.test')
  await dialog.locator('.admin-invite-form input[name="name"]').fill('Nueva persona')
  await expect(dialog.getByLabel('Enviar los nuevos enlaces por email')).toBeDisabled()
  await dialog.getByRole('button', { name: 'Crear invitación', exact: true }).click()
  await expect(dialog.getByLabel('Enlace personal', { exact: true })).toHaveValue(`${origin}/account/activate#token=${token}`)
  await expect(dialog.locator('.admin-issued')).toContainText('Para compartir manualmente')
  expect(mutations[0]).toEqual({ path: '/api/admin/invitations', body: { email: 'new@example.test', name: 'Nueva persona', sendEmail: false } })
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain(token)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391)
  await dialog.locator('.admin-issued').scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('admin-invitation-mobile.png') })
  await dialog.getByRole('button', { name: 'Revocar enlace', exact: true }).click()
  await expect(dialog.locator('.admin-row').filter({ hasText: 'new@example.test' })).toContainText('Revocado')
  await dialog.getByRole('button', { name: 'Deshabilitar acceso', exact: true }).click()
  await expect(dialog.locator('.admin-row').filter({ hasText: 'member@example.test' })).toContainText('Deshabilitado')
})
