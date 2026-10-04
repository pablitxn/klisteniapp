import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { expect, test, type Page, type Request, type Route } from '@playwright/test'
import { CONSENT_KEY, POLICY_VERSION, consentExpiry } from '../src/lib/analytics-policy.ts'

test.skip(process.env.KLISTENI_ANALYTICS_E2E !== '1', 'Requires isolated production build')
const source = readFileSync(new URL('./fixtures/umami-3.4.0-tracker.ts.txt', import.meta.url), 'utf8')
expect(createHash('sha256').update(source).digest('hex')).toBe('0684f4c6896f53695fe6c0ae1122f70f0e12e6e8a3d1ea21ad2556653525d6a7')
const tracker = stripTypeScriptTypes(source).replaceAll('__COLLECT_API_HOST__', '').replaceAll('__COLLECT_API_ENDPOINT__', '/api/send')
const siteId = '00000000-0000-4000-8000-000000000001'
async function intercept(page: Page, options: { script?: (route: Route) => Promise<void>; collector?: (route: Route) => Promise<void> } = {}) {
  const scripts: Request[] = [], posts: Request[] = []
  await page.route('**/umami/**', async route => {
    if (new URL(route.request().url()).pathname === '/umami/script.js') {
      scripts.push(route.request())
      return options.script ? options.script(route) : route.fulfill({ contentType: 'application/javascript', body: tracker })
    }
    posts.push(route.request())
    return options.collector ? options.collector(route) : route.fulfill({ contentType: 'application/json', body: '{"cache":"fixture-only"}' })
  })
  return { scripts, posts }
}
async function idle(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}
async function storedChoice(page: Page, overrides: Record<string, unknown> = {}) {
  await page.addInitScript(({ key, record }) => localStorage.setItem(key, JSON.stringify(record)), { key: CONSENT_KEY, record: { choice: 'accepted', version: POLICY_VERSION, expiresAt: consentExpiry(Date.now()), ...overrides } })
}
async function openPreferences(page: Page) { await page.getByTestId('privacy-preferences').click(); await expect(page.getByTestId('privacy-dialog')).toBeVisible() }

test('undecided and rejected visitors produce no tracker requests, including reload', async ({ page }) => {
  const capture = await intercept(page)
  await page.goto('/')
  await expect(page.getByTestId('analytics-consent-banner')).toBeVisible()
  await idle(page)
  expect(capture.scripts).toHaveLength(0)
  await page.getByTestId('analytics-reject').click()
  await page.reload()
  await expect(page.getByTestId('privacy-preferences')).toBeVisible()
  await idle(page)
  expect(capture.scripts).toHaveLength(0)
  expect(capture.posts).toHaveLength(0)
})

test('acceptance records one fixed visit and never exercise, progress, browser URL or referrer data', async ({ page }) => {
  const capture = await intercept(page)
  await page.goto('/?email=private@example.invalid#private-history', { referer: 'https://private.example.invalid/secret' })
  await page.evaluate(() => { document.title = 'Private medical notes'; localStorage.setItem('private-sentinel', 'my-private-history') })
  await page.getByTestId('analytics-accept').click()
  await expect.poll(() => capture.posts.length).toBe(1)
  for (const name of ['Ejercicios', 'Mi cuerpo', 'Mi progreso', 'Mi rutina']) await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('button', { name, exact: true }).click()
  await page.getByRole('button', { name: 'Registrar actividad', exact: true }).click()
  await page.getByLabel('Duración (minutos)').fill('23')
  await page.getByRole('button', { name: 'Guardar actividad' }).click()
  await idle(page)
  expect(capture.scripts).toHaveLength(1)
  expect(capture.posts).toHaveLength(1)
  expect(capture.posts[0].postDataJSON()).toEqual({ type: 'event', payload: { website: siteId, hostname: '127.0.0.1', url: '/', title: 'Klisteni', referrer: '' } })
  expect(capture.posts[0].headers()['referer']).toBeUndefined()
  expect(capture.posts[0].headers()['cookie']).toBeUndefined()
  await expect(page.locator('script[data-website-id]')).toHaveAttribute('data-auto-track', 'false')
  await expect(page.locator('script[data-website-id]')).toHaveAttribute('referrerpolicy', 'no-referrer')
  await page.evaluate(async () => {
    const umami = (window as Window & { umami?: { track: (payload: () => object) => Promise<unknown> } }).umami
    await umami?.track(() => ({ url: '/private', name: 'workout', data: { reps: 23 } }))
  })
  await idle(page)
  expect(capture.posts).toHaveLength(1)
})

