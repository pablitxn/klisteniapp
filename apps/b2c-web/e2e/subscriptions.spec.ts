import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import type { ServerState } from '@klisteniapp/scene-schema'
import { openAccountSettings } from './settings-helpers'

const password = 'Only-for-browser-tests-2026!'
const progressKey = 'klisteniapp.progress.v1'

async function prepare(context: BrowserContext, ip: number) {
  await context.setExtraHTTPHeaders({ 'X-Klisteniapp-Test-Client-IP': `198.51.100.${ip}` })
  await context.route('**/models/*.glb', route => route.abort())
}
async function login(page: Page, email: string) {
  const dialog = await openAccountSettings(page)
  await dialog.getByLabel('Email', { exact: true }).fill(email)
  await dialog.getByLabel('Contraseña', { exact: true }).fill(password)
  await dialog.getByRole('button', { name: 'Entrar a mi cuenta' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('.account-login')).toHaveCount(0)
}
async function accountPanel(page: Page) {
  await expect(page.locator('.account-status')).toHaveCount(0)
  return openAccountSettings(page)
}
async function readState(page: Page): Promise<ServerState> {
  return page.evaluate(async () => {
    const session = await fetch('/api/auth/get-session', { cache: 'no-store' }).then(response => response.json())
    const response = await fetch('/api/me/state', { cache: 'no-store', headers: { 'X-Klisteni-Account': session.user.id } })
    if (!response.ok) throw new Error(`Could not read state: ${response.status}`)
    return response.json()
  })
}
async function readAccess(page: Page) {
  return page.evaluate(async () => {
    const session = await fetch('/api/auth/get-session').then(response => response.json())
    return fetch('/api/me/access', { headers: { 'X-Klisteni-Account': session.user.id } }).then(response => response.json())
  })
}
async function activate(page: Page, name: string, email?: string) {
  await page.getByLabel('Tu nombre', { exact: true }).fill(name)
  if (email) await page.getByLabel('Tu email', { exact: true }).fill(email)
  await page.getByLabel('Elegí una contraseña', { exact: true }).fill(password)
  await page.getByLabel('Repetí la contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Activar mi cuenta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tu cuenta está lista.' })).toBeVisible()
  await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Configuración', exact: true })).toBeVisible()
}

