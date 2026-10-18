import { reloadHistory, waitForHistoryReady } from './fixtures/b2b-product/readiness'
import type { Response } from '@playwright/test'
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
    const continuity = page.getByRole('region', { name: 'Continuidad de la rutina' })
    const started = performance.now()
    let regionWaitStarted: number | undefined
    let regionVisible = false
    const responses: Array<{ endpoint: string; status: number; elapsedMs: number }> = []
    const recordResponse = (response: Response) => {
      const endpoint = new URL(response.url()).pathname.match(
        /\/(context|bootstrap\/v2|access|continuity|sessions|week|occurrences)$/,
      )?.[1]
      if (endpoint)
        responses.push({
          endpoint,
          status: response.status(),
          elapsedMs: Math.round(performance.now() - started),
        })
    }
    page.on('response', recordResponse)
    try {
      await open(page, product, info, 'history')
      regionWaitStarted = performance.now()
      await expect(continuity).toBeVisible({ timeout: 30000 })
      regionVisible = true
    } finally {
      page.off('response', recordResponse)
      await info.attach(`history-continuity-readiness-${operation()}`, {
        body: Buffer.from(
          JSON.stringify({
            regionVisible,
            maximumRegionWaitMs: 30000,
            navigationMs:
              regionWaitStarted === undefined ? null : Math.round(regionWaitStarted - started),
            regionWaitMs:
              regionWaitStarted === undefined
                ? null
                : Math.round(performance.now() - regionWaitStarted),
            responseTiming: 'Browser response events; body completion is not inferred.',
            responses,
          }),
        ),
        contentType: 'application/json',
      })
    }
    await expect(continuity).toContainText(plan.enrollment.content.name)
    await expect(continuity).toContainText(plan.enrollment.content.goal)
    await expect(continuity).toContainText(plan.enrollment.content.stages[0]!.name)
    await expect(continuity.getByText(/cantidad de sustituciones|substitution count/i)).toHaveCount(
      0,
    )
    const enrolled = continuity.locator(':scope > div').filter({
      has: page.getByRole('heading', { name: plan.enrollment.content.name, exact: true }),
    })
    await enrolled
      .getByRole('button', {
        name: `Ver detalle del período vigente r${plan.enrollment.revision}`,
        exact: true,
      })
      .click()
    const detail = enrolled.getByRole('region', {
      name: `Período registrado r${plan.enrollment.revision}`,
      exact: true,
    })
    await expect(detail).toContainText(plan.enrollment.content.goal)
    await expect(detail).toContainText(plan.enrollment.content.timeZone)
    await expect(detail).toContainText(plan.enrollment.content.stages[0]!.startDate)
    await expect(detail).toContainText(staff.who.actor.id)
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
    await session
      .getByRole('button', {
        name: `Ver período original emitido r${plan.enrollment.revision}`,
        exact: true,
      })
      .click()
    const issued = session.getByRole('region', {
      name: `Período registrado r${plan.enrollment.revision}`,
      exact: true,
    })
    await expect(issued).toContainText(plan.enrollment.content.goal)
    await expect(issued).toContainText(plan.enrollment.content.stages[0]!.startDate)
    await expect(issued).toContainText('Etapa original de este registro')
    await expect(issued).toContainText(staff.who.actor.id)
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
    const revised = await api(staff.page, staff.who, 'applyPeriod', {
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
    const actual = actuals.locator(`[id="actual-session-${saved.session.id}"]`)
    await actual
      .getByRole('button', {
        name: `Ver período original emitido r${plan.enrollment.revision}`,
        exact: true,
      })
      .click()
    const issued = actual.getByRole('region', {
      name: `Período registrado r${plan.enrollment.revision}`,
      exact: true,
    })
    await expect(issued).toContainText(plan.enrollment.content.stages[0]!.startDate)
    const currentPlan = page
      .getByRole('region', { name: 'Continuidad de la rutina' })
      .locator(':scope > div')
      .filter({
        has: page.getByRole('heading', { name: revised.content.name, exact: true }),
      })
    await currentPlan
      .getByRole('button', {
        name: `Ver detalle del período vigente r${revised.revision}`,
        exact: true,
      })
      .click()
    const currentPeriod = currentPlan.getByRole('region', {
      name: `Período registrado r${revised.revision}`,
      exact: true,
    })
    await expect(currentPeriod).toContainText(proposed.stages[0]!.startDate)
    expect(revised.revision).toBeGreaterThan(plan.enrollment.revision)
    expect(
      (
        await api(page, member, 'enrollmentRevision', {
          id: plan.enrollment.id,
          revision: plan.enrollment.revision,
        })
      ).enrollment,
    ).toEqual(plan.enrollment)
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
    await reloadHistory(page, info)
    await expect(
      plan.getByRole('status').filter({ hasText: 'Hoy no hay una etapa prescrita' }),
    ).toBeVisible()
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-HISTORY-005'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const actual = await record(page, member, plan.routine, plan.occurrences[0]!)
    // Remove the original stable slot. A new slot is a separate obligation,
    // even when its routine and calendar date happen to be identical.
    const proposed = {
      ...plan.enrollment.content,
      stages: plan.enrollment.content.stages.map((stage) => ({
        ...stage,
        slots: stage.slots.map((slot) => ({ ...slot, id: operation() })),
      })),
    }
    const preview = await api(staff.page, staff.who, 'periodPreview', {
      id: plan.enrollment.id,
      expectedRevision: plan.enrollment.revision,
      proposed,
    })
    expect(preview.impacts.find((i) => i.occurrenceId === plan.occurrences[0]!.id)).toMatchObject({
      afterEligibility: 'cancelled',
      linkedSessionIds: [actual.session.id],
    })
    await api(staff.page, staff.who, 'applyPeriod', {
      enrollmentId: plan.enrollment.id,
      expectedRevision: plan.enrollment.revision,
      operationId: operation(),
      proposed,
      previewHash: preview.previewHash,
    })
    const linked = await api(page, member, 'occurrence', { id: plan.occurrences[0]!.id })
    expect(linked.occurrence.eligibility).toBe('cancelled')
    expect(linked.occurrence.cancellationReason).toBeTruthy()
    const summary = await api(page, member, 'week', {
      memberId: member.actor.id,
      weekStart: plan.weekStart,
      timeZone: 'UTC',
    })
    expect(summary).toMatchObject({ required: 1, completed: 0, missed: 1 })
    expect(summary.occurrenceIds).not.toContain(plan.occurrences[0]!.id)
    await open(page, product, info, 'history')
    const entry = page.locator(`[id="actual-session-${actual.session.id}"]`)
    await expect(entry).toContainText('Trabajo conservado, excluido del seguimiento vigente')
    await expect(entry).toContainText(
      actual.session.origin.kind === 'occurrence' ? actual.session.origin.occurrenceId : '',
    )
    expect(await api(page, member, 'sessionRevisions', { id: actual.session.id })).toEqual([
      actual.session,
    ])
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-HISTORY-009'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const saved = await record(page, member, plan.routine, plan.occurrences[0]!)
    await open(page, product, info, 'history')
    await page.getByRole('link', { name: `Ver sesión ${saved.session.id}`, exact: true }).click()
    await reloadHistory(page, info)
    await expect(page.locator(`[id="actual-session-${saved.session.id}"]`)).toBeVisible()
    await open(page, product, info, 'health')
    await page.goBack()
    await waitForHistoryReady(page, info)
    await expect(page.getByRole('region', { name: 'Sesiones realizadas' })).toContainText(
      saved.session.id,
    )
    await page.goForward()
    await expect(
      page.getByRole('heading', { name: 'Mi salud y privacidad', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Salir', exact: true }).click()
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
    await login(page, principal(product, 'secondary-member', 'atlas', true), info)
    await open(page, product, info, 'history')
    await reloadHistory(page, info)
    await expect(page.getByRole('region', { name: 'Sesiones realizadas' })).not.toContainText(
      saved.session.id,
    )
    await expect(page.getByText(plan.enrollment.content.name, { exact: true })).toHaveCount(0)
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})
