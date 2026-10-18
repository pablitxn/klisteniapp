import { test as base, expect, type Page, type Request } from '@playwright/test'

type Phase = { phase: string; observedAt: number; url?: string; [key: string]: unknown }
type ApiEvent = { path: string; branch: string; role: string; unmodeled?: boolean }
const admin = JSON.stringify(['branch-a', 'admin'])
const coach = JSON.stringify(['branch-b', 'coach'])
const planningTitle = 'Rutinas y programas por objetivo'
const peopleTitle = 'Personas del gimnasio'

const test = base.extend<{ phases: Phase[] }>({
  phases: async ({ page }, use, testInfo) => {
    const phases: Phase[] = []
    const record = (request: Request, phase: string) => {
      if (/\/assets\/.*\.js|\/api\/b2b\//.test(request.url()))
        phases.push({ phase, observedAt: Date.now(), url: request.url(), timing: request.timing(), failure: request.failure() })
    }
    page.on('request', (request) => record(request, 'browser-request'))
    page.on('response', (response) => {
      phases.push({ phase: 'browser-response-headers', observedAt: Date.now(), url: response.url(), status: response.status() })
    })
    page.on('requestfinished', (request) => record(request, 'browser-body-finished'))
    page.on('requestfailed', (request) => record(request, 'browser-request-failed'))
    await use(phases)
    const api = await page.request.get('/__fixture/events')
    const serverEvents = await api.json() as ApiEvent[]
    await testInfo.attach('synthetic-request-phases', {
      body: JSON.stringify({ kind: 'built-app-synthetic-api', browserEventClock: 'test-runner epoch milliseconds; request.timing contains browser network timing', phases, serverEvents }, null, 2),
      contentType: 'application/json',
    })
    expect(serverEvents.filter((event) => event.unmodeled), 'Every API read must have an explicit synthetic contract').toEqual([])
  },
})

async function start(page: Page, scenario: { inactive?: boolean; consentDenied?: boolean } = {}, role = 'admin', view = 'planning') {
  await page.request.post('/__fixture/scenario', { data: scenario })
  await page.addInitScript(({ role }) => {
    sessionStorage.setItem('klisteni.b2b.product-context.synthetic-loading.fixture-user', JSON.stringify({
      organizationId: 'org-fixture', branchId: role === 'coach' ? 'branch-b' : 'branch-a', role,
    }))
  }, { role })
  await page.goto(`/manage?view=${view}`, { waitUntil: 'domcontentloaded' })
  expect(
    await page.evaluate(() => ({ online: navigator.onLine, visibility: document.visibilityState })),
    'The fixture browser must be online and visible for the real workspace admission guard',
  ).toEqual({ online: true, visibility: 'visible' })
  await page.getByLabel('Email', { exact: true }).fill('loading@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('synthetic-password')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
}

async function shell(page: Page) {
  await expect(page.getByRole('combobox', { name: 'Organización', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Organización', exact: true })).toHaveValue('org-fixture')
  await expect(page.getByRole('combobox', { name: 'Sede y función', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Secciones del gimnasio' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
}

function mark(phases: Phase[], phase: string) {
  phases.push({ phase, observedAt: Date.now() })
}

async function chunkGate(page: Page, name: string, phases: Phase[]) {
  const metadata = await page.request.get('/__fixture/chunks')
  expect(metadata.ok(), 'Production chunk inventory must be available').toBe(true)
  const inventory = await metadata.json() as { kind: string; files: string[] }
  expect(inventory.kind).toBe('production-build-assets')
  const emitted = inventory.files.filter((file) => file.startsWith(`${name}-`) && file.endsWith('.js'))
  expect(emitted.length, `The served production build must emit a ${name} chunk before arming its gate`).toBeGreaterThan(0)
  phases.push({ phase: 'production-chunk-present', observedAt: Date.now(), name, files: emitted })
  const pattern = new RegExp(`/assets/${name}-[^/]+\\.js(?:\\?.*)?$`)
  const requests: string[] = []
  let release!: () => void
  let reject = false
  const held = new Promise<void>((resolve) => { release = resolve })
  page.once('close', release)
  await page.route(pattern, async (route) => {
    requests.push(route.request().url())
    phases.push({ phase: 'chunk-held', observedAt: Date.now(), url: route.request().url() })
    await held
    if (page.isClosed()) return
    if (reject) await route.abort('failed')
    else await route.continue()
  })
  return {
    requests,
    async requested() { await expect.poll(() => requests.length, `Production ${name} chunk requested`).toBeGreaterThan(0) },
    release() { mark(phases, 'chunk-released'); release() },
    fail() { reject = true; mark(phases, 'chunk-rejected'); release() },
    async evaluated() {
      expect(requests.length).toBeGreaterThan(0)
      // Await the same browser module registry promise. This establishes actual
      // import evaluation after body completion without a guessed settling delay.
      await page.evaluate(async (url) => { await import(/* @vite-ignore */ url) }, requests[0])
      mark(phases, 'chunk-module-evaluated')
    },
  }
}

async function apiEvents(page: Page): Promise<ApiEvent[]> {
  return (await page.request.get('/__fixture/events')).json()
}

async function noHealthReads(page: Page) {
  expect((await apiEvents(page)).filter((event) => /\/health(?:\/|$)/.test(event.path))).toEqual([])
}

test('an unrelated production chunk cannot hold the authorized shell or initial feature', async ({ page, phases }) => {
  const unrelated = await chunkGate(page, 'ProductReportsPage', phases)
  await start(page)
  await shell(page)
  mark(phases, 'authorized-shell-visible')
  await expect(page.getByRole('heading', { name: planningTitle, exact: true })).toBeVisible()
  mark(phases, 'initial-feature-ready')
  expect(unrelated.requests, 'History reports must stay outside the initial workspace dependency graph').toEqual([])
  unrelated.release()
})

test('a delayed selected chunk leaves navigation usable and loads when explicitly released', async ({ page, phases }) => {
  const planning = await chunkGate(page, 'ProgrammingPage', phases)
  await start(page)
  await planning.requested()
  await shell(page)
  await expect(page.getByRole('status').filter({ hasText: /^Cargando programación…$/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: planningTitle, exact: true })).toHaveCount(0)
  mark(phases, 'selected-feature-local-loading')
  await page.getByRole('link', { name: 'Personas', exact: true }).click()
  await expect(page.getByRole('heading', { name: peopleTitle, exact: true })).toBeVisible()
  await expect(page.getByText('SYNTHETIC NORTH ADMIN DATA', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Programación', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: /^Cargando programación…$/ })).toBeVisible()
  planning.release()
  await expect(page.getByRole('heading', { name: planningTitle, exact: true })).toBeVisible()
  mark(phases, 'released-feature-ready')
  await shell(page)
})

test('a rejected selected chunk reports a scoped error and another section still works', async ({ page, phases }) => {
  const planning = await chunkGate(page, 'ProgrammingPage', phases)
  await start(page)
  await planning.requested()
  await shell(page)
  planning.fail()
  await expect(page.getByRole('alert')).toContainText('No pudimos mostrar programación.')
  await expect(page.getByRole('alert')).toContainText('Podés elegir otra sección desde la navegación.')
  await expect(page.getByRole('heading', { name: planningTitle, exact: true })).toHaveCount(0)
  await shell(page)
  await page.getByRole('link', { name: 'Personas', exact: true }).click()
  await expect(page.getByRole('heading', { name: peopleTitle, exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect((await apiEvents(page)).filter((event) => event.path.endsWith('/auth/sign-in/email'))).toHaveLength(1)
  mark(phases, 'shell-recovered-by-navigation')
})

test('a branch and role change while planning is delayed cannot fetch or reveal old privileged data', async ({ page, phases }) => {
  const planning = await chunkGate(page, 'ProgrammingPage', phases)
  await start(page)
  await planning.requested()
  await shell(page)
  await page.getByRole('combobox', { name: 'Sede y función', exact: true }).selectOption(coach)
  await expect(page.getByRole('combobox', { name: 'Sede y función', exact: true })).toHaveValue(coach)
  await expect.poll(async () => (await apiEvents(page)).some((event) => event.path.endsWith('/access') && event.branch === 'branch-b' && event.role === 'coach')).toBe(true)
  mark(phases, 'new-branch-role-access-request-observed')
  planning.release()
  await expect(page.getByRole('alert')).toContainText('No tenés permiso para editar programación en esta sede.')
  await expect(page.getByRole('heading', { name: planningTitle, exact: true })).toHaveCount(0)
  await expect(page.getByText('SYNTHETIC NORTH ADMIN DATA', { exact: true })).toHaveCount(0)
  expect((await apiEvents(page)).filter((event) => /\/(routines|people|catalog\/exercises|routine-publications)$/.test(event.path))).toEqual([])
  await shell(page)
  await noHealthReads(page)
})

test('revoking consent during a delayed shared-health import cannot mount or fetch the old projection', async ({ page, phases }) => {
  const health = await chunkGate(page, 'TrainerHealthView', phases)
  await start(page, {}, 'coach', 'shared-health')
  await shell(page)
  await page.getByRole('combobox', { name: 'Persona', exact: true }).selectOption('synthetic-member')
  await health.requested()
  await expect(page.getByRole('status').filter({ hasText: /^Cargando la salud compartida…$/ })).toBeVisible()
  await page.request.post('/__fixture/revoke-consent')
  await expect(page.getByRole('status').filter({ hasText: 'El acceso o consentimiento cambió. Los datos compartidos están ocultos.' })).toBeVisible()
  mark(phases, 'consent-revoked-before-import-release')
  health.release()
  await health.evaluated()
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
  mark(phases, 'post-import-render-frames-completed')
  await expect(page.getByRole('status').filter({ hasText: 'El acceso o consentimiento cambió. Los datos compartidos están ocultos.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Salud compartida: Synthetic Consent Subject', exact: true })).toHaveCount(0)
  await noHealthReads(page)
  await page.getByRole('combobox', { name: 'Sede y función', exact: true }).selectOption(admin)
  await expect(page.getByRole('status').filter({ hasText: 'Elegí una sección autorizada.' })).toBeVisible()
  await shell(page)
  await noHealthReads(page)
})

test('consent denial prevents importing or reading shared health', async ({ page, phases }) => {
  const health = await chunkGate(page, 'TrainerHealthView', phases)
  await start(page, { consentDenied: true }, 'coach', 'shared-health')
  await shell(page)
  await page.getByRole('combobox', { name: 'Persona', exact: true }).selectOption('synthetic-member')
  await expect(page.getByRole('status').filter({ hasText: 'El acceso o consentimiento cambió. Los datos compartidos están ocultos.' })).toBeVisible()
  expect(health.requests).toEqual([])
  await noHealthReads(page)
  health.release()
})

test('inactive membership remains export-only even when a health route is requested', async ({ page, phases }) => {
  const health = await chunkGate(page, 'HealthSettings', phases)
  await start(page, { inactive: true }, 'admin', 'health')
  await expect(page.getByRole('combobox', { name: 'Organización', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tu membresía está inactiva', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Descargar mis registros', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Secciones del gimnasio' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Sede y función', exact: true })).toHaveCount(0)
  expect(health.requests).toEqual([])
  await noHealthReads(page)
  health.release()
})
