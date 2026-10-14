const qaProtocol = process.env.QA_INTEGRATION_HTTP === '1' ? 'http' : 'https'
import { expect, test, type Page, type TestInfo } from './fixtures/integration-test'
import type {
  Unit,
  Website,
  Program,
  Member,
  Branch,
  ThemeState,
  Assignment,
} from '../../../packages/b2b-contracts/src/index.ts'

import { brandAdminSignIn } from './fixtures/brand-admin-sign-in'
import { brandAdminImage } from './fixtures/brand-admin-image'

const password = 'browser-tests-only-password-2026'
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const field = (page: Page, name: string) => page.getByLabel(name, { exact: true })
const card = (page: Page, name: string) =>
  page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
const endpoint = (brand: string, path: string) => `/api/b2b/orgs/${brand}-demo${path}`
async function api<T>(
  page: Page,
  brand: string,
  branch: string,
  path: string,
  method = 'GET',
  body?: unknown,
) {
  return page.evaluate(
    async ({ brand, branch, path, method, body }) => {
      const me = await (await fetch('/api/b2b/me')).json()
      const response = await fetch(`/api/b2b/orgs/${brand}-demo${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Klisteni-B2B-Account': me.user.id,
          'X-Klisteni-B2B-Branch': /^[0-9a-f]{8}-/.test(branch)
            ? branch
            : `${brand}-demo-${branch}`,
          'X-Klisteni-B2B-Role': 'admin',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      return { status: response.status, body: await response.json().catch(() => ({})) }
    },
    { brand, branch, path, method, body },
  ) as Promise<{ status: number; body: T }>
}
async function read<T>(page: Page, brand: string, branch: string, path: string) {
  const result = await api<T>(page, brand, branch, path)
  expect(result.status).toBe(200)
  return result.body
}
async function login(page: Page, brand = 'atlas', branch = 'principal') {
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto(`${qaProtocol}://${brand}.b2b.test/manage`)
  await brandAdminSignIn(page, `admin@${brand}.example.test`)
  await field(page, 'Sede y función').selectOption(`${brand}-demo-${branch}:admin`)
  await expect(field(page, 'Sede y función')).toHaveValue(`${brand}-demo-${branch}:admin`)
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true })
  const dimensions = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }))
  if (dimensions.document > dimensions.viewport) {
    const overflowing = await page.evaluate(() =>
      [...document.querySelectorAll('body *')].flatMap((element) => {
        const rect = element.getBoundingClientRect(),
          style = getComputedStyle(element)
        return rect.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1
          ? [
              {
                tag: element.tagName,
                className: element.className,
                right: rect.right,
                width: rect.width,
                scrollWidth: element.scrollWidth,
                minWidth: style.minWidth,
                maxWidth: style.maxWidth,
                overflowX: style.overflowX,
              },
            ]
          : []
      }),
    )
    await info.attach(`${name}-overflow.json`, {
      body: JSON.stringify({ dimensions, overflowing }, null, 2),
      contentType: 'application/json',
    })
  }
  expect(dimensions).toEqual({
    document: info.project.use.viewport!.width,
    viewport: info.project.use.viewport!.width,
  })
}

for (const [brand, branches] of [
  ['atlas', ['principal', 'norte']],
  ['sur', ['principal', 'oeste']],
] as const) {
  test(`${brand}: every administrator route in both branches renders, reloads and navigates back/forward`, async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(180_000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await login(page, brand)
    // The shell renders before the default section's lazy imports finish.
    // Navigating then cancels those imports in the document being unloaded.
    await expect(
      page.getByRole('heading', { name: 'Preparemos tu gimnasio.', exact: true }),
    ).toBeVisible()
    const headings: Record<string, string> = {
      whiteLabel: 'Una marca, varios espacios.',
      preparation: 'Preparemos tu gimnasio.',
      reports: 'Acompañar también es observar.',
      people: 'Personas antes que números.',
      programs: 'Planes con intención.',
      catalog: 'Una biblioteca que crece.',
      equipment: 'Conocé cada equipo.',
      media: 'Los recursos de tu gimnasio.',
      website: 'Tu gimnasio, también en la web.',
      qr: 'Un acceso en cada equipo.',
      brand: 'Un espacio con tu identidad.',
    }
    for (const branch of branches) {
      await field(page, 'Sede y función').selectOption(`${brand}-demo-${branch}:admin`)
      for (const route of [
        'whiteLabel',
        'preparation',
        'reports',
        'people',
        'programs',
        'catalog',
        'equipment',
        'media',
        'website',
        'qr',
        'brand',
      ]) {
        await page.goto(`${qaProtocol}://${brand}.b2b.test/manage/${route}`)
        await expect(button(page, 'Salir')).toBeVisible()
        await expect(
          page.getByRole('heading', { name: headings[route]!, exact: true }),
        ).toBeVisible()
        await expect(page.getByRole('alert')).toHaveCount(0)
        await capture(page, info, `${brand}-${branch}-${route}`)
      }
      await button(page, 'Personas').click()
      await expect(page.getByRole('heading', { name: headings.people!, exact: true })).toBeVisible()
      await button(page, 'Website').click()
      await expect(
        page.getByRole('heading', { name: headings.website!, exact: true }),
      ).toBeVisible()
      await page.goBack()
      await expect(page).toHaveURL(/\/manage\/people$/)
      await expect(page.getByRole('heading', { name: headings.people!, exact: true })).toBeVisible()
      await page.goForward()
      await expect(page).toHaveURL(/\/manage\/website$/)
      await expect(
        page.getByRole('heading', { name: headings.website!, exact: true }),
      ).toBeVisible()
      await page.reload()
      await expect(
        page.getByRole('heading', { name: headings.website!, exact: true }),
      ).toBeVisible()
      await expect(field(page, 'Sede y función')).toHaveValue(`${brand}-demo-${branch}:admin`)
    }
    expect(errors).toEqual([])
    await info.attach('browser-version', {
      body: `${browser.browserType().name()} ${browser.version()}`,
      contentType: 'text/plain',
    })
  })
}

