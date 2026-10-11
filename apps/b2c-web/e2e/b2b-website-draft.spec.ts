import { expect, test, type Page } from '@playwright/test'
import type { Me, Website } from '../../../packages/b2b-contracts/src/index.ts'

async function login(page: Page) {
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto('/backoffice/')
  await page.getByLabel('Email', { exact: true }).fill('admin@atlas.example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('browser-tests-only-password-2026')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
  const me = (await (await page.request.get('/api/b2b/me')).json()) as Me
  return { Origin: new URL(page.url()).origin, 'X-Klisteni-B2B-Account': me.user.id }
}
const endpoint = '/api/b2b/orgs/atlas-demo/website'

test('website copies retain unfinished map fields and require comparison after a concurrent edit and reload', async ({
  page,
}) => {
  const headers = await login(page)
  const original = (
    (await (await page.request.get(endpoint, { headers })).json()) as { website: Website }
  ).website
  const initialized = await page.request.put(endpoint, {
    headers,
    data: {
      ...original.draft,
      floorPlan: {
        title: 'Plano inicial',
        description: 'Orientación preservada',
        image: {
          id: 'plan',
          kind: 'image',
          url: '/models/plan.png',
          label: 'Croquis',
          attribution: '',
        },
        points: [],
      },
      expectedRevision: original.revision,
    },
  })
  expect(initialized.ok()).toBeTruthy()
  const baseline = ((await initialized.json()) as { website: Website }).website
  try {
    await page.getByRole('button', { name: 'Website', exact: true }).click()
    await page.getByLabel('Título del website', { exact: true }).fill('Mi cambio local recuperable')
    await page.getByText('Plano y vista del espacio', { exact: true }).click()
    await page.getByLabel('Título del plano', { exact: true }).fill('')
    const concurrent = await page.request.put(endpoint, {
      headers,
      data: {
        ...baseline.draft,
        headline: 'Texto de otra persona',
        expectedRevision: baseline.revision,
      },
    })
    expect(concurrent.ok()).toBeTruthy()
    await page.reload()
    await page.getByRole('button', { name: 'Website', exact: true }).click()
    await page.getByRole('button', { name: 'Recuperar mi copia local', exact: true }).click()
    await expect(page.getByLabel('Título del website', { exact: true })).toHaveValue(
      'Mi cambio local recuperable',
    )
    await page.getByText('Plano y vista del espacio', { exact: true }).click()
    await expect(page.getByLabel('Título del plano', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('Orientación del plano', { exact: true })).toHaveValue(
      'Orientación preservada',
    )
    const compare = page.getByRole('region', {
      name: 'Comparar copia local del website',
      exact: true,
    })
    await expect(
      compare.getByRole('heading', { name: 'Texto de otra persona', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Guardar borrador del website', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Continuar con mi copia revisada', exact: true }),
    ).toBeDisabled()
    await page.getByLabel('Título del plano', { exact: true }).fill('Plano recuperado')
    await page
      .getByRole('checkbox', {
        name: 'Comparé la versión actual con mi copia local y quiero conservar mis cambios.',
        exact: true,
      })
      .check()
    await page.getByRole('button', { name: 'Continuar con mi copia revisada', exact: true }).click()
    await page.getByRole('button', { name: 'Guardar borrador del website', exact: true }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Borrador del website guardado' }),
    ).toBeVisible()
    const result = (
      (await (await page.request.get(endpoint, { headers })).json()) as { website: Website }
    ).website
    expect(result.draft.headline).toBe('Mi cambio local recuperable')
    expect(result.draft.floorPlan!.title).toBe('Plano recuperado')
  } finally {
    const latest = (
      (await (await page.request.get(endpoint, { headers })).json()) as { website: Website }
    ).website
    expect(
      (
        await page.request.put(endpoint, {
          headers,
          data: { ...original.draft, expectedRevision: latest.revision },
        })
      ).ok(),
    ).toBeTruthy()
  }
})

test('a delayed website save cannot erase the newer copy made after reopening the editor', async ({
  page,
}) => {
  const headers = await login(page)
  const original = (
    (await (await page.request.get(endpoint, { headers })).json()) as { website: Website }
  ).website
  let release = () => {},
    captured = () => {},
    finished = () => {}
  const hold = new Promise<void>((resolve) => {
    release = resolve
  })
  const committed = new Promise<void>((resolve) => {
    captured = resolve
  })
  const responded = new Promise<void>((resolve) => {
    finished = resolve
  })
  await page.route(`**${endpoint}`, async (route) => {
    if (route.request().method() !== 'PUT') return route.continue()
    const response = await route.fetch()
    captured()
    await hold
    await route.fulfill({ response })
    finished()
  })
  try {
    await page.getByRole('button', { name: 'Website', exact: true }).click()
    await page.getByLabel('Título del website', { exact: true }).fill('Primer envío')
    await page.getByRole('button', { name: 'Guardar borrador del website', exact: true }).click()
    await committed
    await page.getByRole('button', { name: 'Archivos', exact: true }).click()
    await page.getByRole('button', { name: 'Website', exact: true }).click()
    await page
      .getByLabel('Título del website', { exact: true })
      .fill('Cambio posterior que debe conservarse')
    release()
    await responded
    await expect(page.getByLabel('Título del website', { exact: true })).toHaveValue(
      'Cambio posterior que debe conservarse',
    )
    await page.reload()
    await page.getByRole('button', { name: 'Website', exact: true }).click()
    await page.getByRole('button', { name: 'Recuperar mi copia local', exact: true }).click()
    await expect(page.getByLabel('Título del website', { exact: true })).toHaveValue(
      'Cambio posterior que debe conservarse',
    )
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
    const latest = (
      (await (await page.request.get(endpoint, { headers })).json()) as { website: Website }
    ).website
    expect(
      (
        await page.request.put(endpoint, {
          headers,
          data: { ...original.draft, expectedRevision: latest.revision },
        })
      ).ok(),
    ).toBeTruthy()
  }
})

test('unpublishing preserves unsaved website edits and their recoverable revision', async ({
  page,
}) => {
  const headers = await login(page)
  const original = (
    (await (await page.request.get(endpoint, { headers })).json()) as { website: Website }
  ).website
  if (original.publishedRevision === null) {
    expect(
      (
        await page.request.post(`${endpoint}/publish`, {
          headers,
          data: { expectedRevision: original.revision },
        })
      ).ok(),
    ).toBeTruthy()
  }
  try {
    await page.getByRole('button', { name: 'Website', exact: true }).click()
    await page
      .getByLabel('Título del website', { exact: true })
      .fill('Edición pendiente al retirar')
    await page.getByLabel('Presentación del espacio', { exact: true }).fill('Texto aún sin guardar')
    await page
      .locator('summary')
      .filter({ hasText: /^Despublicar website$/ })
      .click()
    await page.getByRole('button', { name: 'Confirmar despublicación', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Website despublicado' })).toBeVisible()
    await expect(page.getByText('SIN PUBLICAR', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Título del website', { exact: true })).toHaveValue(
      'Edición pendiente al retirar',
    )
    await expect(page.getByLabel('Presentación del espacio', { exact: true })).toHaveValue(
      'Texto aún sin guardar',
    )
    const afterUnpublish = (
      (await (await page.request.get(endpoint, { headers })).json()) as { website: Website }
    ).website
    expect(afterUnpublish.publishedRevision).toBeNull()
    expect(afterUnpublish.draft).toEqual(original.draft)
    expect((await page.request.get('/api/b2b/public/atlas-demo')).status()).toBe(404)

    await page.reload()
    await page.getByRole('button', { name: 'Website', exact: true }).click()
    await page.getByRole('button', { name: 'Recuperar mi copia local', exact: true }).click()
    await expect(page.getByLabel('Título del website', { exact: true })).toHaveValue(
      'Edición pendiente al retirar',
    )
    await expect(page.getByLabel('Presentación del espacio', { exact: true })).toHaveValue(
      'Texto aún sin guardar',
    )
    await expect(
      page.getByRole('region', { name: 'Comparar copia local del website', exact: true }),
    ).toHaveCount(0)
    const save = page.getByRole('button', { name: 'Guardar borrador del website', exact: true })
    await expect(save).toBeEnabled()
    await save.click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Borrador del website guardado' }),
    ).toBeVisible()
    const saved = (
      (await (await page.request.get(endpoint, { headers })).json()) as { website: Website }
    ).website
    expect(saved.draft.headline).toBe('Edición pendiente al retirar')
    expect(saved.draft.introduction).toBe('Texto aún sin guardar')
    expect(saved.publishedRevision).toBeNull()
  } finally {
    const latest = (
      (await (await page.request.get(endpoint, { headers })).json()) as { website: Website }
    ).website
    const restored = await page.request.put(endpoint, {
      headers,
      data: { ...original.draft, expectedRevision: latest.revision },
    })
    expect(restored.ok()).toBeTruthy()
    const website = ((await restored.json()) as { website: Website }).website
    expect(
      (
        await page.request.post(
          `${endpoint}/${original.publishedRevision === null ? 'unpublish' : 'publish'}`,
          {
            headers,
            data: { expectedRevision: website.revision },
          },
        )
      ).ok(),
    ).toBeTruthy()
  }
})
