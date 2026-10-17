import { readFileSync } from 'node:fs'
import {
  test,
  expect,
  principal,
  login,
  prescribe,
  startWorkout,
  staffSession,
  latest,
  api,
  newPage,
  updateActive,
  raw,
  record,
  operation,
  open,
  type Page,
} from './fixtures/b2b-product/app-fixture'
import { scenarioTitle, assertProductViewport } from './fixtures/b2b-product/browser-assertions'
import type { ProductInput } from '../../../packages/b2b-contracts/src/product-v2.ts'
import {
  holdNativeWorkoutTransaction,
  nativeHoldState,
  releaseNativeHold,
  restoreNativeHold,
  readNativeWorkout,
  nativeWorkoutQuotaFault,
} from './fixtures/b2b-product/native-workout-store'
const quantity = (page: Page) => page.getByRole('spinbutton', { name: /cantidad$/ }).first()
const synchronized = (page: Page) =>
  page.getByRole('status').filter({ hasText: 'Sincronizado. Guardar no completa la sesión.' })

test(scenarioTitle('B2BP-SYNC-001'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const id = await startWorkout(page, product, info, plan)
    await expect(synchronized(page)).toBeVisible()
    const closeEvidence: Array<Record<string, unknown>> = []
    for (const store of ['workouts-v2', 'selected-workout-v1'] as const) {
      await test.step(`Actual Close awaits native ${store} and captured successor`, async () => {
        const before = await readNativeWorkout(page, id)
        await context.setOffline(true)
        await holdNativeWorkoutTransaction(page, id, store)
        const notes = `Captured before delayed ${store} Close`
        const reason = `Captured successor behind delayed ${store}`
        await page.getByLabel('Notas de la sesión', { exact: true }).fill(notes)
        await expect.poll(async () => (await nativeHoldState(page))?.held).toBe(true)
        await page.getByLabel('Motivo de corrección', { exact: true }).fill(reason)
        await page
          .locator('.workout-session')
          .getByRole('button', { name: 'Volver', exact: true })
          .click()
        await expect(
          page.getByRole('button', { name: 'Guardando en este dispositivo…', exact: true }),
        ).toBeDisabled()
        await expect(page.getByLabel('Notas de la sesión', { exact: true })).toHaveValue(notes)
        await expect(page.getByLabel('Motivo de corrección', { exact: true })).toHaveValue(reason)
        await releaseNativeHold(page)
        await expect(
          page.getByRole('heading', { name: 'Mi rutina e historial', exact: true }),
        ).toBeVisible()
        const saved = await readNativeWorkout(page, id)
        expect(saved.document.content).toMatchObject({
          notes,
          correctionReason: reason,
          status: before.document.content.status,
          explicitCompletion: false,
        })
        expect(saved.document.accepted).toEqual(before.document.accepted)
        expect(saved.document.operations).toEqual(before.document.operations)
        expect(saved.pointers).toHaveLength(1)
        expect(saved.pointers[0]).toMatchObject({
          id,
          documentKey: saved.document.key,
          documentGeneration: saved.document.generation,
        })
        closeEvidence.push({
          store,
          generation: saved.document.generation,
          pointerGeneration: saved.pointers[0]!.documentGeneration,
          capturedNotes: saved.document.content.notes,
          capturedReason: saved.document.content.correctionReason,
          status: saved.document.content.status,
          explicitCompletion: saved.document.content.explicitCompletion,
          unchangedAcceptedRevision: true,
          unchangedOperations: true,
        })
        await restoreNativeHold(page)
        await context.setOffline(false)
        await expect(
          page.getByText(
            'Conexión pendiente de validar. Conservamos el trabajo local; los envíos están suspendidos.',
            { exact: true },
          ),
        ).toHaveCount(0)
        await page
          .getByRole('button', {
            name: 'Retomar trabajo guardado en este dispositivo',
            exact: true,
          })
          .click()
        await expect(page.getByLabel('Notas de la sesión', { exact: true })).toHaveValue(notes)
        await expect(synchronized(page)).toBeVisible()
      })
    }
    await info.attach('authenticated-close-local-evidence', {
      body: JSON.stringify({ id, checkpoints: closeEvidence }, null, 2),
      contentType: 'application/json',
    })
    await context.setOffline(true)
    await quantity(page).fill('3')
    await page.getByLabel('Notas de la sesión').fill('WP12 persisted during network loss')
    await expect(
      page
        .locator('.workout-session')
        .getByRole('status')
        .filter({ hasText: /sin conexión|local|pendiente/i }),
    ).toBeVisible()
    await context.setOffline(false)
    await page.reload() // Shell startup requires connectivity; no service-worker guarantee is assumed.
    await page
      .getByRole('button', { name: 'Retomar trabajo guardado en este dispositivo', exact: true })
      .click()
    await expect(quantity(page)).toHaveValue('3')
    await expect(page.getByLabel('Notas de la sesión')).toHaveValue(
      'WP12 persisted during network loss',
    )
    await expect(synchronized(page)).toBeVisible()
    const saved = await latest(page, member, plan.occurrences[0]!.id)
    expect(saved).toMatchObject({
      schemaVersion: 2,
      content: {
        status: 'partial',
        explicitCompletion: false,
        notes: 'WP12 persisted during network loss',
      },
    })
    await assertProductViewport(page, info)
  } finally {
    await restoreNativeHold(page)
    await context.setOffline(false)
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-SYNC-003'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const id = await startWorkout(page, product, info, plan)
    await expect(synchronized(page)).toBeVisible()
    const attempts: Array<{ operationId: string; content: unknown }> = []
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname.endsWith(`/sessions/${id}/revisions`)
      )
        attempts.push(request.postDataJSON())
    })
    await page.route(
      `**/sessions/${id}/revisions`,
      async (route) => {
        const response = await route.fetch()
        expect(response.ok()).toBe(true)
        await route.abort('failed')
      },
      { times: 1 },
    )
    await quantity(page).fill('3')
    await expect.poll(() => attempts.length).toBeGreaterThanOrEqual(2)
    expect(attempts[1]).toEqual(attempts[0])
    await expect(synchronized(page)).toBeVisible()
    const revisions = await api(page, member, 'sessionRevisions', { id })
    expect(
      revisions.filter(
        (record) => record.schemaVersion === 2 && record.operationId === attempts[0]!.operationId,
      ),
    ).toHaveLength(1)
    expect(await latest(page, member, plan.occurrences[0]!.id)).toMatchObject({
      content: { status: 'partial', explicitCompletion: false },
    })
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-SYNC-006'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  let release!: () => void
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const id = await startWorkout(page, product, info, plan)
    await expect(synchronized(page)).toBeVisible()
    const accepted = await latest(page, member, plan.occurrences[0]!.id)
    expect(accepted?.schemaVersion).toBe(2)
    if (!accepted || accepted.schemaVersion !== 2)
      throw new Error('Expected real accepted v2 record')
    // Delay the local send before it reaches the server while a second device commits.
    let arrived!: () => void
    const held = new Promise<void>((resolve) => {
      arrived = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(
      `**/sessions/${id}/revisions`,
      async (route) => {
        arrived()
        await gate
        await route.continue()
      },
      { times: 1 },
    )
    await page.getByLabel('Notas de la sesión').fill('Local device unsent version')
    await held
    const peer = await newPage(context, info)
    try {
      await login(peer.page, member, info)
      await api(peer.page, member, 'saveSession', {
        id,
        operationId: crypto.randomUUID(),
        expectedRevision: accepted.revision,
        origin: accepted.origin,
        content: {
          ...accepted.content,
          notes: 'Second device accepted version',
          correctionReason: 'Second device correction',
        },
      })
    } finally {
      await peer.context.close()
    }
    release()
    await expect(page.getByRole('button', { name: 'Cargar revisión del servidor' })).toBeVisible()
    await page.getByRole('button', { name: 'Cargar revisión del servidor' }).click()
    await page.getByText('Comparar registros', { exact: true }).click()
    await expect(
      page.locator('pre').filter({ hasText: 'Second device accepted version' }),
    ).toContainText('Local device unsent version')
    await page.getByRole('button', { name: 'Usar servidor y archivar copia local' }).click()
    await expect(page.getByLabel('Notas de la sesión')).toHaveValue(
      'Second device accepted version',
    )
    await assertProductViewport(page, info)
  } finally {
    release?.()
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-SYNC-007'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  let release!: () => void
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const id = await startWorkout(page, product, info, plan)
    await expect(synchronized(page)).toBeVisible()
    let arrived!: () => void
    const held = new Promise<void>((resolve) => {
      arrived = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(
      `**/sessions/${id}/revisions`,
      async (route) => {
        const response = await route.fetch()
        arrived()
        await gate
        try {
          await route.fulfill({ response })
        } catch (error) {
          if (!/closed|cancel|abort|handled/i.test(String(error))) throw error
        }
      },
      { times: 1 },
    )
    await page.getByLabel('Notas de la sesión').fill('Private former owner note')
    await held
    await page.getByRole('button', { name: 'Salir', exact: true }).click()
    release()
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: plan.routine.name })).toHaveCount(0)
    const other = principal(product, 'secondary-member', 'atlas', true)
    await login(page, other, info)
    await expect(page.getByText('Private former owner note', { exact: true })).toHaveCount(0)
    expect(
      (await raw(page, other, 'routineVersion', { id: plan.routine.programId, version: 1 })).ok(),
    ).toBe(false)
    await assertProductViewport(page, info)
  } finally {
    release?.()
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-SYNC-008'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  let deactivated = false
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const id = await startWorkout(page, product, info, plan)
    await expect(synchronized(page)).toBeVisible()
    const accepted = await latest(page, member, plan.occurrences[0]!.id)
    if (!accepted || accepted.schemaVersion !== 2)
      throw new Error('Expected accepted real record before revocation')
    await context.setOffline(true)
    await page.getByLabel('Notas de la sesión').fill('Unconfirmed owner recovery value')
    await updateActive(staff.page, staff.who, member, false)
    deactivated = true
    await context.setOffline(false)
    await expect(page.getByRole('heading', { name: 'Tu membresía está inactiva' })).toBeVisible()
    expect((await raw(page, member, 'operationReceipt', { id: accepted.operationId })).ok()).toBe(
      false,
    )
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Descargar trabajo local', exact: true }).click()
    const local = JSON.parse(readFileSync((await (await download).path())!, 'utf8'))
    expect(local).toMatchObject({
      format: 'klisteniapp.local-workout-recovery',
      version: 2,
      serverConfirmed: false,
    })
    expect(JSON.stringify(local)).toContain(id)
    expect(JSON.stringify(local)).toContain('Unconfirmed owner recovery value')
    await expect(page.getByRole('button', { name: 'Completar sesión explícitamente' })).toHaveCount(
      0,
    )
    await assertProductViewport(page, info)
  } finally {
    await context.setOffline(false)
    if (deactivated) await updateActive(staff.page, staff.who, member, true)
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-SYNC-010'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    await startWorkout(page, product, info, plan)
    await quantity(page).fill('1') // Below target, but truthful positive actual measurement.
    await page.getByRole('button', { name: 'Guardar parcial', exact: true }).click()
    await expect(synchronized(page)).toBeVisible()
    expect(await latest(page, member, plan.occurrences[0]!.id)).toMatchObject({
      content: { status: 'partial', explicitCompletion: false },
    })
    await page.getByRole('button', { name: 'Completar sesión explícitamente', exact: true }).click()
    await expect
      .poll(async () => await latest(page, member, plan.occurrences[0]!.id))
      .toMatchObject({ content: { status: 'completed', explicitCompletion: true } })
    await expect(synchronized(page)).toBeVisible()
    await page.getByLabel('Motivo de corrección').fill('Truthful completion corrected to partial')
    await expect(page.getByLabel('Motivo de corrección')).toHaveValue(
      'Truthful completion corrected to partial',
    )
    await page.getByRole('button', { name: 'Guardar parcial' }).click()
    await expect
      .poll(async () => await latest(page, member, plan.occurrences[0]!.id))
      .toMatchObject({ content: { status: 'partial', explicitCompletion: false } })
    expect(
      await api(page, member, 'week', {
        memberId: member.actor.id,
        weekStart: plan.weekStart,
        timeZone: 'UTC',
      }),
    ).toMatchObject({ completed: 0, partial: 1 })
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-SYNC-004'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  let release!: () => void
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const id = await startWorkout(page, product, info, plan)
    await expect(synchronized(page)).toBeVisible()
    const attempts: ProductInput<'saveSession'>[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname.endsWith(`/sessions/${id}/revisions`)
      )
        attempts.push(request.postDataJSON())
    })
    let arrived!: () => void
    const held = new Promise<void>((resolve) => {
      arrived = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(
      `**/sessions/${id}/revisions`,
      async (route) => {
        const response = await route.fetch()
        expect(response.ok()).toBe(true)
        arrived()
        await gate
        await route.fulfill({ response })
      },
      { times: 1 },
    )
    await page.getByLabel('Notas de la sesión').fill('First immutable queued bytes')
    await held
    await page.getByLabel('Notas de la sesión').fill('Serialized successor bytes')
    release()
    await expect.poll(() => attempts.length).toBeGreaterThanOrEqual(2)
    await expect(synchronized(page)).toBeVisible()
    expect(attempts[0]!.content.notes).toBe('First immutable queued bytes')
    expect(attempts[1]!.content.notes).toBe('Serialized successor bytes')
    expect(attempts[1]!.operationId).not.toBe(attempts[0]!.operationId)
    expect(attempts[1]!.expectedRevision).toBe(attempts[0]!.expectedRevision + 1)
    const wrongBytes = await raw(page, member, 'saveSession', {
      ...attempts[0]!,
      content: { ...attempts[0]!.content, notes: 'Changed operation bytes' },
    })
    expect(wrongBytes.status()).toBe(409)
    expect((await wrongBytes.json()).code).toBe('OPERATION_CONFLICT')
    expect((await latest(page, member, plan.occurrences[0]!.id))!.content.notes).toBe(
      'Serialized successor bytes',
    )
    await assertProductViewport(page, info)
  } finally {
    release?.()
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-SYNC-005'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  let paused = false
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const first = await record(page, member, plan.routine, plan.occurrences[0]!)
    const successor = await api(page, member, 'saveSession', {
      ...first.sent,
      operationId: operation(),
      expectedRevision: first.session.revision,
      content: {
        ...first.session.content,
        notes: 'Accepted successor is authoritative',
        correctionReason: 'Owner correction',
      },
    })
    expect(await api(page, member, 'saveSession', first.sent)).toEqual({
      session: first.session,
      receipt: first.receipt,
    })
    expect((await latest(page, member, plan.occurrences[0]!.id))!.revision).toBe(
      successor.session.revision,
    )
    await open(page, product, info, 'history')
    const ownSession = page.locator(`[id="actual-session-${first.session.id}"]`)
    await expect(ownSession).toContainText('Accepted successor is authoritative')
    await updateActive(staff.page, staff.who, member, false)
    paused = true
    const deniedReplay = await raw(page, member, 'saveSession', first.sent)
    expect([403, 409]).toContain(deniedReplay.status())
    expect((await raw(page, member, 'operationReceipt', { id: first.sent.operationId })).ok()).toBe(
      false,
    )
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Tu membresía está inactiva', exact: true }),
    ).toBeVisible()
    await assertProductViewport(page, info)
  } finally {
    if (paused) await updateActive(staff.page, staff.who, member, true)
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-SYNC-002'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  let release!: () => void
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const id = await startWorkout(page, product, info, plan)
    await expect(synchronized(page)).toBeVisible()
    await expect(page.getByText('Estado del trabajo: draft.', { exact: false })).toBeVisible()
    let arrived!: () => void
    const held = new Promise<void>((resolve) => {
        arrived = resolve
      }),
      gate = new Promise<void>((resolve) => {
        release = resolve
      })
    await page.route(
      `**/sessions/${id}/revisions`,
      async (route) => {
        const response = await route.fetch()
        expect(response.ok()).toBe(true)
        arrived()
        await gate
        await route.fulfill({ response })
      },
      { times: 1 },
    )
    await quantity(page).fill('1')
    await held
    await expect(
      page.getByRole('status').filter({ hasText: 'Enviando una operación inmutable…' }),
    ).toBeVisible()
    await expect(page.getByText('Estado del trabajo: partial.', { exact: false })).toBeVisible()
    await expect(synchronized(page)).toHaveCount(0)
    release()
    await expect(synchronized(page)).toBeVisible()
    expect((await latest(page, member, plan.occurrences[0]!.id))!.content).toMatchObject({
      status: 'partial',
      explicitCompletion: false,
    })
    await page.getByRole('button', { name: 'Completar sesión explícitamente', exact: true }).click()
    await expect
      .poll(async () => (await latest(page, member, plan.occurrences[0]!.id))!.content.status)
      .toBe('completed')
    await expect(synchronized(page)).toBeVisible()
    await expect(page.getByText('Estado del trabajo: completed.', { exact: false })).toBeVisible()
    await assertProductViewport(page, info)
  } finally {
    release?.()
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-SYNC-011'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const id = await startWorkout(page, product, info, plan)
    await expect(synchronized(page)).toBeVisible()
    const attempts: Array<{ time: number; payload: ProductInput<'saveSession'> }> = []
    await page.route(`**/sessions/${id}/revisions`, async (route) => {
      attempts.push({ time: performance.now(), payload: route.request().postDataJSON() })
      if (attempts.length <= 2) await route.abort('connectionfailed')
      else await route.continue()
    })
    await quantity(page).fill('1')
    await expect(
      page.getByRole('status').filter({ hasText: /Falló la sincronización|Envío pendiente/ }),
    ).toBeVisible()
    await expect(synchronized(page)).toHaveCount(0)
    await expect(synchronized(page)).toBeVisible({ timeout: 30_000 })
    expect(attempts).toHaveLength(3)
    for (let index = 1; index < attempts.length; index++) {
      expect(attempts[index]!.payload).toEqual(attempts[0]!.payload)
      expect(attempts[index]!.time - attempts[index - 1]!.time).toBeGreaterThanOrEqual(700)
    }
    expect(
      (await api(page, member, 'sessionRevisions', { id })).filter(
        (r) => r.schemaVersion === 2 && r.operationId === attempts[0]!.payload.operationId,
      ),
    ).toHaveLength(1)
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-SYNC-009'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    // This is an opaque synthetic v1 database fixture, not a fabricated v2 DTO.
    await page.goto(new URL('/api/b2b/healthz', String(info.project.use.baseURL)).href)
    const bytes = '{unreadable-old-draft: preserve these exact synthetic bytes'
    await page.evaluate(async (bytes) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('klisteni.b2b.workouts', 1)
        request.onupgradeneeded = () => request.result.createObjectStore('wp12-v1-opaque')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('wp12-v1-opaque', 'readwrite')
        transaction.objectStore('wp12-v1-opaque').put(bytes, 'old')
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
      db.close()
    }, bytes)
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const id = await startWorkout(page, product, info, plan)
    await expect(synchronized(page)).toBeVisible()
    const before = await readNativeWorkout(page, id)
    await nativeWorkoutQuotaFault(page, true)
    await quantity(page).fill('3')
    await expect(
      page.getByRole('status').filter({
        hasText: 'No se pudo guardar en este dispositivo. Exportá el trabajo antes de salir.',
      }),
    ).toBeVisible()
    await expect(quantity(page)).toHaveValue('3')
    expect(
      (await api(page, member, 'sessionRevisions', { id }))
        .filter((r) => r.schemaVersion === 2)
        .at(-1),
    ).toMatchObject({ content: { sets: [] } })
    const retained = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open('klisteni.b2b.workouts')
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      })
      try {
        return await new Promise((resolve, reject) => {
          const r = db.transaction('wp12-v1-opaque').objectStore('wp12-v1-opaque').get('old')
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        })
      } finally {
        db.close()
      }
    })
    expect(retained).toBe(bytes)
    let layoutFailure: unknown
    try {
      await assertProductViewport(page, info)
    } catch (error) {
      layoutFailure = error // Preserve the original failed layout while checking independent recovery.
    }
    await page
      .locator('.workout-session')
      .getByRole('button', { name: 'Volver', exact: true })
      .click()
    const retry = page.getByRole('button', {
      name: 'Reintentar guardado local y volver',
      exact: true,
    })
    await expect(retry).toBeEnabled()
    await expect(quantity(page)).toHaveValue('3')
    const download = page.waitForEvent('download')
    await page
      .getByRole('button', { name: 'Exportar trabajo local sin confirmar', exact: true })
      .click()
    const exported = JSON.parse(readFileSync((await (await download).path())!, 'utf8'))
    expect(JSON.stringify(exported)).toContain('"repetitions":3')
    await nativeWorkoutQuotaFault(page, false)
    await retry.click()
    await expect(
      page.getByRole('heading', { name: 'Mi rutina e historial', exact: true }),
    ).toBeVisible()
    const saved = await readNativeWorkout(page, id)
    expect(saved.document.content.sets[0]?.repetitions).toBe(3)
    expect(saved.document.content.explicitCompletion).toBe(false)
    expect(saved.document.accepted).toEqual(before.document.accepted)
    expect(saved.document.operations).toEqual(before.document.operations)
    expect(saved.pointers[0]?.documentGeneration).toBe(saved.document.generation)
    await info.attach('authenticated-close-quota-retry-evidence', {
      body: JSON.stringify({
        id,
        localGeneration: saved.document.generation,
        pointerGeneration: saved.pointers[0]?.documentGeneration,
        actualRepetitions: saved.document.content.sets[0]?.repetitions,
        exportContainsCapturedValue: true,
        explicitCompletion: false,
        unchangedAcceptedRevision: true,
        unchangedOperations: true,
      }),
      contentType: 'application/json',
    })
    if (layoutFailure) throw layoutFailure
  } finally {
    await nativeWorkoutQuotaFault(page, false)
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-SYNC-012'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  let release!: () => void
  let paused = false
  let queued!: ProductInput<'saveSession'>
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const id = await startWorkout(page, product, info, plan)
    await expect(synchronized(page)).toBeVisible()
    const accepted = (await latest(page, member, plan.occurrences[0]!.id))!
    let arrived!: () => void
    const held = new Promise<void>((resolve) => {
        arrived = resolve
      }),
      gate = new Promise<void>((resolve) => {
        release = resolve
      })
    await page.route(
      `**/sessions/${id}/revisions`,
      async (route) => {
        queued = route.request().postDataJSON()
        arrived()
        await gate
        await route.continue()
      },
      { times: 1 },
    )
    await page.getByLabel('Notas de la sesión').fill('Stale device must not resurrect void work')
    await held
    const peer = await newPage(context, info)
    try {
      await login(peer.page, member, info)
      await api(peer.page, member, 'saveSession', {
        id,
        expectedRevision: accepted.revision,
        operationId: operation(),
        origin: accepted.origin,
        content: {
          ...accepted.content,
          status: 'void',
          explicitCompletion: false,
          correctionReason: 'Void accepted from another device',
        },
      })
    } finally {
      await peer.context.close()
    }
    release()
    await expect(
      page.getByRole('button', { name: 'Cargar revisión del servidor', exact: true }),
    ).toBeVisible()
    expect((await latest(page, member, plan.occurrences[0]!.id))!.content.status).toBe('void')
    await updateActive(staff.page, staff.who, member, false)
    paused = true
    expect((await raw(page, member, 'saveSession', queued)).status()).toBe(403)
    expect((await raw(page, member, 'operationReceipt', { id: accepted.operationId })).ok()).toBe(
      false,
    )
    await updateActive(staff.page, staff.who, member, true)
    paused = false
    expect((await raw(page, member, 'saveSession', queued)).status()).toBe(409)
    expect((await latest(page, member, plan.occurrences[0]!.id))!.content.status).toBe('void')
    await page.getByRole('button', { name: 'Salir', exact: true }).click()
    await login(page, member, info)
    expect((await latest(page, member, plan.occurrences[0]!.id))!.content.status).toBe('void')
    await open(page, product, info, 'history')
    await expect(page.locator(`[id="actual-session-${id}"]`)).toContainText('Anulada')
    await assertProductViewport(page, info)
    await test.step('Actual sign-out cancels a Close barrier before its native write', async () => {
      const next = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
      const nextId = await startWorkout(page, product, info, next)
      await expect(synchronized(page)).toBeVisible()
      const baseline = await readNativeWorkout(page, nextId)
      await holdNativeWorkoutTransaction(page, nextId)
      await page
        .getByLabel('Notas de la sesión', { exact: true })
        .fill('Private captured value revoked before native commit')
      await expect.poll(async () => (await nativeHoldState(page))?.held).toBe(true)
      await page
        .getByLabel('Motivo de corrección', { exact: true })
        .fill('Queued successor must not cross departed authority')
      await page
        .locator('.workout-session')
        .getByRole('button', { name: 'Volver', exact: true })
        .click()
      await expect(
        page.getByRole('button', { name: 'Guardando en este dispositivo…', exact: true }),
      ).toBeDisabled()
      await page.getByRole('button', { name: 'Salir', exact: true }).click()
      await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
      await expect(page.getByLabel('Notas de la sesión', { exact: true })).toHaveCount(0)
      await expect.poll(async () => (await nativeHoldState(page))?.aborted).toBe(true)
      await releaseNativeHold(page)
      const retained = await readNativeWorkout(page, nextId)
      expect(retained.document.generation).toBe(baseline.document.generation)
      expect(retained.document.content).toEqual(baseline.document.content)
      expect(retained.document.operations).toEqual(baseline.document.operations)
      await info.attach('authenticated-close-revocation-evidence', {
        body: JSON.stringify({
          id: nextId,
          nativeTransactionAborted: true,
          generationBefore: baseline.document.generation,
          generationAfter: retained.document.generation,
          capturedAndQueuedWritesCancelled: true,
          privateEditorHiddenBeforeRelease: true,
        }),
        contentType: 'application/json',
      })
    })
  } finally {
    release?.()
    await restoreNativeHold(page)
    if (paused) await updateActive(staff.page, staff.who, member, true)
    await staff.context.close()
  }
})