test('people administer brand membership, protect the last admin and keep branch coaching scoped', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  await login(page)
  await button(page, 'Personas').click()
  await expect(page.getByText('Atlas Demo Administrador', { exact: true })).toBeVisible()
  const rolesFit = await page.locator('tbody select').evaluateAll((selects) =>
    selects.every((node) => {
      const select = node as HTMLSelectElement
      const style = getComputedStyle(select)
      const canvas = document.createElement('canvas').getContext('2d')!
      canvas.font = style.font
      const text = select.selectedOptions[0]?.textContent ?? ''
      return (
        select.getBoundingClientRect().width >=
        canvas.measureText(text).width +
          parseFloat(style.paddingLeft) +
          parseFloat(style.paddingRight) +
          24
      )
    }),
  )
  expect(rolesFit).toBe(true)
  await expect(
    page.locator('tr').filter({ hasText: 'member-norte@atlas.example.test' }),
  ).toContainText('atlas norte coach')
  const self = page.locator('tr').filter({ hasText: 'admin@atlas.example.test' })
  await self.getByRole('button', { name: /Pausar acceso/ }).click()
  await expect(page.getByRole('alert')).toContainText('administrador activo')
  await expect(self).toContainText('Activo')
  // Admin can see brand members from Norte, but assignment choices stay in Centro.
  await expect(page.getByText('member-norte@atlas.example.test', { exact: true })).toBeVisible()
  await expect(
    field(page, 'Socio').locator('option').filter({ hasText: 'atlas norte member' }),
  ).toHaveCount(0)
  const row = page.locator('tr').filter({ hasText: 'multi@b2b.example.test' })
  const before = await read<{ members: Member[] }>(page, 'atlas', 'principal', '/members')
  expect(before.members.find((member) => member.email === 'multi@b2b.example.test')?.role).toBe(
    'coach',
  )
  await row.getByRole('combobox').selectOption('admin')
  await expect(row.getByRole('combobox')).toHaveValue('admin')
  await page.reload()
  await expect(row.getByRole('combobox')).toHaveValue('admin')
  await row.getByRole('combobox').selectOption('member')
  await expect(row.getByRole('combobox')).toHaveValue('member')
  await row.getByRole('button', { name: /Pausar acceso/ }).click()
  await expect(row).toContainText('Pausado')
  await row.getByRole('button', { name: /Habilitar acceso/ }).click()
  await expect(row).toContainText('Activo')
  // A real assignment is persisted to the selected branch.
  await field(page, 'Socio').selectOption({ label: 'Atlas Demo Socio' })
  await field(page, 'Entrenador').selectOption({ label: 'Atlas Demo Instructor' })
  await button(page, 'Asignar entrenador').click()
  await expect(page.getByRole('status').filter({ hasText: 'Profesional asignado' })).toBeVisible()
  await field(page, 'Buscar persona').fill('Nobody in synthetic data')
  await expect(page.locator('tbody tr')).toHaveCount(0)
  await field(page, 'Buscar persona').fill('')
  await capture(page, info, 'people-brand-and-scoped-coaching')
})

test('branch validation, duplicate slug, grant and removal, archive guard and empty branch', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  await login(page)
  await button(page, 'Marca y sedes').click()
  const create = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Crear sede', exact: true }) })
  await create.getByRole('button', { name: 'Crear sede', exact: true }).click()
  expect(await create.evaluate((form) => (form as HTMLFormElement).checkValidity())).toBe(false)
  await create.getByLabel('Nombre de sede', { exact: true }).fill(`Vacía ${info.project.name}`)
  await create
    .getByLabel('Dirección del enlace', { exact: true })
    .fill(`empty-${info.project.name}`)
  await create.getByLabel('Zona horaria', { exact: true }).fill('Invalid/Timezone')
  await button(page, 'Crear sede').click()
  await expect(page.getByRole('alert')).toBeVisible()
  await create.getByLabel('Zona horaria', { exact: true }).fill('UTC')
  await button(page, 'Crear sede').click()
  await expect(
    page.getByRole('heading', { name: `Vacía ${info.project.name}`, exact: true }),
  ).toBeVisible()
  const branches = (await read<{ branches: Branch[] }>(page, 'atlas', 'principal', '/branches'))
    .branches
  const branch = branches.find((item) => item.slug === `empty-${info.project.name}`)!
  expect(branch.timezone).toBe('UTC')
  await create.getByLabel('Nombre de sede', { exact: true }).fill('Duplicada')
  await create
    .getByLabel('Dirección del enlace', { exact: true })
    .fill(`empty-${info.project.name}`)
  await button(page, 'Crear sede').click()
  await expect(page.getByRole('alert')).toContainText('Ya existe una sede')
  expect(
    (await read<{ branches: Branch[] }>(page, 'atlas', 'principal', '/branches')).branches.filter(
      (item) => item.slug === branch.slug,
    ),
  ).toHaveLength(1)
  await field(page, 'Persona').selectOption({ label: 'Atlas Demo Socio' })
  await field(page, 'Sede').selectOption(branch.id)
  await field(page, 'Función').selectOption('member')
  await button(page, 'Conceder acceso').click()
  const grant = page
    .getByText(`Atlas Demo Socio · ${branch.name} · Socio`, { exact: true })
    .locator('..')
  await expect(grant).toBeVisible()
  await grant.getByRole('button', { name: 'Retirar acceso', exact: true }).click()
  await expect(grant).toHaveCount(0)
  const centro = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Centro', exact: true }) })
  await centro.getByLabel('Estado', { exact: true }).selectOption('archived')
  await centro.getByRole('button', { name: 'Guardar sede', exact: true }).click()
  await expect(centro.getByRole('alert')).toContainText('asignaciones activas')
  await centro.getByLabel('Estado', { exact: true }).selectOption('active')
  await field(page, 'Sede y función').selectOption(`${branch.id}:admin`)
  await button(page, 'Equipamiento').click()
  await expect(page.getByText('Hagamos un mapa del gimnasio', { exact: false })).toBeVisible()
  await button(page, 'Rutinas').click()
  await expect(button(page, '+ Crear rutina')).toBeVisible()
  expect(
    (await read<{ programs: Program[] }>(page, 'atlas', branch.id, '/programs')).programs,
  ).toEqual([])
  await capture(page, info, 'empty-branch')
})

