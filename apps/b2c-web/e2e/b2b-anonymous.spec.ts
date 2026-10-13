import { test, expect, type Page, type TestInfo } from '@playwright/test'

let protocol = 'https',
  atlas = 'https://atlas.b2b.test',
  sur = 'https://sur.b2b.test'
const unitPath = '/g/atlas-demo/units/atlas-demo-norte-cable-01'
const privateMarker = /BORRADOR PRIVADO|NO PUBLICAR|adaptación pendiente|Borrador privado/
let fixture: { media: Record<string, { url: string; label: string }>; state: unknown }
let jsErrors: string[]
const control = (info: TestInfo, path: string) =>
  `http://127.0.0.1:4348/${path}${path.includes('?') ? '&' : '?'}project=${info.project.metadata.fixtureIndex}`
async function apply(info: TestInfo, name = 'normal') {
  const response = await fetch(control(info, `fixture?case=${name}`), { method: 'POST' })
  expect(response.status).toBe(200)
  fixture = await response.json()
}
async function api(page: Page, path: string) {
  return page.evaluate(async (path) => {
    const response = await fetch(path)
    return { status: response.status, body: await response.text() }
  }, path)
}
async function screen(page: Page, info: TestInfo, name = 'screen') {
  await expect(page.locator('body')).not.toHaveText(privateMarker)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true })
}
async function branch(page: Page) {
  await page.goto(`${atlas}/sedes/norte`)
  await expect(page.getByRole('heading', { name: 'Atlas Norte', exact: true })).toBeVisible()
}
async function unavailable(page: Page) {
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Polea 01', exact: true })).toHaveCount(0)
}

test.beforeEach(async ({ page }, info) => {
  protocol = String(info.project.metadata.protocol ?? 'https')
  atlas = `${protocol}://atlas.b2b.test`
  sur = `${protocol}://sur.b2b.test`
  jsErrors = []
  page.on('pageerror', (error) => jsErrors.push(error.message))
  await apply(info)
})
test.afterEach(async ({ page, browser }, info) => {
  if (info.status === info.expectedStatus) {
    expect(jsErrors).toEqual([])
    const state = await (await fetch(control(info, 'state'))).json()
    expect(state).toEqual(fixture.state)
    await info.attach('persisted-state-and-engine', {
      body: JSON.stringify({ engine: browser.version(), viewport: page.viewportSize(), state }),
      contentType: 'application/json',
    })
  }
})

