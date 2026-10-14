import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test'
import type { Execution, Me, Program } from '../../../packages/b2b-contracts/src/index.ts'

const password = 'browser-tests-only-password-2026'
const atlas = 'https://atlas.b2b.test'
const sur = 'https://sur.b2b.test'
const center = 'atlas-demo-principal'
const north = 'atlas-demo-norte'
const pageErrors = new WeakMap<Page, string[]>()
const browserDiagnostics = new WeakMap<Page, Array<{ name: string; message: string }>>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  const diagnostics: Array<{ name: string; message: string }> = []
  pageErrors.set(page, errors)
  browserDiagnostics.set(page, diagnostics)
  page.on('pageerror', (error) => diagnostics.push({ name: error.name, message: error.message }))
  // WebKit also emits Inspector network cancellation diagnostics as pageerror.
  // Measure actual uncaught script errors/rejections at their browser boundary,
  // retaining every Inspector diagnostic separately for review.
  await page.exposeFunction('__memberQaFault', (fault: { kind: string; message: string }) => {
    errors.push(`${fault.kind}: ${fault.message}`)
  })
  await page.addInitScript(() => {
    const report = (kind: string, message: string) => {
      const binding = (
        window as unknown as {
          __memberQaFault: (fault: { kind: string; message: string }) => Promise<void>
        }
      ).__memberQaFault
      void binding({ kind, message }).catch(() => undefined)
    }
    window.addEventListener('error', (event) => {
      if (event instanceof ErrorEvent) report('error', event.message)
    })
    window.addEventListener('unhandledrejection', (event) => {
      report('unhandledrejection', String(event.reason))
    })
  })
})

