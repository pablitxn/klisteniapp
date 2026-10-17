import {
  test,
  expect,
  principal,
  login,
  open,
  api,
  raw,
  operation,
  dose,
  publish,
  newPage,
  prescribe,
  record,
  addDays,
  monday,
  date,
  showWeek,
  type Page,
  type ProductFixture,
  type TestInfo,
  type Principal,
} from './fixtures/b2b-product/app-fixture'
import { scenarioTitle, assertProductViewport } from './fixtures/b2b-product/browser-assertions'

async function goalForm(page: Page, product: ProductFixture, info: TestInfo, member: Principal) {
  await open(page, product, info, 'programming')
  await page.getByLabel('Persona de esta sede', { exact: true }).selectOption(member.actor.id)
  await page.getByRole('button', { name: 'Crear programa por objetivo', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Programa por objetivo', exact: true }),
  ).toBeVisible()
}

test(scenarioTitle('B2BP-PROGRAMMING-001'), async ({ page, product }, info) => {
  const staff = principal(product, 'cover-coach')
  await login(page, staff, info)
  await open(page, product, info, 'programming')
  await expect(
    page.getByRole('heading', { name: 'Rutinas y programas por objetivo' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Crear rutina', exact: true }).click()
  const name = `WP12 incomplete ${operation()}`
  await page.getByLabel('Nombre de la rutina', { exact: true }).fill(name)
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/product\/v2\/routines\/[^/]+$/.test(new URL(response.url()).pathname),
  )
  await page.getByRole('button', { name: 'Guardar borrador incompleto', exact: true }).click()
  const response = await saved
  expect(response.ok()).toBe(true)
  const routine = await response.json()
  expect(routine.steps).toEqual([])
  await page.reload()
  await page.getByRole('button', { name: `Editar ${name}`, exact: true }).click()
  await expect(page.getByLabel('Nombre de la rutina')).toHaveValue(name)
  await page.getByRole('button', { name: 'Agregar movimiento sin configurar', exact: true }).click()
  await page.context().setOffline(true)
  await page.getByLabel('Descripción de la rutina').fill('Own offline draft')
  await page.context().setOffline(false)
  await page.reload()
  await page.getByRole('button', { name: `Editar ${name}`, exact: true }).click()
  // Existing draft recovery is a real provider flow; no storage bytes are injected.
  const recover = page.getByRole('button', { name: /Recuperar borrador/ })
  if (await recover.count()) await recover.click()
  await expect(page.getByLabel('Descripción de la rutina')).toHaveValue('Own offline draft')
  await expect(page.getByText(/puntaje de equilibrio|balance score/i)).toHaveCount(0)
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-PROGRAMMING-002'), async ({ page, product }, info) => {
  const staff = principal(product, 'cover-coach')
  await login(page, staff, info)
  await open(page, product, info, 'programming')
  await page.getByRole('button', { name: 'Crear rutina', exact: true }).click()
  await page.getByLabel('Nombre de la rutina').fill(`WP12 invalid ${operation()}`)
  await page.getByRole('button', { name: 'Agregar movimiento sin configurar' }).click()
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      /\/product\/v2\/routines\/[^/]+$/.test(new URL(r.url()).pathname),
  )
  await page.getByRole('button', { name: 'Guardar borrador incompleto' }).click()
  const routine = await (await saved).json()
  await page.getByRole('button', { name: 'Publicar versión para asignar' }).click()
  await expect(page.getByRole('alert')).not.toHaveCount(0)
  const rejection = await raw(page, staff, 'publishRoutine', {
    id: routine.id,
    expectedRevision: routine.revision,
    operationId: operation(),
  })
  expect(rejection.status()).toBe(422)
  const body = await rejection.json()
  expect(body.code).toBe('INCOMPLETE_PRESCRIPTION')
  expect(
    body.issues.some((issue: { stepId: string }) => issue.stepId === routine.steps[0].id),
  ).toBe(true)
  expect((await api(page, staff, 'routine', { id: routine.id })).publishedVersion).toBeNull()
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-PROGRAMMING-003'), async ({ page, product }, info) => {
  const staff = principal(product, 'cover-coach')
  await login(page, staff, info)
  const exercises = await api(page, staff, 'catalogExercises', {})
  const source = exercises.find(
    (exercise) => exercise.status === 'published' && !exercise.machineId,
  )!
  await open(page, product, info, 'programming')
  await page.getByRole('button', { name: 'Crear rutina', exact: true }).click()
  await page.getByLabel('Nombre de la rutina').fill(`WP12 range ${operation()}`)
  await page.getByRole('button', { name: 'Agregar movimiento sin configurar' }).click()
  await page.getByLabel('Ejercicio · movimiento 1', { exact: true }).selectOption(source.id)
  await page.getByLabel('Medición · movimiento 1', { exact: true }).selectOption('repetitions')
  for (const [label, min, max] of [
    ['Series', '1', '2'],
    ['Repeticiones', '5', '9'],
  ] as const) {
    await page
      .getByLabel(`${label} · movimiento 1 · formato`, { exact: true })
      .selectOption('range')
    await page.getByLabel(`${label} · movimiento 1 · mínimo`, { exact: true }).fill(min)
    await page.getByLabel(`${label} · movimiento 1 · máximo`, { exact: true }).fill(max)
  }
  await page.getByLabel('Carga · movimiento 1', { exact: true }).selectOption('external')
  await page.getByLabel('Carga externa (kg) · movimiento 1 · valor', { exact: true }).fill('0')
  await page.getByLabel('Lados y conteo · movimiento 1', { exact: true }).selectOption('bilateral')
  await page
    .getByLabel('Descanso (segundos) · movimiento 1 · formato', { exact: true })
    .selectOption('fixed')
  await page.getByLabel('Descanso (segundos) · movimiento 1 · valor', { exact: true }).fill('0')
  await page.getByLabel('Esfuerzo RPE (opcional, 1–10) · movimiento 1').fill('7.5')
  await page.getByLabel('Indicaciones · movimiento 1').fill('Explicit zero and optional note')
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      /\/product\/v2\/routines\/[^/]+$/.test(new URL(r.url()).pathname),
  )
  await page.getByRole('button', { name: 'Guardar borrador incompleto' }).click()
  const routine = await (await saved).json()
  expect(routine.steps[0].dose).toMatchObject({
    sets: { kind: 'range', min: 1, max: 2 },
    repetitions: { kind: 'range', min: 5, max: 9 },
    durationSeconds: null,
    load: { mode: 'external', kilograms: { kind: 'fixed', value: 0 } },
    restSeconds: { kind: 'fixed', value: 0 },
    targetRpe: 7.5,
  })
  const published = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/publish'),
  )
  await page.getByRole('button', { name: 'Publicar versión para asignar' }).click()
  expect((await published).ok()).toBe(true)
  await expect(page.getByRole('heading', { name: 'Versión publicada 1' })).toBeVisible()
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-PROGRAMMING-009'), async ({ page, context, product }, info) => {
  const staff = principal(product, 'cover-coach')
  await login(page, staff, info)
  const initial = await publish(page, staff)
  const current = await api(page, staff, 'routine', { id: initial.programId })
  await open(page, product, info, 'programming')
  await page.getByRole('button', { name: `Editar ${initial.name}`, exact: true }).click()
  await page.getByLabel('Descripción de la rutina').fill('My conflicting unsaved work')
  const other = await newPage(context, info)
  try {
    const peer = principal(product, 'assigned-coach')
    await login(other.page, peer, info)
    await api(other.page, peer, 'saveRoutine', {
      id: current.id,
      expectedRevision: current.revision,
      operationId: operation(),
      content: {
        name: current.name,
        description: 'Other trainer accepted revision',
        steps: current.steps,
      },
    })
    const conflict = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes(`/routines/${current.id}`),
    )
    await page.getByRole('button', { name: 'Guardar borrador incompleto' }).click()
    expect((await conflict).status()).toBe(409)
    await expect(page.getByLabel('Descripción de la rutina')).toHaveValue(
      'My conflicting unsaved work',
    )
    await expect(page.getByRole('alert')).not.toHaveCount(0)
    expect((await api(other.page, peer, 'routine', { id: current.id })).description).toBe(
      'Other trainer accepted revision',
    )
  } finally {
    await other.context.close()
  }
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-PROGRAMMING-011'), async ({ page, product }, info) => {
  const staff = principal(product, 'cover-coach')
  await login(page, staff, info)
  const catalog = await api(page, staff, 'catalogExercises', {})
  const routine = await publish(page, staff, {
    name: `WP12 block ${operation()}`,
    description: '',
    steps: [
      {
        id: operation(),
        exerciseId: catalog.find((e) => e.status === 'published' && !e.machineId)!.id,
        dose: dose(),
        substitutionPolicy: 'reviewed',
      },
    ],
  })
  await open(page, product, info, 'programming')
  await page.getByRole('button', { name: `Editar ${routine.name}`, exact: true }).click()
  await page.getByRole('checkbox', { name: 'Bloquear alternativas en este movimiento' }).check()
  await expect(
    page.getByRole('status').filter({ hasText: 'Las alternativas están bloqueadas' }),
  ).toBeVisible()
  const save = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().endsWith(`/routines/${routine.programId}`),
  )
  await page.getByRole('button', { name: 'Guardar borrador incompleto' }).click()
  expect((await (await save).json()).steps[0].substitutionPolicy).toBe('blocked')
  expect(
    (await api(page, staff, 'routineVersion', { id: routine.programId, version: 1 })).snapshot
      .steps[0],
  ).toMatchObject({ substitutionPolicy: 'reviewed' })
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-PROGRAMMING-008'), async ({ page, context, product }, info) => {
  const staff = principal(product, 'cover-coach'),
    member = principal(product)
  await login(page, staff, info)
  const plan = await prescribe(page, staff, member, { weekdays: [1] })
  const peer = await newPage(context, info)
  try {
    await login(peer.page, member, info)
    const saved = await record(peer.page, member, plan.routine, plan.occurrences[0]!)
    await open(page, product, info, 'programming')
    await page.getByLabel('Persona de esta sede', { exact: true }).selectOption(member.actor.id)
    await page
      .getByRole('button', {
        name: `Revisar períodos de ${plan.enrollment.content.name}`,
        exact: true,
      })
      .click()
    await page.getByLabel('Inicio · etapa 1', { exact: true }).fill(addDays(plan.weekStart, 7))
    await page
      .getByLabel('Fin inclusive · etapa 1', { exact: true })
      .fill(addDays(plan.weekStart, 13))
    const previewResponse = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().includes(`/enrollments/${plan.enrollment.id}/period-preview`),
    )
    await page
      .getByRole('button', { name: 'Consultar impacto antes de aplicar', exact: true })
      .click()
    const preview = await (await previewResponse).json()
    expect(
      preview.impacts.some((impact: { linkedSessionIds: string[] }) =>
        impact.linkedSessionIds.includes(saved.session.id),
      ),
    ).toBe(true)
    const impact = page.getByRole('region', { name: 'Impacto del cambio', exact: true })
    await expect(impact).toContainText(saved.session.id)
    await expect(impact.getByRole('button', { name: 'Aplicar períodos revisados' })).toBeDisabled()
    await impact
      .getByRole('checkbox', { name: 'Revisé el impacto y confirmo aplicar estos períodos.' })
      .check()
    const applied = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        new URL(r.url()).pathname.endsWith(`/enrollments/${plan.enrollment.id}/period`),
    )
    await impact.getByRole('button', { name: 'Aplicar períodos revisados' }).click()
    const result = await applied
    expect(result.ok()).toBe(true)
    const changed = await result.json()
    expect(changed.revision).toBe(plan.enrollment.revision + 1)
    expect(changed.content.stages[0].slots).toEqual(plan.enrollment.content.stages[0]!.slots)
    const revisions = await api(peer.page, member, 'sessionRevisions', { id: saved.session.id })
    expect(revisions).toEqual([saved.session])
    const audit = await api(page, staff, 'audit', { id: plan.enrollment.id })
    expect(
      audit.some(
        (entry) => entry.actorId === staff.actor.id && entry.afterRevision === changed.revision,
      ),
    ).toBe(true)
    await assertProductViewport(page, info)
  } finally {
    await peer.context.close()
  }
})