test('unit batch recovers after response loss and double submit without duplicate records; cancellation keeps draft', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  await login(page)
  await button(page, 'Equipamiento').click()
  await button(page, '+ Registrar equipo').click()
  await field(page, 'Modelo de máquina').selectOption('base-cable-station-v1')
  await field(page, 'Nombre de esta unidad').fill(`Recuperable ${info.project.name}`)
  await field(page, 'Cantidad de unidades').fill('2')
  await field(page, 'Número inicial').fill('7')
  await field(page, 'Ubicación').fill('Sala ficticia')
  await button(page, 'Cerrar formulario').click()
  await button(page, '+ Registrar equipo').click()
  await button(page, 'Recuperar borrador local').click()
  await expect(field(page, 'Cantidad de unidades')).toHaveValue('2')
  let writes = 0
  await page.route(`**${endpoint('atlas', '/units/batch')}`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    writes++
    await route.fetch() // Commit really reaches PostgreSQL, response is deliberately lost.
    await route.abort('failed')
  })
  await button(page, 'Registrar 2 equipos').evaluate((element) => {
    ;(element as HTMLButtonElement).click()
    ;(element as HTMLButtonElement).click()
  })
  await expect(page.getByRole('alert')).toBeVisible()
  expect(writes).toBe(1)
  await page.unrouteAll({ behavior: 'wait' })
  await page.reload()
  await expect(button(page, 'Confirmar alta pendiente')).toBeVisible()
  await button(page, 'Confirmar alta pendiente').click()
  await expect(page.getByRole('status').filter({ hasText: '2 equipos guardados' })).toBeVisible()
  const units = (await read<{ units: Unit[] }>(page, 'atlas', 'principal', '/units')).units.filter(
    (unit) => unit.label.startsWith(`Recuperable ${info.project.name}`),
  )
  expect(units.map((unit) => unit.label).sort()).toEqual([
    `Recuperable ${info.project.name} 07`,
    `Recuperable ${info.project.name} 08`,
  ])
  await capture(page, info, 'recovered-unit-batch')
})

test('unit concurrency is recoverable, requires review, publishes correct QR and archive/restores', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  await login(page)
  const initial = (await read<{ units: Unit[] }>(page, 'atlas', 'principal', '/units')).units.find(
    (unit) => unit.id === 'atlas-demo-cable-01',
  )!
  await button(page, 'Equipamiento').click()
  await card(page, initial.label)
    .getByRole('button', { name: 'Editar equipo', exact: true })
    .click()
  await field(page, 'Ajustes y particularidades de esta unidad').fill(`Local ${info.project.name}`)
  expect(
    (
      await api(page, 'atlas', 'principal', `/units/${initial.id}`, 'PUT', {
        ...initial,
        adjustments: 'Edición concurrente QA',
        expectedRevision: initial.revision,
        id: undefined,
        organizationId: undefined,
        branchId: undefined,
        revision: undefined,
        publicPath: undefined,
      })
    ).status,
  ).toBe(200)
  if (initial.public)
    await field(
      page,
      'Revisé el nombre, la ubicación, los ajustes y los recursos de estas unidades.',
    ).check()
  await button(page, 'Guardar equipo').click()
  await expect(page.getByText('Edición concurrente QA', { exact: true })).toBeVisible()
  await expect(button(page, 'Guardar equipo')).toBeDisabled()
  await capture(page, info, 'unit-conflict')
  await button(page, 'Descartar mis cambios y cargar versión actual').click()
  await expect(field(page, 'Ajustes y particularidades de esta unidad')).toHaveValue(
    'Edición concurrente QA',
  )
  await field(page, 'Mostrar ficha y recursos en la web pública del gimnasio').check()
  await field(
    page,
    'Revisé el nombre, la ubicación, los ajustes y los recursos de estas unidades.',
  ).check()
  await button(page, 'Guardar equipo').click()
  await expect(card(page, initial.label)).toContainText('FICHA PÚBLICA')
  await button(page, 'Etiquetas QR').click()
  await page
    .getByRole('checkbox', { name: `${initial.label} ${initial.location}`, exact: true })
    .check()
  await expect(page.locator('.qr-label img')).toBeVisible()
  await expect(page.locator('.qr-absolute-url')).toHaveAttribute(
    'href',
    `${qaProtocol}://atlas.b2b.test${initial.publicPath}`,
  )
  await capture(page, info, 'qr-label')
  await page.locator('.qr-absolute-url').click()
  await expect(page.getByRole('heading', { name: initial.label, exact: true })).toBeVisible()
  await page.goBack()
  await button(page, 'Equipamiento').click()
  await card(page, initial.label)
    .getByRole('button', { name: 'Retirar equipo', exact: true })
    .click()
  await expect(card(page, initial.label)).toContainText('RETIRADO')
  await card(page, initial.label)
    .getByRole('button', { name: 'Restaurar equipo', exact: true })
    .click()
  await expect(card(page, initial.label)).toContainText('FICHA PÚBLICA')
})

test('theme draft survives navigation and concurrent publication, then requires explicit comparison', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  await login(page)
  await button(page, 'Marca y sedes').click()
  await button(page, 'Diseño publicado').click()
  const original = (await read<{ theme: ThemeState }>(page, 'atlas', 'principal', '/theme')).theme
  await field(page, 'Título de bienvenida').fill(`Tema local ${info.project.name}`)
  await button(page, 'Personas').click()
  await button(page, 'Marca y sedes').click()
  await button(page, 'Diseño publicado').click()
  await button(page, 'Recuperar borrador local').click()
  await expect(field(page, 'Título de bienvenida')).toHaveValue(`Tema local ${info.project.name}`)
  expect(
    (
      await api(page, 'atlas', 'principal', '/theme', 'PUT', {
        ...original.draft,
        loginTitle: 'Cambio concurrente QA',
        expectedRevision: original.revision,
      })
    ).status,
  ).toBe(200)
  await button(page, 'Guardar borrador').click()
  await expect(page.getByText('Cambio concurrente QA', { exact: true })).toBeVisible()
  await expect(button(page, 'Publicar diseño')).toBeDisabled()
  await expect(field(page, 'Título de bienvenida')).toHaveValue(`Tema local ${info.project.name}`)
  await capture(page, info, 'theme-conflict')
  await field(
    page,
    'Revisé la versión actual. Al guardar mis cambios reemplazaré este borrador del gimnasio.',
  ).check()
  await button(page, 'Continuar con mis cambios').click()
  await button(page, 'Guardar borrador').click()
  await expect
    .poll(
      async () =>
        (await read<{ theme: ThemeState }>(page, 'atlas', 'principal', '/theme')).theme.draft
          .loginTitle,
    )
    .toBe(`Tema local ${info.project.name}`)
  expect(
    await page.evaluate(
      async () => (await (await fetch('/api/b2b/context')).json()).theme.loginTitle,
    ),
  ).toBe(original.published.loginTitle)
  await button(page, 'Publicar diseño').click()
  await expect
    .poll(
      async () =>
        await page.evaluate(
          async () => (await (await fetch('/api/b2b/context')).json()).theme.loginTitle,
        ),
    )
    .toBe(`Tema local ${info.project.name}`)
  await field(page, 'Volver a una versión publicada').selectOption(
    String(original.publishedVersion),
  )
  await button(page, 'Restaurar diseño').click()
  await expect
    .poll(
      async () =>
        await page.evaluate(
          async () => (await (await fetch('/api/b2b/context')).json()).theme.loginTitle,
        ),
    )
    .toBe(original.published.loginTitle)
})