test('a public campaign creates a real trial; its limit and independent lifetime grant are visible', async ({ page, context, browser }, testInfo) => {
  await prepare(context, 101)
  await page.goto('/')
  await login(page, 'admin@accounts.test')
  const panel = await accountPanel(page)
  await panel.getByText('Usuarios e invitaciones', { exact: true }).click()
  await panel.getByLabel('Nombre del enlace', { exact: true }).fill('Comunidad de prueba')
  await panel.getByLabel('Cantidad máxima de personas').fill('1')
  await panel.getByLabel('Vigencia del enlace (días)').fill('7')
  await panel.getByRole('button', { name: 'Crear enlace compartible', exact: true }).click()
  await expect(panel.getByLabel('Enlace compartible', { exact: true })).toHaveValue(/\/account\/join#token=/)
  const url = await panel.getByLabel('Enlace compartible', { exact: true }).inputValue()
  const token = new URL(url).hash.slice('#token='.length)
  const memberContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4181', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await prepare(memberContext, 102)
  try {
    const member = await memberContext.newPage()
    await member.goto(url)
    await expect(member).toHaveURL(/\/account\/join$/)
    await expect(member.locator('.billing-notice')).toContainText('15 días gratis')
    await expect(member.locator('.billing-notice')).toContainText('Comunidad de prueba')
    expect(await member.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391)
    await member.screenshot({ path: testInfo.outputPath('public-invitation-mobile.png') })
    await activate(member, 'Persona de la comunidad', 'community@accounts.test')
    await login(member, 'community@accounts.test')
    const access = await readAccess(member)
    expect(access.status).toBe('trial')
    expect(access.cloudWrite).toBe(true)
    expect(Date.parse(access.trialEndsAt) - Date.now()).toBeGreaterThan(14 * 86400000)
    expect(await member.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).not.toContain(token)
    const memberPanel = await accountPanel(member)
    await expect(memberPanel.getByRole('region', { name: 'Acceso y suscripción' })).toContainText('15 días restantes')
    await expect(memberPanel.getByText('Usuarios e invitaciones', { exact: true })).toHaveCount(0)
    await expect(memberPanel).toContainText('Los planes mensual y anual en ARS están en preparación')
    await expect(memberPanel.getByRole('button', { name: /Probar plan/ })).toHaveCount(0)
    await panel.getByRole('button', { name: 'Actualizar', exact: true }).click()
    const campaign = panel.locator('.admin-row').filter({ hasText: 'Comunidad de prueba' })
    await expect(campaign).toContainText('1 / 1 personas')
    await expect(campaign).toContainText('Agotado')
    const person = panel.locator('.admin-row').filter({ hasText: 'community@accounts.test' })
    await person.getByRole('button', { name: 'Otorgar acceso vitalicio', exact: true }).click()
    await expect(person).toContainText('Acceso vitalicio')
    await member.reload()
    expect((await readAccess(member)).status).toBe('lifetime')
    const lifetimePanel = await accountPanel(member)
    await expect(lifetimePanel.getByRole('region', { name: 'Acceso y suscripción' })).toContainText('No necesitás una suscripción')
    await expect(lifetimePanel.getByText('Usuarios e invitaciones', { exact: true })).toHaveCount(0)
    await person.getByRole('button', { name: 'Quitar acceso vitalicio', exact: true }).click()
    await expect.poll(async () => (await readAccess(member)).status).toBe('trial')
    const exhausted = await memberContext.newPage()
    await exhausted.goto(url)
    await expect(exhausted.getByRole('alert')).toContainText('ya no está disponible')
    await expect(exhausted.getByRole('button', { name: 'Activar mi cuenta', exact: true })).toHaveCount(0)
  } finally { await memberContext.close() }
})

test('a named lifetime invitation activates without requiring a subscription', async ({ page, context, browser }) => {
  await prepare(context, 111)
  await page.goto('/')
  await login(page, 'admin@accounts.test')
  const panel = await accountPanel(page)
  await panel.getByText('Usuarios e invitaciones', { exact: true }).click()
  await panel.getByLabel('Email de la persona').fill('forever@accounts.test')
  await panel.getByRole('combobox', { name: 'Acceso a la nube', exact: true }).selectOption('lifetime')
  await panel.getByRole('button', { name: 'Crear invitación', exact: true }).click()
  await expect(panel.getByLabel('Enlace personal', { exact: true })).toHaveValue(/\/account\/activate#token=/)
  const url = await panel.getByLabel('Enlace personal', { exact: true }).inputValue()
  const memberContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4181', reducedMotion: 'reduce' })
  await prepare(memberContext, 112)
  try {
    const member = await memberContext.newPage()
    await member.goto(url)
    await expect(member.locator('.billing-notice')).toContainText('acceso vitalicio a la nube, sin suscripción')
    await expect(member.getByLabel('Email de la invitación')).toHaveValue('forever@accounts.test')
    await activate(member, 'Amiga vitalicia')
    await login(member, 'forever@accounts.test')
    expect((await readAccess(member)).status).toBe('lifetime')
    await member.reload()
    const memberPanel = await accountPanel(member)
    await expect(memberPanel.getByRole('region', { name: 'Acceso y suscripción' })).toContainText('Acceso vitalicio')
    await expect(memberPanel.getByRole('region', { name: 'Acceso y suscripción' })).toContainText('independiente de los permisos de administrador')
    await expect(memberPanel.getByRole('button', { name: /Probar plan|checkout/ })).toHaveCount(0)
  } finally { await memberContext.close() }
})

test('expired cloud access preserves history and export; free local activity still works', async ({ page, context }, testInfo) => {
  await prepare(context, 121)
  const local = { version: 1, workouts: [], cardio: [{ id: 'subscription-local-walk', date: '2026-10-01', activity: 'walk', minutes: 7 }] }
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: progressKey, data: local })
  await page.goto('/')
  await login(page, 'expired@accounts.test')
  await expect(page.locator('.local-badge')).toContainText('Nube pausada')
  const saved = await readState(page)
  expect(saved.data.progress.cardio).toEqual([expect.objectContaining({ id: 'expired-cloud-history', minutes: 26 })])
  const panel = await accountPanel(page)
  await expect(panel.getByRole('heading', { name: 'Guardado en la nube pausado', exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Guardar mi planificación', exact: true })).toBeDisabled()
  await expect(panel.getByRole('button', { name: 'Incorporar mis datos locales', exact: true })).toBeDisabled()
  await expect(panel).toContainText('Los planes mensual y anual en ARS están en preparación')
  await expect(panel.getByRole('button', { name: /Probar plan|checkout/ })).toHaveCount(0)
  const downloadPromise = page.waitForEvent('download')
  await panel.getByRole('button', { name: 'Descargar mis datos', exact: true }).click()
  const stream = await (await downloadPromise).createReadStream()
  if (!stream) throw new Error('Export did not produce a file')
  let exported = ''
  for await (const chunk of stream) exported += String(chunk)
  expect(JSON.parse(exported)).toEqual(saved.data)
  const denied = await page.evaluate(async data => {
    const session = await fetch('/api/auth/get-session').then(response => response.json())
    const response = await fetch('/api/me/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Klisteni-Account': session.user.id }, body: JSON.stringify({ expectedRevision: data.revision, settings: data.data.settings }) })
    return { status: response.status, body: await response.json() }
  }, saved)
  expect(denied).toMatchObject({ status: 402, body: { code: 'CLOUD_ACCESS_REQUIRED' } })
  expect(await readState(page)).toEqual(saved)
  await page.setViewportSize({ width: 390, height: 844 })
  await panel.evaluate(element => { element.scrollTop = 0 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391)
  await page.screenshot({ path: testInfo.outputPath('expired-account-mobile.png') })
  await panel.getByRole('button', { name: 'Cerrar sesión y seguir gratis en modo local', exact: true }).click()
  await expect(page.locator('.account-status')).toHaveCount(0)
  await expect(page.locator('.local-badge')).toContainText('Guardado en este dispositivo')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('navigation', { name: /Navegación (principal|móvil)/ }).getByRole('button', { name: 'Mi progreso', exact: true }).click()
  await expect(page.locator('.activity-history')).toContainText('7 min')
  await expect(page.locator('.activity-history')).not.toContainText('26 min')
  const cloudWrites: string[] = []
  page.on('request', request => { if (request.method() !== 'GET' && request.url().includes('/api/me/')) cloudWrites.push(request.url()) })
  await page.getByRole('button', { name: 'Agregar actividad', exact: true }).click()
  const activity = page.getByRole('dialog')
  await activity.getByLabel('Duración (minutos)').fill('13')
  await activity.getByRole('button', { name: 'Guardar actividad', exact: true }).click()
  await expect(activity).not.toBeVisible()
  await expect(page.locator('.activity-history')).toContainText('13 min')
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).cardio.map((entry: { minutes: number }) => entry.minutes).sort(), progressKey)).toEqual([13, 7])
  expect(cloudWrites).toEqual([])
})