test(scenarioTitle('B2BP-PROGRAMMING-005'), async ({ page, product }, info) => {
  const staff = principal(product, 'cover-coach'),
    member = principal(product)
  await login(page, staff, info)
  const routine = await publish(page, staff)
  await goalForm(page, product, info, member)
  const name = `WP12 explicit timezone ${operation()}`,
    start = monday(date())
  await page.getByLabel('Nombre del programa', { exact: true }).fill(name)
  await page
    .getByLabel('Objetivo del programa', { exact: true })
    .fill('Explicit objective, inclusive stages and a gap')
  await expect(page.getByText('Zona sin confirmar', { exact: true })).toBeVisible()
  await page.getByLabel('Zona horaria IANA', { exact: true }).fill('America/New_York')
  await expect(page.getByText('Zona sin confirmar', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar zona horaria', exact: true }).click()
  await expect(page.getByText('Zona confirmada: America/New_York', { exact: true })).toBeVisible()
  for (const [index, offset, stageName] of [
    [1, -7, 'Past'],
    [2, 0, 'Current'],
    [3, 14, 'Future'],
  ] as const) {
    await page.getByRole('button', { name: 'Agregar etapa', exact: true }).click()
    await page.getByLabel(`Nombre · etapa ${index}`, { exact: true }).fill(stageName)
    await page.getByLabel(`Inicio · etapa ${index}`, { exact: true }).fill(addDays(start, offset))
    await page
      .getByLabel(`Fin inclusive · etapa ${index}`, { exact: true })
      .fill(addDays(start, offset + 6))
    await page
      .getByRole('button', { name: `Agregar sesión semanal a etapa ${index}`, exact: true })
      .click()
    await page.getByLabel(`Día · etapa ${index}, sesión 1`, { exact: true }).selectOption('1')
    await page
      .getByLabel(`Rutina publicada · etapa ${index}, sesión 1`, { exact: true })
      .selectOption(JSON.stringify([routine.programId, routine.version, 2]))
  }
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/goals\/[^/]+$/.test(new URL(r.url()).pathname),
  )
  await page.getByRole('button', { name: 'Guardar programa incompleto', exact: true }).click()
  const goal = await (await saved).json()
  expect(goal.stages).toHaveLength(3)
  await page
    .getByRole('checkbox', {
      name: 'Confirmo fechas, sesiones y zona horaria para asignar una nueva inscripción a esta persona.',
    })
    .check()
  const enrolled = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' && /\/enrollments\/[^/]+$/.test(new URL(r.url()).pathname),
  )
  await page.getByRole('button', { name: 'Asignar programa completo', exact: true }).click()
  const response = await enrolled
  expect(response.ok()).toBe(true)
  const result = await response.json()
  expect(result.content).toMatchObject({
    name,
    timeZone: 'America/New_York',
    goal: 'Explicit objective, inclusive stages and a gap',
  })
  expect(
    result.content.stages.every(
      (s: { slots: Array<{ routine: { programId: string } }> }) =>
        s.slots[0]!.routine.programId === routine.programId,
    ),
  ).toBe(true)
  expect(
    (await api(page, staff, 'enrollmentRevision', { id: result.id, revision: 1 })).enrollment
      .content,
  ).toEqual(result.content)
  await page.reload()
  await page.getByLabel('Persona de esta sede', { exact: true }).selectOption(member.actor.id)
  await expect(
    page.getByRole('button', { name: `Revisar períodos de ${name}`, exact: true }),
  ).toBeVisible()
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-PROGRAMMING-006'), async ({ page, context, product }, info) => {
  const staff = principal(product, 'cover-coach'),
    member = principal(product)
  await login(page, staff, info)
  const a = await prescribe(page, staff, member, { weekdays: [1, 1] })
  const b = await prescribe(page, staff, member, {
    weekdays: [1, 1],
    routine: a.routine,
    weekStart: a.weekStart,
  })
  expect(new Set([...a.occurrences, ...b.occurrences].map((o) => o.id)).size).toBe(4)
  expect(a.enrollment.id).not.toBe(b.enrollment.id)
  const peer = await newPage(context, info)
  try {
    await login(peer.page, member, info)
    expect(
      await api(peer.page, member, 'week', {
        memberId: member.actor.id,
        weekStart: a.weekStart,
        timeZone: 'UTC',
      }),
    ).toMatchObject({ required: 4, completed: 0, missed: 4 })
    await showWeek(peer.page, product, info, a.weekStart)
    for (const occurrence of [...a.occurrences, ...b.occurrences])
      await expect(peer.page.locator(`[id="scheduled-occurrence-${occurrence.id}"]`)).toBeVisible()
    await assertProductViewport(peer.page, info)
  } finally {
    await peer.context.close()
  }
})