test('website validation, reload, concurrency, review/publication and withdrawal preserve pending edits', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  await login(page, 'sur', 'oeste')
  await button(page, 'Website').click()
  const before = (await read<{ website: Website }>(page, 'sur', 'oeste', '/website')).website
  await field(page, 'Título del website').fill(`Website QA ${info.project.name}`)
  await button(page, '+ Agregar actividad').click()
  await button(page, 'Guardar borrador del website').click()
  expect(
    await page.locator('form').evaluate((form) => (form as HTMLFormElement).checkValidity()),
  ).toBe(false)
  await field(page, `Nombre de actividad ${before.draft.activities.length + 1}`).fill(
    'Actividad ficticia',
  )
  await page.reload()
  await button(page, 'Recuperar mi copia local').click()
  await expect(field(page, 'Título del website')).toHaveValue(`Website QA ${info.project.name}`)
  expect(
    (
      await api(page, 'sur', 'oeste', '/website', 'PUT', {
        ...before.draft,
        headline: 'Website concurrente',
        expectedRevision: before.revision,
      })
    ).status,
  ).toBe(200)
  await button(page, 'Guardar borrador del website').click()
  await button(page, 'Conservar copia y cargar versión actual').click()
  await button(page, 'Recuperar mi copia local').click()
  await expect(
    page.getByRole('region', { name: 'Comparar copia local del website', exact: true }),
  ).toBeVisible()
  await field(
    page,
    'Comparé la versión actual con mi copia local y quiero conservar mis cambios.',
  ).check()
  await button(page, 'Continuar con mi copia revisada').click()
  await button(page, 'Guardar borrador del website').click()
  await expect(button(page, 'Revisar website')).toBeEnabled()
  await button(page, 'Revisar website').click()
  await expect(button(page, 'Publicar website')).toBeDisabled()
  await field(page, 'Revisé los textos, horarios y fotos de esta versión.').check()
  await button(page, 'Publicar website').click()
  await expect(page.getByRole('status').filter({ hasText: 'Website publicado' })).toBeVisible()
  const published = await page.context().newPage()
  await published.goto(`${qaProtocol}://sur.b2b.test/sedes/oeste`)
  await expect(
    published.getByRole('heading', { name: `Website QA ${info.project.name}`, exact: true }),
  ).toBeVisible()
  await capture(published, info, 'sur-oeste-published-website')
  await field(page, 'Título del website').fill('Cambio aún sin guardar al retirar')
  await page
    .locator('summary')
    .filter({ hasText: /^Despublicar website$/ })
    .click()
  await button(page, 'Confirmar despublicación').click()
  await expect(page.getByRole('status').filter({ hasText: 'Website despublicado' })).toBeVisible()
  await expect(field(page, 'Título del website')).toHaveValue('Cambio aún sin guardar al retirar')
  await published.reload()
  await expect(
    published.getByRole('heading', { name: `Website QA ${info.project.name}`, exact: true }),
  ).toHaveCount(0)
  await page.reload()
  await button(page, 'Recuperar mi copia local').click()
  await expect(field(page, 'Título del website')).toHaveValue('Cambio aún sin guardar al retirar')
  expect(
    (await read<{ website: Website }>(page, 'sur', 'oeste', '/website')).website.draft.headline,
  ).toBe(`Website QA ${info.project.name}`)
  await published.close()
})

test('library validates file formats, renders uploaded image, retries failed load and isolates branches/brands', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  await login(page)
  await button(page, 'Archivos').click()
  await expect(
    page.getByText('La biblioteca está lista para tus archivos', { exact: true }),
  ).toBeVisible()
  const upload = field(page, 'Archivo del gimnasio')
  for (const [name, mimeType, buffer, error] of [
    ['bad.svg', 'image/svg+xml', Buffer.from('<svg/>'), 'Elegí un archivo del tipo indicado.'],
    ['empty.png', 'image/png', Buffer.alloc(0), 'El archivo debe tener contenido'],
    ['spoof.png', 'image/png', Buffer.from('<html>not PNG</html>'), ''],
  ] as const) {
    await upload.setInputFiles({ name, mimeType, buffer })
    await button(page, 'Subir a la biblioteca').click()
    await expect(page.getByRole('alert')).toBeVisible()
    if (error) await expect(page.getByRole('alert')).toContainText(error)
  }
  const png = brandAdminImage()
  await upload.setInputFiles({
    name: `qa-${info.project.name}.png`,
    mimeType: 'image/png',
    buffer: png,
  })
  await field(page, 'Nombre del archivo').fill(`Foto ficticia ${info.project.name}`)
  await button(page, 'Subir a la biblioteca').click()
  await expect(
    page.getByText('Archivo guardado en la biblioteca del gimnasio.', { exact: true }),
  ).toBeVisible()
  const image = page.getByRole('img', { name: `Foto ficticia ${info.project.name}`, exact: true })
  await expect(image).toBeVisible()
  await image.scrollIntoViewIfNeeded()
  await expect
    .poll(async () => await image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
    .toBe(1)
  const media = (
    await read<{ media: { id: string; sha256: string; bytes: number; branchId?: string }[] }>(
      page,
      'atlas',
      'principal',
      '/media',
    )
  ).media.find((item) => item.bytes === png.length)!
  expect(media.sha256).toHaveLength(64)
  await capture(page, info, 'uploaded-library-photo')
  await field(page, 'Buscar en la biblioteca de archivos').fill('No results')
  await expect(
    page.getByText('La biblioteca está lista para tus archivos', { exact: true }),
  ).toBeVisible()
  await field(page, 'Sede y función').selectOption('atlas-demo-norte:admin')
  await button(page, 'Archivos').click()
  await expect(
    page.getByRole('img', { name: `Foto ficticia ${info.project.name}`, exact: true }),
  ).toHaveCount(0)
  await page.route(`**${endpoint('atlas', '/media')}`, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'QA_FAILURE', error: 'Falla transitoria de prueba' }),
    }),
  )
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Falla transitoria')
  await page.unrouteAll({ behavior: 'wait' })
  await button(page, 'Reintentar biblioteca').click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.context().clearCookies()
  await login(page, 'sur')
  expect((await read<{ media: unknown[] }>(page, 'sur', 'principal', '/media')).media).toEqual([])
  expect(
    await page.evaluate(async (id) => (await fetch(`/api/b2b/media/${id}`)).status, media.id),
  ).toBe(404)
})

