import { expect, test, type Page } from '@playwright/test'
import { isDeepStrictEqual } from 'node:util'
import { createDefaultPersonalData, YogaDataSchema, type ServerState, type YogaData, type YogaLog, type YogaPractice } from '@klisteniapp/scene-schema'

// These tests exercise the actual instance bundle and browser store against an
// explicitly simulated transport. PostgreSQL coverage lives in API integration.
const owner = { id: 'yoga-browser-owner', name: 'Yoga Browser', email: 'yoga@example.test' }
const practice: YogaPractice = {
  id: 'account-practice', name: 'Mi pausa guardada', intention: 'Con atención',
  steps: [{ id: 'first-step', asanaId: 'tadasana', durationSeconds: 30, side: 'both' }],
}
const log: YogaLog = {
  id: 'account-log', date: '2026-10-07', completedAt: '2026-10-07T10:00:00Z', timeZone: 'Europe/Tirane',
  practiceSnapshot: practice, durationSeconds: 20,
  completedSteps: [{ stepId: 'first-step', asanaId: 'tadasana', durationSeconds: 20, side: 'both' }],
}

async function mockAccount(page: Page, expired = false) {
  const data = createDefaultPersonalData(owner.name, 'Europe/Tirane')
  data.settings.yoga = { practices: [structuredClone(practice)], logs: [structuredClone(log)] }
  const fixture = {
    state: { data, revision: 0 } as ServerState,
    expired,
    failWrites: false,
    writes: [] as { yoga: YogaData; expectedRevision: number }[],
    stateReads: 0,
  }
  await page.route('**/models/*.glb', route => route.abort())
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value), headers: { 'cache-control': 'no-store' } })
    if (path === '/api/auth/get-session') return json({ user: owner })
    if (route.request().headers()['x-klisteni-account'] !== owner.id) return json({ code: 'ACCOUNT_CHANGED', error: 'La cuenta cambió.' }, 401)
    if (path === '/api/me/access') return json({ status: fixture.expired ? 'expired' : 'lifetime', cloudWrite: !fixture.expired, trialEndsAt: null, paidThrough: null })
    if (path === '/api/me/state') { fixture.stateReads++; return json(fixture.state) }
    if (path === '/api/me/yoga' && route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { yoga: YogaData; expectedRevision: number }
      fixture.writes.push(structuredClone(body))
      if (fixture.failWrites) return route.abort('internetdisconnected')
      const parsed = YogaDataSchema.safeParse(body.yoga)
      if (!parsed.success) return json({ code: 'INVALID_INPUT', error: 'Datos de yoga inválidos.' }, 400)
      if (body.expectedRevision !== fixture.state.revision) return json({ code: 'REVISION_CONFLICT', error: 'Tus datos cambiaron en otro dispositivo.' }, 409)
      const current = fixture.state.data.settings.yoga!
      const removalOnly = (['practices', 'logs'] as const).every(collection => {
        const retained = new Set(body.yoga[collection].map(item => item.id))
        return isDeepStrictEqual(current[collection].filter(item => retained.has(item.id)), body.yoga[collection])
      }) && body.yoga.practices.length + body.yoga.logs.length < current.practices.length + current.logs.length
      if (fixture.expired && !removalOnly) return json({ code: 'CLOUD_ACCESS_REQUIRED', error: 'El guardado en la nube está pausado.' }, 402)
      fixture.state = { data: { ...fixture.state.data, settings: { ...fixture.state.data.settings, yoga: parsed.data } }, revision: fixture.state.revision + 1 }
      return json(fixture.state)
    }
    return json({ code: 'UNMOCKED_ROUTE', error: `Unexpected route ${path}` }, 404)
  })
  return fixture
}

async function openYoga(page: Page) {
  await page.goto('/')
  await expect(page.locator('.local-badge')).toContainText(/Sincronizado con tu cuenta|Nube pausada/)
  await page.getByRole('navigation', { name: /Navegación (principal|móvil)/ }).getByRole('button', { name: 'Yoga', exact: true }).click()
  await page.getByRole('navigation', { name: 'Secciones de yoga' }).getByRole('button', { name: 'Mis prácticas' }).click()
  await expect(page.getByRole('heading', { name: practice.name, exact: true })).toBeVisible()
}

async function expectNoLocalSpill(page: Page) {
  expect(await page.evaluate(() => ({
    personal: localStorage.getItem('klisteniapp.personal.v2'),
    pending: Object.keys(localStorage).filter(key => key.startsWith('klisteniapp.pending.')),
  }))).toEqual({ personal: null, pending: [] })
}

