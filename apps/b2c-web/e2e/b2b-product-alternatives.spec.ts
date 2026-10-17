import {
  test,
  expect,
  principal,
  login,
  api,
  publish,
  prescribe,
  dose,
  operation,
  staffSession,
  startWorkout,
  latest,
  type Principal,
  type Page,
} from './fixtures/b2b-product/app-fixture'
import { scenarioTitle, assertProductViewport } from './fixtures/b2b-product/browser-assertions'
import type { Dose } from '../../../packages/b2b-contracts/src/product-v2.ts'

async function reviewedRoutine(page: Page, staff: Principal, sourceDose: Dose = dose()) {
  const catalog = await api(page, staff, 'catalogExercises', {})
  // Relationships and dose come only from accepted server publications, never
  // from invented reverse links or fixture-copied provider data.
  for (const exercise of catalog.filter(
    (item) => item.scope === 'base' && item.status === 'published' && !item.machineId,
  )) {
    const routine = await publish(page, staff, {
      name: `WP12 reviewed ${operation()}`,
      description: 'Actual canonical reviewed projection',
      steps: [
        {
          id: operation(),
          exerciseId: exercise.id,
          dose: sourceDose,
          substitutionPolicy: 'reviewed',
        },
      ],
    })
    const relation = routine.relations.find(
      (item) =>
        item.sourceExerciseId === exercise.id &&
        !item.target.machineId &&
        item.targetDose.load.mode === 'bodyweight',
    )
    if (relation) return { routine, relation }
  }
  throw new Error(
    'Activated product has no published canonical reviewed bodyweight target; inspect migration007/catalog/branch availability',
  )
}