test('withdrawal removes tracker and stays rejected after reload without losing local progress', async ({ page }) => {
  const capture = await intercept(page)
  await page.goto('/')
  await page.getByTestId('analytics-accept').click()
  await expect.poll(() => capture.posts.length).toBe(1)
  await page.evaluate(() => localStorage.setItem('klisteniapp.progress.v1', '{"version":1,"workouts":[],"cardio":[]}'))
  await openPreferences(page)
  await page.getByTestId('analytics-dialog-reject').click()
  await expect(page.getByTestId('analytics-status')).toContainText('Rechazaste')
  await expect(page.locator('script[data-website-id]')).toHaveCount(0)
  await page.reload()
  await idle(page)
  expect(capture.scripts).toHaveLength(1)
  expect(capture.posts).toHaveLength(1)
  expect(await page.evaluate(() => localStorage.getItem('klisteniapp.progress.v1'))).toBe('{"version":1,"workouts":[],"cardio":[]}')
})

test('privacy direct links and reloads remain untracked, without loading the 3D model', async ({ page }) => {
  const capture = await intercept(page)
  await storedChoice(page)
  const models: string[] = []
  page.on('request', request => { if (request.url().endsWith('.glb')) models.push(request.url()) })
  await page.goto('/privacy/')
  await expect(page.getByRole('heading', { name: 'Tu práctica, bajo tu control.' })).toBeVisible()
  await page.reload()
  await idle(page)
  expect(capture.scripts).toHaveLength(0)
  expect(capture.posts).toHaveLength(0)
  expect(models).toHaveLength(0)
  await page.getByRole('link', { name: '← Volver a Klisteni' }).click()
  await expect.poll(() => capture.posts.length).toBe(1)
})

test('privacy round trip preserves an active session and does not duplicate the visit', async ({ page }) => {
  const capture = await intercept(page)
  await page.goto('/')
  await page.getByTestId('analytics-accept').click()
  await expect.poll(() => capture.posts.length).toBe(1)
  await page.getByRole('button', { name: 'Empezar mi rutina' }).click()
  await page.getByRole('button', { name: 'Registrar serie' }).click()
  await page.getByTestId('privacy-policy').click()
  await expect(page.getByRole('heading', { name: 'Tu práctica, bajo tu control.' })).toBeVisible()
  await expect(page.locator('script[data-website-id]')).toHaveCount(0)
  await page.getByRole('link', { name: '← Volver a Klisteni' }).click()
  await expect(page.getByRole('region', { name: 'Sesión en curso', exact: true })).toContainText('Serie 2 de 2')
  await idle(page)
  expect(capture.posts).toHaveLength(1)
})

for (const signal of ['doNotTrack', 'globalPrivacyControl']) test(`${signal} overrides stored permission`, async ({ page }) => {
  await storedChoice(page)
  await page.addInitScript(name => Object.defineProperty(navigator, name, { get: () => name === 'doNotTrack' ? '1' : true }), signal)
  const capture = await intercept(page)
  await page.goto('/')
  await openPreferences(page)
  await expect(page.getByTestId('analytics-status')).toContainText('no ser rastreado')
  await idle(page)
  expect(capture.scripts).toHaveLength(0)
  expect(capture.posts).toHaveLength(0)
})