for (const [brand, branch] of [
  ['atlas', 'principal'],
  ['atlas', 'norte'],
  ['sur', 'principal'],
  ['sur', 'oeste'],
]) {
  test(`${brand}/${branch}: administrator authors, publishes and assigns a version without crossing branch recipients`, async ({
    page,
  }, info) => {
    test.setTimeout(180_000)
    await login(page, brand, branch)
    await button(page, 'Rutinas').click()
    await button(page, '+ Crear rutina').click()
    const name = `Programa ${brand} ${branch} ${info.project.name}`
    await field(page, 'Nombre de la rutina').fill(name)
    await expect(button(page, 'Guardar borrador de rutina')).toBeDisabled()
    await field(page, 'Ejercicio para agregar').selectOption('dead-bug')
    await button(page, '+ Agregar movimiento').click()
    await field(page, 'Tipo de objetivo · movimiento 1').selectOption('duration')
    await field(page, 'Series · movimiento 1').fill('2')
    await field(page, 'Duración segundos · movimiento 1').fill('30')
    await field(page, 'Esfuerzo objetivo RPE · movimiento 1').fill('6.5')
    await page.reload()
    await button(page, '+ Crear rutina').click()
    await button(page, 'Recuperar borrador local').click()
    await expect(field(page, 'Duración segundos · movimiento 1')).toHaveValue('30')
    await button(page, 'Guardar borrador de rutina').click()
    await expect(page.getByRole('status').filter({ hasText: 'Borrador guardado' })).toBeVisible()
    await button(page, 'Volver a rutinas').click()
    await card(page, name).getByRole('button', { name: 'Publicar versión', exact: true }).click()
    await expect(card(page, name)).toContainText('V1')
    await card(page, name).getByRole('button', { name: 'Asignar a socio', exact: true }).click()
    const recipient =
      branch === 'principal'
        ? `member@${brand}.example.test`
        : `member-${branch}@${brand}.example.test`
    const picker = field(page, 'Socio destinatario')
    await expect(picker.locator('option').filter({ hasText: recipient })).toHaveCount(1)
    const options = await picker.locator('option').allTextContents()
    expect(options.some((option) => option.includes(recipient))).toBe(true)
    expect(
      options.some((option) =>
        option.includes(brand === 'atlas' ? '@sur.example.test' : '@atlas.example.test'),
      ),
    ).toBe(false)
    const value = await picker
      .locator('option')
      .filter({ hasText: recipient })
      .getAttribute('value')
    await picker.selectOption(value!)
    await button(page, 'Confirmar asignación').click()
    await expect(page.getByRole('status').filter({ hasText: 'Rutina asignada' })).toBeVisible()
    const program = (
      await read<{ programs: Program[] }>(page, brand, branch, '/programs')
    ).programs.find((program) => program.name === name)!
    const assignments = await read<{ assignments: Assignment[] }>(
      page,
      brand,
      branch,
      '/assignments',
    )
    expect(
      assignments.assignments.find((item) => item.program.programId === program.id)?.program
        .version,
    ).toBe(1)
    await card(page, name).getByRole('button', { name: 'Editar borrador', exact: true }).click()
    await field(page, 'Duración segundos · movimiento 1').fill('60')
    await button(page, 'Guardar borrador de rutina').click()
    await button(page, 'Volver a rutinas').click()
    await card(page, name).getByRole('button', { name: 'Publicar versión', exact: true }).click()
    await expect(card(page, name)).toContainText('V2')
    expect(
      (await read<typeof assignments>(page, brand, branch, '/assignments')).assignments.find(
        (item) => item.program.programId === program.id,
      )?.program.version,
    ).toBe(1)
    await capture(page, info, `${brand}-${branch}-admin-prescription`)
  })
}

test('modules deny direct routes, stay branch scoped, retain data and recover after reenabling', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  await login(page)
  const before = await read<{ units: Unit[] }>(page, 'atlas', 'principal', '/units')
  await button(page, 'Marca y sedes').click()
  await button(page, 'Módulos').click()
  const equipment = page.getByText('Equipamiento y QR', { exact: true }).locator('..')
  await equipment.getByRole('checkbox', { name: 'Sede actual', exact: true }).click()
  await expect(button(page, 'Equipamiento')).toHaveCount(0)
  await page.goto('/manage/equipment')
  await expect(page.getByText(/Esta función está deshabilitada/)).toBeVisible()
  expect(
    (
      await api(page, 'atlas', 'principal', '/units', 'POST', {
        machineId: 'base-cable-station-v1',
        label: 'No debe persistir',
      })
    ).status,
  ).toBe(403)
  await field(page, 'Sede y función').selectOption('atlas-demo-norte:admin')
  await expect(button(page, 'Equipamiento')).toBeVisible()
  await field(page, 'Sede y función').selectOption('atlas-demo-principal:admin')
  await button(page, 'Marca y sedes').click()
  await button(page, 'Módulos').click()
  await equipment.getByRole('checkbox', { name: 'Sede actual', exact: true }).click()
  await expect(button(page, 'Equipamiento')).toBeVisible()
  expect((await read<{ units: Unit[] }>(page, 'atlas', 'principal', '/units')).units).toEqual(
    before.units,
  )
  const website = page.getByText('Website público', { exact: true }).locator('..')
  await website.getByRole('checkbox', { name: 'Marca', exact: true }).click()
  await expect(button(page, 'Website')).toHaveCount(0)
  await field(page, 'Sede y función').selectOption('atlas-demo-norte:admin')
  await expect(button(page, 'Website')).toHaveCount(0)
  await button(page, 'Marca y sedes').click()
  await button(page, 'Módulos').click()
  await website.getByRole('checkbox', { name: 'Marca', exact: true }).click()
  await expect(button(page, 'Website')).toBeVisible()
  await capture(page, info, 'module-controls')
})

