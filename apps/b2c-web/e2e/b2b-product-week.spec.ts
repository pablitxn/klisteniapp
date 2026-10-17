import {
  test,
  expect,
  principal,
  login,
  api,
  raw,
  prescribe,
  record,
  showWeek,
  addDays,
  operation,
  staffSession,
  actualContent,
  monday,
  newPage,
} from './fixtures/b2b-product/app-fixture'
import { scenarioTitle, assertProductViewport } from './fixtures/b2b-product/browser-assertions'

test(scenarioTitle('B2BP-WEEK-001'), async ({ page, context, product }, info) => {
  const member = principal(product)
  const staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member)
    await login(page, member, info)
    for (const occurrence of plan.occurrences.slice(0, 3))
      await record(page, member, plan.routine, occurrence)
    await record(page, member, plan.routine, plan.occurrences[3]!, 'partial')
    const summary = await api(page, member, 'week', {
      memberId: member.actor.id,
      weekStart: plan.weekStart,
      timeZone: 'UTC',
    })
    expect(summary).toMatchObject({
      required: 4,
      completed: 3,
      partial: 1,
      missed: 1,
      pending: 0,
      closed: true,
    })
    await showWeek(page, product, info, plan.weekStart)
    const calendar = page.getByRole('region', { name: 'Calendario semanal' })
    for (const [label, count] of [
      ['Prescritas', 4],
      ['Completadas', 3],
      ['Parciales', 1],
      ['Ausentes', 1],
      ['Pendientes', 0],
    ] as const) {
      await expect(
        calendar
          .locator('dt')
          .filter({ hasText: new RegExp(`^${label}$`) })
          .locator('..')
          .locator('dd'),
      ).toHaveText(String(count))
    }
    await expect(
      calendar.getByText('Parcial al cierre: incluida entre las ausentes.'),
    ).toBeVisible()
    await assertProductViewport(page, info)
    const openMember = principal(product, 'secondary-member', 'atlas', true)
    const openStaff = { ...staff.who, branchId: openMember.branchId }
    const openPlan = await prescribe(staff.page, openStaff, openMember, {
      weekStart: monday(),
      weekdays: [1, 1, 1, 1],
    })
    const peer = await newPage(context, info)
    try {
      await login(peer.page, openMember, info)
      for (const [index, occurrence] of openPlan.occurrences.entries()) {
        const content = actualContent(
          openPlan.routine,
          openPlan.weekStart,
          index < 3 ? 'completed' : 'partial',
        )
        content.performedAt = `${openPlan.weekStart}T00:00:00Z`
        content.segments.forEach((segment) => {
          segment.createdAt = content.performedAt
        })
        await api(peer.page, openMember, 'saveSession', {
          id: operation(),
          operationId: operation(),
          expectedRevision: 0,
          origin: { kind: 'occurrence', occurrenceId: occurrence.id, routine: occurrence.routine },
          content,
        })
      }
      expect(
        await api(peer.page, openMember, 'week', {
          memberId: openMember.actor.id,
          weekStart: openPlan.weekStart,
          timeZone: 'UTC',
        }),
      ).toMatchObject({
        required: 4,
        completed: 3,
        partial: 1,
        missed: 0,
        pending: 1,
        closed: false,
      })
      await showWeek(peer.page, product, info, openPlan.weekStart)
      await expect(peer.page.getByRole('region', { name: 'Calendario semanal' })).toContainText(
        'Semana en curso',
      )
      await assertProductViewport(peer.page, info)
    } finally {
      await peer.context.close()
    }
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-WEEK-003'), async ({ page, context, product }, info) => {
  const member = principal(product)
  const staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    await showWeek(page, product, info, plan.weekStart)
    const occurrence = plan.occurrences[0]!
    const card = page.locator(`[id="scheduled-occurrence-${occurrence.id}"]`)
    const control = card.getByLabel('Mover dentro de esta semana', { exact: true })
    await expect(control.locator('option')).toHaveCount(7)
    await control.focus()
    await page.keyboard.press('End')
    expect(await control.inputValue()).toBe(addDays(plan.weekStart, 6))
    const moved = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' && r.url().includes(`/occurrences/${occurrence.id}/move`),
    )
    await card.getByRole('button', { name: 'Confirmar cambio de día' }).click()
    const response = await moved
    expect(response.ok()).toBe(true)
    const after = await response.json()
    expect(after).toMatchObject({
      id: occurrence.id,
      stageId: occurrence.stageId,
      routine: occurrence.routine,
      originalDate: occurrence.originalDate,
      scheduledDate: addDays(plan.weekStart, 6),
    })
    await expect(page.locator(`[id="scheduled-occurrence-${occurrence.id}"]`)).toBeFocused()
    const authoritative = await api(page, member, 'week', {
      memberId: member.actor.id,
      weekStart: plan.weekStart,
      timeZone: 'UTC',
    })
    expect(authoritative.required).toBe(1)
    expect(authoritative.occurrenceIds).toEqual([occurrence.id])
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-WEEK-004'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1, 2] })
    await login(page, member, info)
    await record(page, member, plan.routine, plan.occurrences[0]!)
    await showWeek(page, product, info, plan.weekStart)
    await expect(
      page
        .locator(`[id="scheduled-occurrence-${plan.occurrences[0]!.id}"]`)
        .getByLabel('Mover dentro de esta semana'),
    ).toHaveCount(0)
    const pending = plan.occurrences[1]!
    const outside = await raw(page, member, 'moveOccurrence', {
      id: pending.id,
      expectedRevision: pending.revision,
      operationId: operation(),
      scheduledDate: addDays(plan.weekStart, 7),
    })
    expect(outside.ok()).toBe(false)
    expect((await outside.json()).code).toBe('OUTSIDE_PRESCRIBED_WEEK')
    const foreign = principal(product, 'secondary-member', 'atlas', true)
    const denied = await raw(
      page,
      member,
      'moveOccurrence',
      {
        id: pending.id,
        expectedRevision: pending.revision,
        operationId: operation(),
        scheduledDate: addDays(plan.weekStart, 3),
      },
      { branchId: foreign.branchId },
    )
    expect([403, 404, 409]).toContain(denied.status())
    expect(
      (
        await api(page, member, 'occurrences', {
          memberId: member.actor.id,
          weekStart: plan.weekStart,
          timeZone: 'UTC',
        })
      ).find((o) => o.id === pending.id)!.scheduledDate,
    ).toBe(pending.scheduledDate)
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-WEEK-006'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1, 1] })
    await login(page, member, info)
    const accepted = await record(page, member, plan.routine, plan.occurrences[0]!)
    const replay = await api(page, member, 'saveSession', accepted.sent)
    expect(replay).toEqual({ session: accepted.session, receipt: accepted.receipt })
    await showWeek(page, product, info, plan.weekStart)
    for (const o of plan.occurrences)
      await expect(page.locator(`[id="scheduled-occurrence-${o.id}"]`)).toBeVisible()
    expect(plan.occurrences[0]!.id).not.toBe(plan.occurrences[1]!.id)
    const week = await api(page, member, 'week', {
      memberId: member.actor.id,
      weekStart: plan.weekStart,
      timeZone: 'UTC',
    })
    expect(week).toMatchObject({ required: 2, completed: 1, missed: 1 })
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-WEEK-009'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const saved = await record(page, member, plan.routine, plan.occurrences[0]!)
    const partial = await api(page, member, 'saveSession', {
      id: saved.session.id,
      origin: saved.session.origin,
      expectedRevision: saved.session.revision,
      operationId: operation(),
      content: {
        ...saved.session.content,
        status: 'partial',
        explicitCompletion: false,
        correctionReason: 'Correct mistaken completion',
      },
    })
    await showWeek(page, product, info, plan.weekStart)
    await expect(
      page.locator(`[id="scheduled-occurrence-${plan.occurrences[0]!.id}"]`),
    ).toContainText('Parcial')
    expect(
      await api(page, member, 'week', {
        memberId: member.actor.id,
        weekStart: plan.weekStart,
        timeZone: 'UTC',
      }),
    ).toMatchObject({ required: 1, completed: 0, missed: 1, partial: 1 })
    await api(page, member, 'saveSession', {
      id: partial.session.id,
      origin: partial.session.origin,
      expectedRevision: partial.session.revision,
      operationId: operation(),
      content: {
        ...partial.session.content,
        status: 'void',
        explicitCompletion: false,
        correctionReason: 'Void mistaken record',
      },
    })
    const revisions = await api(page, member, 'sessionRevisions', { id: saved.session.id })
    expect(revisions).toHaveLength(3)
    expect(revisions[0]).toMatchObject({ origin: saved.session.origin })
    await page.reload()
    await expect(page.getByRole('region', { name: 'Sesiones realizadas' })).toContainText('Anulada')
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})
