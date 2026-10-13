import { expect, test, type Page } from './fixtures/integration-test'
import type { Branch } from '../../../packages/b2b-contracts/src/index.ts'
import { brandAdminSignIn } from './fixtures/brand-admin-sign-in'
async function login(page: Page) {
  await page.goto('/manage')
  await brandAdminSignIn(page)
  await page
    .getByLabel('Sede y función', { exact: true })
    .selectOption('atlas-demo-principal:admin')
  await page.getByRole('button', { name: 'Marca y sedes', exact: true }).click()
}
async function branchRequest(page: Page, method: string, path: string, body?: unknown) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const me = await (await fetch('/api/b2b/me')).json()
      const response = await fetch(`/api/b2b/orgs/atlas-demo/branches${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Klisteni-B2B-Account': me.user.id },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      return { status: response.status, body: await response.json() }
    },
    { method, path, body },
  )
}

test('branch editor retains unsaved address through reload and resolves a concurrent revision explicitly', async ({
  page,
}, info) => {
  await login(page)
  const original = (await branchRequest(page, 'GET', '')).body.branches.find(
    (branch: Branch) => branch.slug === 'norte',
  ) as Branch
  const editor = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Norte', exact: true }) })
  await editor.getByLabel('Dirección', { exact: true }).fill(`Dirección local ${info.project.name}`)
  await page.reload()
  await editor.getByRole('button', { name: 'Recuperar borrador local', exact: true }).click()
  await expect(editor.getByLabel('Dirección', { exact: true })).toHaveValue(
    `Dirección local ${info.project.name}`,
  )
  const update = {
    slug: original.slug,
    name: original.name,
    address: 'Dirección de otra persona',
    contact: original.contact,
    timezone: original.timezone,
    status: original.status,
    public: original.public,
    openingHours: original.openingHours,
    expectedRevision: original.revision,
  }
  expect((await branchRequest(page, 'PUT', `/${original.id}`, update)).status).toBe(200)
  await editor.getByRole('button', { name: 'Guardar sede', exact: true }).click()
  await expect(editor.getByText('Dirección de otra persona', { exact: true })).toBeVisible()
  await expect(editor.getByRole('button', { name: 'Guardar sede', exact: true })).toBeDisabled()
  await page.screenshot({ path: info.outputPath('branch-conflict.png'), fullPage: true })
  await editor
    .getByLabel(
      'Revisé la versión actual. Al guardar mis cambios reemplazaré este borrador del gimnasio.',
      { exact: true },
    )
    .check()
  await editor.getByRole('button', { name: 'Continuar con mis cambios', exact: true }).click()
  await editor.getByRole('button', { name: 'Guardar sede', exact: true }).click()
  await expect
    .poll(
      async () =>
        (await branchRequest(page, 'GET', '')).body.branches.find(
          (branch: Branch) => branch.id === original.id,
        ).address,
    )
    .toBe(`Dirección local ${info.project.name}`)
})

test('theme fields cannot change during a delayed save and a response to a closed editor preserves newer local work', async ({
  page,
}, info) => {
  await login(page)
  await page.getByRole('button', { name: 'Diseño publicado', exact: true }).click()
  let release = () => {},
    committed = () => {}
  const hold = new Promise<void>((resolve) => {
    release = resolve
  })
  const sent = new Promise<void>((resolve) => {
    committed = resolve
  })
  await page.route('**/api/b2b/orgs/atlas-demo/theme', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue()
    const response = await route.fetch()
    committed()
    await hold
    await route.fulfill({ response })
  })
  try {
    await page
      .getByLabel('Título de bienvenida', { exact: true })
      .fill(`Primer envío ${info.project.name}`)
    await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click()
    await sent
    await expect(page.getByLabel('Título de bienvenida', { exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Personas', exact: true }).click()
    await page.getByRole('button', { name: 'Marca y sedes', exact: true }).click()
    await page.getByRole('button', { name: 'Diseño publicado', exact: true }).click()
    await page.getByRole('button', { name: 'Recuperar borrador local', exact: true }).click()
    // The first commit is present but cannot silently rebase the old copy.
    await page
      .getByLabel(
        'Revisé la versión actual. Al guardar mis cambios reemplazaré este borrador del gimnasio.',
        { exact: true },
      )
      .check()
    await page.getByRole('button', { name: 'Continuar con mis cambios', exact: true }).click()
    await page
      .getByLabel('Título de bienvenida', { exact: true })
      .fill(`Cambio posterior ${info.project.name}`)
    release()
    await page.unrouteAll({ behavior: 'wait' })
    await page.reload()
    await page.getByRole('button', { name: 'Diseño publicado', exact: true }).click()
    await page.getByRole('button', { name: 'Recuperar borrador local', exact: true }).click()
    await expect(page.getByLabel('Título de bienvenida', { exact: true })).toHaveValue(
      `Cambio posterior ${info.project.name}`,
    )
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

for (const kind of ['exercise', 'program'] as const) {
  test(`${kind} editor keeps its return action blocked until the pending save is acknowledged`, async ({
    page,
  }, info) => {
    test.setTimeout(180_000)
    await login(page)
    const resource = kind === 'exercise' ? 'exercises' : 'programs'
    const id = kind === 'exercise' ? 'atlas-demo-cable-row' : 'atlas-demo-starter'
    const item = await page.evaluate(
      async ({ resource, id }) => {
        const me = await (await fetch('/api/b2b/me')).json()
        const response = await fetch(`/api/b2b/orgs/atlas-demo/${resource}`, {
          headers: {
            'X-Klisteni-B2B-Account': me.user.id,
            'X-Klisteni-B2B-Branch': 'atlas-demo-principal',
            'X-Klisteni-B2B-Role': 'admin',
          },
        })
        if (response.status !== 200) throw new Error(`Fixture read HTTP ${response.status}`)
        const data = await response.json()
        return data[resource].find((item: { id: string }) => item.id === id) as {
          id: string
          name: string
        }
      },
      { resource, id },
    )
    await page
      .getByRole('button', { name: kind === 'exercise' ? 'Ejercicios' : 'Rutinas', exact: true })
      .click()
    await page
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: item.name, exact: true }) })
      .getByRole('button', {
        name: kind === 'exercise' ? 'Editar' : 'Editar borrador',
        exact: true,
      })
      .click()
    await page
      .getByLabel(kind === 'exercise' ? 'Descripción' : 'Objetivo o descripción', { exact: true })
      .fill(`Guardado pendiente ${info.project.name}`)
    let release = () => {},
      committed = () => {}
    const hold = new Promise<void>((resolve) => {
      release = resolve
    })
    const sent = new Promise<void>((resolve) => {
      committed = resolve
    })
    await page.route(`**/api/b2b/orgs/atlas-demo/${resource}/${id}`, async (route) => {
      if (route.request().method() !== 'PUT') return route.continue()
      const response = await route.fetch()
      expect(response.status()).toBe(200)
      committed()
      await hold
      await route.fulfill({ response })
    })
    try {
      await page
        .getByRole('button', {
          name: kind === 'exercise' ? 'Guardar borrador' : 'Guardar borrador de rutina',
          exact: true,
        })
        .click()
      await sent
      const back = page.getByRole('button', {
        name: kind === 'exercise' ? 'Volver al catálogo' : 'Volver a rutinas',
        exact: true,
      })
      await expect(back).toBeDisabled()
      release()
      await expect(back).toBeEnabled()
      await back.click()
      const saved = page
        .locator('article')
        .filter({ has: page.getByRole('heading', { name: item.name, exact: true }) })
        .filter({
          has: page.getByRole('button', {
            name: kind === 'exercise' ? 'Editar' : 'Editar borrador',
            exact: true,
          }),
        })
      if (kind === 'exercise') await expect(saved).toContainText('BORRADOR')
      else await expect(saved).toContainText(`Guardado pendiente ${info.project.name}`)
      await page.screenshot({
        path: info.outputPath(`${kind}-acknowledged-save.png`),
        fullPage: true,
      })
    } finally {
      release()
      await page.unrouteAll({ behavior: 'wait' })
    }
  })
}
