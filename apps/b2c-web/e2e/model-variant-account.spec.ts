import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import type { PersonalSettings, ServerState } from '@klisteniapp/scene-schema'
import { openAccountSettings, openSettings } from './settings-helpers'

async function prepare(context: BrowserContext, ip: number) {
  await context.setExtraHTTPHeaders({ 'X-Klisteniapp-Test-Client-IP': `198.51.100.${ip}` })
  // This verifies actual account/API/database persistence; source-rendered model
  // acceptance is covered separately without tying account checks to GPU speed.
  await context.route('**/models/*.glb', route => route.abort())
}

async function login(page: Page, name: 'Alice' | 'Bob') {
  await page.goto('/')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Configuración', exact: true })
  await dialog.getByLabel('Email', { exact: true }).fill(`${name.toLowerCase()}@accounts.test`)
  await dialog.getByLabel('Contraseña', { exact: true }).fill('Only-for-browser-tests-2026!')
  await dialog.getByRole('button', { name: 'Entrar a mi cuenta', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('.local-badge')).toContainText('Sincronizado con tu cuenta')
}

async function readState(page: Page): Promise<ServerState> {
  return page.evaluate(async () => {
    const session = await fetch('/api/auth/get-session', { cache: 'no-store' }).then(response => response.json())
    const response = await fetch('/api/me/state', { cache: 'no-store', headers: { 'X-Klisteni-Account': session.user.id } })
    if (!response.ok) throw new Error(`Could not read account state: ${response.status}`)
    return response.json()
  })
}

async function selectModel(page: Page, model: 'female' | 'male') {
  const dialog = await openSettings(page)
  const response = page.waitForResponse(result => result.url().endsWith('/api/me/settings') && result.request().method() === 'PUT')
  await dialog.getByRole('combobox', { name: 'Modelo corporal', exact: true }).selectOption(model)
  expect((await response).status()).toBe(200)
  await expect(dialog.getByRole('combobox', { name: 'Modelo corporal', exact: true })).toHaveValue(model)
  await expect(dialog).toContainText('Preferencias guardadas.')
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(page.locator('.anatomy-viewer')).toHaveAttribute('data-model', model)
}

async function putSettings(page: Page, settings: Omit<PersonalSettings, 'anatomicalModel'> & { anatomicalModel?: string }, expectedRevision: number) {
  return page.evaluate(async ({ settings, expectedRevision }) => {
    const session = await fetch('/api/auth/get-session', { cache: 'no-store' }).then(response => response.json())
    const response = await fetch('/api/me/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Klisteni-Account': session.user.id },
      body: JSON.stringify({ settings, expectedRevision }),
    })
    return { status: response.status, body: await response.json() }
  }, { settings, expectedRevision })
}

test('a body model persists through the real API across devices, conflicts and account boundaries', async ({ page, context, browser }) => {
  await prepare(context, 121)
  await login(page, 'Alice')
  const original = await readState(page)
  await selectModel(page, 'female')
  const selected = await readState(page)
  expect(selected.data.settings.anatomicalModel).toBe('female')
  expect(selected.data.settings.health).toEqual(original.data.settings.health)
  expect(selected.data.settings.routines).toEqual(original.data.settings.routines)
  expect(selected.data.settings.plans).toEqual(original.data.settings.plans)
  expect(selected.data.progress).toEqual(original.data.progress)
  expect(await page.evaluate(() => localStorage.getItem('klisteniapp.personal.v2'))).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('klisteniapp.display.v1') ?? '')).not.toContain('anatomicalModel')

  const secondDevice = await browser.newContext({ baseURL: 'http://127.0.0.1:4181', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  const otherAccount = await browser.newContext({ baseURL: 'http://127.0.0.1:4181', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  try {
    await prepare(secondDevice, 122)
    await prepare(otherAccount, 123)
    const second = await secondDevice.newPage()
    await login(second, 'Alice')
    const settings = await openSettings(second)
    await expect(settings.getByRole('combobox', { name: 'Modelo corporal', exact: true })).toHaveValue('female')
    await settings.getByRole('button', { name: 'Cerrar', exact: true }).click()
    await expect(second.locator('.anatomy-viewer')).toHaveAttribute('data-model', 'female')

    const bob = await otherAccount.newPage()
    await login(bob, 'Bob')
    const bobSettings = await openSettings(bob)
    await expect(bobSettings.getByRole('combobox', { name: 'Modelo corporal', exact: true })).toHaveValue('male')
    expect((await readState(bob)).data.settings.anatomicalModel).toBeUndefined()

    const invalid = await putSettings(page, { ...selected.data.settings, anatomicalModel: 'unknown' }, selected.revision)
    expect(invalid.status).toBe(400)
    expect(await readState(page)).toEqual(selected)
    const legacy = structuredClone(selected.data.settings)
    delete legacy.anatomicalModel
    const legacySave = await putSettings(page, legacy, selected.revision)
    expect(legacySave.status).toBe(200)
    expect(legacySave.body.data.settings.anatomicalModel).toBe('female')
    const staleSave = await putSettings(page, { ...original.data.settings, anatomicalModel: 'male' }, original.revision)
    expect(staleSave.status).toBe(409)
    expect((await readState(page)).data.settings.anatomicalModel).toBe('female')

    await selectModel(second, 'male')
    await page.reload()
    await expect(page.locator('.local-badge')).toContainText('Sincronizado con tu cuenta')
    await expect(page.locator('.anatomy-viewer')).toHaveAttribute('data-model', 'male')
    await selectModel(second, 'female')
    await page.reload()
    await expect(page.locator('.anatomy-viewer')).toHaveAttribute('data-model', 'female')

    const data = await openSettings(page, 'Datos')
    const download = page.waitForEvent('download')
    await data.getByRole('button', { name: 'Exportar mi cuenta', exact: true }).click()
    const stream = await (await download).createReadStream()
    if (!stream) throw new Error('Account export did not produce a file')
    let exported = ''
    for await (const chunk of stream) exported += String(chunk)
    expect(JSON.parse(exported).settings.anatomicalModel).toBe('female')
    const account = await openAccountSettings(page)
    await account.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible()
    await expect(page.locator('.anatomy-viewer')).toHaveAttribute('data-model', 'male')
    const local = await openSettings(page)
    await expect(local.getByRole('combobox', { name: 'Modelo corporal', exact: true })).toHaveValue('male')
  } finally {
    await secondDevice.close()
    await otherAccount.close()
  }
})