async function api<T>(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return page.evaluate(
    async ({ path, method, body, headers }) => {
      const response = await fetch(path, {
        method,
        headers: { 'content-type': 'application/json', ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      return { status: response.status, body: await response.json() }
    },
    { path, method, body, headers },
  ) as Promise<{ status: number; body: T }>
}
async function identity(page: Page) {
  const result = await api<Me>(page, '/api/b2b/me')
  expect(result.status).toBe(200)
  return result.body
}
const scope = (user: string, branch = center, role = 'admin') => ({
  'x-klisteni-b2b-account': user,
  'x-klisteni-b2b-branch': branch,
  'x-klisteni-b2b-role': role,
})
async function login(
  page: Page,
  email = 'member@atlas.example.test',
  origin = atlas,
  path = '/app',
) {
  await page.goto(`${origin}${path}`)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await submitLogin(page)
}
async function submitLogin(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const [response] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith('/auth/sign-in/email') && response.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click(),
    ])
    if (response.status() !== 429) {
      expect(response.status()).toBe(200)
      break
    }
    // Keep the product's real per-origin throttle; no test flag disables it.
    await page.waitForTimeout(
      Math.min(59, Math.max(1, Number(response.headers()['retry-after']) || 60)) * 1000,
    )
  }
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
}
function routine(page: Page, name = 'Inicio · fuerza y técnica') {
  return page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
}
async function start(page: Page, name?: string) {
  await routine(page, name).getByRole('button', { name: 'Empezar sesión', exact: true }).click()
  await expect(page.getByLabel('Notas de la sesión', { exact: true })).toBeVisible()
}
async function evidence(page: Page, info: TestInfo, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true })
  await page.screenshot({ path: info.outputPath(`${name}-viewport.png`) })
}
async function adminFixture(browser: Browser, info: TestInfo) {
  const use = info.project.use
  const context = await browser.newContext({
    proxy: use.proxy,
    ignoreHTTPSErrors: use.ignoreHTTPSErrors,
    viewport: use.viewport,
    hasTouch: use.hasTouch,
    isMobile: use.isMobile,
  })
  const page = await context.newPage()
  await login(page, 'admin@atlas.example.test', atlas, '/manage')
  const me = await identity(page)
  return { context, page, headers: scope(me.user.id) }
}
async function invite(
  admin: Awaited<ReturnType<typeof adminFixture>>,
  branch = center,
  email = `qa-${crypto.randomUUID()}@example.test`,
) {
  const result = await api<{ url: string }>(
    admin.page,
    '/api/b2b/orgs/atlas-demo/invitations',
    'POST',
    { email, name: 'Socio QA ficticio', role: 'member' },
    { ...admin.headers, 'x-klisteni-b2b-branch': branch },
  )
  expect(result.status).toBe(201)
  return { url: result.body.url, email }
}
async function activate(page: Page, url: string) {
  await page.goto(url)
  await page.getByLabel('Tu nombre', { exact: true }).fill('Socio QA ficticio')
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Activar mi cuenta', exact: true }).click()
  await expect(page.getByText('Tu cuenta está lista.', { exact: false })).toBeVisible()
  expect(new URL(page.url()).hash).toBe('')
}
async function assign(
  admin: Awaited<ReturnType<typeof adminFixture>>,
  userId: string,
  branch = center,
  timed = false,
) {
  const headers = { ...admin.headers, 'x-klisteni-b2b-branch': branch }
  const name = `QA ${timed ? 'tiempo' : 'series'} ${crypto.randomUUID().slice(0, 8)}`
  const created = await api<{ program: Program }>(
    admin.page,
    '/api/b2b/orgs/atlas-demo/programs',
    'POST',
    {
      name,
      description: 'Fixture sintético de revisión de socio.',
      steps: [
        {
          id: 'qa-step',
          exerciseId: 'squat',
          sets: 2,
          reps: timed ? null : 10,
          durationSeconds: timed ? 45 : null,
          targetRpe: 7,
          loadKg: null,
          restSeconds: 30,
          alternatives: ['quarter-squat'],
          notes: 'Instrucción escrita QA.',
        },
      ],
    },
    headers,
  )
  expect(created.status).toBe(201)
  const program = created.body.program
  expect(
    (
      await api(
        admin.page,
        `/api/b2b/orgs/atlas-demo/programs/${program.id}/publish`,
        'POST',
        { expectedRevision: program.revision },
        headers,
      )
    ).status,
  ).toBe(201)
  expect(
    (
      await api(
        admin.page,
        '/api/b2b/orgs/atlas-demo/assignments',
        'POST',
        { memberId: userId, programId: program.id, version: 1 },
        headers,
      )
    ).status,
  ).toBe(201)
  return name
}
async function history(page: Page, branch = center) {
  const me = await identity(page)
  const result = await api<{ executions: Execution[] }>(
    page,
    '/api/b2b/orgs/atlas-demo/executions',
    'GET',
    undefined,
    scope(me.user.id, branch, 'member'),
  )
  expect(result.status).toBe(200)
  return result.body.executions
}
function gate() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test.afterEach(async ({ page, browser }, info) => {
  if (page.isClosed()) return
  await info.attach('runtime.json', {
    contentType: 'application/json',
    body: JSON.stringify(
      {
        engine: info.project.use.browserName,
        version: browser.version(),
        viewport: page.viewportSize(),
        touch: info.project.use.hasTouch,
        mobileEmulation: info.project.use.isMobile,
        state: await page
          .evaluate(() => ({
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            deviceScale: devicePixelRatio,
            touchPoints: navigator.maxTouchPoints,
            userAgent: navigator.userAgent,
            speechApi: typeof speechSynthesis !== 'undefined',
            speechVoices:
              typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices().length : 0,
          }))
          .catch(() => null),
      },
      null,
      2,
    ),
  })
  await info.attach('browser-diagnostics.json', {
    contentType: 'application/json',
    body: JSON.stringify(
      {
        inspector: browserDiagnostics.get(page) ?? [],
        uncaughtScriptFaults: pageErrors.get(page) ?? [],
      },
      null,
      2,
    ),
  })
  expect(pageErrors.get(page) ?? [], 'uncaught JavaScript errors').toEqual([])
})

