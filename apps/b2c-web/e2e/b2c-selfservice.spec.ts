import { expect, test, type Page } from '@playwright/test'
import type { ServerState } from '@klisteniapp/scene-schema'
import { openAccountSettings, openSettings } from './settings-helpers'

const password = 'Only-for-browser-tests-2026!'
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: /Navegación (principal|móvil)/ }).getByRole('button', { name, exact: true }).click()
async function state(page: Page): Promise<ServerState> {
  return page.evaluate(async () => {
    const session = await fetch('/api/auth/get-session').then(r => r.json())
    const response = await fetch('/api/me/state', { headers: { 'X-Klisteni-Account': session.user.id } })
    if (!response.ok) throw new Error(`State ${response.status}`)
    return response.json()
  })
}
async function login(page: Page, name: string, secret = password) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Configuración', exact: true })
  await dialog.getByLabel('Email', { exact: true }).fill(`${name.toLowerCase()}@accounts.test`)
  await dialog.getByLabel('Contraseña', { exact: true }).fill(secret)
  await dialog.getByRole('button', { name: 'Entrar a mi cuenta' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('.local-badge')).toContainText('Sincronizado con tu cuenta')
}
async function width(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
}
test.beforeEach(async ({ context }, info) => {
  await context.setExtraHTTPHeaders({ 'X-Klisteniapp-Test-Client-IP': `198.51.100.${150 + (info.line % 90)}` })
  // Scope is functional account UI; preserve textual fallbacks without 3D GPU work.
  await context.route('**/models/*.glb', route => route.abort())
})