test('expired consent requires another decision', async ({ page }) => {
  await storedChoice(page, { expiresAt: Date.now() - 1 })
  const capture = await intercept(page)
  await page.goto('/')
  await expect(page.getByTestId('analytics-consent-banner')).toBeVisible()
  await idle(page)
  expect(capture.scripts).toHaveLength(0)
})

test('blocked storage fails closed while the app remains usable', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('blocked') } })
  const capture = await intercept(page)
  await page.goto('/')
  await page.getByTestId('analytics-accept').click()
  await expect(page.getByTestId('analytics-consent-banner')).toContainText('No pudimos guardar')
  await idle(page)
  expect(capture.scripts).toHaveLength(0)
  await expect(page.getByRole('button', { name: 'Empezar mi rutina' })).toBeEnabled()
})

test('another-tab rejection stops an accepted document', async ({ page }) => {
  const capture = await intercept(page)
  await page.goto('/')
  await page.getByTestId('analytics-accept').click()
  await expect.poll(() => capture.posts.length).toBe(1)
  await page.evaluate(key => {
    const record = JSON.parse(localStorage.getItem(key)!)
    localStorage.setItem(key, JSON.stringify({ ...record, choice: 'rejected' }))
    window.dispatchEvent(new StorageEvent('storage', { key }))
  }, CONSENT_KEY)
  await expect(page.locator('script[data-website-id]')).toHaveCount(0)
  await openPreferences(page)
  await expect(page.getByTestId('analytics-status')).toContainText('Rechazaste')
})

test('blocked tracker and collector errors leave the application usable', async ({ page }) => {
  const capture = await intercept(page, { collector: route => route.fulfill({ status: 503, body: 'Unavailable' }) })
  await page.goto('/')
  await page.getByTestId('analytics-accept').click()
  await expect.poll(() => capture.posts.length).toBe(1)
  await openPreferences(page)
  await expect(page.getByTestId('analytics-status')).toContainText('no está disponible')
  await expect(page.locator('script[data-website-id]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Empezar mi rutina' })).toBeEnabled()
})

test('delayed tracker after rejection cannot send a visit', async ({ page }) => {
  let release: (() => void) | undefined
  const ready = new Promise<void>(resolve => { release = resolve })
  const capture = await intercept(page, { script: async route => { await ready; await route.fulfill({ contentType: 'application/javascript', body: tracker }).catch(() => {}) } })
  await page.goto('/')
  await page.getByTestId('analytics-accept').click()
  await expect.poll(() => capture.scripts.length).toBe(1)
  await openPreferences(page)
  await page.getByTestId('analytics-dialog-reject').click()
  release!()
  await idle(page)
  expect(capture.posts).toHaveLength(0)
})

test('mobile consent uses equal choices and privacy stays within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await intercept(page)
  await page.goto('/')
  await expect(page.getByTestId('analytics-accept')).toBeVisible()
  await expect(page.getByTestId('analytics-reject')).toBeVisible()
  const sizes = await page.locator('.privacy-banner .privacy-choices button').evaluateAll(buttons => buttons.map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })))
  expect(sizes[0]).toEqual(sizes[1])
  await page.getByTestId('analytics-reject').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('privacy-preferences')).toBeFocused()
  await page.getByTestId('privacy-policy').click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
})