test(scenarioTitle('B2BP-ALTERNATIVES-001'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const { routine, relation } = await reviewedRoutine(staff.page, staff.who)
    const plan = await prescribe(staff.page, staff.who, member, { routine, weekdays: [1] })
    await login(page, member, info)
    await startWorkout(page, product, info, plan)
    const options = page.getByRole('region', { name: 'Alternativas revisadas', exact: true })
    const offered = await options.getByRole('button', { name: /^Usar / }).allTextContents()
    expect(offered.sort()).toEqual(
      routine.relations
        .filter((r) => r.sourceExerciseId === routine.steps[0]!.exerciseId)
        .map((r) => `Usar ${r.target.name}`)
        .sort(),
    )
    const target = options.getByRole('group', { name: relation.target.name, exact: true })
    await expect(
      target.getByRole('button', { name: `Usar ${relation.target.name}`, exact: true }),
    ).toBeDisabled()
    expect(await target.getByRole('checkbox').count()).toBe(relation.conditions.length)
    for (const checkbox of await target.getByRole('checkbox').all()) await checkbox.check()
    await expect(
      target.getByRole('button', { name: `Usar ${relation.target.name}`, exact: true }),
    ).toBeEnabled()
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-ALTERNATIVES-003'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const source = await reviewedRoutine(staff.page, staff.who)
    const blocked = await publish(staff.page, staff.who, {
      name: `WP12 explicit block ${operation()}`,
      description: '',
      steps: source.routine.steps.map((step) => ({
        ...step,
        substitutionPolicy: 'blocked' as const,
      })),
    })
    const plan = await prescribe(staff.page, staff.who, member, { routine: blocked, weekdays: [1] })
    await login(page, member, info)
    await startWorkout(page, product, info, plan)
    const options = page.getByRole('region', { name: 'Alternativas revisadas', exact: true })
    await expect(options.getByRole('status')).toContainText(/bloque/i)
    await expect(options.getByRole('button', { name: /^Usar / })).toHaveCount(0)
    expect(source.routine.steps[0]!.substitutionPolicy).toBe('reviewed')
    expect(blocked.steps[0]!.substitutionPolicy).toBe('blocked')
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-ALTERNATIVES-008'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    // A valid trainer-issued timed source uses its actual published reviewed
    // relation's independent target dose. No catalog relationship is fabricated.
    const { routine, relation } = await reviewedRoutine(
      staff.page,
      staff.who,
      dose({
        mode: 'duration',
        repetitions: null,
        durationSeconds: { kind: 'fixed', value: 45 },
        load: { mode: 'external', kilograms: { kind: 'fixed', value: 20 } },
      }),
    )
    const plan = await prescribe(staff.page, staff.who, member, { routine, weekdays: [1] })
    await login(page, member, info)
    await startWorkout(page, product, info, plan)
    await page
      .getByRole('spinbutton', { name: /cantidad$/ })
      .first()
      .fill('3')
    await page.getByLabel('Carga realizada kg', { exact: true }).fill('15')
    await page.getByLabel('RPE opcional', { exact: true }).fill('7.5')
    await expect
      .poll(async () => JSON.stringify(await latest(page, member, plan.occurrences[0]!.id)))
      .toContain('"durationSeconds":3')
    const target = page
      .getByRole('region', { name: 'Alternativas revisadas' })
      .getByRole('group', { name: relation.target.name, exact: true })
    for (const checkbox of await target.getByRole('checkbox').all()) await checkbox.check()
    await target.getByRole('button', { name: `Usar ${relation.target.name}`, exact: true }).click()
    const selected = page.locator('.workout-segment').filter({
      has: page.getByRole('heading', {
        name: `${relation.target.name} · Objetivo actual`,
        exact: true,
      }),
    })
    await expect(selected).toBeVisible()
    for (const input of await selected.getByRole('spinbutton', { name: /cantidad$/ }).all())
      await expect(input).toHaveValue('')
    for (const input of await selected.getByLabel('RPE opcional', { exact: true }).all())
      await expect(input).toHaveValue('')
    await expect(selected.getByLabel('Carga realizada kg', { exact: true })).toHaveCount(0)
    await expect(
      page
        .locator('.workout-segment')
        .filter({ hasText: 'Trabajo conservado' })
        .getByRole('spinbutton', { name: /cantidad$/ })
        .first(),
    ).toHaveValue('3')
    await expect
      .poll(async () => await latest(page, member, plan.occurrences[0]!.id))
      .toMatchObject({ content: { status: 'draft' } })
    for (const input of await selected.getByRole('spinbutton', { name: /cantidad$/ }).all())
      await input.fill('1')
    await page.getByRole('button', { name: 'Completar sesión explícitamente' }).click()
    await expect
      .poll(async () => await latest(page, member, plan.occurrences[0]!.id))
      .toMatchObject({ content: { status: 'completed', explicitCompletion: true } })
    const saved = await latest(page, member, plan.occurrences[0]!.id)
    if (!saved || saved.schemaVersion !== 2) throw new Error('Expected accepted server segments')
    const targetSegment = saved.content.segments.find(
      (s) => s.exerciseId === relation.targetExerciseId,
    )!
    expect(targetSegment.dose).toEqual(relation.targetDose)
    expect(targetSegment.relation).toEqual(relation)
    expect(saved.content.segments).toHaveLength(2)
    expect(
      saved.content.sets.some(
        (set) => set.durationSeconds === 3 && set.segmentId !== targetSegment.segmentId,
      ),
    ).toBe(true)
    expect(saved.origin).toMatchObject({ routine: plan.occurrences[0]!.routine })
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-ALTERNATIVES-010'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const { routine, relation } = await reviewedRoutine(staff.page, staff.who)
    const plan = await prescribe(staff.page, staff.who, member, { routine, weekdays: [1] })
    await login(page, member, info)
    await startWorkout(page, product, info, plan)
    await page
      .getByRole('spinbutton', { name: /cantidad$/ })
      .first()
      .fill('2')
    const target = page
      .getByRole('region', { name: 'Alternativas revisadas' })
      .getByRole('group', { name: relation.target.name, exact: true })
    for (const checkbox of await target.getByRole('checkbox').all()) await checkbox.check()
    await target.getByRole('button', { name: `Usar ${relation.target.name}`, exact: true }).click()
    await expect
      .poll(async () => {
        const record = await latest(page, member, plan.occurrences[0]!.id)
        return record?.schemaVersion === 2 ? record.content.segments.length : 0
      })
      .toBe(2)
    const before = await latest(page, member, plan.occurrences[0]!.id)
    await page.getByRole('button', { name: 'Volver a este objetivo', exact: true }).click()
    await expect(
      page
        .locator('.workout-segment')
        .filter({ hasText: 'Objetivo actual' })
        .getByRole('spinbutton', { name: /cantidad$/ })
        .first(),
    ).toHaveValue('2')
    await expect
      .poll(async () => await latest(page, member, plan.occurrences[0]!.id))
      .toMatchObject({ content: { status: 'draft' } })
    const after = await latest(page, member, plan.occurrences[0]!.id)
    if (!before || before.schemaVersion !== 2 || !after || after.schemaVersion !== 2)
      throw new Error('Expected accepted actual segment records')
    expect(after.content.segments).toEqual(before.content.segments)
    expect(after.content.sets).toEqual(before.content.sets)
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})