test(scenarioTitle('B2BP-PROGRAMMING-007'), async ({ page, context, product }, info) => {
  const staff = principal(product, 'cover-coach'),
    member = principal(product)
  await login(page, staff, info)
  const first = await prescribe(page, staff, member, { weekdays: [1] })
  const original = await api(page, staff, 'routineVersion', {
    id: first.routine.programId,
    version: 1,
  })
  const draft = await api(page, staff, 'routine', { id: first.routine.programId })
  const updated = await api(page, staff, 'saveRoutine', {
    id: draft.id,
    expectedRevision: draft.revision,
    operationId: operation(),
    content: {
      name: `${draft.name} next`,
      description: 'A later issue, with stable routine identity',
      steps: draft.steps,
    },
  })
  const second = await api(page, staff, 'publishRoutine', {
    id: draft.id,
    expectedRevision: updated.revision,
    operationId: operation(),
  })
  expect(second).toMatchObject({ programId: first.routine.programId, version: 2 })
  const reuse = await prescribe(page, staff, member, {
    weekdays: [2],
    routine: first.routine,
    weekStart: first.weekStart,
  })
  expect(reuse.occurrences[0]!.routine).toEqual(first.occurrences[0]!.routine)
  const current = await api(page, staff, 'routine', { id: draft.id })
  await api(page, staff, 'archiveRoutine', {
    id: draft.id,
    expectedRevision: current.revision,
    operationId: operation(),
  })
  expect(await api(page, staff, 'routineVersion', { id: draft.id, version: 1 })).toEqual(original)
  const peer = await newPage(context, info)
  try {
    await login(peer.page, member, info)
    await open(peer.page, product, info, 'history')
    await expect(
      peer.page.getByRole('region', { name: 'Rutinas originales y sus registros' }),
    ).toContainText(draft.id)
    expect(
      (await api(peer.page, member, 'enrollmentRevision', { id: first.enrollment.id, revision: 1 }))
        .enrollment,
    ).toEqual(first.enrollment)
    await assertProductViewport(peer.page, info)
  } finally {
    await peer.context.close()
  }
})