test('activation, shared invitations and recovery pages never load analytics, even with saved consent', async ({ page }) => {
  const capture = await intercept(page)
  await storedChoice(page)
  await page.route('**/api/account/token-info', route => route.fulfill({ status: 400, json: { error: 'Enlace vencido', code: 'INVALID_TOKEN' } }))
  await page.route('**/api/account/share-info', route => route.fulfill({ status: 400, json: { error: 'Enlace vencido', code: 'INVALID_TOKEN' } }))
  const models: string[] = []
  page.on('request', request => { if (request.url().endsWith('.glb')) models.push(request.url()) })
  for (const path of ['/account/activate', '/account/join', '/account/recover']) {
    await page.goto(`${path}#token=fake-private-link-token`)
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page.getByRole('alert')).toBeVisible()
    await idle(page)
    expect(capture.scripts).toHaveLength(0)
    expect(capture.posts).toHaveLength(0)
    expect(models).toHaveLength(0)
    await page.reload()
    await expect(page.getByRole('alert')).toContainText('incompleto')
    expect(capture.scripts).toHaveLength(0)
  }
})


test('forgot-password stays untracked with saved consent, submits privately and reloads without email or model', async ({ page }) => {
  const capture = await intercept(page)
  await storedChoice(page)
  const apiPaths: string[] = [], models: string[] = []
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/')) apiPaths.push(path)
    if (path.endsWith('.glb')) models.push(path)
  })
  await page.route('**/api/account/request-recovery', route => route.fulfill({ status: 202, json: { ok: true } }))
  await page.goto('/account/forgot-password?email=private@example.test#token=private-sentinel')
  await expect(page).toHaveURL(/\/account\/forgot-password$/)
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('')
  await page.getByLabel('Email', { exact: true }).fill('private@example.test')
  await page.getByRole('button', { name: 'Enviar enlace de recuperación', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Si ese email tiene una cuenta activa')
  await idle(page)
  expect(capture.scripts).toHaveLength(0)
  expect(capture.posts).toHaveLength(0)
  expect(models).toHaveLength(0)
  expect(apiPaths).toEqual(['/api/account/request-recovery'])
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  expect(stored).not.toContain('private@example.test')
  expect(stored).not.toContain('private-sentinel')
  await page.reload()
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('')
  await idle(page)
  expect(capture.scripts).toHaveLength(0)
  expect(capture.posts).toHaveLength(0)
  expect(models).toHaveLength(0)
  expect(apiPaths).toEqual(['/api/account/request-recovery'])
})


test('health profile and body records never enter the analytics visit payload', async ({ page }) => {
  const { createDefaultPersonalData } = await import('@klisteniapp/scene-schema')
  let state = { data: createDefaultPersonalData('Private health name'), revision: 0 }
  await page.route('**/api/auth/get-session', route => route.fulfill({ json: { user: { id: 'private-health-owner', name: 'Private health name', email: 'private-health@example.test' } } }))
  await page.route('**/api/me/state', route => route.fulfill({ json: state }))
  await page.route('**/api/me/health', route => {
    const { health } = route.request().postDataJSON()
    state = { data: { ...state.data, settings: { ...state.data.settings, health } }, revision: state.revision + 1 }
    return route.fulfill({ json: state })
  })
  const capture = await intercept(page)
  await page.goto('/')
  await expect(page.locator('.local-badge')).toContainText('Sincronizado con tu cuenta')
  await page.getByTestId('analytics-accept').click()
  await expect.poll(() => capture.posts.length).toBe(1)
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('button', { name: 'Mi salud', exact: true }).click()
  await page.getByRole('navigation', { name: 'Secciones de mi salud' }).getByRole('button', { name: 'Cuerpo', exact: true }).click()
  await page.getByRole('button', { name: 'Agregar registro', exact: true }).click()
  await page.getByLabel('Peso (kg)', { exact: true }).fill('79.4')
  await page.getByLabel('Cintura (cm)', { exact: true }).fill('93.2')
  await page.getByRole('button', { name: 'Guardar en mi cuenta', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Guardado en tu cuenta.' })).toBeVisible()
  await idle(page)
  expect(capture.posts).toHaveLength(1)
  expect(capture.posts[0].postDataJSON()).toEqual({ type: 'event', payload: { website: siteId, hostname: '127.0.0.1', url: '/', title: 'Klisteni', referrer: '' } })
})
