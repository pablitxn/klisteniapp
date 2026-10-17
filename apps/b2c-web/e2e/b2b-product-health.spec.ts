import {
  test,
  expect,
  principal,
  login,
  open,
  api,
  raw,
  newPage,
  unavailable,
  staffSession,
  updateActive,
} from './fixtures/b2b-product/app-fixture'
import { scenarioTitle, assertProductViewport } from './fixtures/b2b-product/browser-assertions'
import {
  importThroughUi,
  grantThroughUi,
  privateHealth,
  healthFile,
} from './fixtures/b2b-product/health-journey'

test(scenarioTitle('B2BP-HEALTH-001'), async ({ page, product }, info) => {
  const owner = principal(product)
  await login(page, owner, info)
  await privateHealth(page, owner)
  await open(page, product, info, 'health')
  const writes: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/health/'))
      writes.push(request.url())
  })
  const file = healthFile()
  const before = await api(page, owner, 'ownHealth', {})
  await page.getByLabel('Archivo JSON', { exact: true }).setInputFiles({
    name: 'synthetic.json',
    mimeType: 'application/json',
    buffer: Buffer.from(file.raw),
  })
  await expect(page.getByRole('heading', { name: 'Vista previa de importación' })).toBeVisible()
  expect(await api(page, owner, 'ownHealth', {})).toEqual(before)
  expect(writes.some((url) => new URL(url).pathname.endsWith('/health/import'))).toBe(false)
  const response = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/health/import'),
  )
  await page.getByRole('button', { name: 'Confirmar importación' }).focus()
  await page.keyboard.press('Enter')
  expect((await response).ok()).toBe(true)
  expect(writes.some((url) => url.includes('/consents/'))).toBe(false)
  expect(
    (await api(page, owner, 'healthConsents', {})).filter(
      (c) => c.status === 'active' && c.scope.branchId === owner.branchId,
    ),
  ).toEqual([])
  await expect(
    page.getByText('Privado: no compartís datos de salud con entrenadores de esta sede.'),
  ).toBeVisible()
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-HEALTH-002'), async ({ page, context, product }, info) => {
  const owner = principal(product)
  await login(page, owner, info)
  await importThroughUi(page, product, info, owner)
  for (const label of ['cover-coach', 'new-admin', 'superadmin'] as const) {
    const peer = await newPage(context, info),
      who = principal(product, label)
    try {
      await login(peer.page, who, info)
      const denied = await raw(peer.page, who, 'consentedHealth', { memberId: owner.actor.id })
      expect([403, 404, 409]).toContain(denied.status())
      expect(denied.headers()['cache-control']).toContain('no-store')
      const foreign = await raw(
        peer.page,
        who,
        'consentedHealth',
        { memberId: owner.actor.id },
        { organizationId: principal(product, 'member', 'sur').organization.id },
      )
      expect([403, 404, 409]).toContain(foreign.status())
    } finally {
      await peer.context.close()
    }
  }
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-HEALTH-003'), async ({ page, context, product }, info) => {
  const owner = principal(product)
  await login(page, owner, info)
  await importThroughUi(page, product, info, owner)
  const permit = page.getByRole('button', { name: 'Autorizar estas categorías' })
  await expect(permit).toBeDisabled()
  await expect(page.getByText(/incluidos quienes obtengan ese acceso en el futuro/)).toBeVisible()
  await expect(page.getByText(/No se limita a tu entrenador asignado/)).toBeVisible()
  await grantThroughUi(page)
  const peer = await newPage(context, info),
    coach = principal(product, 'cover-coach')
  try {
    await login(peer.page, coach, info)
    await open(peer.page, product, info, 'trainerHealth', { memberId: owner.actor.id })
    const section = peer.page.getByRole('region', { name: 'Salud compartida con entrenadores' })
    await section.getByRole('button', { name: 'Validar y mostrar datos' }).click()
    await expect(section.getByRole('heading', { name: 'Medidas', exact: true })).toBeVisible()
    await expect(section.getByRole('heading', { name: 'Actividad', exact: true })).toHaveCount(0)
    await expect(section.getByRole('button', { name: /Exportar|Descargar/ })).toHaveCount(0)
    const actual = await raw(peer.page, coach, 'consentedHealth', { memberId: owner.actor.id })
    expect(actual.ok()).toBe(true)
    expect(actual.headers()['cache-control']).toContain('no-store')
    expect((await actual.json()).categories.map((c: { category: string }) => c.category)).toEqual([
      'measurements',
    ])
    await assertProductViewport(peer.page, info)
  } finally {
    await peer.context.close()
    await privateHealth(page, owner)
  }
})