test('branch drafts stay isolated, current progress stays in the selected branch, and all-history exports both', async ({
  page,
  browser,
}, info) => {
  const admin = await adminFixture(browser, info)
  try {
    const invitation = await invite(admin, north)
    await activate(page, invitation.url)
    await login(page, invitation.email)
    const member = (await identity(page)).user.id
    expect(
      (
        await api(
          admin.page,
          '/api/b2b/orgs/atlas-demo/grants',
          'PUT',
          { userId: member, branchId: center, role: 'member', active: true },
          admin.headers,
        )
      ).status,
    ).toBe(200)
    const centerName = await assign(admin, member)
    const northName = await assign(admin, member, north)
    await page.reload()
    await page.getByLabel('Sede y función', { exact: true }).selectOption(`${center}:member`)
    await start(page, centerName)
    await page.getByLabel('Notas de la sesión').fill('Borrador Centro QA')
    await page.getByRole('checkbox', { name: 'Hecha', exact: true }).first().check()
    await page.getByLabel('Sede y función', { exact: true }).selectOption(`${north}:member`)
    await start(page, northName)
    await expect(page.getByLabel('Notas de la sesión')).toHaveValue('')
    await page.getByLabel('Notas de la sesión').fill('Registro Norte QA')
    for (const checkbox of await page.getByRole('checkbox', { name: 'Hecha', exact: true }).all())
      await checkbox.check()
    await page.getByRole('button', { name: 'Completar sesión', exact: true }).click()
    await expect(page.getByText('Tu sesión quedó guardada.', { exact: true })).toBeVisible()
    expect(await history(page, north)).toHaveLength(1)
    await page.getByLabel('Sede y función', { exact: true }).selectOption(`${center}:member`)
    await start(page, centerName)
    await expect(page.getByLabel('Notas de la sesión')).toHaveValue('Borrador Centro QA')
    await expect(page.getByRole('checkbox', { name: 'Hecha', exact: true }).first()).toBeChecked()
    await page.goto(`${atlas}/g/atlas-demo/units/atlas-demo-norte-cable-01`)
    await page.getByRole('link', { name: 'Ver este equipo en mi rutina →', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Elegí la sede de este equipo', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Abrir mi rutina en Norte', exact: true }).click()
    await expect(page.getByLabel('Sede y función', { exact: true })).toHaveValue(`${north}:member`)
    await expect(page.getByText(/Estás consultando el equipo/)).toBeVisible()
    expect(new URL(page.url()).searchParams.get('machine')).toBe('base-cable-station-v1')
    await page.getByRole('link', { name: 'Ver todas mis rutinas', exact: true }).click()
    await page.getByLabel('Sede y función', { exact: true }).selectOption(`${center}:member`)
    await page.getByRole('button', { name: 'Mi progreso', exact: true }).click()
    await expect(page.getByText('Cada comienzo cuenta', { exact: true })).toBeVisible()
    await expect(routine(page, northName)).toHaveCount(0)
    await page.getByRole('link', { name: 'Todo mi historial', exact: true }).click()
    await expect(routine(page, northName)).toBeVisible()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar mi historial', exact: true }).click()
    const exported = await download
    expect(exported.suggestedFilename()).toBe('mi-historial.json')
    const path = await exported.path()
    const { readFile } = await import('node:fs/promises')
    const content = JSON.parse(await readFile(path!, 'utf8')) as { executions: Execution[] }
    expect(content.executions).toHaveLength(1)
    expect(content.executions[0].branchId).toBe(north)
    await evidence(page, info, 'all-history-export')
  } finally {
    await admin.context.close()
  }
})

