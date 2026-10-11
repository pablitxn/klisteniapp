import { expect, test, type Page } from '@playwright/test'
import type { Me, Media, Website } from '../../../packages/b2b-contracts/src/index.ts'
import { equipmentGLB } from './fixtures/equipment-glb'

async function admin(page: Page) {
  await page.goto('/backoffice/')
  await page.getByLabel('Email', { exact: true }).fill('admin@atlas.example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('browser-tests-only-password-2026')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
  const me = await (await page.request.get('/api/b2b/me')).json() as Me
  return { Origin: new URL(page.url()).origin, 'X-Klisteni-B2B-Account': me.user.id }
}

test('public B2B entry keeps gym discovery and staff/member access separate without fetching an account', async ({ page }) => {
  const privateRequests: string[] = []
  page.on('request', request => { if (/\/api\/b2b\/(me|orgs)/.test(request.url())) privateRequests.push(request.url()) })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tu gimnasio. Tu práctica.' })).toBeVisible()
  await page.getByLabel('Código del gimnasio').fill('atlas-demo')
  await page.getByRole('button', { name: 'Ver gimnasio', exact: true }).click()
  await expect(page).toHaveURL(/\/g\/atlas-demo$/)
  await expect(page.getByRole('heading', { name: 'Atlas Demo', exact: true })).toBeVisible()
  expect(privateRequests).toEqual([])
})

test('admin publishes an uploaded floor plan; visitors follow unit markers with image failure fallback and private drafts', async ({ page, browser }) => {
  const headers = await admin(page)
  const endpoint = '/api/b2b/orgs/atlas-demo/website'
  const original = (await (await page.request.get(endpoint, { headers })).json() as { website: Website }).website
  const visitor = await browser.newContext()
  const publicPage = await visitor.newPage()
  try {
    await page.getByRole('button', { name: 'Website', exact: true }).click()
    await page.getByText('Plano y vista del espacio', { exact: true }).click()
    await page.getByRole('button', { name: 'Elegir imagen del plano', exact: true }).click()
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 400
      const context = canvas.getContext('2d')!; context.fillStyle = '#eaf0e3'; context.fillRect(0, 0, 640, 400)
      context.strokeStyle = '#263b35'; context.lineWidth = 8; context.strokeRect(20, 20, 600, 360)
      return canvas.toDataURL('image/png').split(',')[1]
    })
    await page.getByLabel('Archivo del gimnasio', { exact: true }).setInputFiles({ name: 'floor-plan.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
    await page.getByLabel('Nombre del archivo', { exact: true }).fill('Croquis de prueba del espacio')
    await page.getByRole('button', { name: 'Subir a la biblioteca', exact: true }).click()
    await page.getByLabel('Título del plano', { exact: true }).fill('Encontrá cada equipo')
    await page.getByLabel('Agregar equipo al plano', { exact: true }).selectOption('atlas-demo-cable-01')
    await page.getByLabel('Posición horizontal del punto 1 (%)', { exact: true }).fill('25')
    await page.getByLabel('Posición vertical del punto 1 (%)', { exact: true }).fill('40')
    await page.getByRole('button', { name: 'Guardar borrador del website', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Borrador del website guardado' })).toBeVisible()
    const draft = (await (await page.request.get(endpoint, { headers })).json() as { website: Website }).website
    expect((await publicPage.request.get(draft.draft.floorPlan!.image.url)).status()).toBe(404)
    await page.getByRole('button', { name: 'Revisar website', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Revisé los textos, horarios y fotos de esta versión.', exact: true }).check()
    await page.getByRole('button', { name: 'Publicar website', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Website publicado' })).toBeVisible()
    await publicPage.goto('/g/atlas-demo')
    const plan = publicPage.getByRole('region', { name: 'Plano del gimnasio', exact: true })
    await expect(plan.getByRole('heading', { name: 'Encontrá cada equipo', exact: true })).toBeVisible()
    const marker = plan.locator('.floor-plan-point')
    await marker.focus(); await publicPage.keyboard.press('Enter')
    await expect(publicPage).toHaveURL(/\/units\/atlas-demo-cable-01$/)
    await publicPage.route(`**${draft.draft.floorPlan!.image.url}`, route => route.abort())
    await publicPage.goto('/g/atlas-demo')
    await expect(plan.getByText('No pudimos cargar el plano. Podés consultar los equipos en la lista.', { exact: true })).toBeVisible()
    await expect(plan.locator('.floor-plan-list a')).toHaveCount(1)
    expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  } finally {
    const current = (await (await page.request.get(endpoint, { headers })).json() as { website: Website }).website
    const saved = await page.request.put(endpoint, { headers, data: { ...original.draft, expectedRevision: current.revision } })
    expect(saved.ok()).toBeTruthy()
    const restored = (await saved.json() as { website: Website }).website
    expect((await page.request.post(`${endpoint}/publish`, { headers, data: { expectedRevision: restored.revision } })).ok()).toBeTruthy()
    await visitor.close()
  }
})

test('uploaded extensionless GLB loads only on demand and remains readable after missing WebGL or loader failure', async ({ page, browser, browserName }) => {
  const headers = await admin(page)
  const endpoint = '/api/b2b/orgs/atlas-demo/website'
  const original = (await (await page.request.get(endpoint, { headers })).json() as { website: Website }).website
  const query = new URLSearchParams({ kind: 'model3d', label: 'Sector de prueba', attribution: 'Triángulo técnico de prueba, no contenido educativo' })
  const uploaded = await page.request.post(`/api/b2b/orgs/atlas-demo/media?${query}`, { headers: { ...headers, 'Content-Type': 'model/gltf-binary' }, data: equipmentGLB() })
  expect(uploaded.ok()).toBeTruthy()
  const media = (await uploaded.json() as { media: Media }).media
  const asset = { id: media.id, kind: media.kind, url: media.url, label: media.label, attribution: media.attribution }
  const saved = (await (await page.request.put(endpoint, { headers, data: { ...original.draft, spatialModel: asset, expectedRevision: original.revision } })).json() as { website: Website }).website
  expect((await page.request.post(`${endpoint}/publish`, { headers, data: { expectedRevision: saved.revision } })).ok()).toBeTruthy()
  const visitor = await browser.newContext()
  const publicPage = await visitor.newPage()
  let releaseInitialModel = () => {}
  async function openModelWithKeyboard() {
    const open = publicPage.getByRole('button', { name: 'Ver Sector de prueba en 3D', exact: true })
    await expect(open).toHaveAttribute('aria-expanded', 'false')
    await open.focus()
    await publicPage.keyboard.press('Enter')
    const close = publicPage.getByRole('button', { name: 'Cerrar vista 3D', exact: true })
    await expect(close).toBeFocused()
    await expect(close).toHaveAttribute('aria-expanded', 'true')
  }
  async function closeModelWithKeyboard() {
    await expect(publicPage.getByRole('button', { name: 'Cerrar vista 3D', exact: true })).toBeFocused()
    await publicPage.keyboard.press('Enter')
    const open = publicPage.getByRole('button', { name: 'Ver Sector de prueba en 3D', exact: true })
    await expect(open).toBeFocused()
    await expect(open).toHaveAttribute('aria-expanded', 'false')
  }
  try {
    let modelRequests = 0
    publicPage.on('request', request => { if (request.url().endsWith(media.url)) modelRequests++ })
    await publicPage.goto('/g/atlas-demo')
    await expect(publicPage.getByRole('button', { name: 'Ver Sector de prueba en 3D', exact: true })).toBeVisible()
    expect(modelRequests).toBe(0)
    if (browserName === 'chromium') {
      const initialModel = new Promise<void>(resolve => { releaseInitialModel = resolve })
      await publicPage.route(`**${media.url}`, async route => { await initialModel; await route.continue() })
      await openModelWithKeyboard()
      await expect.poll(() => modelRequests).toBeGreaterThan(0)
      await expect(publicPage.getByRole('group', { name: 'Modelo 3D de Sector de prueba', exact: true })).toHaveAttribute('aria-busy', 'true')
      await expect(publicPage.getByText('Cargando modelo del equipo…', { exact: true })).toBeVisible()
      releaseInitialModel()
      await expect(publicPage.getByRole('group', { name: 'Modelo 3D de Sector de prueba', exact: true })).toHaveAttribute('aria-busy', 'false')
      await expect(publicPage.getByText('Cargando modelo del equipo…', { exact: true })).toHaveCount(0)
      await test.info().attach('loaded-equipment-model', { body: await publicPage.getByRole('group', { name: 'Modelo 3D de Sector de prueba', exact: true }).screenshot(), contentType: 'image/png' })
      await publicPage.unroute(`**${media.url}`)
      await closeModelWithKeyboard()
      await publicPage.reload()
      await publicPage.route(`**${media.url}`, route => route.fulfill({ status: 503, body: 'Unavailable' }))
      await openModelWithKeyboard()
      await expect(publicPage.getByText(/Vista 3D no disponible para Sector de prueba/)).toBeVisible()
      await closeModelWithKeyboard()
      await publicPage.unroute(`**${media.url}`)
      await openModelWithKeyboard()
      await expect(publicPage.getByRole('group', { name: 'Modelo 3D de Sector de prueba', exact: true })).toHaveAttribute('aria-busy', 'false')
      await closeModelWithKeyboard()
    }
    await publicPage.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        return /^webgl|experimental-webgl/.test(type) ? null : Reflect.apply(original, this, [type, ...args])
      } as typeof original
    })
    await publicPage.reload()
    await openModelWithKeyboard()
    await expect(publicPage.getByText(/Vista 3D no disponible para Sector de prueba/)).toBeVisible()
    await expect(publicPage.getByRole('heading', { name: 'Equipos que acompañan tu práctica', exact: true })).toBeVisible()
    await closeModelWithKeyboard()
  } finally {
    releaseInitialModel()
    const current = (await (await page.request.get(endpoint, { headers })).json() as { website: Website }).website
    const restored = (await (await page.request.put(endpoint, { headers, data: { ...original.draft, expectedRevision: current.revision } })).json() as { website: Website }).website
    expect((await page.request.post(`${endpoint}/publish`, { headers, data: { expectedRevision: restored.revision } })).ok()).toBeTruthy()
    await visitor.close()
  }
})
