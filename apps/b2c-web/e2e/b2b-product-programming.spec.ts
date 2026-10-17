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
} from './fixtures/b2b-product/app-fixture'
import { scenarioTitle, assertProductViewport } from './fixtures/b2b-product/browser-assertions'

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