test(scenarioTitle('B2BP-PROGRAMMING-004'), async ({ page, product }, info) => {
  const staff = principal(product, 'cover-coach'),
    member = principal(product)
  await login(page, staff, info)
  const routine = await publish(page, staff)
  await open(page, product, info, 'programming')
  await page.getByRole('button', { name: `Editar ${routine.name}`, exact: true }).click()
  await page.getByLabel('Series · movimiento 1 · formato', { exact: true }).selectOption('range')
  await page.getByLabel('Series · movimiento 1 · mínimo', { exact: true }).fill('4')
  await page.getByLabel('Series · movimiento 1 · máximo', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Publicar versión para asignar', exact: true }).click()
  await expect(page.getByRole('alert')).not.toHaveCount(0)
  expect((await api(page, staff, 'routine', { id: routine.programId })).publishedVersion).toBe(1)
  await goalForm(page, product, info, member)
  await page
    .getByLabel('Nombre del programa', { exact: true })
    .fill(`WP12 invalid dates ${operation()}`)
  await page
    .getByLabel('Objetivo del programa', { exact: true })
    .fill('Reject incomplete and reversed date periods')
  await page.getByLabel('Zona horaria IANA', { exact: true }).fill('UTC')
  await page.getByRole('button', { name: 'Confirmar zona horaria', exact: true }).click()
  await page.getByRole('button', { name: 'Agregar etapa', exact: true }).click()
  await page.getByLabel('Nombre · etapa 1', { exact: true }).fill('Invalid period')
  await page.getByLabel('Inicio · etapa 1', { exact: true }).fill('2026-10-20')
  await page.getByLabel('Fin inclusive · etapa 1', { exact: true }).fill('2026-10-19')
  await page.getByRole('button', { name: 'Agregar sesión semanal a etapa 1', exact: true }).click()
  await page.getByLabel('Día · etapa 1, sesión 1', { exact: true }).selectOption('1')
  await page
    .getByLabel('Rutina publicada · etapa 1, sesión 1', { exact: true })
    .selectOption(JSON.stringify([routine.programId, 1, 2]))
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/goals\/[^/]+$/.test(new URL(r.url()).pathname),
  )
  await page.getByRole('button', { name: 'Guardar programa incompleto', exact: true }).click()
  expect((await saved).ok()).toBe(true)
  await page
    .getByRole('checkbox', {
      name: 'Confirmo fechas, sesiones y zona horaria para asignar una nueva inscripción a esta persona.',
    })
    .check()
  await page.getByRole('button', { name: 'Asignar programa completo', exact: true }).click()
  await expect(page.getByRole('alert', { name: 'Campos a revisar', exact: true })).toBeVisible()
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-PROGRAMMING-010'), async ({ page, product }, info) => {
  const staff = principal(product, 'superadmin'),
    secondary = principal(product, 'superadmin', 'atlas', true)
  await login(page, staff, info)
  const routine = await publish(page, staff)
  let release!: () => void, arrived!: () => void
  const held = new Promise<void>((resolve) => {
      arrived = resolve
    }),
    gate = new Promise<void>((resolve) => {
      release = resolve
    })
  try {
    await page.route(
      '**/product/v2/routines',
      async (route) => {
        const response = await route.fetch()
        arrived()
        await gate
        try {
          await route.fulfill({ response })
        } catch (e) {
          if (!/abort|closed|handled/i.test(String(e))) throw e
        }
      },
      { times: 1 },
    )
    await page.reload({ waitUntil: 'domcontentloaded' })
    await held
    await page
      .getByRole('combobox', { name: 'Sede y función', exact: true })
      .selectOption(JSON.stringify([secondary.branchId, 'superadmin']))
    release()
    await expect(
      page.getByRole('heading', { name: 'Rutinas y programas por objetivo', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: `Editar ${routine.name}`, exact: true }),
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'Salir', exact: true }).click()
    await login(page, principal(product, 'superadmin', 'sur'), info)
    await open(page, product, info, 'programming')
    await expect(
      page.getByRole('button', { name: `Editar ${routine.name}`, exact: true }),
    ).toHaveCount(0)
    await assertProductViewport(page, info)
  } finally {
    release?.()
  }
})