test('refreshed remote edits preserve the open draft and require saving a separate copy', async ({ page }) => {
  const account = await mockAccount(page)
  await openYoga(page)
  await page.getByRole('button', { name: `Editar ${practice.name}`, exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Editar práctica', exact: true })
  await editor.getByRole('textbox', { name: 'Nombre de la práctica' }).fill('Mi borrador sin perder')
  await editor.getByRole('spinbutton').first().fill('45')
  account.state.data.settings.yoga!.practices[0] = { ...structuredClone(practice), name: 'Cambio de otro dispositivo' }
  account.state.revision = 1
  const reads = account.stateReads
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect.poll(() => account.stateReads).toBeGreaterThan(reads)
  await expect(editor.getByRole('button', { name: 'Guardar práctica', exact: true })).toBeDisabled()
  await expect(editor.getByRole('textbox', { name: 'Nombre de la práctica' })).toHaveValue('Mi borrador sin perder')
  await expect(editor.getByRole('spinbutton').first()).toHaveValue('45')
  await expect(editor).toContainText('Esta práctica cambió o fue eliminada mientras la editabas.')
  expect(account.writes).toHaveLength(0)
  await editor.getByRole('button', { name: 'Guardar una copia', exact: true }).click()
  await expect(editor).not.toBeVisible()
  expect(account.writes).toHaveLength(1)
  expect(account.writes[0].expectedRevision).toBe(1)
  const saved = account.state.data.settings.yoga!.practices
  expect(saved).toHaveLength(2)
  expect(saved.find(item => item.id === practice.id)?.name).toBe('Cambio de otro dispositivo')
  const copy = saved.find(item => item.id !== practice.id)!
  expect(copy.name).toBe('Mi borrador sin perder')
  expect(copy.steps[0].durationSeconds).toBe(45)
  expect(account.state.data.settings.yoga!.logs).toEqual([log])
  await expectNoLocalSpill(page)
})

test('a revision conflict during save retains the draft and offers a copy of the updated canonical state', async ({ page }) => {
  const account = await mockAccount(page)
  await openYoga(page)
  await page.getByRole('button', { name: `Editar ${practice.name}`, exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Editar práctica', exact: true })
  await editor.getByRole('textbox', { name: 'Nombre de la práctica' }).fill('Borrador durante conflicto')
  account.state.data.settings.yoga!.practices[0].name = 'Versión remota más reciente'
  account.state.revision = 2
  await editor.getByRole('button', { name: 'Guardar práctica', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText('Tu cuenta cambió')
  await expect(editor.getByRole('textbox', { name: 'Nombre de la práctica' })).toHaveValue('Borrador durante conflicto')
  await expect(editor.getByRole('button', { name: 'Guardar práctica', exact: true })).toBeDisabled()
  await editor.getByRole('button', { name: 'Guardar una copia', exact: true }).click()
  await expect(editor).not.toBeVisible()
  expect(account.writes.map(write => write.expectedRevision)).toEqual([0, 2])
  expect(account.state.data.settings.yoga!.practices.map(item => item.name)).toEqual(['Versión remota más reciente', 'Borrador durante conflicto'])
  await expectNoLocalSpill(page)
})

test('expired accounts keep the library readable and can delete without enabling additions', async ({ page }) => {
  const account = await mockAccount(page, true)
  await openYoga(page)
  await expect(page.getByRole('button', { name: 'Crear práctica', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: `Editar ${practice.name}`, exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: `Comenzar ${practice.name}`, exact: true })).toBeDisabled()
  const remove = page.getByRole('button', { name: `Eliminar ${practice.name}`, exact: true })
  await expect(remove).toBeEnabled()
  await remove.click()
  await page.getByRole('dialog', { name: 'Eliminar práctica', exact: true }).getByRole('button', { name: 'Sí, eliminar', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(account.writes).toHaveLength(1)
  expect(account.state.data.settings.yoga).toEqual({ practices: [], logs: [log] })
  await page.getByRole('navigation', { name: 'Secciones de yoga' }).getByRole('button', { name: 'Biblioteca' }).click()
  await expect(page.locator('.yoga-asana-card')).toHaveCount(24)
  await page.locator('.yoga-asana-card').first().getByRole('button', { name: 'Explorar asana', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Fuentes y lecturas')
  await expectNoLocalSpill(page)
})

test('a remote write failure keeps the unsaved draft for retry and never falls back to browser storage', async ({ page }) => {
  const account = await mockAccount(page)
  await openYoga(page)
  await page.getByRole('button', { name: 'Crear práctica', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Crear práctica', exact: true })
  await editor.getByRole('textbox', { name: 'Nombre de la práctica' }).fill('Mi borrador remoto')
  await editor.getByRole('button', { name: 'Agregar Montaña', exact: true }).click()
  account.failWrites = true
  await editor.getByRole('button', { name: 'Guardar práctica', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText('No pudimos conectar con tu cuenta')
  await expect(editor.getByRole('textbox', { name: 'Nombre de la práctica' })).toHaveValue('Mi borrador remoto')
  expect(account.state.data.settings.yoga!.practices).toEqual([practice])
  await expectNoLocalSpill(page)
  account.failWrites = false
  await editor.getByRole('button', { name: 'Guardar práctica', exact: true }).click()
  await expect(editor).not.toBeVisible()
  expect(account.writes).toHaveLength(2)
  expect(account.writes[0].yoga).toEqual(account.writes[1].yoga)
  expect(account.state.data.settings.yoga!.practices.map(item => item.name)).toEqual([practice.name, 'Mi borrador remoto'])
  await expectNoLocalSpill(page)
})
