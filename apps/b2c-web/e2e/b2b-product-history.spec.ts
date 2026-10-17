import {
  test,
  expect,
  principal,
  login,
  open,
  api,
  prescribe,
  record,
  staffSession,
  operation,
  updateActive,
  newPage,
  raw,
  addDays,
  publish,
  monday,
  date,
} from './fixtures/b2b-product/app-fixture'
import { scenarioTitle, assertProductViewport } from './fixtures/b2b-product/browser-assertions'

test(scenarioTitle('B2BP-HISTORY-002'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member)
    await login(page, member, info)
    await open(page, product, info, 'history')
    const continuity = page.getByRole('region', { name: 'Continuidad de la rutina' })
    await expect(continuity).toContainText(plan.enrollment.content.name)
    await expect(continuity).toContainText(plan.enrollment.content.goal)
    await expect(continuity).toContainText(plan.enrollment.content.stages[0]!.name)
    await expect(continuity.getByText(/cantidad de sustituciones|substitution count/i)).toHaveCount(
      0,
    )
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-HISTORY-003'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const saved = await record(page, member, plan.routine, plan.occurrences[0]!)
    await open(page, product, info, 'history')
    const history = page.getByRole('region', { name: 'Sesiones realizadas' })
    await expect(history).toContainText(saved.session.id)
    const original = history
      .getByRole('link', { name: /rutina original/i })
      .filter({ hasText: plan.routine.programId })
    await expect(original).toHaveCount(1)
    const target = await original.getAttribute('href')
    expect(target).toMatch(/^#original-routine-/)
    await original.click()
    await expect(page.locator(`[id="${target!.slice(1)}"]`)).toContainText(
      plan.enrollment.content.goal,
    )
    await page.getByRole('link', { name: `Ver sesión ${saved.session.id}`, exact: true }).click()
    expect(new URL(page.url()).hash).toContain(saved.session.id)
    const session = history.locator(`[id="actual-session-${saved.session.id}"]`)
    await session.getByRole('button', { name: 'Ver registro original y correcciones' }).click()
    await expect(session.getByText(/Revisión 1/)).not.toHaveCount(0)
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-HISTORY-008'), async ({ page, context, product }, info) => {
  const staff = principal(product, 'superadmin'),
    member = principal(product)
  const peer = await newPage(context, info)
  let paused = false
  try {
    await login(page, staff, info)
    const plan = await prescribe(page, staff, member, { weekdays: [1] })
    await login(peer.page, member, info)
    const saved = await record(peer.page, member, plan.routine, plan.occurrences[0]!)
    await updateActive(page, staff, member, false)
    paused = true
    const disclosures: string[] = []
    page.on('request', (r) => {
      if (new URL(r.url()).pathname.endsWith(`/members/${member.actor.id}/health`))
        disclosures.push(r.url())
    })
    await open(page, product, info, 'reports')
    await page.getByLabel('Persona', { exact: true }).selectOption(member.actor.id)
    await expect(page.getByRole('heading').filter({ hasText: 'Membresía inactiva' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Sesiones realizadas' })).toContainText(
      saved.session.id,
    )
    await expect(page.getByLabel('Mover dentro de esta semana')).toHaveCount(0)
    expect(disclosures).toEqual([])
    expect(
      (
        await raw(page, { ...staff, role: 'coach' }, 'consentedHealth', {
          memberId: member.actor.id,
        })
      ).ok(),
    ).toBe(false)
    await assertProductViewport(page, info)
  } finally {
    if (paused) await updateActive(page, staff, member, true)
    await peer.context.close()
  }
})

test(scenarioTitle('B2BP-HISTORY-006'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const saved = await record(page, member, plan.routine, plan.occurrences[0]!)
    const before = await api(page, member, 'routineVersion', {
      id: plan.routine.programId,
      version: 1,
    })
    const draft = await api(staff.page, staff.who, 'routine', { id: plan.routine.programId })
    const edited = await api(staff.page, staff.who, 'saveRoutine', {
      id: draft.id,
      operationId: operation(),
      expectedRevision: draft.revision,
      content: {
        name: `${draft.name} later`,
        description: 'Later mutable draft',
        steps: draft.steps,
      },
    })
    await api(staff.page, staff.who, 'publishRoutine', {
      id: draft.id,
      operationId: operation(),
      expectedRevision: edited.revision,
    })
    const current = await api(staff.page, staff.who, 'routine', { id: draft.id })
    await api(staff.page, staff.who, 'archiveRoutine', {
      id: draft.id,
      operationId: operation(),
      expectedRevision: current.revision,
    })
    expect(
      await api(page, member, 'routineVersion', { id: plan.routine.programId, version: 1 }),
    ).toEqual(before)
    await open(page, product, info, 'history')
    await expect(page.getByRole('region', { name: 'Sesiones realizadas' })).toContainText(
      saved.session.id,
    )
    await expect(page.getByRole('region', { name: 'Sesiones realizadas' })).not.toContainText(
      'Later mutable draft',
    )
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-HISTORY-007'), async ({ page, product }, info) => {
  const member = principal(product)
  await login(page, member, info)
  const legacy = product.resources.legacy.find((item) => item.memberId === member.actor.id)!
  expect(legacy).toBeTruthy()
  const records = await api(page, member, 'sessionRevisions', { id: legacy.executionId })
  expect(
    records.some((item) => item.schemaVersion === 1 && item.original.id === legacy.executionId),
  ).toBe(true)
  await open(page, product, info, 'history')
  const history = page.getByRole('region', { name: 'Sesiones realizadas' })
  await expect(history).toContainText(legacy.executionId)
  await expect(history.getByText(/legado|sin turno|sin prescrip|no programad/i)).not.toHaveCount(0)
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-HISTORY-004'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const saved = await record(page, member, plan.routine, plan.occurrences[0]!)
    const original = await api(page, member, 'routineVersion', {
      id: plan.routine.programId,
      version: 1,
    })
    const proposed = {
      ...plan.enrollment.content,
      stages: plan.enrollment.content.stages.map((stage) => ({
        ...stage,
        startDate: addDays(stage.startDate, 7),
        endDate: addDays(stage.endDate, 7),
      })),
    }
    const preview = await api(staff.page, staff.who, 'periodPreview', {
      id: plan.enrollment.id,
      expectedRevision: plan.enrollment.revision,
      proposed,
    })
    await api(staff.page, staff.who, 'applyPeriod', {
      enrollmentId: plan.enrollment.id,
      expectedRevision: plan.enrollment.revision,
      operationId: operation(),
      proposed,
      previewHash: preview.previewHash,
    })
    expect(await api(page, member, 'sessionRevisions', { id: saved.session.id })).toEqual([
      saved.session,
    ])
    expect(
      await api(page, member, 'routineVersion', { id: plan.routine.programId, version: 1 }),
    ).toEqual(original)
    await open(page, product, info, 'history')
    const actuals = page.getByRole('region', { name: 'Sesiones realizadas' })
    await expect(actuals).toContainText(saved.session.id)
    await expect(
      actuals.locator(`time[datetime="${saved.session.content.performedAt}"]`),
    ).toBeVisible()
    await expect(
      actuals
        .getByRole('link', { name: /Ver rutina original/ })
        .filter({ hasText: plan.routine.programId }),
    ).toHaveCount(1)
    const oldWeek = await api(page, member, 'week', {
      memberId: member.actor.id,
      weekStart: plan.weekStart,
      timeZone: 'UTC',
    })
    const nextWeek = await api(page, member, 'week', {
      memberId: member.actor.id,
      weekStart: addDays(plan.weekStart, 7),
      timeZone: 'UTC',
    })
    expect(oldWeek.completed).toBe(0)
    expect(nextWeek.completed).toBeLessThanOrEqual(nextWeek.required)
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-HISTORY-001'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const routine = await publish(staff.page, staff.who)
    const start = monday(date())
    const ref = {
      programId: routine.programId,
      version: routine.version,
      schemaVersion: 2 as const,
    }
    const content = {
      name: `WP12 timezone ${operation()}`,
      goal: 'Use the issued IANA timezone, independently of the UTC device',
      timeZone: 'America/New_York',
      stages: [
        {
          id: operation(),
          name: 'Past phase',
          startDate: addDays(start, -7),
          endDate: addDays(start, -1),
          slots: [{ id: operation(), weekday: 1, routine: ref }],
        },
        {
          id: operation(),
          name: 'Current phase',
          startDate: start,
          endDate: addDays(start, 6),
          slots: [{ id: operation(), weekday: 1, routine: ref }],
        },
        {
          id: operation(),
          name: 'Future phase',
          startDate: addDays(start, 14),
          endDate: addDays(start, 20),
          slots: [{ id: operation(), weekday: 1, routine: ref }],
        },
      ],
    }
    const goal = await api(staff.page, staff.who, 'saveGoal', {
      id: operation(),
      operationId: operation(),
      expectedRevision: 0,
      memberId: member.actor.id,
      content,
    })
    await api(staff.page, staff.who, 'enroll', {
      id: operation(),
      operationId: operation(),
      expectedRevision: 0,
      memberId: member.actor.id,
      goalProgramId: goal.id,
      issuedGoalRevision: goal.revision,
      content,
    })
    await login(page, member, info)
    await page.clock.setFixedTime(new Date(`${addDays(start, 7)}T00:30:00Z`)) // UTC Monday is still Sunday in New York.
    await open(page, product, info, 'history')
    const plan = page
      .getByRole('region', { name: 'Continuidad de la rutina' })
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: content.name, exact: true }) })
    await expect(plan).toContainText(`Hoy ${addDays(start, 6)} · America/New_York`)
    await expect(plan.locator('[aria-current="step"]')).toContainText('Current phase')
    await expect(plan).toContainText('Past phase')
    await expect(plan).toContainText('Future phase')
    await page.clock.setFixedTime(new Date(`${addDays(start, 9)}T12:00:00Z`))
    await page.reload()
    await expect(
      plan.getByRole('status').filter({ hasText: 'Hoy no hay una etapa prescrita' }),
    ).toBeVisible()
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})