test('real training: edit, cancel, complete, double submit and persistent exact sets', async ({ page }, info) => {
  await login(page, 'QARoutine')
  const before = await state(page)
  await page.getByRole('button', { name: 'Personalizar', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Series por ejercicio').selectOption('1')
  await dialog.getByRole('button', { name: 'Guardar mi rutina' }).click()
  await expect(dialog).not.toBeVisible()
  const settings = (await state(page)).data.settings
  const routine = settings.routines.find(r => r.id === settings.activeRoutineId)!
  expect(routine.sets).toBe(1)
  await page.getByRole('button', { name: 'Empezar mi rutina' }).click()
  const session = page.getByRole('region', { name: 'Sesión en curso', exact: true })
  await session.getByRole('button', { name: 'Salir de la sesión' }).click()
  await session.getByRole('button', { name: 'Seguir entrenando' }).click()
  for (let i = 0; i < routine.exerciseIds.length; i++) {
    if (i) await session.getByRole('button', { name: 'Omitir descanso' }).click()
    await session.getByRole('spinbutton', { name: 'Repeticiones', exact: true }).fill('7')
    await session.getByRole('button', { name: 'Registrar serie' }).click()
  }
  await width(page)
  await page.screenshot({ path: info.outputPath('training-review.png'), fullPage: true })
  await session.getByRole('button', { name: 'Guardar sesión' }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(session).not.toBeVisible()
  const saved = (await state(page)).data.progress.workouts
  expect(saved).toHaveLength(before.data.progress.workouts.length + 1)
  expect(saved[0].exercises.every(e => e.reps === 7)).toBe(true)
  await page.reload()
  await nav(page, 'Mi progreso')
  await expect(page.locator('.activity-history')).toContainText('7')
  expect((await state(page)).data.progress.workouts).toEqual(saved)
})

test('real cardio loses committed response, reloads and retries without duplicate', async ({ page }, info) => {
  await login(page, 'QALoss')
  let lost = false
  await page.route('**/api/me/logs', async route => {
    await route.fetch()
    lost = true
    await route.abort('connectionreset')
  })
  await page.getByRole('button', { name: 'Registrar actividad', exact: true }).click()
  await page.getByLabel('Duración (minutos)').fill('37')
  await page.getByRole('button', { name: 'Guardar actividad' }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(lost).toBe(true)
  await expect(page.locator('.local-badge')).toContainText('1 envíos pendientes')
  expect((await state(page)).data.progress.cardio).toHaveLength(1)
  await page.screenshot({ path: info.outputPath('response-lost.png') })
  await page.unroute('**/api/me/logs')
  await page.reload()
  await expect(page.locator('.local-badge')).toContainText('Sincronizado con tu cuenta')
  expect((await state(page)).data.progress.cardio).toHaveLength(1)
  await nav(page, 'Mi progreso')
  await expect(page.locator('.activity-history article')).toHaveCount(1)
})

test('real planning validates timezone, empty days and whitespace; named copy persists once', async ({ page }, info) => {
  await login(page, 'QAPlan')
  const before = await state(page)
  const panel = await openAccountSettings(page)
  await panel.getByLabel('Zona horaria', { exact: true }).fill('Invalid/Zone')
  await panel.getByRole('button', { name: 'Guardar mi planificación' }).click()
  await expect(panel.getByRole('status').filter({ hasText: 'Revisá el nombre' })).toBeVisible()
  expect((await state(page)).revision).toBe(before.revision)
  await panel.getByLabel('Zona horaria', { exact: true }).fill('Pacific/Kiritimati')
  await panel.getByLabel('Nombre', { exact: true }).fill('   ')
  await panel.getByRole('button', { name: 'Guardar mi planificación' }).click()
  expect((await state(page)).revision).toBe(before.revision)
  await panel.getByLabel('Nombre', { exact: true }).fill('Práctica de prueba')
  for (const day of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) await panel.getByLabel(day, { exact: true }).uncheck()
  await expect(panel.getByRole('button', { name: 'Guardar mi planificación' })).toBeDisabled()
  await panel.getByLabel('Domingo', { exact: true }).check()
  await panel.getByLabel(/Guardar una copia de la rutina/).fill('Mi domingo')
  await panel.getByRole('button', { name: 'Guardar mi planificación' }).dblclick()
  await expect(panel.getByRole('status').filter({ hasText: 'Preferencias guardadas' })).toBeVisible()
  const saved = (await state(page)).data.settings
  expect(saved.routines).toHaveLength(before.data.settings.routines.length + 1)
  expect(saved.plans.at(-1)?.weekdays).toEqual([7])
  await width(page)
  await page.screenshot({ path: info.outputPath('planning.png') })
  await page.reload()
  const restored = await openAccountSettings(page)
  await expect(restored.getByLabel('Rutina activa')).toHaveValue(saved.activeRoutineId)
  expect((await state(page)).data.settings).toEqual(saved)
})

test('real yoga saves practice, times one segment, preserves snapshot and reloads', async ({ page }, info) => {
  await login(page, 'QAYoga')
  await nav(page, 'Yoga')
  await page.getByRole('navigation', { name: 'Secciones de yoga' }).getByRole('button', { name: 'Mis prácticas' }).click()
  await page.getByRole('button', { name: 'Crear práctica', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Crear práctica', exact: true })
  await editor.getByLabel('Nombre de la práctica').fill('Pausa QA')
  await editor.getByLabel('Buscar asanas para agregar').fill('tadasana')
  await editor.getByRole('button', { name: /^Agregar / }).click()
  await editor.getByRole('spinbutton').fill('5')
  await editor.getByRole('button', { name: 'Guardar práctica', exact: true }).click()
  await expect(editor).not.toBeVisible()
  expect((await state(page)).data.settings.yoga?.practices).toHaveLength(1)
  await page.getByRole('button', { name: 'Comenzar Pausa QA', exact: true }).click()
  const session = page.getByRole('dialog', { name: 'Pausa QA', exact: true })
  await session.getByRole('button', { name: /^(Comenzar|Iniciar|Reanudar)/ }).click()
  await expect(session.getByRole('heading', { name: 'Práctica completa' })).toBeVisible({ timeout: 12_000 })
  await page.screenshot({ path: info.outputPath('yoga-review.png') })
  await session.getByRole('button', { name: 'Guardar registro', exact: true }).click()
  await expect(session).not.toBeVisible()
  const saved = (await state(page)).data.settings.yoga!
  expect(saved.logs).toHaveLength(1)
  expect(saved.logs[0].durationSeconds).toBe(5)
  await page.reload()
  expect((await state(page)).data.settings.yoga).toEqual(saved)
})

test('real session expiry hides private health and isolates the next login', async ({ page, context }, info) => {
  await login(page, 'QASession')
  await nav(page, 'Mi salud')
  await page.getByRole('navigation', { name: 'Secciones de mi salud' }).getByRole('button', { name: 'Cuerpo', exact: true }).click()
  await page.getByRole('button', { name: 'Agregar registro', exact: true }).click()
  await page.getByLabel('Peso (kg)', { exact: true }).fill('81.3')
  await page.getByRole('button', { name: 'Guardar en mi cuenta', exact: true }).click()
  expect((await state(page)).data.settings.health?.measurements).toHaveLength(1)
  await context.clearCookies()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible()
  await expect(page.getByText('81,3 kg', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('expired-session.png') })
  await login(page, 'QAIsolation')
  expect((await state(page)).data.settings.health?.measurements).toEqual([])
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain('81.3')
  const denied = await page.evaluate(async () => { const session = await fetch('/api/auth/get-session').then(r => r.json()); const headers = { 'X-Klisteni-Account': session.user.id }; return { admin: (await fetch('/api/admin/users', { headers })).status, b2b: (await fetch('/api/b2b/me', { headers })).status } })
  expect(denied.admin).toBe(403)
  expect(denied.b2b).toBe(404)
})

test('paid fixture can write, browser billing return cannot change its entitlement', async ({ page }) => {
  await login(page, 'QAActive')
  const access = () => page.evaluate(async () => {
    const session = await fetch('/api/auth/get-session').then(r => r.json())
    return fetch('/api/me/access', { headers: { 'X-Klisteni-Account': session.user.id } }).then(r => r.json())
  })
  expect((await access()).status).toBe('active')
  await page.goto('/?billing=return')
  const panel = page.getByRole('dialog', { name: 'Configuración', exact: true })
  await expect(panel.getByRole('button', { name: 'Guardar mi planificación' })).toBeEnabled()
  await expect(panel.getByText('Usuarios e invitaciones', { exact: true })).toHaveCount(0)
  expect((await access()).status).toBe('active')
})

test('real health imports preview, deduplicate, reject future records and export faithfully', async ({ page }, info) => {
  await login(page, 'QAHealth')
  await nav(page, 'Mi salud')
  await page.getByRole('navigation', { name: 'Secciones de mi salud' }).getByRole('button', { name: 'Importar', exact: true }).click()
  const file = {
    format: 'klisteniapp.health', version: 1, exportedAt: '2026-09-28T12:00:00Z', timeZone: 'Europe/Paris',
    records: { measurements: [{ id: 'qa-watch-body', date: '2026-09-28', recordedAt: '2026-09-28T09:00:00Z', source: { kind: 'samsung-health', device: 'Fictional QA Watch', externalId: 'qa-original' }, weightKg: 80, bodyFatPercent: 26 }], sleep: [], activity: [], nutrition: [], supplements: [] },
  }
  const upload = () => page.locator('.health-file input[type="file"]').setInputFiles({ name: 'qa-health.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) })
  const before = await state(page)
  await upload()
  expect((await state(page)).revision).toBe(before.revision)
  await page.getByRole('button', { name: /Confirmar importación/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Guardado en tu cuenta.' })).toBeVisible()
  const imported = await state(page)
  expect(imported.data.settings.health?.measurements).toHaveLength(1)
  await upload()
  await expect(page.locator('.health-import-counts')).toContainText('1')
  expect((await state(page)).revision).toBe(imported.revision)
  file.records.measurements[0].date = '2099-01-01'
  file.records.measurements[0].recordedAt = '2099-01-01T09:00:00Z'
  await upload()
  await expect(page.getByRole('alert').filter({ hasText: /futura/ })).toBeVisible()
  expect((await state(page)).revision).toBe(imported.revision)
  await width(page)
  await page.screenshot({ path: info.outputPath('health-import-invalid.png') })
  const panel = await openSettings(page, 'Datos')
  const download = page.waitForEvent('download')
  await panel.getByRole('button', { name: 'Exportar mi cuenta' }).click()
  const stream = await (await download).createReadStream()
  if (!stream) throw new Error('Missing export')
  let content = ''; for await (const chunk of stream) content += String(chunk)
  expect(JSON.parse(content)).toEqual(imported.data)
  await page.reload()
  expect((await state(page)).data.settings.health).toEqual(imported.data.settings.health)
})

test('real data invalid import, cancellation and privacy back-forward retain account', async ({ page }, info) => {
  await login(page, 'QAImport')
  const before = await state(page)
  const panel = await openSettings(page, 'Datos')
  await panel.locator('input[type="file"]').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') })
  await panel.getByRole('button', { name: 'Incorporar historial', exact: true }).click()
  await expect(panel).toContainText('El archivo no contiene un historial válido')
  expect((await state(page)).revision).toBe(before.revision)
  const data = structuredClone(before.data)
  data.progress.cardio.push({ id: 'cancelled-import', date: '2026-10-01', activity: 'walk', minutes: 9 })
  await panel.locator('input[type="file"]').setInputFiles({ name: 'qa-copy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
  await panel.getByRole('button', { name: 'Cancelar', exact: true }).click()
  expect((await state(page)).data).toEqual(before.data)
  await openSettings(page, 'Privacidad')
  await panel.getByRole('link', { name: /política de privacidad/i }).click()
  await expect(page).toHaveURL(/\/privacy$/)
  await width(page)
  await page.screenshot({ path: info.outputPath('privacy-mobile.png') })
  await page.goBack()
  await expect(panel).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(/\/privacy$/)
  await page.goBack()
  expect((await state(page)).data).toEqual(before.data)
})

test('real password changes revoke other sessions, preserve data and reject old password', async ({ page, browser }, info) => {
  await login(page, 'QAPassword')
  const before = await state(page)
  const other = await browser.newContext({ ...info.project.use, baseURL: 'http://127.0.0.1:4181', extraHTTPHeaders: { 'X-Klisteniapp-Test-Client-IP': '198.51.100.241' } })
  try {
    await other.route('**/models/*.glb', route => route.abort())
    const second = await other.newPage()
    await login(second, 'QAPassword')
    const panel = await openAccountSettings(page)
    await panel.getByText('Contraseña y otros dispositivos', { exact: true }).click()
    await panel.getByLabel('Contraseña actual', { exact: true }).fill('wrong-password-for-qa')
    await panel.getByLabel('Nueva contraseña', { exact: true }).fill('Changed-only-for-QA-2026!')
    await panel.getByRole('button', { name: 'Cambiar contraseña', exact: true }).click()
    await expect(panel.getByRole('status').filter({ hasText: 'No se pudo cambiar' })).toBeVisible()
    await panel.getByLabel('Contraseña actual', { exact: true }).fill(password)
    await panel.getByRole('button', { name: 'Cambiar contraseña', exact: true }).click()
    await expect(panel.getByRole('status').filter({ hasText: 'Contraseña actualizada' })).toBeVisible()
    expect((await state(page)).data).toEqual(before.data)
    await second.reload()
    await expect(second.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible()
    await second.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
    const loginPanel = second.getByRole('dialog')
    await loginPanel.getByLabel('Email', { exact: true }).fill('qapassword@accounts.test')
    await loginPanel.getByLabel('Contraseña', { exact: true }).fill(password)
    await loginPanel.getByRole('button', { name: 'Entrar a mi cuenta' }).click()
    await expect(loginPanel.getByRole('alert')).toBeVisible()
    await loginPanel.getByLabel('Contraseña', { exact: true }).fill('Changed-only-for-QA-2026!')
    await loginPanel.getByRole('button', { name: 'Entrar a mi cuenta' }).click()
    await expect(loginPanel).not.toBeVisible()
    expect((await state(second)).data).toEqual(before.data)
  } finally { await other.close() }
})

test('real yoga lost edit response retries the committed version without forcing a duplicate copy', async ({ page }, info) => {
  await login(page, 'QAYogaLoss')
  await nav(page, 'Yoga')
  await page.getByRole('navigation', { name: 'Secciones de yoga' }).getByRole('button', { name: 'Mis prácticas' }).click()
  await page.getByRole('button', { name: 'Editar Pausa QA', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Editar práctica', exact: true })
  await editor.getByLabel('Nombre de la práctica').fill('Pausa QA recuperada')
  await page.route('**/api/me/yoga', async route => { await route.fetch(); await route.abort('connectionreset') })
  await editor.getByRole('button', { name: 'Guardar práctica', exact: true }).click()
  await expect(editor.getByRole('alert')).toBeVisible()
  await page.unroute('**/api/me/yoga')
  await editor.getByRole('button', { name: 'Guardar práctica', exact: true }).click()
  await page.screenshot({ path: info.outputPath('yoga-lost-response-retry.png') })
  await expect(editor).not.toBeVisible()
  const saved = (await state(page)).data.settings.yoga!
  expect(saved.practices).toHaveLength(1)
  expect(saved.practices[0].name).toBe('Pausa QA recuperada')
  expect(saved.logs[0].practiceSnapshot.name).toBe('Pausa QA')
})

test('billing sandbox fixture: uncertain checkout, unsafe destination, refresh and explicit cancellation', async ({ page }, info) => {
  await login(page, 'QAActive')
  const access = { status: 'active', cloudWrite: true, trialEndsAt: null, paidThrough: '2026-12-31T00:00:00Z' }
  const billing = { mode: 'sandbox', plans: [{ id: 'monthly', label: 'QA mensual', amount: 100, currency: 'ARS', months: 1 }], subscription: null as null | { id: string; plan: string; status: string; checkoutUrl: null }, access }
  let attempts = 0, cancelled = 0
  await page.route('**/api/me/billing**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/checkout')) {
      attempts++
      if (attempts === 1) {
        billing.subscription = { id: 'qa-sandbox-only', plan: 'monthly', status: 'creating', checkoutUrl: null }
        return route.fulfill({ status: 409, json: { code: 'CHECKOUT_UNCONFIRMED', error: 'Checkout de prueba sin confirmar' } })
      }
      return route.fulfill({ json: { checkoutUrl: 'https://untrusted.example.test/qa' } })
    }
    if (path.endsWith('/cancel')) { cancelled++; billing.subscription!.status = 'cancelled' }
    return route.fulfill({ json: billing })
  })
  // No provider traffic or payment instruments; all billing responses are fixtures.
  await page.route('**/*mercadopago*', route => route.abort())
  const panel = await openAccountSettings(page)
  await panel.getByRole('button', { name: 'Probar plan mensual', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('sin confirmar')
  await panel.getByRole('button', { name: 'Actualizar estado de acceso' }).click()
  await panel.getByRole('button', { name: 'Recuperar checkout de prueba' }).click()
  await expect(panel.getByRole('alert')).toContainText('verificar el enlace')
  await expect(page).toHaveURL('http://127.0.0.1:4181/')
  await panel.getByRole('button', { name: 'Cancelar suscripción', exact: true }).click()
  await panel.getByRole('button', { name: 'Volver', exact: true }).click()
  expect(cancelled).toBe(0)
  await panel.getByRole('button', { name: 'Cancelar suscripción', exact: true }).click()
  await panel.getByRole('button', { name: 'Confirmar cancelación', exact: true }).dblclick()
  await expect(panel.getByRole('status').filter({ hasText: 'Suscripción cancelada' })).toBeVisible()
  expect(cancelled).toBe(1)
  expect(attempts).toBe(2)
  await page.screenshot({ path: info.outputPath('sandbox-cancelled.png') })
})
