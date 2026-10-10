import { expect, test } from '@playwright/test'

function gate() {
  let resolve = () => {}
  let reject: (error: unknown) => void = () => {}
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

test('a delayed training save cannot close a session reopened after navigation', async ({
  page,
}) => {
  await page.goto('/app')
  await page.getByLabel('Email', { exact: true }).fill('member@atlas.example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('browser-tests-only-password-2026')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  const routine = page.locator('article').filter({
    has: page.getByRole('heading', { name: 'Inicio · fuerza y técnica', exact: true }),
  })
  await routine.getByRole('button', { name: 'Empezar sesión', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Hecha', exact: true }).first().check()

  const committed = gate()
  const release = gate()
  await page.route('**/api/b2b/orgs/atlas-demo/executions', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
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
    await routine.getByRole('button', { name: 'Empezar sesión', exact: true }).click()
    const confirm = page.getByRole('button', { name: 'Confirmar envío pendiente', exact: true })
    await expect(confirm).toBeVisible()
    // Storage cleanup proves the old save's success callback has run, so the
    // following assertion does not race against delivery of that response.
    const draftCount = () =>
      page.evaluate(
        () =>
          Object.keys(localStorage).filter((key) => key.startsWith('klisteni.b2b.session.v1.'))
            .length,
      )
    expect(await draftCount()).toBe(1)
    release.resolve()
    await expect.poll(draftCount).toBe(0)
    await expect(confirm).toBeVisible()
    await page.unrouteAll({ behavior: 'wait' })
    await confirm.click()
    await expect(page.getByText('Tu sesión quedó guardada.', { exact: true })).toBeVisible()
  } finally {
    release.resolve()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

for (const { path, role } of [
  { path: '/app', role: 'member' },
  { path: '/backoffice/', role: 'admin' },
]) {
  test(`${role}: signing out cancels a delayed session probe without restoring protected content`, async ({
    page,
  }) => {
    await page.goto(path)
    await page.getByLabel('Email', { exact: true }).fill(`${role}@atlas.example.test`)
    await page.getByLabel('Contraseña', { exact: true }).fill('browser-tests-only-password-2026')
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()

    const captured = gate()
    const release = gate()
    const finished = gate()
    await page.route(
      '**/api/b2b/me',
      async (route) => {
        try {
          const response = await route.fetch()
          expect(response.ok()).toBeTruthy()
          captured.resolve()
          await release.promise
          // The request can already be cancelled when its old authenticated
          // response becomes available. Either outcome must leave the UI signed out.
          await route.fulfill({ response }).catch(() => undefined)
        } catch (error) {
          captured.reject(error)
          throw error
        } finally {
          finished.resolve()
        }
      },
      { times: 1 },
    )

    try {
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await captured.promise
      const cancelled = page.waitForEvent(
        'requestfailed',
        (request) => new URL(request.url()).pathname === '/api/b2b/me',
      )
      await page.getByRole('button', { name: 'Salir', exact: true }).click()
      await cancelled
      await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible()
      release.resolve()
      await finished.promise
      await expect(page.getByRole('button', { name: 'Salir', exact: true })).not.toBeVisible()
      await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible()
    } finally {
      release.resolve()
      await page.unrouteAll({ behavior: 'wait' })
    }
  })
}