test(scenarioTitle('B2BP-PROGRAMMING-012'), async ({ page, product }, info) => {
  const staff = principal(product, 'cover-coach')
  await login(page, staff, info)
  await publish(page, staff)
  await goalForm(page, product, info, principal(product))
  const add = page.getByRole('button', { name: 'Agregar etapa', exact: true })
  if (info.project.use.hasTouch) await add.tap()
  else {
    await add.focus()
    await page.keyboard.press('Enter')
  }
  const start = page.getByLabel('Inicio · etapa 1', { exact: true })
  await start.fill('2026-10-19')
  await start.focus()
  await expect(start).toBeFocused()
  const end = page.getByLabel('Fin inclusive · etapa 1', { exact: true })
  for (
    let index = 0;
    index < 5 && !(await end.evaluate((e) => e === document.activeElement));
    index++
  )
    await page.keyboard.press('Tab')
  await expect(end).toBeFocused()
  // Native segmented date editing differs by engine; establish the explicit
  // date through the actual control, then preserve keyboard focus order.
  await page.getByLabel('Fin inclusive · etapa 1', { exact: true }).fill('2026-10-25')
  await expect(start).toHaveValue('2026-10-19')
  await expect(page.getByLabel('Fin inclusive · etapa 1', { exact: true })).toHaveValue(
    '2026-10-25',
  )
  await assertProductViewport(page, info)
})
