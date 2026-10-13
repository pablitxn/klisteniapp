import { randomUUID } from 'node:crypto'
import { expect, test, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test'
import { createPool } from '../../b2c-api/src/database.ts'
import { createProvisionedUser } from '../../b2c-api/src/operator-service.ts'
import { StateRepository } from '../../b2c-api/src/state.ts'
import { adminPassword as password, fixtureConfig } from '../../../scripts/b2c-admin-fixtures.ts'
import { openAccountSettings } from './settings-helpers'

const config = fixtureConfig()
const pool = createPool(config)
const email = (prefix: string) => `${prefix}-${randomUUID()}@admin.test`
test.afterAll(async () => { await pool.end() })
test.beforeEach(async ({ context }, info) => {
  await context.setExtraHTTPHeaders({ 'X-Klisteniapp-Test-Client-IP': `198.51.100.${info.testId.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % 250 + 1}` })
  // Models are outside this role's scope. Keep the real app shell and backend.
  await context.route('**/models/*.glb', route => route.abort())
})

async function login(page: Page, address = 'admin@admin.test') {
  await page.goto('/')
  let dialog = await openAccountSettings(page)
  const session = await page.evaluate(() => fetch('/api/auth/get-session').then(r => r.json()))
  if (session) {
    await dialog.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
    dialog = await openAccountSettings(page)
  }
  await dialog.getByLabel('Email', { exact: true }).fill(address)
  await dialog.getByLabel('Contraseña', { exact: true }).fill(password)
  await dialog.getByRole('button', { name: 'Entrar a mi cuenta', exact: true }).click()
  await expect(dialog).not.toBeVisible()
}
async function adminPanel(page: Page) {
  const panel = await openAccountSettings(page)
  const admin = panel.locator('.admin-accounts')
  if (await admin.getAttribute('open') === null) await admin.locator('summary').click()
  await expect(admin.locator('.admin-invite-form').first()).toBeVisible()
  await expect(admin.getByRole('button', { name: 'Actualizar', exact: true })).toBeEnabled()
  return admin
}
function userRow(admin: Locator, address: string) {
  return admin.locator('.admin-row').filter({ has: admin.page().getByRole('button', { name: /acceso vitalicio/ }) }).filter({ hasText: address })
}
function invitationRow(admin: Locator, address: string) {
  return admin.locator('.admin-row').filter({ hasText: address }).filter({ hasText: /Activación|Recuperación/ }).first()
}
async function invite(admin: Locator, address: string, access = 'trial') {
  await admin.getByLabel('Email de la persona').fill(address)
  await admin.locator('input[name="name"]').fill('Persona QA')
  await admin.getByRole('combobox', { name: 'Acceso a la nube', exact: true }).selectOption(access)
  await admin.getByRole('button', { name: 'Crear invitación', exact: true }).click()
  await expect(admin.getByLabel('Enlace personal', { exact: true })).toHaveValue(/#token=/)
  return admin.getByLabel('Enlace personal', { exact: true }).inputValue()
}
async function shared(admin: Locator, label: string, maxUses = 1, days = 7) {
  await admin.getByLabel('Nombre del enlace', { exact: true }).fill(label)
  await admin.getByLabel('Cantidad máxima de personas').fill(String(maxUses))
  await admin.getByLabel('Vigencia del enlace (días)').fill(String(days))
  await admin.getByRole('button', { name: 'Crear enlace compartible', exact: true }).click()
  await expect(admin.getByLabel('Enlace compartible', { exact: true })).toHaveValue(/#token=/)
  return admin.getByLabel('Enlace compartible', { exact: true }).inputValue()
}
async function fillActivation(page: Page, address?: string) {
  await page.getByLabel('Tu nombre', { exact: true }).fill('Persona QA')
  if (address) await page.getByLabel('Tu email', { exact: true }).fill(address)
  await page.getByLabel('Elegí una contraseña', { exact: true }).fill(password)
  await page.getByLabel('Repetí la contraseña', { exact: true }).fill(password)
}
async function newRecipient(context: BrowserContext, url: string) {
  // New tab in the same context is adequate for anonymous activation; individual
  // session-isolation cases below explicitly use separate browser contexts.
  const page = await context.newPage()
  await page.goto(url)
  return page
}
async function api(page: Page, path: string, method = 'GET', body?: unknown, accountId?: string) {
  return page.evaluate(async ({ path, method, body, accountId }) => {
    const session = await fetch('/api/auth/get-session', { cache: 'no-store' }).then(r => r.json())
    const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-Klisteni-Account': accountId ?? session?.user.id ?? '' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    return { status: response.status, body: await response.json() }
  }, { path, method, body, accountId })
}
async function evidence(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path, mask: [page.locator('.admin-issued input:visible'), page.locator('input[type="password"]:visible')] })
  await info.attach(name, { path, contentType: 'image/png' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(info.project.use.viewport!.width)
}

test('inventory: account states, empty shared list, self protection and mobile layout', async ({ page }, info) => {
  await pool.query('DELETE FROM account_bootstrap')
  await pool.query('DELETE FROM account_token')
  await pool.query('DELETE FROM account_share_invitation')
  await login(page)
  const admin = await adminPanel(page)
  await expect(admin).toContainText('Todavía no hay invitaciones ni enlaces de recuperación.')
  await expect(admin.getByRole('heading', { name: 'Enlaces compartibles', exact: true })).toHaveCount(0)
  await expect(userRow(admin, 'trial@admin.test')).toContainText('Prueba de la nube')
  await expect(userRow(admin, 'expired@admin.test')).toContainText('Guardado en la nube pausado')
  await expect(userRow(admin, 'lifetime@admin.test')).toContainText('Acceso vitalicio')
  await expect(userRow(admin, 'paid@admin.test')).toContainText('Suscripción activa')
  await expect(userRow(admin, 'disabled@admin.test')).toContainText('Deshabilitado')
  const self = userRow(admin, 'admin@admin.test')
  await expect(self).toContainText('Administrador · tu cuenta')
  await expect(self.getByRole('button', { name: /Deshabilitar|Cerrar sus sesiones|Crear recuperación/ })).toHaveCount(0)
  await expect(admin.getByRole('checkbox', { name: /Enviar los nuevos enlaces por email/ })).toBeDisabled()
  await expect(admin).toContainText('El correo no está configurado')
  if (info.project.use.hasTouch) {
    await admin.locator('summary').tap()
    await expect(admin).not.toHaveAttribute('open', '')
    await admin.locator('summary').tap()
    await expect(admin.getByLabel('Email de la persona')).toBeVisible()
  }
  await admin.getByRole('button', { name: 'Actualizar', exact: true }).click()
  await self.scrollIntoViewIfNeeded()
  await evidence(page, info, 'account-states')
  await admin.getByLabel('Email de la persona').scrollIntoViewIfNeeded()
  await evidence(page, info, 'invitation-forms')
})

test('personal trial and lifetime: validation, activation, consumed link, refresh and persisted roles', async ({ page, context }, info) => {
  await login(page)
  const admin = await adminPanel(page)
  const form = admin.locator('.admin-invite-form').first()
  let writes = 0
  page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/api/admin/invitations')) writes++ })
  await admin.getByLabel('Email de la persona').fill('invalid')
  await form.getByRole('button', { name: 'Crear invitación', exact: true }).click()
  expect(writes).toBe(0)
  await admin.getByLabel('Email de la persona').fill('trial@admin.test')
  await form.getByRole('button', { name: 'Crear invitación', exact: true }).click()
  await expect(admin.getByRole('alert')).toContainText('ya tiene una cuenta')
  for (const access of ['trial', 'lifetime']) {
    const address = email(access)
    const url = await invite(admin, address, access)
    const recipient = await newRecipient(context, url)
    await expect(recipient).toHaveURL(/\/account\/activate$/)
    await expect(recipient.locator('.billing-notice')).toContainText(access === 'trial' ? '15 días' : 'vitalicio')
    await fillActivation(recipient)
    await recipient.getByLabel('Repetí la contraseña', { exact: true }).fill('Wrong-password-2026!')
    await recipient.getByRole('button', { name: 'Activar mi cuenta', exact: true }).click()
    await expect(recipient.getByRole('alert')).toContainText('no coinciden')
    expect((await pool.query('SELECT id FROM auth_user WHERE email = $1', [address])).rowCount).toBe(0)
    await fillActivation(recipient)
    await recipient.getByRole('button', { name: 'Activar mi cuenta', exact: true }).click()
    await expect(recipient.getByRole('heading', { name: 'Tu cuenta está lista.' })).toBeVisible()
    const saved = (await pool.query('SELECT u.role, u."emailVerified", a.lifetime, a.trial_ends_at FROM auth_user u JOIN account_access a ON a.user_id = u.id WHERE u.email = $1', [address])).rows[0]
    expect(saved).toMatchObject({ role: 'user', emailVerified: true, lifetime: access === 'lifetime' })
    expect(saved.trial_ends_at.getTime() - Date.now()).toBeGreaterThan(14 * 86400000)
    await recipient.reload()
    await expect(recipient.getByRole('alert')).toContainText('incompleto')
    await recipient.goto(url)
    await expect(recipient.getByRole('alert')).toContainText('ya no está disponible')
    await recipient.goBack()
    await recipient.goForward()
    await expect(recipient.getByRole('button', { name: 'Activar mi cuenta', exact: true })).toHaveCount(0)
    await recipient.close()
    await admin.getByRole('button', { name: 'Actualizar', exact: true }).click()
    await expect(invitationRow(admin, address)).toContainText('Utilizado')
    await expect(invitationRow(admin, address).getByRole('button')).toHaveCount(0)
  }
  await evidence(page, info, 'personal-invitations')
})

test('personal reissue, copy fallback, revocation and exact expiry do not create users', async ({ page, context }, info) => {
  await login(page)
  const admin = await adminPanel(page)
  const address = email('reissue')
  const old = await invite(admin, address)
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Fixture clipboard denied') } } }) })
  await admin.getByRole('button', { name: 'Copiar enlace', exact: true }).click()
  await expect(admin.getByRole('status')).toContainText('copiarlo manualmente')
  await invitationRow(admin, address).getByRole('button', { name: 'Reemitir enlace', exact: true }).click()
  await expect(admin.getByLabel('Enlace personal', { exact: true })).not.toHaveValue(old)
  const replacement = await admin.getByLabel('Enlace personal', { exact: true }).inputValue()
  const recipient = await newRecipient(context, old)
  await expect(recipient.getByRole('alert')).toContainText('ya no está disponible')
  await recipient.goto(replacement)
  await expect(recipient.getByRole('button', { name: 'Activar mi cuenta' })).toBeVisible()
  await invitationRow(admin, address).getByRole('button', { name: 'Revocar enlace', exact: true }).click()
  await recipient.goto(replacement)
  await expect(recipient.getByRole('alert')).toContainText('ya no está disponible')
  await invitationRow(admin, address).getByRole('button', { name: 'Reemitir enlace', exact: true }).click()
  const expiredUrl = await admin.getByLabel('Enlace personal', { exact: true }).inputValue()
  await pool.query('UPDATE account_token SET expires_at = now() WHERE email = $1 AND revoked_at IS NULL AND used_at IS NULL', [address])
  await admin.getByRole('button', { name: 'Actualizar', exact: true }).click()
  await expect(invitationRow(admin, address)).toContainText('Vencido')
  await recipient.goto(expiredUrl)
  await expect(recipient.getByRole('alert')).toContainText('ya no está disponible')
  expect((await pool.query('SELECT id FROM auth_user WHERE email = $1', [address])).rowCount).toBe(0)
  await evidence(page, info, 'revoked-expired-personal')
})

test('shared link boundaries, validation, cancellation and reload preserve issued metadata', async ({ page }, info) => {
  await login(page)
  const admin = await adminPanel(page)
  const label = `Boundary ${randomUUID()}`
  await admin.getByLabel('Nombre del enlace').fill(label)
  await admin.getByLabel('Cantidad máxima de personas').fill('0')
  await admin.getByRole('button', { name: 'Crear enlace compartible', exact: true }).click()
  expect((await pool.query('SELECT id FROM account_share_invitation WHERE label = $1', [label])).rowCount).toBe(0)
  await shared(admin, label, 10000, 90)
  await expect(admin.locator('.admin-row').filter({ hasText: label })).toContainText('0 / 10000')
  await admin.locator('summary').click()
  await admin.locator('summary').click()
  await expect(admin.getByLabel('Enlace compartible', { exact: true })).toHaveCount(0)
  await page.reload()
  const reopened = await adminPanel(page)
  await expect(reopened.locator('.admin-row').filter({ hasText: label })).toContainText('0 / 10000')
  await expect(reopened.getByLabel('Enlace compartible', { exact: true })).toHaveCount(0)
  await reopened.locator('.admin-row').filter({ hasText: label }).getByRole('button', { name: 'Revocar enlace compartible' }).click()
  await expect(reopened.locator('.admin-row').filter({ hasText: label })).toContainText('Revocado')
  await evidence(page, info, 'shared-boundary')
})

test('shared quota is atomic across recipients; duplicate email, expiry and revocation block without consuming', async ({ page, browser }, info) => {
  await login(page)
  const admin = await adminPanel(page)
  const label = `Quota ${randomUUID()}`
  const url = await shared(admin, label)
  const contexts = await Promise.all([1, 2].map(n => browser.newContext({ ...info.project.use, baseURL: 'http://127.0.0.1:4187', extraHTTPHeaders: { 'X-Klisteniapp-Test-Client-IP': `203.0.113.${n}` } })))
  try {
    const recipients = await Promise.all(contexts.map(c => c.newPage()))
    await Promise.all(recipients.map(p => p.goto(url)))
    await fillActivation(recipients[0], 'trial@admin.test')
    await recipients[0].getByRole('button', { name: 'Activar mi cuenta' }).click()
    await expect(recipients[0].getByRole('alert')).toContainText('Ya existe una cuenta')
    expect((await pool.query('SELECT uses FROM account_share_invitation WHERE label = $1', [label])).rows[0].uses).toBe(0)
    const addresses = [email('quota-a'), email('quota-b')]
    await Promise.all(recipients.map((p, n) => fillActivation(p, addresses[n])))
    await Promise.all(recipients.map(p => p.getByRole('button', { name: 'Activar mi cuenta' }).click()))
    await expect.poll(async () => (await pool.query('SELECT id FROM auth_user WHERE email = ANY($1)', [addresses])).rowCount).toBe(1)
    await expect.poll(async () => (await pool.query('SELECT uses FROM account_share_invitation WHERE label = $1', [label])).rows[0].uses).toBe(1)
    const saved = (await pool.query('SELECT role, "emailVerified" FROM auth_user WHERE email = ANY($1)', [addresses])).rows[0]
    expect(saved).toMatchObject({ role: 'user', emailVerified: false })
    const outcomes = await Promise.all(recipients.map(async p => ({ done: await p.getByRole('heading', { name: 'Tu cuenta está lista.' }).count(), error: await p.getByRole('alert').count() })))
    expect(outcomes.filter(o => o.done)).toHaveLength(1)
    expect(outcomes.filter(o => o.error)).toHaveLength(1)
    await admin.getByRole('button', { name: 'Actualizar', exact: true }).click()
    await expect(admin.locator('.admin-row').filter({ hasText: label })).toContainText('Agotado')
    for (const mode of ['expired', 'revoked']) {
      const label2 = `${mode} ${randomUUID()}`
      const unavailable = await shared(admin, label2)
      if (mode === 'expired') await pool.query('UPDATE account_share_invitation SET expires_at = now() WHERE label = $1', [label2])
      else await admin.locator('.admin-row').filter({ hasText: label2 }).getByRole('button', { name: 'Revocar enlace compartible' }).click()
      await recipients[0].goto(unavailable)
      await expect(recipients[0].getByRole('alert')).toContainText('ya no está disponible')
      expect((await pool.query('SELECT uses FROM account_share_invitation WHERE label = $1', [label2])).rows[0].uses).toBe(0)
    }
  } finally { await Promise.all(contexts.map(c => c.close())) }
})

test('user enable, suspend, revoke sessions and recover preserve history and account access', async ({ page, browser }, info) => {
  const address = email('managed')
  const user = await createProvisionedUser(pool, config, { email: address, name: 'Managed QA', password })
  await new StateRepository(pool).addLog(user, { kind: 'cardio', log: { id: randomUUID(), date: '2026-10-01', activity: 'walk', minutes: 19 } })
  const original = (await pool.query('SELECT * FROM account_access WHERE user_id = $1', [user.id])).rows[0]
  const memberContext = await browser.newContext({ ...info.project.use, baseURL: 'http://127.0.0.1:4187', extraHTTPHeaders: { 'X-Klisteniapp-Test-Client-IP': '203.0.113.80' } })
  await memberContext.route('**/models/*.glb', route => route.abort())
  try {
    const member = await memberContext.newPage()
    await login(member, address)
    await login(page)
    const admin = await adminPanel(page)
    const row = userRow(admin, address)
    await row.getByRole('button', { name: 'Cerrar sus sesiones' }).click()
    // A click resolves when dispatched, before the API transaction necessarily
    // commits. Check the UI acknowledgement before inspecting persisted effects.
    await expect(admin.getByRole('status')).toContainText('Sesiones revocadas.')
    expect((await pool.query('SELECT id FROM auth_session WHERE "userId" = $1', [user.id])).rowCount).toBe(0)
    await member.reload()
    await expect((await openAccountSettings(member)).getByRole('button', { name: 'Entrar a mi cuenta' })).toBeVisible()
    await login(member, address)
    await row.getByRole('button', { name: 'Crear recuperación' }).click()
    const recovery = await admin.getByLabel('Enlace personal', { exact: true }).inputValue()
    await row.getByRole('button', { name: 'Deshabilitar acceso' }).click()
    await expect(row).toContainText('Deshabilitado')
    expect((await pool.query('SELECT id FROM auth_session WHERE "userId" = $1', [user.id])).rowCount).toBe(0)
    await member.goto(recovery)
    await expect(member.getByRole('alert')).toContainText('ya no está disponible')
    await member.goto('/')
    const rejectedLogin = await openAccountSettings(member)
    await rejectedLogin.getByLabel('Email', { exact: true }).fill(address)
    await rejectedLogin.getByLabel('Contraseña', { exact: true }).fill(password)
    await rejectedLogin.getByRole('button', { name: 'Entrar a mi cuenta' }).click()
    await expect(rejectedLogin.getByRole('alert')).toBeVisible()
    await row.getByRole('button', { name: 'Habilitar acceso' }).click()
    await expect(row).toContainText('Activo')
    expect((await pool.query('SELECT id FROM auth_session WHERE "userId" = $1', [user.id])).rowCount).toBe(0)
    await login(member, address)
    await row.getByRole('button', { name: 'Crear recuperación' }).click()
    const newRecovery = await admin.getByLabel('Enlace personal', { exact: true }).inputValue()
    await member.goto(newRecovery)
    await member.getByLabel('Nueva contraseña', { exact: true }).fill(password)
    await member.getByLabel('Repetí la contraseña', { exact: true }).fill(password)
    await member.getByRole('button', { name: 'Guardar nueva contraseña' }).click()
    await expect(member.getByRole('heading', { name: 'Contraseña actualizada.' })).toBeVisible()
    expect((await pool.query('SELECT id FROM auth_session WHERE "userId" = $1', [user.id])).rowCount).toBe(0)
    await login(member, address)
    const state = await api(member, '/api/me/state')
    expect(state.body.data.progress.cardio[0].minutes).toBe(19)
    expect((await pool.query('SELECT * FROM account_access WHERE user_id = $1', [user.id])).rows[0]).toEqual(original)
    await row.scrollIntoViewIfNeeded()
    await evidence(page, info, 'managed-user')
    await member.waitForLoadState('networkidle')
  } finally { await memberContext.close() }
})

test('lifetime grant/removal respects original trial and paid deadlines and never promotes roles', async ({ page }, info) => {
  await login(page)
  const admin = await adminPanel(page)
  for (const name of ['Trial', 'Expired', 'Paid']) {
    const address = email(`access-${name}`)
    const user = await createProvisionedUser(pool, config, { email: address, name, password })
    if (name !== 'Trial') await pool.query("UPDATE account_access SET trial_ends_at = now() - interval '1 day', paid_through = $2 WHERE user_id = $1", [user.id, name === 'Paid' ? new Date(Date.now() + 86400000) : null])
    const original = (await pool.query('SELECT * FROM account_access WHERE user_id = $1', [user.id])).rows[0]
    await admin.getByRole('button', { name: 'Actualizar', exact: true }).click()
    const row = userRow(admin, address)
    await row.getByRole('button', { name: 'Otorgar acceso vitalicio' }).click()
    await expect(row).toContainText('Acceso vitalicio')
    expect((await pool.query('SELECT role FROM auth_user WHERE id = $1', [user.id])).rows[0].role).toBe('user')
    await row.getByRole('button', { name: 'Quitar acceso vitalicio' }).click()
    await expect(row).toContainText(name === 'Trial' ? 'Prueba de la nube' : name === 'Paid' ? 'Suscripción activa' : 'Guardado en la nube pausado')
    expect((await pool.query('SELECT * FROM account_access WHERE user_id = $1', [user.id])).rows[0]).toEqual(original)
  }
  await evidence(page, info, 'lifetime-access')
})

test('load errors retry; mutation errors keep drafts; two synchronous submits issue only one link', async ({ page }, info) => {
  await login(page)
  let failed = false
  await page.route('**/api/admin/users', async route => { if (!failed) { failed = true; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture unavailable' }) }) } else await route.continue() })
  const panel = await openAccountSettings(page)
  await panel.locator('.admin-accounts summary').click()
  const admin = panel.locator('.admin-accounts')
  await expect(admin.getByRole('alert')).toContainText('Fixture unavailable')
  await admin.getByRole('button', { name: 'Reintentar', exact: true }).click()
  await expect(admin.getByLabel('Email de la persona')).toBeVisible()
  const address = email('retry')
  await page.route('**/api/admin/invitations', async route => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture failed write' }) })
    else await route.continue()
  })
  await admin.getByLabel('Email de la persona').fill(address)
  await admin.getByRole('button', { name: 'Crear invitación', exact: true }).click()
  await expect(admin.getByRole('alert')).toContainText('Fixture failed write')
  await expect(admin.getByLabel('Email de la persona')).toHaveValue(address)
  expect((await pool.query('SELECT id FROM account_token WHERE email = $1', [address])).rowCount).toBe(0)
  await page.unroute('**/api/admin/invitations')
  await admin.locator('.admin-invite-form').first().evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit() })
  await expect(admin.getByLabel('Enlace personal', { exact: true })).toHaveValue(/#token=/)
  await expect(admin.getByRole('button', { name: 'Actualizar', exact: true })).toBeEnabled()
  expect((await pool.query('SELECT id FROM account_token WHERE email = $1', [address])).rowCount).toBe(1)
  await evidence(page, info, 'retry-double-submit')
})

test('lost issuance response is visible, refresh reveals committed link and reissue recovers it', async ({ page, context }, info) => {
  await login(page)
  const admin = await adminPanel(page)
  const address = email('lost')
  let dropped = false
  await page.route('**/api/admin/invitations', async route => {
    if (route.request().method() === 'POST' && !dropped) { dropped = true; await route.fetch(); await route.abort('failed') }
    else await route.continue()
  })
  await admin.getByLabel('Email de la persona').fill(address)
  await admin.getByRole('button', { name: 'Crear invitación', exact: true }).click()
  await expect(admin.getByRole('alert')).toContainText('No pudimos conectar')
  expect((await pool.query('SELECT id FROM account_token WHERE email = $1 AND revoked_at IS NULL', [address])).rowCount).toBe(1)
  await expect(admin.getByLabel('Enlace personal', { exact: true })).toHaveCount(0)
  await admin.getByRole('button', { name: 'Actualizar', exact: true }).click()
  await expect(invitationRow(admin, address)).toContainText('Pendiente')
  await invitationRow(admin, address).getByRole('button', { name: 'Reemitir enlace' }).click()
  await expect(admin.getByLabel('Enlace personal', { exact: true })).toHaveValue(/#token=/)
  const recipient = await newRecipient(context, await admin.getByLabel('Enlace personal', { exact: true }).inputValue())
  await expect(recipient.getByRole('button', { name: 'Activar mi cuenta' })).toBeVisible()
  expect((await pool.query('SELECT id FROM account_token WHERE email = $1 AND revoked_at IS NULL', [address])).rowCount).toBe(1)
  await evidence(page, info, 'lost-response-recovery')
})

test('common user denied every admin endpoint and mismatched account headers cannot act', async ({ page }) => {
  const address = email('ordinary')
  const user = await createProvisionedUser(pool, config, { email: address, name: 'Ordinary', password })
  await login(page, address)
  await expect((await openAccountSettings(page)).getByText('Usuarios e invitaciones', { exact: true })).toHaveCount(0)
  const paths: [string, string, unknown?][] = [
    ['/api/admin/users', 'GET'], ['/api/admin/invitations', 'GET'], ['/api/admin/share-invitations', 'GET'],
    ['/api/admin/invitations', 'POST', { email: email('denied'), sendEmail: false }],
    ['/api/admin/share-invitations', 'POST', { label: 'denied', maxUses: 1, expiresInDays: 1 }],
    ...['disable', 'enable', 'revoke-sessions', 'recovery', 'lifetime'].map(action => [`/api/admin/users/${user.id}/${action}`, 'POST', action === 'lifetime' ? { lifetime: true } : action === 'recovery' ? { sendEmail: false } : {}] as [string, string, unknown]),
    ['/api/admin/invitations/missing/reissue', 'POST', { sendEmail: false }], ['/api/admin/invitations/missing/revoke', 'POST', {}], ['/api/admin/share-invitations/missing/revoke', 'POST', {}],
  ]
  for (const [path, method, body] of paths) expect(await api(page, path, method, body)).toMatchObject({ status: 403, body: { code: 'ADMIN_REQUIRED' } })
  await login(page)
  expect(await api(page, `/api/admin/users/${user.id}/lifetime`, 'POST', { lifetime: true }, user.id)).toMatchObject({ status: 401, body: { code: 'ACCOUNT_CHANGED' } })
  expect((await pool.query('SELECT lifetime FROM account_access WHERE user_id = $1', [user.id])).rows[0].lifetime).toBe(false)
})

test('expired admin session and same-browser account switch remove administration and block stale writes', async ({ page, context }) => {
  await login(page)
  const admin = await adminPanel(page)
  const second = await context.newPage()
  await login(second, 'trial@admin.test')
  await admin.getByRole('button', { name: 'Actualizar', exact: true }).click()
  await expect(page.locator('.admin-accounts')).toHaveCount(0)
  await expect(await openAccountSettings(page)).toContainText('trial@admin.test')
  await login(page)
  const refreshed = await adminPanel(page)
  await pool.query('UPDATE auth_session SET "expiresAt" = now() WHERE "userId" = (SELECT id FROM auth_user WHERE email = $1)', ['admin@admin.test'])
  await refreshed.getByRole('button', { name: 'Actualizar', exact: true }).click()
  await expect(page.locator('.admin-accounts')).toHaveCount(0)
  await expect((await openAccountSettings(page)).getByRole('button', { name: 'Entrar a mi cuenta' })).toBeVisible()
})

test('admin with expired cloud retains management rights; own lifetime grant resumes cloud writes', async ({ page }) => {
  await login(page)
  const before = (await pool.query('SELECT a.* FROM account_access a JOIN auth_user u ON a.user_id = u.id WHERE u.email = $1', ['admin@admin.test'])).rows[0]
  try {
    await pool.query("UPDATE account_access SET trial_ends_at = now() - interval '1 day' WHERE user_id = $1", [before.user_id])
    const admin = await adminPanel(page)
    const row = userRow(admin, 'admin@admin.test')
    await row.getByRole('button', { name: 'Quitar acceso vitalicio' }).click()
    await expect(row).toContainText('Guardado en la nube pausado')
    await expect(page.getByRole('heading', { name: 'Guardado en la nube pausado', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guardar mi planificación', exact: true })).toBeDisabled()
    const url = await invite(admin, email('expired-admin'))
    expect(url).toContain('/account/activate#token=')
    await row.getByRole('button', { name: 'Otorgar acceso vitalicio' }).click()
    await expect(row).toContainText('Acceso vitalicio')
    expect((await api(page, '/api/me/access')).body).toMatchObject({ status: 'lifetime', cloudWrite: true })
    expect((await pool.query('SELECT role FROM auth_user WHERE id = $1', [before.user_id])).rows[0].role).toBe('admin')
  } finally {
    await pool.query('UPDATE account_access SET trial_ends_at = $2, lifetime = $3, paid_through = $4 WHERE user_id = $1', [before.user_id, before.trial_ends_at, before.lifetime, before.paid_through])
  }
})

test('closing the dialog during a delayed issuance hides its link; token-info outage can retry', async ({ page, context }) => {
  await login(page)
  const admin = await adminPanel(page)
  const address = email('cancelled')
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let issuedUrl = ''
  await page.route('**/api/admin/invitations', async route => {
    if (route.request().method() === 'POST') {
      const response = await route.fetch()
      issuedUrl = (await response.json()).url
      await gate
      await route.fulfill({ response })
    } else await route.continue()
  })
  await admin.getByLabel('Email de la persona').fill(address)
  await admin.getByRole('button', { name: 'Crear invitación', exact: true }).click()
  await expect.poll(() => issuedUrl !== '').toBe(true)
  await expect(admin.getByRole('button', { name: 'Actualizar', exact: true })).toBeDisabled()
  await page.getByRole('dialog', { name: 'Configuración' }).getByRole('button', { name: 'Cerrar', exact: true }).click()
  release()
  const reopened = await adminPanel(page)
  await expect(invitationRow(reopened, address)).toContainText('Pendiente')
  await expect(reopened.getByLabel('Enlace personal', { exact: true })).toHaveCount(0)
  const recipient = await context.newPage()
  let failed = false
  await recipient.route('**/api/account/token-info', async route => {
    if (!failed) { failed = true; await route.abort('failed') }
    else await route.continue()
  })
  await recipient.goto(issuedUrl)
  await expect(recipient.getByRole('alert')).toContainText('No pudimos verificar')
  await recipient.getByRole('button', { name: 'Reintentar verificación' }).click()
  await expect(recipient.getByLabel('Email de la invitación')).toHaveValue(address)
  await recipient.reload()
  await expect(recipient.getByRole('alert')).toContainText('incompleto')
  expect((await pool.query('SELECT id FROM auth_user WHERE email = $1', [address])).rowCount).toBe(0)
})

test('collapsing administration during issuance keeps late personal and shared links hidden', async ({ page }) => {
  await login(page)
  const admin = await adminPanel(page)
  for (const kind of ['personal', 'shared']) {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const path = kind === 'personal' ? '**/api/admin/invitations' : '**/api/admin/share-invitations'
    let committed = false
    await page.route(path, async route => {
      if (route.request().method() === 'POST') { const response = await route.fetch(); committed = true; await gate; await route.fulfill({ response }) }
      else await route.continue()
    })
    if (kind === 'personal') {
      await admin.getByLabel('Email de la persona').fill(email('folded'))
      await admin.getByRole('button', { name: 'Crear invitación', exact: true }).click()
    } else {
      await admin.getByLabel('Nombre del enlace').fill(`Folded ${randomUUID()}`)
      await admin.getByRole('button', { name: 'Crear enlace compartible', exact: true }).click()
    }
    await expect.poll(() => committed).toBe(true)
    await admin.locator('summary').click()
    release()
    await expect(admin.getByRole('button', { name: 'Actualizar', exact: true, includeHidden: true })).toBeEnabled()
    await admin.locator('summary').click()
    await expect(admin.getByLabel(kind === 'personal' ? 'Enlace personal' : 'Enlace compartible', { exact: true })).toHaveCount(0)
    await page.unroute(path)
  }
})
