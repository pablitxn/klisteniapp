import { expect, test, type Page } from '@playwright/test'
import type { BrandContext, Me, ThemeState } from '../../../packages/b2b-contracts/src/index.ts'

const password = 'browser-tests-only-password-2026'
const atlas = 'https://atlas.b2b.test', sur = 'https://sur.b2b.test'

// Fetch inside the browser so DNS, TLS, Origin, cookie policy and the shared
// gateway remain part of every assertion (APIRequestContext has separate DNS).
async function api<T>(page: Page, path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  return page.evaluate(async ({ path, method, body, headers }) => {
    const response = await fetch(path, { method, headers: { 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }, { path, method, body, headers }) as Promise<{ status: number; body: T }>
}
async function login(page: Page, email: string, origin = atlas, path = '/app') {
  await page.goto(`${origin}${path}`)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  for (let attempt = 0; attempt < 3; attempt++) {
    const [response] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/api/b2b/auth/sign-in/email') && response.request().method() === 'POST'),
      page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click(),
    ])
    if (response.status() !== 429) { expect(response.status()).toBe(200); break }
    const retry = Math.max(1, Number(response.headers()['retry-after']) || 60)
    await page.waitForTimeout(Math.min(retry + 1, 65) * 1000)
  }
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
}
async function identity(page: Page) {
  const result = await api<Me>(page, '/api/b2b/me')
  expect(result.status).toBe(200)
  return result.body
}
const headers = (user: string, branch = 'atlas-demo-principal', role = 'admin') => ({
  'x-klisteni-b2b-account': user, 'x-klisteni-b2b-branch': branch, 'x-klisteni-b2b-role': role,
})

test('two actual HTTPS origins show distinct published brands and two branches before login; unknown hosts fail closed', async ({ page }) => {
  await page.goto(atlas)
  const a = await api<BrandContext>(page, '/api/b2b/context')
  expect(a.status).toBe(200)
  expect(a.body.organization.id).toBe('atlas-demo')
  expect(a.body.branches.map(branch => branch.slug).sort()).toEqual(['centro', 'norte'])
  await expect(page.locator('[data-brand="atlas-demo"]')).toBeVisible()
  await page.goto(sur)
  const b = await api<BrandContext>(page, '/api/b2b/context')
  expect(b.body.organization.id).toBe('sur-demo')
  expect(b.body.branches.map(branch => branch.slug).sort()).toEqual(['centro', 'oeste'])
  expect(b.body.theme.layout).not.toBe(a.body.theme.layout)
  await expect(page.locator('[data-brand="sur-demo"]')).toBeVisible()
  await page.goto('https://alias.b2b.test/sedes/centro#must-not-transfer')
  expect(new URL(page.url()).origin).toBe(atlas)
  expect(new URL(page.url()).hash).toBe('')
  expect(new URL(page.url()).pathname).toBe('/sedes/centro')
  expect((await page.goto('https://alias.b2b.test/login?token=do-not-forward'))?.status()).toBe(421)
  const invalid = await page.goto('https://unknown.b2b.test/')
  expect(invalid?.status()).toBe(421)
  await expect(page.locator('[data-brand]')).toHaveCount(0)
})

test('a valid account in another brand cannot log in here; Secure host cookies and session binding isolate both domains', async ({ page, context }) => {
  test.setTimeout(180_000)
  await page.goto(`${atlas}/app`)
  await page.getByLabel('Email', { exact: true }).fill('member@sur.example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toHaveCount(0)
  expect((await api(page, '/api/b2b/me')).status).toBe(401)
  await login(page, 'multi@b2b.example.test', atlas)
  const atlasMe = await identity(page)
  expect(atlasMe.memberships.map(membership => membership.organization.id)).toEqual(['atlas-demo'])
  const atlasCookie = (await context.cookies(atlas)).find(cookie => cookie.name.endsWith('.session_token'))!
  expect(atlasCookie).toBeDefined()
  expect(atlasCookie.secure).toBe(true)
  expect(atlasCookie.httpOnly).toBe(true)
  expect(atlasCookie.domain).toBe('atlas.b2b.test')
  await page.goto(`${sur}/app`)
  expect((await api(page, '/api/b2b/me')).status).toBe(401)
  await context.addCookies([{ ...atlasCookie, domain: 'sur.b2b.test' }])
  expect((await api(page, '/api/b2b/me')).status).toBe(401)
  await context.clearCookies({ domain: 'sur.b2b.test' })
  await login(page, 'multi@b2b.example.test', sur)
  const surMe = await identity(page)
  expect(surMe.memberships.map(membership => membership.organization.id)).toEqual(['sur-demo'])
  expect(surMe.user.id).toBe(atlasMe.user.id)
  await page.goto(`${atlas}/app`)
  expect((await identity(page)).memberships[0].organization.id).toBe('atlas-demo')
})

test('coach branch grants reject foreign branch IDs, other brand URLs and invalid work roles', async ({ page }) => {
  await login(page, 'coach@atlas.example.test', atlas, '/backoffice/')
  const me = await identity(page)
  const own = await api(page, '/api/b2b/orgs/atlas-demo/units', 'GET', undefined, headers(me.user.id, 'atlas-demo-principal', 'coach'))
  expect(own.status).toBe(200)
  const foreign = await api(page, '/api/b2b/orgs/atlas-demo/units', 'GET', undefined, headers(me.user.id, 'atlas-demo-norte', 'coach'))
  expect(foreign.status).toBe(403)
  const otherBrand = await api(page, '/api/b2b/orgs/sur-demo/units', 'GET', undefined, headers(me.user.id, 'sur-demo-principal', 'coach'))
  expect([403, 404]).toContain(otherBrand.status)
  const publicOther = await api(page, '/api/b2b/public/sur-demo')
  expect([403, 404]).toContain(publicOther.status)
  expect([400, 403]).toContain((await api(page, '/api/b2b/orgs/atlas-demo/units', 'GET', undefined, headers(me.user.id, 'atlas-demo-principal', 'admin'))).status)
})

test('multiple branch roles require an explicit choice and navigate to the selected workspace', async ({ page }) => {
  await login(page, 'multi@b2b.example.test')
  const selector = page.getByLabel('Sede y función', { exact: true })
  await expect(selector).toBeVisible()
  await expect(selector).toHaveValue('')
  await page.evaluate(() => Object.assign(window, { b2bDocumentMarker: 'shared-workspace' }))
  const contextRequests: string[] = []
  page.on('request', request => {
    if (/\/api\/b2b\/(?:me|context)$/.test(new URL(request.url()).pathname)) contextRequests.push(request.url())
  })
  await selector.selectOption('atlas-demo-principal:coach')
  await expect(page).toHaveURL(/\/manage$/)
  await expect(page.getByLabel('Sede y función', { exact: true })).toHaveValue('atlas-demo-principal:coach')
  await page.getByLabel('Sede y función', { exact: true }).selectOption('atlas-demo-norte:member')
  await expect(page).toHaveURL(/\/app/)
  await expect(page.getByLabel('Sede y función', { exact: true })).toHaveValue('atlas-demo-norte:member')
  expect(await page.evaluate(() => (window as Window & { b2bDocumentMarker?: string }).b2bDocumentMarker)).toBe('shared-workspace')
  expect(contextRequests).toEqual([])
  await page.getByRole('button', { name: 'Movimientos', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/catalog$/)
  await page.reload()
  await expect(page.getByLabel('Sede y función', { exact: true })).toHaveValue('atlas-demo-norte:member')
  await expect(page.getByRole('heading', { name: 'Conocé cada movimiento.' })).toBeVisible()
})

test('published identity is separate from theme drafts, website publication and immediate module permissions', async ({ page }) => {
  await login(page, 'admin@atlas.example.test', atlas, '/backoffice/')
  const me = await identity(page), access = headers(me.user.id)
  const original = (await api<{ theme: ThemeState }>(page, '/api/b2b/orgs/atlas-demo/theme', 'GET', undefined, access)).body.theme
  const changedTitle = 'Entrada de Atlas actualizada'
  const draft = await api<{ theme: ThemeState }>(page, '/api/b2b/orgs/atlas-demo/theme', 'PUT',
    { ...original.draft, loginTitle: changedTitle, expectedRevision: original.revision }, access)
  expect(draft.status).toBe(200)
  const before = (await api<BrandContext>(page, '/api/b2b/context')).body
  expect(before.theme.loginTitle).toBe(original.published.loginTitle)
  expect((await api(page, '/api/b2b/orgs/atlas-demo/theme/publish', 'POST', { expectedRevision: original.revision + 1 }, access)).status).toBe(201)
  expect((await api<BrandContext>(page, '/api/b2b/context')).body.theme.loginTitle).toBe(changedTitle)
  try {
    expect((await api(page, '/api/b2b/orgs/atlas-demo/modules/brand', 'PUT', { module: 'equipment', enabled: false }, access)).status).toBe(200)
    expect((await api(page, '/api/b2b/orgs/atlas-demo/units', 'POST', { machineId: 'base-cable-station-v1', label: 'No crear' }, access)).status).toBe(403)
    expect((await api(page, '/api/b2b/me')).status).toBe(200)
    expect((await api(page, '/api/b2b/orgs/atlas-demo/executions', 'GET', undefined, access)).status).toBe(200)
  } finally {
    await api(page, '/api/b2b/orgs/atlas-demo/modules/brand', 'PUT', { module: 'equipment', enabled: true }, access)
  }
})

test('members complete a real routine in all four branches without mixing the training history', async ({ page, context }, testInfo) => {
  test.setTimeout(180_000)
  for (const [origin, email, branch] of [
    [atlas, 'member@atlas.example.test', 'atlas-demo-principal'],
    [atlas, 'member-norte@atlas.example.test', 'atlas-demo-norte'],
    [sur, 'member@sur.example.test', 'sur-demo-principal'],
    [sur, 'member-oeste@sur.example.test', 'sur-demo-oeste'],
  ]) {
    await context.clearCookies()
    await login(page, email, origin)
    const me = await identity(page), organization = origin === atlas ? 'atlas-demo' : 'sur-demo'
    await page.getByRole('button', { name: 'Empezar sesión', exact: true }).first().click()
    for (const checkbox of await page.getByRole('checkbox', { name: 'Hecha', exact: true }).all()) await checkbox.check()
    await page.getByRole('button', { name: 'Completar sesión', exact: true }).click()
    await expect(page.getByText('Tu sesión quedó guardada.', { exact: true })).toBeVisible()
    const history = await api<{ executions: { branchId: string; memberId: string }[] }>(page, `/api/b2b/orgs/${organization}/executions`, 'GET', undefined, headers(me.user.id, branch, 'member'))
    expect(history.status).toBe(200)
    expect(history.body.executions.length).toBeGreaterThan(0)
    expect(history.body.executions.every(execution => execution.branchId === branch && execution.memberId === me.user.id)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`${branch}-history.png`), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('logout clears the authorized state in other tabs of the same brand', async ({ page, context }) => {
  await login(page, 'member@atlas.example.test')
  const second = await context.newPage()
  await second.goto(`${atlas}/app`)
  await expect(second.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await expect(second.getByLabel('Email', { exact: true })).toBeVisible()
  expect((await api(second, '/api/b2b/me')).status).toBe(401)
})
