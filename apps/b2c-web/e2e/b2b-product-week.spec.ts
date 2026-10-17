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
  startWorkout,
  latest,
  publish,
  dose,
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

test(scenarioTitle('B2BP-WEEK-002'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    await startWorkout(page, product, info, plan)
    const summary = () =>
      api(page, member, 'week', {
        memberId: member.actor.id,
        weekStart: plan.weekStart,
        timeZone: 'UTC',
      })
    expect(await summary()).toMatchObject({ required: 1, completed: 0, partial: 0, missed: 1 })
    const initial = await latest(page, member, plan.occurrences[0]!.id)
    expect(initial).toMatchObject({
      content: { status: 'draft', explicitCompletion: false, sets: [] },
    })
    await page
      .getByRole('spinbutton', { name: /cantidad$/ })
      .first()
      .fill('1')
    await expect
      .poll(async () => (await latest(page, member, plan.occurrences[0]!.id))?.content.sets.length)
      .toBe(1)
    expect(await summary()).toMatchObject({ completed: 0, partial: 1, missed: 1 })
    await page.getByRole('button', { name: 'Guardar parcial', exact: true }).click()
    await expect.poll(summary).toMatchObject({ required: 1, completed: 0, partial: 1, missed: 1 })
    await expect(
      page.getByRole('status').filter({ hasText: 'Sincronizado. Guardar no completa la sesión.' }),
    ).toBeVisible()
    expect((await latest(page, member, plan.occurrences[0]!.id))!.content.explicitCompletion).toBe(
      false,
    )
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-WEEK-012'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const catalog = await api(staff.page, staff.who, 'catalogExercises', {})
    const routine = await publish(staff.page, staff.who, {
      name: `WP12 ranged minimum ${operation()}`,
      description: 'Truthful positive actuals may be below target',
      steps: [
        {
          id: operation(),
          exerciseId: catalog.find((e) => e.status === 'published' && !e.machineId)!.id,
          substitutionPolicy: 'reviewed',
          dose: dose({
            sets: { kind: 'range', min: 2, max: 4 },
            repetitions: { kind: 'range', min: 8, max: 12 },
          }),
        },
      ],
    })
    const plan = await prescribe(staff.page, staff.who, member, { routine, weekdays: [1] })
    await login(page, member, info)
    await startWorkout(page, product, info, plan)
    const rows = page.getByRole('spinbutton', { name: /cantidad$/ })
    await expect(rows).toHaveCount(2)
    await rows.nth(0).fill('1')
    await rows.nth(1).fill('2')
    await page.getByRole('button', { name: 'Completar sesión explícitamente', exact: true }).click()
    await expect
      .poll(async () => (await latest(page, member, plan.occurrences[0]!.id))?.content.status)
      .toBe('completed')
    const saved = (await latest(page, member, plan.occurrences[0]!.id))!
    expect(saved.content.sets.map((s) => s.repetitions)).toEqual([1, 2])
    const content = {
      ...saved.content,
      correctionReason: 'Include one additional truthful set',
      sets: [
        ...saved.content.sets,
        { ...saved.content.sets[1]!, performedSetId: operation(), ordinal: 3, repetitions: 1 },
      ],
    }
    const extra = await api(page, member, 'saveSession', {
      id: saved.id,
      origin: saved.origin,
      expectedRevision: saved.revision,
      operationId: operation(),
      content,
    })
    expect(extra.session.content.sets).toHaveLength(3)
    expect(
      await api(page, member, 'week', {
        memberId: member.actor.id,
        weekStart: plan.weekStart,
        timeZone: 'UTC',
      }),
    ).toMatchObject({ required: 1, completed: 1, partial: 0 })
    await showWeek(page, product, info, plan.weekStart)
    await expect(page.locator(`[id="actual-session-${saved.id}"]`)).toContainText('3 / both')
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-WEEK-007'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    await login(page, member, info)
    for (const [weekStart, lastInstant, nextMonday] of [
      ['2025-03-03', '2025-03-10T03:59:59.999Z', '2025-03-10T04:00:00.000Z'],
      ['2025-10-27', '2025-11-03T04:59:59.999Z', '2025-11-03T05:00:00.000Z'],
    ] as const) {
      const plan = await prescribe(staff.page, staff.who, member, {
        weekStart,
        timeZone: 'America/New_York',
        weekdays: [7],
      })
      const content = actualContent(plan.routine, addDays(weekStart, 6))
      content.performedAt = lastInstant
      const saved = await api(page, member, 'saveSession', {
        id: operation(),
        operationId: operation(),
        expectedRevision: 0,
        origin: {
          kind: 'occurrence',
          occurrenceId: plan.occurrences[0]!.id,
          routine: plan.occurrences[0]!.routine,
        },
        content,
      })
      const input = { memberId: member.actor.id, weekStart, timeZone: 'America/New_York' }
      expect(await api(page, member, 'week', input)).toMatchObject({
        required: 1,
        completed: 1,
        closed: true,
      })
      const tokyo = await newPage(context, info, 'Asia/Tokyo')
      try {
        await login(tokyo.page, member, info)
        expect(
          await tokyo.page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
        ).toBe('Asia/Tokyo')
        expect(await api(tokyo.page, member, 'week', input)).toMatchObject({
          completed: 1,
          week: { startDate: weekStart, timeZone: 'America/New_York' },
        })
        await showWeek(tokyo.page, product, info, weekStart, 'America/New_York')
        await expect(tokyo.page.getByRole('region', { name: 'Calendario semanal' })).toContainText(
          'America/New_York',
        )
        await assertProductViewport(tokyo.page, info)
      } finally {
        await tokyo.context.close()
      }
      await api(page, member, 'saveSession', {
        id: saved.session.id,
        origin: saved.session.origin,
        expectedRevision: saved.session.revision,
        operationId: operation(),
        content: {
          ...saved.session.content,
          performedAt: nextMonday,
          correctionReason: 'Correct timestamp onto the excluded Monday boundary',
        },
      })
      expect(await api(page, member, 'week', input)).toMatchObject({ completed: 0, missed: 1 })
    }
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-WEEK-010'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [3] })
    await login(page, member, info)
    await record(page, member, plan.routine, plan.occurrences[0]!)
    const original = plan.occurrences[0]!
    let enrollment = plan.enrollment
    for (const adding of [true, false]) {
      const stage = enrollment.content.stages[0]!
      const originalSlot = stage.slots.find((s) => s.id === original.slotId)!
      const proposed = {
        ...enrollment.content,
        stages: [
          {
            ...stage,
            slots: adding
              ? [{ ...originalSlot, id: operation(), weekday: 1 }, originalSlot]
              : [originalSlot],
          },
        ],
      }
      const preview = await api(staff.page, staff.who, 'periodPreview', {
        id: enrollment.id,
        expectedRevision: enrollment.revision,
        proposed,
      })
      enrollment = await api(staff.page, staff.who, 'applyPeriod', {
        enrollmentId: enrollment.id,
        expectedRevision: enrollment.revision,
        operationId: operation(),
        proposed,
        previewHash: preview.previewHash,
      })
      const current = (await api(page, member, 'occurrence', { id: original.id })).occurrence
      expect(current).toMatchObject({
        id: original.id,
        slotId: original.slotId,
        slotOrdinal: original.slotOrdinal,
        originalDate: original.originalDate,
        eligibility: 'required',
      })
      const summary = await api(page, member, 'week', {
        memberId: member.actor.id,
        weekStart: plan.weekStart,
        timeZone: 'UTC',
      })
      expect(summary).toMatchObject({ required: adding ? 2 : 1, completed: 1 })
      expect(summary.completed).toBeLessThanOrEqual(summary.required)
    }
    await showWeek(page, product, info, plan.weekStart)
    await expect(page.locator(`[id="scheduled-occurrence-${original.id}"]`)).toHaveCount(1)
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-WEEK-011'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member)
    await login(page, member, info)
    for (const occurrence of plan.occurrences.slice(0, 3))
      await record(page, member, plan.routine, occurrence)
    await record(page, member, plan.routine, plan.occurrences[3]!, 'partial')
    await showWeek(page, product, info, plan.weekStart)
    const card = page.locator(`[id="scheduled-occurrence-${plan.occurrences[3]!.id}"]`)
    const control = card.getByLabel('Mover dentro de esta semana', { exact: true })
    if (info.project.use.hasTouch) await control.tap()
    else await control.focus()
    await control.selectOption(addDays(plan.weekStart, 6))
    const accepted = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().includes(`/occurrences/${plan.occurrences[3]!.id}/move`),
    )
    const button = card.getByRole('button', { name: 'Confirmar cambio de día', exact: true })
    if (info.project.use.hasTouch) await button.tap()
    else {
      await button.focus()
      await page.keyboard.press('Enter')
    }
    expect((await accepted).ok()).toBe(true)
    await expect(card).toBeFocused()
    expect(
      await api(page, member, 'week', {
        memberId: member.actor.id,
        weekStart: plan.weekStart,
        timeZone: 'UTC',
      }),
    ).toMatchObject({ required: 4, completed: 3, partial: 1, missed: 1 })
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-WEEK-005'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    const stage = plan.enrollment.content.stages[0]!
    const proposed = {
      ...plan.enrollment.content,
      stages: [
        { ...stage, endDate: addDays(plan.weekStart, 1) },
        {
          ...stage,
          id: operation(),
          name: 'Second phase of the same week',
          startDate: addDays(plan.weekStart, 2),
          slots: [{ ...stage.slots[0]!, id: operation(), weekday: 5 }],
        },
      ],
    }
    const preview = await api(staff.page, staff.who, 'periodPreview', {
      id: plan.enrollment.id,
      expectedRevision: plan.enrollment.revision,
      proposed,
    })
    const enrollment = await api(staff.page, staff.who, 'applyPeriod', {
      enrollmentId: plan.enrollment.id,
      expectedRevision: plan.enrollment.revision,
      operationId: operation(),
      proposed,
      previewHash: preview.previewHash,
    })
    await login(page, member, info)
    const current = (await api(page, member, 'occurrence', { id: plan.occurrences[0]!.id }))
      .occurrence
    const moved = await api(page, member, 'moveOccurrence', {
      id: current.id,
      expectedRevision: current.revision,
      operationId: operation(),
      scheduledDate: addDays(plan.weekStart, 4),
    })
    expect(moved).toMatchObject({
      id: current.id,
      stageId: stage.id,
      permittedDateOverride: addDays(plan.weekStart, 4),
    })
    const actual = await record(page, member, plan.routine, moved)
    expect(
      await api(page, member, 'week', {
        memberId: member.actor.id,
        weekStart: plan.weekStart,
        timeZone: 'UTC',
      }),
    ).toMatchObject({ required: 2, completed: 1 })
    const later = {
      ...enrollment.content,
      stages: enrollment.content.stages.map((s) => ({
        ...s,
        startDate: addDays(s.startDate, 7),
        endDate: addDays(s.endDate, 7),
      })),
    }
    const impact = await api(staff.page, staff.who, 'periodPreview', {
      id: enrollment.id,
      expectedRevision: enrollment.revision,
      proposed: later,
    })
    expect(impact.impacts.find((i) => i.occurrenceId === moved.id)).toMatchObject({
      beforeDate: moved.scheduledDate,
      linkedSessionIds: [actual.session.id],
    })
    await showWeek(page, product, info, plan.weekStart)
    await expect(page.locator(`[id="scheduled-occurrence-${moved.id}"]`)).toContainText(
      'Completada',
    )
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-WEEK-008'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1], durationDays: 14 })
    await login(page, member, info)
    await startWorkout(page, product, info, plan)
    await expect(
      page.getByRole('status').filter({ hasText: 'Sincronizado. Guardar no completa la sesión.' }),
    ).toBeVisible()
    await context.setOffline(true)
    await page
      .getByRole('spinbutton', { name: /cantidad$/ })
      .first()
      .fill('1')
    await page.getByRole('button', { name: 'Completar sesión explícitamente', exact: true }).click()
    await expect(
      page.getByRole('status').filter({ hasText: /Sin conexión|pendiente|local/i }),
    ).toBeVisible()
    await context.setOffline(false)
    await expect
      .poll(async () => (await latest(page, member, plan.occurrences[0]!.id))?.content.status)
      .toBe('completed')
    const accepted = (await latest(page, member, plan.occurrences[0]!.id))!
    expect(accepted.content.performedAt.slice(0, 10)).toBe(plan.weekStart)
    expect(Date.parse(accepted.acceptedAt)).toBeGreaterThan(
      Date.parse(accepted.content.performedAt) + 7 * 86400000,
    )
    const query = (weekStart: string) =>
      api(page, member, 'week', { memberId: member.actor.id, weekStart, timeZone: 'UTC' })
    const old = await query(plan.weekStart),
      next = await query(addDays(plan.weekStart, 7))
    expect(old).toMatchObject({ completed: 1, closed: true })
    await api(page, member, 'saveSession', {
      id: accepted.id,
      origin: accepted.origin,
      expectedRevision: accepted.revision,
      operationId: operation(),
      content: {
        ...accepted.content,
        performedAt: `${addDays(plan.weekStart, 7)}T10:00:00Z`,
        correctionReason: 'Correct the performed week without rebinding the occurrence',
      },
    })
    const oldAfter = await query(plan.weekStart),
      nextAfter = await query(addDays(plan.weekStart, 7))
    expect(oldAfter).toMatchObject({ completed: 0, missed: 1 })
    expect(nextAfter).toMatchObject({ completed: 0, missed: 1 })
    expect(oldAfter.revision).toBeGreaterThan(old.revision)
    expect(nextAfter.revision).toBeGreaterThan(next.revision)
    await showWeek(page, product, info, plan.weekStart)
    await expect(page.locator(`[id="actual-session-${accepted.id}"]`)).toContainText(
      'Trabajo conservado, excluido del seguimiento vigente',
    )
    await assertProductViewport(page, info)
  } finally {
    await context.setOffline(false)
    await staff.context.close()
  }
})