test('catalog availability, assignment retirement and equipment transfer use the chosen branch', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  await login(page, 'sur')
  const seedAssignment = (
    await read<{ assignments: Assignment[] }>(page, 'sur', 'principal', '/assignments')
  ).assignments.find((item) => item.id === 'sur-demo-assignment')!
  expect(
    (
      await api(page, 'sur', 'principal', '/assignments', 'POST', {
        memberId: seedAssignment.memberId,
        programId: seedAssignment.program.programId,
        version: seedAssignment.program.version,
      })
    ).status,
  ).toBe(201)
  await button(page, 'Marca y sedes').click()
  await button(page, 'Catálogo y traslados').click()
  const exercise = page
    .locator('.row')
    .filter({ has: page.getByText('Dead bug alternado · Ejercicio', { exact: true }) })
  await expect(exercise).toBeVisible()
  await exercise.getByRole('button', { name: 'Ocultar aquí', exact: true }).click()
  await expect(page.getByText('Ejercicio oculto', { exact: true })).toBeVisible()
  await page
    .getByText('Ejercicio oculto', { exact: true })
    .locator('..')
    .getByRole('button', { name: 'Volver a habilitar', exact: true })
    .click()
  await expect(page.getByText('Ejercicio oculto', { exact: true })).toHaveCount(0)
  await field(page, 'Sede de destino').selectOption('sur-demo-oeste')
  const unitsBefore = (await read<{ units: Unit[] }>(page, 'sur', 'principal', '/units')).units
  const unit = unitsBefore.find((item) => item.id === 'sur-demo-cable-01')!
  const transfer = page
    .getByText(unit.label, { exact: true })
    .locator('..')
    .getByRole('button', { name: 'Trasladar', exact: true })
  await transfer.click()
  await expect(page.getByRole('alert')).toContainText('asignaciones')
  const finish = button(page, 'Finalizar asignación')
  while (await finish.count()) {
    const before = await finish.count()
    await finish.first().click()
    await expect(finish).toHaveCount(before - 1)
  }
  await transfer.click()
  await expect(page.getByRole('status').filter({ hasText: 'Unidad trasladada' })).toBeVisible()
  expect(
    (await read<{ units: Unit[] }>(page, 'sur', 'principal', '/units')).units.some(
      (item) => item.id === unit.id,
    ),
  ).toBe(false)
  await field(page, 'Sede y función').selectOption('sur-demo-oeste:admin')
  await button(page, 'Equipamiento').click()
  const moved = (await read<{ units: Unit[] }>(page, 'sur', 'oeste', '/units')).units.find(
    (item) => item.id === unit.id,
  )!
  expect(moved.branchId).toBe('sur-demo-oeste')
  expect(moved.public).toBe(false)
  await expect(card(page, moved.label).filter({ hasText: 'USO INTERNO' })).toBeVisible()
  await capture(page, info, 'transferred-equipment')
})

test('expired session rejects an editor write, retains draft for same account and never offers it to another account', async ({
  page,
  context,
}, info) => {
  await login(page)
  await button(page, 'Rutinas').click()
  await button(page, '+ Crear rutina').click()
  const name = `Sesión expirada ${info.project.name}`
  await field(page, 'Nombre de la rutina').fill(name)
  await field(page, 'Ejercicio para agregar').selectOption('dead-bug')
  await button(page, '+ Agregar movimiento').click()
  await context.clearCookies()
  await button(page, 'Guardar borrador de rutina').click()
  await expect(field(page, 'Email')).toBeVisible()
  await brandAdminSignIn(page)
  await field(page, 'Sede y función').selectOption('atlas-demo-principal:admin')
  await button(page, 'Rutinas').click()
  await button(page, '+ Crear rutina').click()
  await button(page, 'Recuperar borrador local').click()
  await expect(field(page, 'Nombre de la rutina')).toHaveValue(name)
  await field(page, 'Sede y función').selectOption('atlas-demo-norte:admin')
  await button(page, 'Rutinas').click()
  await button(page, '+ Crear rutina').click()
  await expect(field(page, 'Nombre de la rutina')).toHaveValue('')
  await expect(button(page, 'Recuperar borrador local')).toHaveCount(0)
  await button(page, 'Salir').click()
  await brandAdminSignIn(page, 'coach@atlas.example.test')
  await button(page, 'Rutinas').click()
  await button(page, '+ Crear rutina').click()
  await expect(field(page, 'Nombre de la rutina')).toHaveValue('')
  await expect(button(page, 'Recuperar borrador local')).toHaveCount(0)
  await capture(page, info, 'isolated-account-editor')
})

test('logout propagates to open tabs; another brand cannot reuse the admin session or operate foreign IDs', async ({
  page,
  context,
}, info) => {
  await login(page)
  const other = await context.newPage()
  await other.goto(`${qaProtocol}://atlas.b2b.test/manage/people`)
  await expect(button(other, 'Salir')).toBeVisible()
  const surPage = await context.newPage()
  await surPage.goto(`${qaProtocol}://sur.b2b.test/manage`)
  await expect(field(surPage, 'Email')).toBeVisible()
  expect([403, 404]).toContain((await api(page, 'sur', 'principal', '/branches')).status)
  await brandAdminSignIn(surPage, 'admin@sur.example.test')
  const before = [
    ...(await read<{ units: Unit[] }>(surPage, 'sur', 'principal', '/units')).units,
    ...(await read<{ units: Unit[] }>(surPage, 'sur', 'oeste', '/units')).units,
  ]
  const rejected = await api<{ code: string }>(
    page,
    'atlas',
    'principal',
    '/units/sur-demo-cable-01',
    'PUT',
    {
      machineId: 'base-cable-station-v1',
      label: 'Foreign',
      expectedRevision: 0,
    },
  )
  expect(rejected.status).toBe(409)
  expect(rejected.body.code).toBe('REVISION_CONFLICT')
  expect([
    ...(await read<{ units: Unit[] }>(surPage, 'sur', 'principal', '/units')).units,
    ...(await read<{ units: Unit[] }>(surPage, 'sur', 'oeste', '/units')).units,
  ]).toEqual(before)
  await button(page, 'Salir').click()
  await expect(field(other, 'Email')).toBeVisible()
  await expect(button(surPage, 'Salir')).toBeVisible()
  await other.reload()
  await expect(field(other, 'Email')).toBeVisible()
  await capture(other, info, 'signed-out-second-tab')
  await other.close()
  await surPage.close()
})