test('invitation validates locally, activates only the invited branch, and rejects reused or wrong-brand links', async ({
  page,
  browser,
}, info) => {
  const admin = await adminFixture(browser, info)
  try {
    await page.goto(`${atlas}/app/invite`)
    await expect(page.getByRole('button', { name: 'Activar mi cuenta' })).toBeDisabled()
    await expect(page.getByRole('alert')).toContainText('Falta el enlace')
    const invitation = await invite(admin, north)
    await page.goto(invitation.url)
    await page.getByLabel('Tu nombre').fill('QA')
    await page.getByLabel('Nueva contraseña').fill('corta')
    await page.getByRole('button', { name: 'Activar mi cuenta' }).click()
    expect(
      await page
        .getByLabel('Nueva contraseña')
        .evaluate((input: HTMLInputElement) => input.checkValidity()),
    ).toBe(false)
    await activate(page, invitation.url)
    await login(page, invitation.email)
    expect((await identity(page)).whiteLabel?.branches.map((item) => item.branch.id)).toEqual([
      north,
    ])
    await expect(page.getByText('Tu próxima rutina está en camino', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Mi progreso', exact: true }).click()
    await expect(page.getByText('Cada comienzo cuenta', { exact: true })).toBeVisible()
    await evidence(page, info, 'new-member-empty-history')
    await page.getByRole('button', { name: 'Salir', exact: true }).click()
    await page.goto(invitation.url)
    await page.getByLabel('Tu nombre').fill('QA')
    await page.getByLabel('Nueva contraseña').fill(password)
    await page.getByRole('button', { name: 'Activar mi cuenta' }).click()
    await expect(page.getByRole('alert')).toContainText('Invitación inválida o vencida')
    const other = await invite(admin)
    await page.goto(other.url.replace(atlas, sur))
    await page.getByLabel('Tu nombre').fill('QA')
    await page.getByLabel('Nueva contraseña').fill(password)
    await page.getByRole('button', { name: 'Activar mi cuenta' }).click()
    await expect(page.getByRole('alert')).toContainText('Invitación inválida o vencida')
  } finally {
    await admin.context.close()
  }
})

test('QR keeps the equipment and branch through contextual login and never records a series', async ({
  page,
}, info) => {
  await page.goto(`${atlas}/g/atlas-demo/units/atlas-demo-cable-01`)
  await expect(page.getByRole('heading', { name: 'Polea 01', exact: true })).toBeVisible()
  await evidence(page, info, 'public-qr')
  await page.getByRole('link', { name: 'Ver este equipo en mi rutina →', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill('member@atlas.example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await submitLogin(page)
  await expect(page.getByText(/Estás consultando el equipo/)).toBeVisible()
  expect(new URL(page.url()).searchParams.get('machine')).toBe('base-cable-station-v1')
  const before = await history(page)
  await start(page)
  for (const checkbox of await page.getByRole('checkbox', { name: 'Hecha', exact: true }).all())
    await expect(checkbox).not.toBeChecked()
  await page.getByRole('button', { name: 'Volver', exact: true }).click()
  expect((await history(page)).length).toBe(before.length)
  await page.getByRole('link', { name: 'Ver todas mis rutinas', exact: true }).click()
  expect(new URL(page.url()).search).toBe('')
  await page.goto(`${atlas}/app?machine=no-such-machine`)
  await expect(
    page.getByText('Este equipo no aparece en tus rutinas asignadas', { exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Ver todas mis rutinas', exact: true }).click()
  await expect(routine(page)).toBeVisible()
})

test('series, authorized substitution, validation, return, reload and browser history preserve a draft', async ({
  page,
}, info) => {
  await login(page)
  const before = await history(page)
  await start(page)
  await page.getByRole('button', { name: 'Guardar parcial', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Marcá al menos una serie')
  await page.getByLabel('Repeticiones · 1/1', { exact: true }).fill('-1')
  await page.getByRole('checkbox', { name: 'Hecha', exact: true }).first().check()
  await page.getByRole('button', { name: 'Guardar parcial', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Revisá las repeticiones')
  await page.getByLabel('Repeticiones · 1/1', { exact: true }).fill('12')
  await page.getByLabel('Carga kg · 1/1', { exact: true }).fill('17.5')
  await page.getByLabel('Esfuerzo percibido · 1/1', { exact: true }).selectOption('7.5')
  await page.getByLabel('Ejercicio realizado · 1/1', { exact: true }).selectOption('quarter-squat')
  await expect(page.getByLabel('Carga kg · 1/1', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Esfuerzo percibido · 1/1', { exact: true })).toHaveValue('')
  await expect(page.getByRole('checkbox', { name: 'Hecha', exact: true }).first()).not.toBeChecked()
  await page.getByRole('checkbox', { name: 'Hecha', exact: true }).first().check()
  await page.getByRole('button', { name: 'Guardar parcial', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('motivo de cada sustitución')
  await page
    .getByLabel('Motivo de sustitución · 1/1', { exact: true })
    .fill('Equipo ocupado; alternativa autorizada.')
  await page.getByLabel('Notas de la sesión').fill('Borrador móvil QA')
  await evidence(page, info, 'edited-substitution-draft')
  await page.getByRole('button', { name: 'Volver', exact: true }).click()
  await start(page)
  await expect(page.getByLabel('Notas de la sesión')).toHaveValue('Borrador móvil QA')
  await page.getByRole('button', { name: 'Movimientos', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/catalog$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/app(?:\/routines)?$/)
  // Back can restore either the mounted session or the routine list; both must preserve data.
  if (await page.getByRole('button', { name: 'Empezar sesión', exact: true }).count())
    await start(page)
  await expect(page.getByLabel('Notas de la sesión')).toHaveValue('Borrador móvil QA')
  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Conocé cada movimiento.' })).toBeVisible()
  await page.getByRole('button', { name: 'Mi rutina', exact: true }).click()
  await page.reload()
  await start(page)
  await expect(page.getByLabel('Repeticiones · 1/1', { exact: true })).toHaveValue('12')
  await expect(page.getByLabel('Motivo de sustitución · 1/1', { exact: true })).toHaveValue(
    'Equipo ocupado; alternativa autorizada.',
  )
  await page.getByRole('button', { name: 'Completar sesión', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('marcá todas las series')
  await page.getByRole('button', { name: 'Guardar parcial', exact: true }).click()
  await expect(page.getByText('Tu sesión quedó guardada.', { exact: true })).toBeVisible()
  const after = await history(page)
  expect(after.length).toBe(before.length + 1)
  const saved = after.find((item) => item.notes === 'Borrador móvil QA')!
  expect(saved.status).toBe('partial')
  expect(saved.sets).toHaveLength(1)
  expect(saved.sets[0]).toMatchObject({
    exerciseId: 'quarter-squat',
    reps: 12,
    loadKg: null,
    rpe: null,
  })
  await routine(page).first().getByText('Ver lo que hiciste', { exact: true }).click()
  await evidence(page, info, 'partial-history')
  await page.getByRole('button', { name: 'Mi rutina', exact: true }).click()
  await start(page)
  await expect(page.getByRole('checkbox', { name: 'Hecha', exact: true }).first()).not.toBeChecked()
})

test('timed session recovers duration/RPE, rejects incomplete completion and saves once on double click', async ({
  page,
  browser,
}, info) => {
  const admin = await adminFixture(browser, info)
  try {
    const invitation = await invite(admin)
    await activate(page, invitation.url)
    await login(page, invitation.email)
    const name = await assign(admin, (await identity(page)).user.id, center, true)
    await page.reload()
    await start(page, name)
    await page.getByLabel('Duración segundos · 1/1', { exact: true }).fill('38')
    await page.getByLabel('Esfuerzo percibido · 1/1', { exact: true }).selectOption('7.5')
    await page.getByRole('checkbox', { name: 'Hecha', exact: true }).first().check()
    await page.reload()
    await start(page, name)
    await expect(page.getByLabel('Duración segundos · 1/1', { exact: true })).toHaveValue('38')
    await expect(page.getByLabel('Esfuerzo percibido · 1/1', { exact: true })).toHaveValue('7.5')
    await page.getByRole('button', { name: 'Completar sesión', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('marcá todas las series')
    await page.getByRole('checkbox', { name: 'Hecha', exact: true }).nth(1).check()
    await evidence(page, info, 'timed-session')
    const commit = gate(),
      release = gate()
    let sends = 0
    await page.route('**/api/b2b/orgs/atlas-demo/executions', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      sends++
      const response = await route.fetch()
      expect(response.ok()).toBeTruthy()
      commit.resolve()
      await release.promise
      await route.fulfill({ response })
    })
    try {
      await page.getByRole('button', { name: 'Completar sesión', exact: true }).dblclick()
      await commit.promise
      expect(sends).toBe(1)
      await expect(page.getByLabel('Duración segundos · 1/1', { exact: true })).toBeDisabled()
    } finally {
      release.resolve()
      await page.unrouteAll({ behavior: 'wait' })
    }
    await expect(page.getByText('Tu sesión quedó guardada.', { exact: true })).toBeVisible()
    const executions = await history(page)
    expect(executions).toHaveLength(1)
    expect(executions[0].sets[0]).toMatchObject({ reps: null, durationSeconds: 38, rpe: 7.5 })
    expect(executions[0].program.steps[0]).toMatchObject({ durationSeconds: 45, targetRpe: 7 })
    await routine(page, name).getByText('Ver lo que hiciste', { exact: true }).click()
    await expect(routine(page, name)).toContainText('38 s · RPE 7.5/10')
    await page.reload()
    await expect(routine(page, name)).toBeVisible()
    await evidence(page, info, 'completed-history')
  } finally {
    await admin.context.close()
  }
})

test('committed but lost response retries the identical payload after reload without duplicate history', async ({
  page,
}, info) => {
  await login(page)
  const before = await history(page)
  await start(page)
  await page.getByLabel('Repeticiones · 2/1', { exact: true }).fill('13')
  await page.getByRole('checkbox', { name: 'Hecha', exact: true }).nth(2).check()
  let payload: unknown
  await page.route('**/api/b2b/orgs/atlas-demo/executions', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    payload = route.request().postDataJSON()
    const response = await route.fetch()
    expect(response.ok()).toBeTruthy()
    await route.abort('failed')
  })
  await page.getByRole('button', { name: 'Guardar parcial', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('No pudimos conectar')
  await expect(page.getByLabel('Repeticiones · 2/1', { exact: true })).toBeDisabled()
  await evidence(page, info, 'lost-response')
  await page.unrouteAll({ behavior: 'wait' })
  await page.reload()
  await start(page)
  await expect(
    page.getByRole('button', { name: 'Confirmar envío pendiente', exact: true }),
  ).toBeVisible()
  const retry = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/executions'),
  )
  await page.getByRole('button', { name: 'Confirmar envío pendiente', exact: true }).click()
  expect((await retry).postDataJSON()).toEqual(payload)
  await expect(page.getByText('Tu sesión quedó guardada.', { exact: true })).toBeVisible()
  expect((await history(page)).length).toBe(before.length + 1)
})

test('offline editing and uncommitted server failure retain a retryable draft', async ({
  page,
  context,
}, info) => {
  await login(page)
  const before = await history(page)
  await start(page)
  await context.setOffline(true)
  await expect(page.getByText('Estás sin conexión.', { exact: false })).toBeVisible()
  await page.getByLabel('Notas de la sesión').fill('Edición sin conexión QA')
  await page.getByRole('checkbox', { name: 'Hecha', exact: true }).first().check()
  await page.getByRole('button', { name: 'Guardar parcial', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('No pudimos conectar')
  await context.setOffline(false)
  await page.route('**/api/b2b/orgs/atlas-demo/executions', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'TEMPORARY', message: 'Fixture temporal de QA.' }),
    })
  })
  await page.getByRole('button', { name: 'Confirmar envío pendiente', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Confirmar envío pendiente', exact: true }),
  ).toBeEnabled()
  expect((await history(page)).length).toBe(before.length)
  await evidence(page, info, 'temporary-server-failure')
  await page.unrouteAll({ behavior: 'wait' })
  await page.getByRole('button', { name: 'Confirmar envío pendiente', exact: true }).click()
  await expect(page.getByText('Tu sesión quedó guardada.', { exact: true })).toBeVisible()
  expect((await history(page)).length).toBe(before.length + 1)
})

test('expired session requires login and the same account recovers its draft while another account cannot see it', async ({
  page,
  context,
}, info) => {
  await login(page)
  await start(page)
  await page.getByLabel('Notas de la sesión').fill('Sólo socio Centro QA')
  await page.getByRole('checkbox', { name: 'Hecha', exact: true }).first().check()
  await context.clearCookies()
  await page.getByRole('button', { name: 'Guardar parcial', exact: true }).click()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await login(page, 'member-norte@atlas.example.test')
  await start(page)
  await expect(page.getByLabel('Notas de la sesión')).toHaveValue('')
  await expect(page.getByRole('checkbox', { name: 'Hecha', exact: true }).first()).not.toBeChecked()
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await login(page)
  await start(page)
  await expect(page.getByLabel('Notas de la sesión')).toHaveValue('Sólo socio Centro QA')
  await expect(page.getByRole('checkbox', { name: 'Hecha', exact: true }).first()).toBeChecked()
  await evidence(page, info, 'draft-after-expiration')
})

test('movement search, failed initial load, direct routes, back/forward and denied management remain recoverable', async ({
  page,
}, info) => {
  await login(page)
  await page.route(
    '**/api/b2b/orgs/atlas-demo/assignments',
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'TEMPORARY', message: 'Fixture de carga fallida.' }),
      }),
    { times: 1 },
  )
  await page.reload()
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click()
  await expect(routine(page)).toBeVisible()
  await page.getByRole('button', { name: 'Movimientos', exact: true }).click()
  await page.getByLabel('Buscar movimiento', { exact: true }).fill('sin-resultados-QA')
  await expect(page.getByText('No encontramos ese movimiento', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Limpiar búsqueda', exact: true }).click()
  await page.locator('.member-catalog-card').first().locator('summary').click()
  await expect(page.locator('.member-catalog-card').first().locator('ol li').first()).toBeVisible()
  await evidence(page, info, 'movement-catalog')
  await page.getByRole('button', { name: 'Mi progreso', exact: true }).click()
  await page.goBack()
  await expect(page).toHaveURL(/\/app\/catalog$/)
  await page.goForward()
  await expect(page).toHaveURL(/\/app\/history$/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Lo que cuenta es volver.' })).toBeVisible()
  await page.goto(`${atlas}/manage`)
  await expect(
    page.getByText('Este espacio es para el equipo del gimnasio', { exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Ir a mi espacio de socio', exact: true }).click()
  await expect(routine(page)).toBeVisible()
})

test('a QR from an unauthorized branch cannot present another branch routine as using that physical equipment', async ({
  page,
}, info) => {
  await login(page)
  const before = await history(page)
  await page.goto(`${atlas}/g/atlas-demo/units/atlas-demo-norte-cable-01`)
  await page.getByRole('link', { name: 'Ver este equipo en mi rutina →', exact: true }).click()
  await expect(
    page.getByRole('heading', {
      name: 'Tu cuenta no tiene acceso a la sede de este equipo',
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Empezar sesión', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Ver todas mis rutinas', exact: true }).click()
  await expect(routine(page)).toBeVisible()
  expect((await history(page)).length).toBe(before.length)
  await evidence(page, info, 'wrong-branch-qr-recovery')
})

test('optional voice starts only on request, pauses/resumes/stops, and unavailable speech keeps written instructions', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const events: string[] = []
    Object.defineProperty(window, '__qaVoice', { value: events })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: class {
        constructor(public text: string) {}
      },
    })
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: (utterance: { text: string }) => events.push(`speak:${utterance.text}`),
        cancel: () => events.push('cancel'),
        pause: () => events.push('pause'),
        resume: () => events.push('resume'),
        getVoices: () => [],
      },
    })
  })
  await login(page)
  const before = await history(page)
  await start(page)
  const step = page.locator('.session-step').first()
  await step.locator('summary').first().click()
  const events = () => page.evaluate(() => (window as unknown as { __qaVoice: string[] }).__qaVoice)
  expect(await events()).toEqual([])
  const listen = step.getByRole('button', { name: 'Escuchar instrucciones', exact: true })
  if (info.project.use.hasTouch) await listen.tap()
  else await listen.click()
  await step.getByRole('button', { name: 'Pausar voz', exact: true }).click()
  await expect(step.getByText('Voz en pausa.', { exact: true })).toBeVisible()
  await step.getByRole('button', { name: 'Reanudar voz', exact: true }).click()
  await step.getByRole('button', { name: 'Detener voz', exact: true }).click()
  expect(await events()).toContain('cancel')
  await listen.click()
  await page.getByRole('button', { name: 'Movimientos', exact: true }).click()
  expect((await events()).filter((event) => event === 'cancel').length).toBe(2)
  expect((await history(page)).length).toBe(before.length)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined })
  })
  await page.reload()
  const movement = page.locator('.member-catalog-card').first()
  await movement.locator('summary').click()
  await expect(movement.locator('ol li').first()).toBeVisible()
  await expect(
    movement.getByText(
      'La lectura en voz no está disponible en este navegador. Seguí las instrucciones escritas.',
      { exact: true },
    ),
  ).toBeVisible()
  await evidence(page, info, 'written-speech-fallback')
})

test('rest timer uses elapsed time across pause/resume and completion without checking or persisting sets', async ({
  page,
}, info) => {
  await login(page)
  const before = await history(page)
  await start(page)
  const step = page.locator('.session-step').first()
  await page.clock.install()
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 1000))
  await step.getByRole('button', { name: 'Iniciar descanso', exact: true }).click()
  await page.clock.fastForward(35_000)
  await expect(step.getByRole('timer')).toHaveText('0:25')
  await step.getByRole('button', { name: 'Pausar descanso', exact: true }).click()
  await page.clock.fastForward(10_000)
  await expect(step.getByRole('timer')).toHaveText('0:25')
  await step.getByRole('button', { name: 'Reanudar descanso', exact: true }).click()
  await page.clock.fastForward(26_000)
  await expect(step.getByRole('timer')).toHaveText('0:00')
  await page.clock.resume()
  for (const checkbox of await page.getByRole('checkbox', { name: 'Hecha', exact: true }).all())
    await expect(checkbox).not.toBeChecked()
  expect((await history(page)).length).toBe(before.length)
  await evidence(page, info, 'rest-timer')
})

test('another brand login is rejected; same-brand logout clears other tabs and stale protected responses stay cancelled', async ({
  page,
  context,
}, info) => {
  await page.goto(`${atlas}/app`)
  await page.getByLabel('Email', { exact: true }).fill('member@sur.example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toHaveCount(0)
  await login(page)
  await page.goto(`${sur}/app`)
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await login(page, 'member@sur.example.test', sur)
  await expect(routine(page)).toBeVisible()
  await page.goto(`${atlas}/app`)
  await expect(routine(page)).toBeVisible()
  const second = await context.newPage()
  await second.goto(`${atlas}/app`)
  await expect(second.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
  const captured = gate(),
    release = gate()
  await page.route(
    '**/api/b2b/me',
    async (route) => {
      const response = await route.fetch()
      captured.resolve()
      await release.promise
      await route.fulfill({ response }).catch(() => undefined)
    },
    { times: 1 },
  )
  try {
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await captured.promise
    await second.getByRole('button', { name: 'Salir', exact: true }).click()
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
    release.resolve()
    await page.unrouteAll({ behavior: 'wait' })
    await expect(page.getByRole('button', { name: 'Salir', exact: true })).toHaveCount(0)
    await page.goto(`${sur}/app`)
    await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
    await evidence(page, info, 'independent-sur-session')
  } finally {
    release.resolve()
    await page.unrouteAll({ behavior: 'wait' })
    await second.close()
  }
})

test('unavailable local storage warns honestly while a live session still saves to the backend', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith('klisteni.b2b.session.'))
        throw new DOMException('Synthetic storage quota', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await login(page)
  const before = await history(page)
  await start(page)
  await expect(page.getByRole('alert')).toContainText('No pudimos guardar el borrador')
  await expect(page.getByText('Borrador sin respaldo local.', { exact: true })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Hecha', exact: true }).first().check()
  await evidence(page, info, 'storage-warning')
  await page.getByRole('button', { name: 'Guardar parcial', exact: true }).click()
  await expect(page.getByText('Tu sesión quedó guardada.', { exact: true })).toBeVisible()
  expect((await history(page)).length).toBe(before.length + 1)
})

test('a delayed committed save cannot close a reopened session, and its exact retry remains idempotent', async ({
  page,
}, info) => {
  await login(page)
  const before = await history(page)
  await start(page)
  await page.getByRole('checkbox', { name: 'Hecha', exact: true }).first().check()
  const committed = gate(),
    release = gate()
  await page.route('**/api/b2b/orgs/atlas-demo/executions', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    const response = await route.fetch()
    expect(response.ok()).toBeTruthy()
    committed.resolve()
    await release.promise
    await route.fulfill({ response })
  })
  try {
    await page.getByRole('button', { name: 'Guardar parcial', exact: true }).click()
    await committed.promise
    await page.getByRole('button', { name: 'Mi progreso', exact: true }).click()
    await page.getByRole('button', { name: 'Mi rutina', exact: true }).click()
    await start(page)
    await expect(
      page.getByRole('button', { name: 'Confirmar envío pendiente', exact: true }),
    ).toBeVisible()
    release.resolve()
    await page.unrouteAll({ behavior: 'wait' })
    await expect(
      page.getByRole('button', { name: 'Confirmar envío pendiente', exact: true }),
    ).toBeVisible()
    await evidence(page, info, 'late-save-reopened-session')
    await page.getByRole('button', { name: 'Confirmar envío pendiente', exact: true }).click()
    await expect(page.getByText('Tu sesión quedó guardada.', { exact: true })).toBeVisible()
    expect((await history(page)).length).toBe(before.length + 1)
  } finally {
    release.resolve()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('an existing B2B identity joins a new brand only through explicit invitation consent', async ({
  page,
  browser,
}, info) => {
  const admin = await adminFixture(browser, info)
  try {
    const email = `existing-${crypto.randomUUID()}@example.test`
    // Create a synthetic identity in Sur via its own invitation, then join Atlas.
    await admin.page.goto(`${sur}/manage`)
    await admin.page.getByLabel('Email', { exact: true }).fill('admin@sur.example.test')
    await admin.page.getByLabel('Contraseña', { exact: true }).fill(password)
    await admin.page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
    await expect(admin.page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
    const surAdmin = await identity(admin.page)
    const first = await api<{ url: string }>(
      admin.page,
      '/api/b2b/orgs/sur-demo/invitations',
      'POST',
      { email, name: 'Cuenta existente QA', role: 'member' },
      scope(surAdmin.user.id, 'sur-demo-principal'),
    )
    expect(first.status).toBe(201)
    await activate(page, first.body.url)
    await admin.page.goto(`${atlas}/manage`)
    const next = await invite(admin, north, email)
    await page.goto(next.url)
    await page.getByRole('button', { name: 'Ya tengo una cuenta de gimnasio', exact: true }).click()
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Contraseña', { exact: true }).fill(password)
    const consent = page.getByRole('checkbox')
    await page
      .getByRole('button', { name: 'Aceptar invitación con mi cuenta', exact: true })
      .click()
    expect(await consent.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false)
    await consent.check()
    await page
      .getByRole('button', { name: 'Aceptar invitación con mi cuenta', exact: true })
      .click()
    await expect(page.getByText('Tu cuenta está lista.', { exact: false })).toBeVisible()
    await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
    expect((await identity(page)).whiteLabel?.branches.map(({ branch }) => branch.id)).toEqual([
      north,
    ])
    await evidence(page, info, 'existing-identity-consented')
    await page.getByRole('button', { name: 'Salir', exact: true }).click()
    await login(page, email, sur)
    expect((await identity(page)).whiteLabel?.branches[0].branch.id).toBe('sur-demo-principal')
  } finally {
    await admin.context.close()
  }
})