test(scenarioTitle('B2BP-HEALTH-004'), async ({ page, context, product }, info) => {
  if (!product.readiness?.remoteHealthInvalidation)
    unavailable(
      info,
      'Committed remote health invalidation is not declared wired; polling is insufficient',
    )
  const owner = principal(product)
  await login(page, owner, info)
  await importThroughUi(page, product, info, owner)
  await grantThroughUi(page)
  const peer = await newPage(context, info),
    coach = principal(product, 'cover-coach')
  let release!: () => void
  try {
    await login(peer.page, coach, info)
    await open(peer.page, product, info, 'trainerHealth', { memberId: owner.actor.id })
    await peer.page.bringToFront()
    await peer.page.getByRole('button', { name: 'Validar y mostrar datos' }).click()
    await expect(peer.page.getByRole('heading', { name: 'Medidas', exact: true })).toBeVisible()
    let arrived!: () => void
    const held = new Promise<void>((resolve) => {
      arrived = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await peer.page.route(
      `**/members/${owner.actor.id}/health`,
      async (route) => {
        const response = await route.fetch()
        expect(response.ok()).toBe(true)
        arrived()
        await gate
        try {
          await route.fulfill({ response })
        } catch (error) {
          if (!peer.page.isClosed() && !/closed|cancel|handled|abort/i.test(String(error)))
            throw error
        }
      },
      { times: 1 },
    )
    await peer.page.getByRole('button', { name: 'Validar y mostrar datos' }).click()
    await held
    // APIRequestContext does not focus the owner's window: a blur cannot fake a remote revoke pass.
    await privateHealth(page, owner)
    release()
    await expect(peer.page.getByRole('heading', { name: 'Medidas', exact: true })).toHaveCount(0, {
      timeout: 3000,
    })
    expect(
      (await raw(peer.page, coach, 'consentedHealth', { memberId: owner.actor.id })).ok(),
    ).toBe(false)
    await assertProductViewport(peer.page, info)
  } finally {
    release?.()
    await peer.context.close()
    await privateHealth(page, owner)
  }
})

test(scenarioTitle('B2BP-HEALTH-005'), async ({ page, context, product }, info) => {
  const owner = principal(product)
  await login(page, owner, info)
  const file = await importThroughUi(page, product, info, owner)
  await grantThroughUi(page)
  const peer = await newPage(context, info),
    coach = principal(product, 'cover-coach')
  try {
    await login(peer.page, coach, info)
    await open(peer.page, product, info, 'trainerHealth', { memberId: owner.actor.id })
    await peer.page.bringToFront()
    await peer.page.getByRole('button', { name: 'Validar y mostrar datos' }).click()
    await expect(peer.page.getByRole('heading', { name: 'Medidas', exact: true })).toBeVisible()
    await peer.context.setOffline(true)
    await expect(peer.page.getByRole('heading', { name: 'Medidas', exact: true })).toHaveCount(0)
    const durable = await peer.page.evaluate(async () => {
      const values = [JSON.stringify(localStorage), JSON.stringify(sessionStorage)]
      for (const metadata of await indexedDB.databases())
        if (metadata.name) {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const r = indexedDB.open(metadata.name!)
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
          try {
            for (const store of Array.from(db.objectStoreNames))
              values.push(
                JSON.stringify(
                  await new Promise((resolve, reject) => {
                    const r = db.transaction(store).objectStore(store).getAll()
                    r.onsuccess = () => resolve(r.result)
                    r.onerror = () => reject(r.error)
                  }),
                ),
              )
          } finally {
            db.close()
          }
        }
      if ('caches' in globalThis)
        for (const name of await caches.keys())
          for (const r of await (await caches.open(name)).matchAll()) values.push(await r.text())
      return values.join('\n')
    })
    expect(durable).not.toContain(file.marker)
    await peer.context.setOffline(false)
    await peer.page.getByRole('button', { name: 'Validar y mostrar datos' }).click()
    await expect(peer.page.getByRole('heading', { name: 'Medidas', exact: true })).toBeVisible()
    await assertProductViewport(peer.page, info)
  } finally {
    await peer.context.close()
    await privateHealth(page, owner)
  }
})

test(scenarioTitle('B2BP-HEALTH-007'), async ({ page, product }, info) => {
  const owner = principal(product)
  await login(page, owner, info)
  const file = await importThroughUi(page, product, info, owner)
  const before = await api(page, owner, 'ownHealth', {})
  await page.getByLabel('Archivo JSON').setInputFiles({
    name: 'same.json',
    mimeType: 'application/json',
    buffer: Buffer.from(file.raw),
  })
  await expect(page.getByText('Duplicados sin cambios: 2. No se vuelven a agregar.')).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar importación' }).click()
  await expect.poll(async () => (await api(page, owner, 'ownHealth', {})).data).toEqual(before.data)
  const changed = JSON.parse(file.raw)
  changed.records.measurements[0].weightKg = 74
  await page.getByLabel('Archivo JSON').setInputFiles({
    name: 'conflict.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(changed)),
  })
  await expect(page.getByRole('alert')).not.toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Confirmar importación' })).toBeDisabled()
  expect((await api(page, owner, 'ownHealth', {})).data).toEqual(before.data)
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-HEALTH-008'), async ({ page, product }, info) => {
  const owner = principal(product)
  await login(page, owner, info)
  await open(page, product, info, 'health')
  const before = await api(page, owner, 'ownHealth', {})
  const invalids = [
    { name: 'unsupported.csv', text: 'date,weightKg\n2026-10-16,73.5' },
    { name: 'unsupported.zip', text: 'PK\u0003\u0004synthetic' },
    { name: 'invalid.json', text: '{' },
    {
      name: 'unknown.json',
      text: JSON.stringify({ format: 'klisteniapp.health', version: 99, records: {} }),
    },
    { name: 'oversized.json', text: ' '.repeat(2 * 1024 * 1024 + 1) },
  ]
  for (const file of invalids) {
    await page.getByLabel('Archivo JSON').setInputFiles({
      name: file.name,
      mimeType: 'application/octet-stream',
      buffer: Buffer.from(file.text),
    })
    await expect(page.getByRole('alert')).not.toHaveCount(0)
    expect(await api(page, owner, 'ownHealth', {})).toEqual(before)
    const confirm = page.getByRole('button', { name: 'Confirmar importación' })
    if (await confirm.count()) await expect(confirm).toBeDisabled()
  }
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-HEALTH-006'), async ({ page, context, product }, info) => {
  const owner = principal(product, 'multi-member')
  const otherOwner = principal(product, 'multi-member', 'sur')
  const staff = await staffSession(context, product, info)
  const other = await newPage(context, info)
  let activated = false
  let otherReady = false
  try {
    // This actor starts inactive in Atlas and active in Sur. Both grants below
    // come from its actual owner UI, with separate brand sessions.
    await updateActive(staff.page, staff.who, owner, true)
    activated = true
    await login(page, owner, info)
    await importThroughUi(page, product, info, owner)
    await grantThroughUi(page)
    await login(other.page, otherOwner, info)
    otherReady = true
    await importThroughUi(other.page, product, info, otherOwner)
    await grantThroughUi(other.page)
    const atlasConsent = (await api(page, owner, 'healthConsents', {})).find(
      (c) => c.status === 'active' && c.scope.branchId === owner.branchId,
    )!
    const surConsent = (await api(other.page, otherOwner, 'healthConsents', {})).find(
      (c) => c.status === 'active' && c.scope.branchId === otherOwner.branchId,
    )!
    expect(atlasConsent).toBeTruthy()
    expect(surConsent).toBeTruthy()
    await updateActive(staff.page, staff.who, owner, false)
    activated = false
    expect(
      (await api(other.page, otherOwner, 'healthConsents', {})).find((c) => c.id === surConsent.id),
    ).toEqual(surConsent)
    expect((await api(other.page, otherOwner, 'access', {})).accessMode).toBe('active')
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Tu membresía está inactiva', exact: true }),
    ).toBeVisible()
    await updateActive(staff.page, staff.who, owner, true)
    activated = true
    await page.reload()
    const revoked = (await api(page, owner, 'healthConsents', {})).find(
      (c) => c.id === atlasConsent.id,
    )!
    expect(revoked).toMatchObject({ status: 'revoked', revision: atlasConsent.revision + 1 })
    expect(revoked.revokedAt).not.toBeNull()
    await open(page, product, info, 'health')
    await expect(
      page.getByText('Privado: no compartís datos de salud con entrenadores de esta sede.'),
    ).toBeVisible()
    await grantThroughUi(page)
    const fresh = (await api(page, owner, 'healthConsents', {})).find(
      (c) => c.status === 'active' && c.scope.branchId === owner.branchId,
    )!
    expect(fresh).toBeTruthy()
    expect(fresh.id !== atlasConsent.id || fresh.revision > revoked.revision).toBe(true)
    await assertProductViewport(page, info)
  } finally {
    try {
      if (otherReady) await privateHealth(other.page, otherOwner)
    } finally {
      try {
        if (activated) await updateActive(staff.page, staff.who, owner, false)
      } finally {
        await other.context.close()
        await staff.context.close()
      }
    }
  }
})