test('invitations validate inputs, activate synthetic member and grant only the originating branch', async ({
  page,
  context,
}, info) => {
  await login(page, 'sur', 'oeste')
  await button(page, 'Personas').click()
  await button(page, '+ Invitar persona').click()
  await button(page, 'Crear invitación').click()
  expect(
    await field(page, 'Email de la persona').evaluate(
      (node) => (node as HTMLInputElement).validity.valid,
    ),
  ).toBe(false)
  const email = `invited-${info.project.name}@sur.example.test`
  await field(page, 'Nombre de la persona').fill('Invitada sintética')
  await field(page, 'Email de la persona').fill(email)
  await field(page, 'Rol en el gimnasio').selectOption('member')
  await button(page, 'Crear invitación').click()
  await expect(page.getByRole('status').filter({ hasText: 'Invitación creada' })).toBeVisible()
  const url = await page.locator('a.code-link').getAttribute('href')
  expect(new URL(url!).origin).toBe(`${qaProtocol}://sur.b2b.test`)
  // Never attach an activation URL screenshot; the generated token is confined to this disposable DB.
  const invited = await context.newPage()
  await invited.goto(url!)
  await field(invited, 'Tu nombre').fill('Invitada sintética')
  await field(invited, 'Nueva contraseña').fill(password)
  await button(invited, 'Activar mi cuenta').click()
  await expect(invited.getByText('Tu cuenta está lista.', { exact: false })).toBeVisible()
  expect(new URL(invited.url()).hash).toBe('')
  const roster = await read<{ members: Member[] }>(page, 'sur', 'oeste', '/members')
  expect(roster.members.find((member) => member.email === email)?.role).toBe('member')
  expect(
    (await read<{ members: Member[] }>(page, 'sur', 'principal', '/members')).members.some(
      (member) => member.email === email,
    ),
  ).toBe(false)
  await invited.goto(url!)
  await field(invited, 'Tu nombre').fill('Invitada sintética')
  await field(invited, 'Nueva contraseña').fill(password)
  await button(invited, 'Activar mi cuenta').click()
  await expect(invited.getByRole('alert')).toBeVisible()
  await invited.close()
  await button(page, 'Cerrar invitación').click()
  await capture(page, info, 'invited-person-in-brand-roster')
})

test('exercise editor validates, recovers a draft and requires review before publication without new models', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  await login(page, 'atlas', 'norte')
  await button(page, 'Ejercicios').click()
  await field(page, 'Buscar ejercicio').fill('Sin coincidencias QA')
  await expect(page.locator('article')).toHaveCount(0)
  await field(page, 'Buscar ejercicio').fill('')
  await button(page, '+ Crear ejercicio').click()
  const name = `Guía ficticia ${info.project.name}`
  await field(page, 'Nombre del ejercicio').fill(name)
  await button(page, 'Guardar borrador').click()
  expect(
    await field(page, 'Instrucciones paso a paso').evaluate(
      (node) => (node as HTMLTextAreaElement).validity.valid,
    ),
  ).toBe(false)
  await field(page, 'Instrucciones paso a paso').fill(
    'Instrucción ficticia uno.\nInstrucción ficticia dos.',
  )
  await page.reload()
  await button(page, '+ Crear ejercicio').click()
  await button(page, 'Recuperar borrador local').click()
  await expect(field(page, 'Nombre del ejercicio')).toHaveValue(name)
  await button(page, 'Guardar borrador').click()
  await expect(page.getByRole('status').filter({ hasText: 'Borrador guardado' })).toBeVisible()
  await button(page, 'Volver al catálogo').click()
  await card(page, name).getByRole('button', { name: 'Revisar contenido', exact: true }).click()
  await expect(button(page, 'Confirmar revisión del ejercicio')).toBeDisabled()
  await field(
    page,
    'Revisé las instrucciones, el equipo compatible y los recursos de este ejercicio.',
  ).check()
  await button(page, 'Confirmar revisión del ejercicio').click()
  await button(page, 'Publicar ejercicio revisado').click()
  await expect(card(page, name)).toContainText('PUBLICADO')
  await capture(page, info, 'published-text-exercise')
  await card(page, name).getByRole('button', { name: 'Editar', exact: true }).click()
  await field(page, 'Descripción').fill('Esta edición debe volver a borrador')
  await button(page, 'Guardar borrador').click()
  await button(page, 'Volver al catálogo').click()
  await expect(card(page, name)).toContainText('BORRADOR')
})

test('brand image upload is private until publishing and contrast validation preserves the existing public theme', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  await login(page)
  await button(page, 'Marca y sedes').click()
  await button(page, 'Diseño publicado').click()
  const original = (await read<{ theme: ThemeState }>(page, 'atlas', 'principal', '/theme')).theme
  await field(page, 'Nombre de marca').fill('')
  await button(page, 'Guardar borrador').click()
  await expect(page.getByRole('alert')).toBeVisible()
  await field(page, 'Nombre de marca').fill(original.draft.brand.name)
  await field(page, 'Texto').fill(original.draft.palette.background)
  await button(page, 'Guardar borrador').click()
  await expect(page.getByRole('alert')).toContainText('contraste')
  await field(page, 'Texto').fill(original.draft.palette.text)
  await field(page, 'Subir logo de la marca').setInputFiles({
    name: `logo-${info.project.name}.png`,
    mimeType: 'image/png',
    buffer: brandAdminImage(),
  })
  await expect(page.getByRole('status').filter({ hasText: 'Imagen cargada' })).toBeVisible()
  const logo = await field(page, 'Logo').inputValue()
  expect(logo).toMatch(/^\/api\/b2b\/media\//)
  const anonymous = await page.context().newPage()
  await anonymous.goto(`${qaProtocol}://sur.b2b.test/`)
  expect(
    await anonymous.evaluate(
      async (url) => (await fetch(`${location.protocol}//sur.b2b.test${url}`)).status,
      logo,
    ),
  ).toBe(404)
  await anonymous.close()
  await button(page, 'Guardar borrador').click()
  await expect
    .poll(
      async () =>
        (await read<{ theme: ThemeState }>(page, 'atlas', 'principal', '/theme')).theme.draft.brand
          .logoUrl,
    )
    .toBe(logo)
  expect(
    await page.evaluate(
      async () => (await (await fetch('/api/b2b/context')).json()).theme.brand.logoUrl,
    ),
  ).toBe(original.published.brand.logoUrl)
  await button(page, 'Publicar diseño').click()
  await expect
    .poll(
      async () =>
        await page.evaluate(
          async () => (await (await fetch('/api/b2b/context')).json()).theme.brand.logoUrl,
        ),
    )
    .toBe(logo)
  await capture(page, info, 'published-brand-logo')
  await field(page, 'Volver a una versión publicada').selectOption(
    String(original.publishedVersion),
  )
  await button(page, 'Restaurar diseño').click()
  await expect
    .poll(
      async () =>
        await page.evaluate(
          async () => (await (await fetch('/api/b2b/context')).json()).theme.brand.logoUrl,
        ),
    )
    .toBe(original.published.brand.logoUrl)
})