test('A01 Atlas and Sur show distinct brands and every public branch', async ({ page }, info) => {
  const privateRequests: string[] = []
  page.on('request', (request) => {
    if (/\/api\/b2b\/(?:me$|orgs\/)/.test(request.url())) privateRequests.push(request.url())
  })
  for (const [origin, org, names] of [
    [atlas, 'atlas-demo', ['Centro', 'Norte']],
    [sur, 'sur-demo', ['Centro', 'Oeste']],
  ] as const) {
    await page.goto(origin)
    await expect(page.locator(`[data-brand="${org}"]`)).toBeVisible()
    for (const name of names)
      await expect(page.getByRole('link', { name: `Conocer ${name}` })).toBeVisible()
    await screen(page, info, org)
  }
  expect(privateRequests).toEqual([])
})
test('A02 all four branch pages load with their published catalog and schedules', async ({
  page,
}, info) => {
  for (const [origin, slug, name] of [
    [atlas, 'centro', 'Atlas Demo'],
    [atlas, 'norte', 'Atlas Norte'],
    [sur, 'centro', 'Sur Demo'],
    [sur, 'oeste', 'Sur Oeste'],
  ]) {
    await page.goto(`${origin}/sedes/${slug}`)
    await expect(page.getByRole('heading', { name, exact: true }).first()).toBeVisible()
    await expect(page.getByText('08:00 a 21:00', { exact: true })).toBeVisible()
    await expect(page.getByText('Conocer equipo →').first()).toBeVisible()
    await screen(page, info, `branch-${origin === atlas ? 'atlas' : 'sur'}-${slug}`)
  }
})
test('A03 navigation through branch catalog QR reload and browser history', async ({
  page,
}, info) => {
  await page.goto(atlas)
  await page.getByRole('link', { name: 'Conocer Norte' }).click()
  await expect(page).toHaveURL(`${atlas}/sedes/norte`)
  await page.getByText('Conocer equipo →').first().click()
  await expect(page).toHaveURL(`${atlas}${unitPath}`)
  await expect(page.getByRole('heading', { name: 'Polea 01', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Movimientos para este equipo' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(`${atlas}/sedes/norte`)
  await page.goForward()
  await expect(page).toHaveURL(`${atlas}${unitPath}`)
  await screen(page, info)
})
test('A04 branch published contact differs from private profile drafts', async ({ page }, info) => {
  await branch(page)
  await expect(page.getByText('Avenida norte 200', { exact: true })).toBeVisible()
  await expect(page.getByText('Contacto norte público', { exact: true })).toBeVisible()
  await screen(page, info)
})
test('A05 QR header login and return link preserve the unit branch', async ({ page }, info) => {
  await page.goto(`${atlas}${unitPath}`)
  await expect(page.getByRole('link', { name: 'Mi espacio →', exact: true })).toHaveAttribute(
    'href',
    /branch=atlas-demo-norte/,
  )
  await page.getByRole('link', { name: 'Ver el gimnasio', exact: true }).click()
  await expect(page).toHaveURL(`${atlas}/sedes/norte`)
  await page.getByRole('link', { name: 'Mi espacio →', exact: true }).click()
  await expect(page).toHaveURL(/\/login\?.*branch=atlas-demo-norte/)
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await screen(page, info)
})
test('A06 QR routine entry retains unit machine branch and login context', async ({
  page,
}, info) => {
  await page.goto(`${atlas}${unitPath}`)
  await page.getByRole('link', { name: 'Ver este equipo en mi rutina →' }).click()
  const params = new URL(page.url()).searchParams
  expect(params.get('branch')).toBe('atlas-demo-norte')
  expect(params.get('unit')).toBe('atlas-demo-norte-cable-01')
  expect(params.get('machine')).toBe('base-cable-station-v1')
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await screen(page, info)
})
test('A07 root-only published gallery loads real image bytes', async ({ page }, info) => {
  await page.goto(atlas)
  const image = page.getByRole('img', { name: fixture.media.root.label, exact: true })
  await image.scrollIntoViewIfNeeded()
  await expect(image).toBeVisible()
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true)
  expect((await api(page, fixture.media.root.url)).status).toBe(200)
  await screen(page, info)
})
test('A08 published branch media and video controls load and play', async ({ page }, info) => {
  await branch(page)
  const image = page.getByRole('img', { name: fixture.media.branch.label, exact: true }).first()
  await image.scrollIntoViewIfNeeded()
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true)
  const video = page.getByLabel('Clip sintético publicado', { exact: true })
  await video.scrollIntoViewIfNeeded()
  await video.evaluate((element: HTMLVideoElement) => element.play())
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState))
    .toBeGreaterThanOrEqual(2)
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeGreaterThan(0)
  await video.evaluate((element: HTMLVideoElement) => element.pause())
  await screen(page, info)
})
test('A09 floor plan marker opens the unit; failed image keeps the textual route', async ({
  page,
}, info) => {
  await page.route(`**${fixture.media.branch.url}`, (route) => route.abort())
  await branch(page)
  const floor = page.getByRole('region', { name: 'Plano del gimnasio' })
  await floor.scrollIntoViewIfNeeded()
  await expect(
    page.getByText('No pudimos cargar el plano. Podés consultar los equipos en la lista.'),
  ).toBeVisible()
  await floor.locator('ol a').click()
  await expect(page).toHaveURL(`${atlas}${unitPath}`)
  await screen(page, info)
})
for (const name of ['hiddenBranch', 'archivedBranch', 'unpublishedBranch', 'websiteOff'])
  test(`A10 ${name} hides branch and QR without exposing private content`, async ({
    page,
  }, info) => {
    await apply(info, name)
    await page.goto(atlas)
    await expect(page.getByRole('heading', { name: 'Atlas Demo', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Conocer Norte' })).toHaveCount(0)
    await page.goto(`${atlas}/sedes/norte`)
    await unavailable(page)
    await page.goto(`${atlas}${unitPath}`)
    await unavailable(page)
    await screen(page, info)
  })
for (const name of ['hiddenUnit', 'archivedUnit', 'unpublishedMachine', 'equipmentOff'])
  test(`A11 ${name} removes catalog entry QR and floor marker`, async ({ page }, info) => {
    await apply(info, name)
    await branch(page)
    await expect(page.getByText('Conocer equipo →')).toHaveCount(0)
    await expect(page.locator('.floor-plan-point')).toHaveCount(0)
    await page.goto(`${atlas}${unitPath}`)
    await unavailable(page)
    await screen(page, info)
  })
test('A12 empty branch equipment and no published exercises have usable empty states', async ({
  page,
}, info) => {
  await apply(info, 'empty')
  await branch(page)
  await expect(page.getByRole('heading', { name: 'Un espacio en movimiento' })).toBeVisible()
  await apply(info, 'noExercises')
  await page.goto(`${atlas}${unitPath}`)
  await expect(page.getByRole('heading', { name: 'Pronto, más movimientos' })).toBeVisible()
  await screen(page, info)
})
test('A13 unpublished organization website keeps branch navigation and login usable', async ({
  page,
}, info) => {
  await apply(info, 'unpublishedRoot')
  await page.goto(atlas)
  await expect(page.getByRole('link', { name: 'Conocer Norte' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('link', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await screen(page, info)
})
test('A14 brand without published branches retains login and empty guidance', async ({
  page,
}, info) => {
  await apply(info, 'noBranches')
  await page.goto(atlas)
  await expect(
    page.getByText(
      'El equipo está preparando la información de sus sedes. Tu acceso sigue disponible.',
    ),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Entrar a mi espacio →' }).click()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await screen(page, info)
})
test('A15 invalid routes encoded slugs unknown gym branch and unit fail safely', async ({
  page,
}, info) => {
  for (const path of ['/bogus', '/app/bogus', '/manage/bogus', '/sedes/toString']) {
    await page.goto(`${atlas}${path}`)
    await expect(
      page
        .getByRole('heading', { name: 'Esta página no existe' })
        .or(page.getByRole('button', { name: 'Reintentar', exact: true })),
    ).toBeVisible()
  }
  for (const path of [
    '/g/no-such-gym',
    '/sedes/no-such-branch',
    '/g/atlas-demo/units/no-such-unit',
    '/g/atlas-demo/units/%2Fsecret',
  ]) {
    await page.goto(`${atlas}${path}`)
    await unavailable(page)
  }
  await screen(page, info)
})
test('A16 private media foreign brand URLs and auth-only endpoints are inaccessible', async ({
  page,
}, info) => {
  await branch(page)
  expect((await api(page, fixture.media.private.url)).status).toBe(404)
  expect((await api(page, fixture.media.sur.url)).status).toBe(404)
  for (const path of [
    '/api/b2b/orgs/atlas-demo/units',
    '/api/b2b/orgs/atlas-demo/exercises',
    '/api/b2b/orgs/atlas-demo/people',
    '/api/b2b/orgs/atlas-demo/executions',
  ])
    expect((await api(page, path)).status).toBe(401)
  await page.goto(`${atlas}/g/sur-demo`)
  await unavailable(page)
  await page.goto(`${sur}${unitPath}`)
  await unavailable(page)
  await screen(page, info)
})
test('A17 unknown host and canonical alias redirects reject secret queries', async ({
  page,
}, info) => {
  await page.goto(`${protocol}://alias.b2b.test/sedes/norte#discard`)
  expect(new URL(page.url()).origin).toBe(atlas)
  expect(new URL(page.url()).pathname).toBe('/sedes/norte')
  expect(new URL(page.url()).hash).toBe('')
  await expect(page.getByRole('heading', { name: 'Atlas Norte', exact: true })).toBeVisible()
  expect(
    (await page.goto(`${protocol}://alias.b2b.test/login?token=synthetic-invalid`))?.status(),
  ).toBe(421)
  expect((await page.goto(`${protocol}://unknown.b2b.test/`))?.status()).toBe(421)
  await expect(page.locator('[data-brand]')).toHaveCount(0)
  await screen(page, info)
})
test('A18 branch request failure response loss and retry recover without stale data', async ({
  page,
}, info) => {
  let attempts = 0
  await page.route('**/api/b2b/public/atlas-demo?branch=norte', async (route) => {
    attempts++
    if (attempts === 1) {
      await route.fetch()
      await route.abort()
    } else await route.continue()
  })
  await page.goto(`${atlas}/sedes/norte`)
  await unavailable(page)
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Atlas Norte', exact: true })).toBeVisible()
  await screen(page, info)
})
test('A19 cancelled slow branch response cannot replace a different route', async ({
  page,
}, info) => {
  let release!: () => void
  const hold = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/b2b/public/atlas-demo?branch=norte', async (route) => {
    await hold
    await route.continue().catch(() => {})
  })
  await page.goto(atlas)
  await page.getByRole('link', { name: 'Conocer Norte' }).click()
  await page.getByRole('link', { name: 'Mi espacio →', exact: true }).click()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  release()
  await expect(page.getByRole('heading', { name: 'Atlas Norte', exact: true })).toHaveCount(0)
  await screen(page, info)
})
test('A20 public context error offers a retry and recovers', async ({ page }, info) => {
  let fail = true
  await page.route('**/api/b2b/context', (route) => (fail ? route.abort() : route.continue()))
  await page.goto(atlas)
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Conocer Norte' })).toBeVisible()
  await screen(page, info)
})
test('A21 landing website request error can be retried', async ({ page }, info) => {
  let fail = true
  await page.route('**/api/b2b/public/atlas-demo', (route) =>
    fail ? route.abort() : route.continue(),
  )
  await page.goto(atlas)
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click()
  await expect(page.getByRole('img', { name: fixture.media.root.label })).toBeAttached()
  await screen(page, info)
})
test('A22 login native validation wrong credentials and double submit stay anonymous', async ({
  page,
}, info) => {
  await page.goto(`${atlas}/login`)
  const signIn = page.getByRole('button', { name: 'Iniciar sesión', exact: true })
  await signIn.click()
  expect(
    await page
      .getByLabel('Email', { exact: true })
      .evaluate((element: HTMLInputElement) => element.validity.valueMissing),
  ).toBe(true)
  await page.getByLabel('Email', { exact: true }).fill('invalid')
  await page.getByLabel('Contraseña', { exact: true }).fill('synthetic-invalid-password')
  await signIn.click()
  expect(
    await page
      .getByLabel('Email', { exact: true })
      .evaluate((element: HTMLInputElement) => element.validity.typeMismatch),
  ).toBe(true)
  await page.getByLabel('Email', { exact: true }).fill('nobody@example.test')
  let requests = 0,
    release!: () => void
  const hold = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/b2b/auth/sign-in/email', async (route) => {
    requests++
    await hold
    await route.continue()
  })
  await signIn.click()
  await expect(page.getByRole('button', { name: 'Ingresando…' })).toBeDisabled()
  await page.getByRole('button', { name: 'Ingresando…' }).dispatchEvent('click')
  release()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(requests).toBe(1)
  expect((await api(page, '/api/b2b/me')).status).toBe(401)
  await screen(page, info)
})
test('A23 login response loss leaves a retryable anonymous form', async ({ page }, info) => {
  await page.goto(`${atlas}/login`)
  await page.getByLabel('Email', { exact: true }).fill('nobody@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('synthetic-invalid-password')
  await page.route('**/api/b2b/auth/sign-in/email', async (route) => {
    await route.fetch()
    await route.abort()
  })
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeEnabled()
  expect((await api(page, '/api/b2b/me')).status).toBe(401)
  await screen(page, info)
})
test('A24 every protected route shows login with expired synthetic cookies', async ({
  page,
  context,
}, info) => {
  await context.addCookies([
    {
      name: '__Secure-better-auth.session_token',
      value: 'synthetic-expired',
      domain: 'atlas.b2b.test',
      path: '/',
      secure: true,
      httpOnly: true,
      expires: Math.floor(Date.now() / 1000) - 1,
    },
  ])
  for (const path of [
    '/app',
    '/app/routines',
    '/app/catalog',
    '/app/history',
    '/app/history/all',
    '/manage',
    '/backoffice',
    '/manage/reports',
    '/manage/people',
    '/manage/programs',
    '/manage/catalog',
    '/manage/equipment',
    '/manage/brand',
    '/manage/preparation',
    '/manage/website',
    '/manage/media',
    '/manage/qr',
    '/manage/whiteLabel',
  ]) {
    await page.goto(`${atlas}${path}`)
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salir', exact: true })).toHaveCount(0)
  }
  await screen(page, info)
})
test('A25 invalid invitation is safe and has no account side effects', async ({ page }, info) => {
  await page.goto(`${atlas}/app/invite?token=synthetic-invalid`)
  await page.getByLabel('Tu nombre', { exact: true }).fill('Visitante QA')
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('synthetic-invalid-password')
  await page.getByRole('button', { name: 'Activar mi cuenta', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect((await api(page, '/api/b2b/me')).status).toBe(401)
  await screen(page, info)
})

test('A26 double activation of a branch link keeps one public context and no session', async ({
  page,
}, info) => {
  await page.goto(atlas)
  const link = page.getByRole('link', { name: 'Conocer Norte', exact: true })
  await link.dblclick()
  await expect(page).toHaveURL(`${atlas}/sedes/norte`)
  await expect(page.getByRole('heading', { name: 'Atlas Norte', exact: true })).toBeVisible()
  expect((await api(page, '/api/b2b/me')).status).toBe(401)
  await screen(page, info)
})
test('A27 all four branch QR units and long title stay readable and isolated', async ({
  page,
}, info) => {
  for (const [origin, org, id] of [
    [atlas, 'atlas-demo', 'atlas-demo-cable-01'],
    [atlas, 'atlas-demo', 'atlas-demo-norte-cable-01'],
    [sur, 'sur-demo', 'sur-demo-cable-01'],
    [sur, 'sur-demo', 'sur-demo-oeste-cable-01'],
    [atlas, 'atlas-demo', 'atlas-demo-cable-02'],
  ]) {
    await page.goto(`${origin}/g/${org}/units/${id}`)
    await expect(
      page.getByRole('heading', { name: 'Movimientos para este equipo', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Mi espacio →', exact: true })).toHaveAttribute(
      'href',
      /branch=/,
    )
    await screen(page, info, id)
  }
})
test('A28 published text instructions expand and collapse without loading a model', async ({
  page,
}, info) => {
  const models: string[] = []
  page.on('request', (request) => {
    if (/\.(?:glb|gltf)(?:\?|$)/.test(request.url())) models.push(request.url())
  })
  await page.goto(`${atlas}${unitPath}`)
  await page.getByText('Cómo hacer Remo en polea sentado', { exact: true }).click()
  await expect(
    page.getByText('Con el tronco estable, llevá el agarre hacia el torso.', { exact: true }),
  ).toBeVisible()
  await screen(page, info)
  await page.getByText('Cómo hacer Remo en polea sentado', { exact: true }).click()
  await expect(
    page.getByText('Con el tronco estable, llevá el agarre hacia el torso.', { exact: true }),
  ).toBeHidden()
  expect(models).toEqual([])
})
test('A29 two simultaneous brand tabs expose only their own public data', async ({
  page,
  context,
}, info) => {
  await branch(page)
  const second = await context.newPage()
  await second.goto(`${sur}/sedes/oeste`)
  await expect(second.locator('[data-brand="sur-demo"]')).toBeVisible()
  await expect(
    second.getByRole('img', { name: fixture.media.sur.label, exact: true }).first(),
  ).toBeVisible()
  await expect(second.getByText('Atlas Norte', { exact: true })).toHaveCount(0)
  expect((await api(second, fixture.media.branch.url)).status).toBe(404)
  await expect(page.getByRole('heading', { name: 'Atlas Norte', exact: true })).toBeVisible()
  await screen(second, info, 'sur-tab')
  await screen(page, info, 'atlas-tab')
  await second.close()
})
test('A30 keyboard skip link and normal brand route aliases remain usable', async ({
  page,
}, info) => {
  for (const path of ['/gimnasios', '/g/atlas-demo/', '/sedes/norte/']) {
    await page.goto(`${atlas}${path}`)
    await expect(page.locator('h1')).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Ir al contenido', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#main$/)
    await screen(page, info, path.replaceAll('/', '-'))
  }
})
test('A31 foreign query parameters do not expose a workspace or switch the brand', async ({
  page,
}, info) => {
  await page.goto(`${atlas}/login?gym=sur-demo&branch=sur-demo-oeste&unit=sur-demo-oeste-cable-01`)
  await expect(page.locator('[data-brand="atlas-demo"]')).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  expect((await api(page, '/api/b2b/me')).status).toBe(401)
  await screen(page, info)
})

test('A32 malformed percent encoding is rejected at the document gateway', async ({
  page,
}, info) => {
  const response = page.waitForResponse((response) => response.url() === `${atlas}/g/%ZZ`)
  await page.goto(`${atlas}/g/%ZZ`).catch(() => {})
  expect((await response).status()).toBe(400)
  await expect(page.locator('[data-brand]')).toHaveCount(0)
  await screen(page, info, 'gateway-rejection')
  await page.goto(atlas)
  await expect(page.getByRole('link', { name: 'Conocer Norte' })).toBeVisible()
})

test('A33 touch activation uses real touch pointer events in the mobile viewport', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const pointerTypes: string[] = []
    Object.assign(window, { qaPointerTypes: pointerTypes })
    document.addEventListener('pointerdown', (event) => pointerTypes.push(event.pointerType))
  })
  await page.goto(atlas)
  const touch = Boolean(info.project.use.hasTouch)
  const link = page.getByRole('link', { name: 'Conocer Norte', exact: true })
  if (touch) await link.tap()
  else await link.click()
  await expect(page.getByRole('heading', { name: 'Atlas Norte', exact: true })).toBeVisible()
  const qr = page.getByText('Conocer equipo →').first()
  if (touch) await qr.tap()
  else await qr.click()
  await expect(
    page.getByRole('heading', { name: 'Movimientos para este equipo', exact: true }),
  ).toBeVisible()
  const login = page.getByRole('link', { name: 'Mi espacio →', exact: true })
  if (touch) await login.tap()
  else await login.click()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  const pointers = await page.evaluate(
    () => (window as Window & { qaPointerTypes?: string[] }).qaPointerTypes ?? [],
  )
  expect(pointers.length).toBeGreaterThanOrEqual(3)
  expect(pointers.every((pointer) => pointer === (touch ? 'touch' : 'mouse'))).toBe(true)
  await info.attach('actual-pointer-types', {
    body: JSON.stringify(pointers),
    contentType: 'application/json',
  })
  await screen(page, info)
})
test('A34 unpublishing branch or brand revokes direct anonymous media access', async ({
  page,
}, info) => {
  for (const name of ['hiddenBranch', 'archivedBranch', 'unpublishedBranch', 'websiteOff']) {
    await apply(info, name)
    await page.goto(atlas)
    await expect(page.getByRole('heading', { name: 'Atlas Demo', exact: true })).toBeVisible()
    expect((await api(page, fixture.media.branch.url)).status).toBe(404)
  }
  await apply(info, 'unpublishedRoot')
  await page.goto(atlas)
  expect((await api(page, fixture.media.root.url)).status).toBe(404)
  await screen(page, info)
})
test('A35 browser without speech retains the full published written instructions', async ({
  page,
}, info) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => undefined }),
  )
  await page.goto(`${atlas}${unitPath}`)
  await page.getByText('Cómo hacer Remo en polea sentado', { exact: true }).click()
  await expect(
    page.getByText(
      'La lectura en voz no está disponible en este navegador. Seguí las instrucciones escritas.',
      { exact: true },
    ),
  ).toBeVisible()
  await expect(
    page.getByText('Con el tronco estable, llevá el agarre hacia el torso.', { exact: true }),
  ).toBeVisible()
  await screen(page, info)
})
test('A36 brand logo enters login and invitation account entry can be cancelled', async ({
  page,
}, info) => {
  await page.goto(atlas)
  await page.locator('.brand-link').click()
  await expect(page).toHaveURL(`${atlas}/app`)
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await page.goto(`${atlas}/app/invite?token=synthetic-invalid`)
  await page.getByRole('button', { name: 'Ya tengo una cuenta de gimnasio', exact: true }).click()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Acepto incorporarme a esta marca con el acceso de esta invitación.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Volver', exact: true }).click()
  await expect(page.getByLabel('Tu nombre', { exact: true })).toBeVisible()
  expect((await api(page, '/api/b2b/me')).status).toBe(401)
  await screen(page, info)
})