test('a branch without activity archives and restores through UI without deleting its saved metadata', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  await login(page)
  const slug = `archive-${info.project.name}`
  const result = await api<{ branch: Branch }>(page, 'atlas', 'principal', '/branches', 'POST', {
    slug,
    name: `Archivo ${info.project.name}`,
    address: 'Dirección ficticia preservada',
    timezone: 'UTC',
  })
  expect(result.status).toBe(201)
  await button(page, 'Marca y sedes').click()
  const editor = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: result.body.branch.name, exact: true }) })
  await editor.getByLabel('Estado', { exact: true }).selectOption('archived')
  await editor.getByRole('button', { name: 'Guardar sede', exact: true }).click()
  await expect
    .poll(
      async () =>
        (await read<{ branches: Branch[] }>(page, 'atlas', 'principal', '/branches')).branches.find(
          (branch) => branch.id === result.body.branch.id,
        )?.status,
    )
    .toBe('archived')
  await expect(
    field(page, 'Sede y función').locator('option').filter({ hasText: result.body.branch.name }),
  ).toHaveCount(0)
  await editor.getByLabel('Estado', { exact: true }).selectOption('active')
  await editor.getByRole('button', { name: 'Guardar sede', exact: true }).click()
  await expect(
    field(page, 'Sede y función').locator('option').filter({ hasText: result.body.branch.name }),
  ).toHaveCount(1)
  await expect(editor.getByLabel('Dirección', { exact: true })).toHaveValue(
    'Dirección ficticia preservada',
  )
  await capture(page, info, 'restored-empty-branch')
})

test('administrator filters a persisted partial training fixture and exports brand history with exact branch identity', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  // Arrange a real persisted member record through the local API; only the admin UI is under test.
  await page.goto(`${qaProtocol}://atlas.b2b.test/`)
  const fixtureId = await page.evaluate(async (password) => {
    const signed = await fetch('/api/b2b/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'member-norte@atlas.example.test', password }),
    })
    if (signed.status !== 200) throw new Error(`Fixture login HTTP ${signed.status}`)
    const me = await (await fetch('/api/b2b/me')).json()
    const headers = {
      'Content-Type': 'application/json',
      'X-Klisteni-B2B-Account': me.user.id,
      'X-Klisteni-B2B-Branch': 'atlas-demo-norte',
      'X-Klisteni-B2B-Role': 'member',
    }
    const assignments = await (
      await fetch('/api/b2b/orgs/atlas-demo/assignments', { headers })
    ).json()
    const assignment = assignments.assignments.find(
      (item: { id: string }) => item.id === 'atlas-demo-norte-assignment',
    )
    const step = assignment.program.steps[0]
    const id = crypto.randomUUID()
    const saved = await fetch('/api/b2b/orgs/atlas-demo/executions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id,
        assignmentId: assignment.id,
        status: 'partial',
        completedAt: new Date().toISOString(),
        notes: 'Registro ficticio para QA administrador',
        sets: [
          {
            stepId: step.id,
            set: 1,
            exerciseId: step.exerciseId,
            reps: step.reps,
            durationSeconds: step.durationSeconds,
            loadKg: step.loadKg,
            rpe: 6.5,
            reason: '',
          },
        ],
      }),
    })
    if (saved.status !== 201) throw new Error(`Fixture save HTTP ${saved.status}`)
    await fetch('/api/b2b/auth/sign-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    return id
  }, password)
  await login(page, 'atlas', 'norte')
  await button(page, 'Seguimiento').click()
  await expect(
    page.getByText('Registro ficticio para QA administrador', { exact: true }),
  ).toBeVisible()
  await field(page, 'Filtrar seguimiento por socio').selectOption({ label: 'atlas norte member' })
  await expect(page.getByText('Parcial', { exact: true })).toBeVisible()
  await capture(page, info, 'partial-record-admin-followup')
  await button(page, 'Marca y sedes').click()
  const downloadEvent = page.waitForEvent('download')
  await button(page, 'Exportar historial de la marca').click()
  const download = await downloadEvent
  const { readFile } = await import('node:fs/promises')
  const result = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(
    result.executions.find((execution: { id: string }) => execution.id === fixtureId)?.branchId,
  ).toBe('atlas-demo-norte')
})

test('routine conflict survives reload and preserves local prescription until an explicit comparison/rebase', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  await login(page, 'atlas', 'norte')
  const created = await api<{ program: Program }>(page, 'atlas', 'norte', '/programs', 'POST', {
    name: `Rutina concurrente ${info.project.name}`,
    description: 'Borrador inicial de fixture',
    steps: [
      {
        id: 'qa-step',
        exerciseId: 'dead-bug',
        sets: 2,
        reps: 10,
        durationSeconds: null,
        targetRpe: 6.5,
        loadKg: null,
        restSeconds: 60,
        notes: '',
        alternatives: [],
      },
    ],
  })
  expect(created.status).toBe(201)
  const initial = created.body.program
  await button(page, 'Rutinas').click()
  await card(page, initial.name)
    .getByRole('button', { name: 'Editar borrador', exact: true })
    .click()
  await field(page, 'Objetivo o descripción').fill('Mi descripción local')
  await field(page, 'Series · movimiento 1').fill('3')
  expect(
    (
      await api(page, 'atlas', 'norte', `/programs/${initial.id}`, 'PUT', {
        name: initial.name,
        description: 'Descripción concurrente de otra persona',
        steps: initial.steps,
        expectedRevision: initial.revision,
      })
    ).status,
  ).toBe(200)
  await button(page, 'Guardar borrador de rutina').click()
  await expect(
    page.getByText('Descripción concurrente de otra persona', { exact: true }),
  ).toBeVisible()
  await expect(button(page, 'Guardar borrador de rutina')).toBeDisabled()
  await page.reload()
  await card(page, initial.name)
    .getByRole('button', { name: 'Editar borrador', exact: true })
    .click()
  await button(page, 'Recuperar borrador local').click()
  await expect(field(page, 'Series · movimiento 1')).toHaveValue('3')
  await expect(button(page, 'Continuar con mis cambios')).toBeDisabled()
  await field(
    page,
    'Revisé la versión actual. Al guardar mis cambios reemplazaré este borrador del gimnasio.',
  ).check()
  await button(page, 'Continuar con mis cambios').click()
  await button(page, 'Guardar borrador de rutina').click()
  await expect(page.getByRole('status').filter({ hasText: 'Borrador guardado' })).toBeVisible()
  const saved = (
    await read<{ programs: Program[] }>(page, 'atlas', 'norte', '/programs')
  ).programs.find((program) => program.id === initial.id)!
  expect(saved.description).toBe('Mi descripción local')
  expect(saved.steps[0].sets).toBe(3)
  expect(saved.revision).toBe(initial.revision + 2)
  await capture(page, info, 'recovered-routine-conflict')
})
