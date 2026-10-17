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
  open,
  unavailable,
  type Principal,
  type Page,
} from './fixtures/b2b-product/app-fixture'
import { scenarioTitle, assertProductViewport } from './fixtures/b2b-product/browser-assertions'
import { reviewedDurationFixture } from './fixtures/b2b-product/reviewed-duration'
import type { Dose, ReviewedRelation } from '../../../packages/b2b-contracts/src/product-v2.ts'
import { exercises as canonical } from '../../../packages/catalog-base/src/exercises.ts'

async function reviewedRoutine(
  page: Page,
  staff: Principal,
  sourceDose: Dose = dose(),
  accept: (relation: ReviewedRelation) => boolean = (relation) =>
    relation.target.equipment === 'none',
) {
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
        item.targetDose.load.mode === 'bodyweight' &&
        accept(item),
      // Target selection remains a filter over the actual published snapshot.
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
      .toMatchObject({ content: { status: 'partial', explicitCompletion: false } })
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
      .toMatchObject({ content: { status: 'partial', explicitCompletion: false } })
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

test(scenarioTitle('B2BP-ALTERNATIVES-002'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    expect(canonical).toHaveLength(37)
    expect(canonical.flatMap((e) => e.planning.relations)).toHaveLength(42)
    expect(canonical.filter((e) => !e.planning.relations.length)).toHaveLength(9)
    const routine = await publish(staff.page, staff.who, {
      name: `WP12 directed catalog ${operation()}`,
      description: 'Whole canonical directed graph, without inferred edges',
      steps: canonical.map((e) => ({
        id: operation(),
        exerciseId: e.id,
        dose: dose(),
        substitutionPolicy: 'reviewed',
      })),
    })
    const expected = canonical
      .flatMap((e) => e.planning.relations.map((r) => `${e.id}->${r.targetId}`))
      .sort()
    expect(
      routine.relations.map((r) => `${r.sourceExerciseId}->${r.targetExerciseId}`).sort(),
    ).toEqual(expected)
    expect(new Set(routine.relations.map((r) => r.catalogRevision)).size).toBe(1)
    for (const relation of routine.relations) {
      expect(relation.catalogRevision).toMatch(/^[a-f0-9]{64}$/)
      expect(relation.sourceContentHash).toMatch(/^[a-f0-9]{64}$/)
      expect(relation.targetContentHash).toMatch(/^[a-f0-9]{64}$/)
      expect(relation.requirements.some((r) => r.startsWith('source:'))).toBe(true)
    }
    await prescribe(staff.page, staff.who, member, { routine, weekdays: [1] })
    await login(page, member, info)
    await open(page, product, info, 'history')
    await page
      .locator(`[id="original-routine-${routine.programId}-v1-s2"]`)
      .getByRole('button', { name: 'Abrir esta versión original', exact: true })
      .click()
    await expect(page.getByRole('heading', { name: routine.name, exact: true })).toBeVisible()
    for (const exercise of canonical)
      await expect(page.getByRole('heading', { name: exercise.name, exact: true })).toBeVisible()
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-ALTERNATIVES-004'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const routine = await publish(staff.page, staff.who, {
      name: `WP12 actual equipment ${operation()}`,
      description: 'Equipment and condition confirmations are separate',
      steps: [{ id: operation(), exerciseId: 'row', dose: dose(), substitutionPolicy: 'reviewed' }],
    })
    const relation = routine.relations.find((r) => r.target.equipment === 'bar-or-rings')!
    expect(relation).toBeTruthy()
    const plan = await prescribe(staff.page, staff.who, member, { routine, weekdays: [1] })
    await login(page, member, info)
    await startWorkout(page, product, info, plan)
    const target = page
      .getByRole('region', { name: 'Alternativas revisadas', exact: true })
      .getByRole('group', { name: relation.target.name, exact: true })
    for (const checkbox of await target.getByRole('checkbox').all()) await checkbox.check()
    const choose = target.getByRole('button', { name: `Usar ${relation.target.name}`, exact: true })
    await expect(choose).toBeDisabled()
    await expect(target.getByRole('status')).toContainText(
      'El equipo necesario no está disponible en esta sede.',
    )
    await page
      .getByRole('checkbox', { name: 'Confirmo que tengo bar-or-rings disponible', exact: true })
      .check()
    await expect(choose).toBeEnabled()
    await expect(
      page.getByRole('region', { name: 'Alternativas revisadas', exact: true }),
    ).toContainText('No se presume la misma carga ni el mismo efecto.')
    await choose.click()
    await expect
      .poll(
        async () => (await latest(page, member, plan.occurrences[0]!.id))?.content.segments.length,
      )
      .toBe(2)
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-ALTERNATIVES-005'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const catalog = await api(staff.page, staff.who, 'catalogExercises', {})
    const local = catalog.find(
      (e) =>
        e.scope === 'organization' &&
        e.status === 'published' &&
        e.baseExerciseId &&
        e.animationId === e.baseExerciseId,
    )
    if (!local)
      unavailable(
        info,
        'Actual activated seed has no published changed local adaptation with matching base/animation; INTEGRATION must supply its accepted catalog fixture',
      )
    const routine = await publish(staff.page, staff.who, {
      name: `WP12 local adaptation ${operation()}`,
      description: '',
      steps: [
        { id: operation(), exerciseId: local.id, dose: dose(), substitutionPolicy: 'reviewed' },
      ],
    })
    expect(routine.relations.filter((r) => r.sourceExerciseId === local.id)).toEqual([])
    const plan = await prescribe(staff.page, staff.who, member, { routine, weekdays: [1] })
    await login(page, member, info)
    await startWorkout(page, product, info, plan)
    const options = page.getByRole('region', { name: 'Alternativas revisadas', exact: true })
    await expect(options).toContainText(
      'No hay alternativas revisadas disponibles para este ejercicio.',
    )
    await expect(options.getByRole('button', { name: /^Usar / })).toHaveCount(0)
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-ALTERNATIVES-006'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    // The real harness migrated an existing 001-005 seed twice before exposing
    // this map. Compare its raw preservation proof and actual publications.
    expect(product.preservation.beforeSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(product.preservation.afterSha256).toBe(product.preservation.beforeSha256)
    const legacy = product.resources.legacy.find((r) => r.memberId === member.actor.id)!
    const before = await api(staff.page, staff.who, 'routineVersion', {
      id: legacy.programId,
      version: 1,
    })
    const a = await reviewedRoutine(staff.page, staff.who),
      b = await reviewedRoutine(staff.page, staff.who)
    expect(a.routine.relations).toEqual(b.routine.relations)
    expect(new Set(a.routine.relations.map((r) => r.id)).size).toBe(a.routine.relations.length)
    expect(
      await api(staff.page, staff.who, 'routineVersion', { id: legacy.programId, version: 1 }),
    ).toEqual(before)
    await login(page, member, info)
    await open(page, product, info, 'history')
    await expect(page.getByRole('region', { name: 'Sesiones realizadas' })).toContainText(
      legacy.executionId,
    )
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-ALTERNATIVES-007'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info, 'cover-coach')
  try {
    await login(page, member, info)
    const legacy = product.resources.legacy.find((row) => row.memberId === member.actor.id)!
    const original = await api(page, member, 'routineVersion', { id: legacy.programId, version: 1 })
    expect(original.schemaVersion).toBe(1)
    if (original.schemaVersion !== 1) throw new Error('Expected preserved legacy source')
    const before = (await api(page, member, 'sessions', { memberId: member.actor.id })).find(
      (row) => row.schemaVersion === 1 && row.original.id === legacy.executionId,
    )
    expect(before).toBeTruthy()
    for (const step of original.snapshot.steps)
      expect(
        await api(page, member, 'alternatives', {
          id: legacy.programId,
          version: 1,
          stepId: step.id,
        }),
      ).toEqual([])
    await open(page, product, info, 'history')
    await expect(page.getByRole('region', { name: 'Sesiones realizadas' })).toContainText(
      'La falta de metadatos antiguos no implica una alternativa revisada.',
    )
    const preview = await api(staff.page, staff.who, 'legacySupplementPreview', {
      id: legacy.assignmentId,
    })
    expect(
      preview.supplement,
      'A fresh synthetic version must require the actual review action',
    ).toBeNull()
    expect(preview.original).toEqual(original.snapshot)
    await open(staff.page, product, info, 'programming')
    await staff.page.getByRole('link', { name: 'Revisar rutinas anteriores', exact: true }).click()
    await staff.page
      .getByLabel('Persona de esta sede', { exact: true })
      .selectOption(member.actor.id)
    await staff.page
      .locator('li')
      .filter({ hasText: legacy.assignmentId })
      .getByRole('button', { name: /^Revisar esta asignación de / })
      .click()
    const review = staff.page.getByRole('region', { name: 'Revisar versión anterior', exact: true })
    await expect(review).toContainText(original.snapshot.name)
    const save = review.getByRole('button', {
      name: 'Guardar revisión explícita de esta versión',
      exact: true,
    })
    await expect(save).toBeDisabled()
    for (const [index, step] of original.snapshot.steps.entries()) {
      if (step.loadKg === null)
        await review
          .getByLabel(`Carga a confirmar · movimiento ${index + 1}`, { exact: true })
          .selectOption('bodyweight')
      await review
        .getByLabel(`Lados y conteo a confirmar · movimiento ${index + 1}`, { exact: true })
        .selectOption('bilateral')
      await review
        .getByLabel(`Alternativas en esta versión · movimiento ${index + 1}`, { exact: true })
        .selectOption('reviewed')
    }
    const targets = review
      .getByRole('region', { name: 'Todos los destinos revisados elegibles', exact: true })
      .getByRole('checkbox', { name: /^Confirmo la dosis propia y todas las condiciones de / })
    expect(await targets.count()).toBe(preview.proposals.length)
    expect(preview.proposals.length).toBeGreaterThan(0)
    for (const checkbox of await targets.all()) await checkbox.check()
    await review
      .getByRole('checkbox', { name: /^Confirmo las dosis originales y las decisiones explícitas/ })
      .check()
    await expect(save).toBeDisabled()
    await review
      .getByRole('checkbox', { name: /^Entiendo que esta revisión se aplica a todas las personas/ })
      .check()
    await expect(save).toBeEnabled()
    const submitted = staff.page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        new URL(request.url()).pathname.endsWith(
          `/legacy-assignments/${legacy.assignmentId}/supplement`,
        ),
    )
    await save.click()
    const input = (await submitted).postDataJSON()
    expect(input).toMatchObject({
      id: legacy.assignmentId,
      expectedRevision: 0,
      sourceSnapshotHash: preview.sourceSnapshotHash,
      sourceDosesConfirmed: true,
      sharedVersionConfirmed: true,
    })
    expect(input.targetConfirmations).toEqual(
      preview.proposals.map(({ relation, hash }) => ({
        relationId: relation.id,
        relationHash: hash,
      })),
    )
    for (const [index, step] of preview.draft.steps.entries())
      for (const field of [
        'sets',
        'repetitions',
        'durationSeconds',
        'restSeconds',
        'targetRpe',
        'notes',
      ] as const)
        expect(input.sourceSteps[index].dose[field]).toEqual(step.dose[field])
    await expect(
      staff.page.getByRole('heading', {
        name: 'Esta versión ya tiene una revisión explícita',
        exact: true,
      }),
    ).toBeVisible()
    const supplement = await api(page, member, 'routineSupplement', {
      id: legacy.programId,
      version: 1,
    })
    expect(supplement).toBeTruthy()
    const adopted = (
      await api(staff.page, staff.who, 'legacySupplementPreview', { id: legacy.assignmentId })
    ).supplement
    expect(adopted!.sourceSnapshotHash).toBe(preview.sourceSnapshotHash)
    expect(adopted!.supplement).toEqual(supplement)
    for (const relation of supplement!.relations)
      expect(relation.targetDose).toEqual(
        preview.proposals.find((proposal) => proposal.relation.id === relation.id)!.relation
          .targetDose,
      )
    expect(supplement!.relations).toHaveLength(preview.proposals.length)
    expect(await api(page, member, 'routineVersion', { id: legacy.programId, version: 1 })).toEqual(
      original,
    )
    expect(
      (await api(page, member, 'sessions', { memberId: member.actor.id })).find(
        (row) => row.schemaVersion === 1 && row.original.id === legacy.executionId,
      ),
    ).toEqual(before)
    const archive = await api(page, member, 'personalExport', {})
    expect(
      archive.training
        .flatMap((row) => row.supplements)
        .find((row) => row.programId === legacy.programId && row.version === 1),
    ).toEqual(adopted)
    await assertProductViewport(staff.page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-ALTERNATIVES-009'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const { routine, relation } = await reviewedRoutine(
      staff.page,
      staff.who,
      dose(),
      (r) => r.targetDose.laterality === 'per-side' && r.target.equipment === 'none',
    )
    const plan = await prescribe(staff.page, staff.who, member, { routine, weekdays: [1] })
    await login(page, member, info)
    await startWorkout(page, product, info, plan)
    await page
      .getByRole('spinbutton', { name: /cantidad$/ })
      .first()
      .fill('3')
    await expect
      .poll(async () => (await latest(page, member, plan.occurrences[0]!.id))?.content.sets.length)
      .toBe(1)
    const option = page
      .getByRole('region', { name: 'Alternativas revisadas' })
      .getByRole('group', { name: relation.target.name, exact: true })
    for (const checkbox of await option.getByRole('checkbox').all()) await checkbox.check()
    await option.getByRole('button', { name: `Usar ${relation.target.name}`, exact: true }).click()
    const target = page.locator('.workout-segment').filter({
      has: page.getByRole('heading', {
        name: `${relation.target.name} · Objetivo actual`,
        exact: true,
      }),
    })
    for (const input of await target.getByRole('spinbutton', { name: / left cantidad$/ }).all())
      await input.fill('1')
    await page.getByRole('button', { name: 'Completar sesión explícitamente', exact: true }).click()
    await expect(page.getByRole('alert')).not.toHaveCount(0)
    expect((await latest(page, member, plan.occurrences[0]!.id))!.content.status).not.toBe(
      'completed',
    )
    for (const input of await target.getByRole('spinbutton', { name: / right cantidad$/ }).all())
      await input.fill('1')
    await page.getByRole('button', { name: 'Completar sesión explícitamente', exact: true }).click()
    await expect
      .poll(async () => (await latest(page, member, plan.occurrences[0]!.id))?.content.status)
      .toBe('completed')
    const saved = (await latest(page, member, plan.occurrences[0]!.id))!
    expect(saved.content.segments).toHaveLength(2)
    const sourceId = saved.content.segments.find(
      (s) => s.exerciseId === routine.steps[0]!.exerciseId,
    )!.segmentId
    expect(saved.content.sets.some((s) => s.segmentId === sourceId && s.repetitions === 3)).toBe(
      true,
    )
    expect(JSON.stringify(await api(page, member, 'personalExport', {}))).toContain(sourceId)
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-ALTERNATIVES-011'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  try {
    const { routine, relation } = await reviewedDurationFixture(
      staff.page,
      staff.who,
      product,
      info,
    )
    const plan = await prescribe(staff.page, staff.who, member, { routine, weekdays: [1] })
    await login(page, member, info)
    const issued = await api(page, member, 'routineVersion', { id: routine.programId, version: 1 })
    await startWorkout(page, product, info, plan)
    const option = page
      .getByRole('region', { name: 'Alternativas revisadas' })
      .getByRole('group', { name: relation.target.name, exact: true })
    for (const checkbox of await option.getByRole('checkbox').all()) await checkbox.check()
    await option.getByRole('button', { name: `Usar ${relation.target.name}`, exact: true }).click()
    const target = page.locator('.workout-segment').filter({
      has: page.getByRole('heading', {
        name: `${relation.target.name} · Objetivo actual`,
        exact: true,
      }),
    })
    const minimum =
      relation.targetDose.sets.kind === 'fixed'
        ? relation.targetDose.sets.value
        : relation.targetDose.sets.min
    const sides = relation.targetDose.laterality === 'bilateral' ? 1 : 2
    await expect(target.getByRole('spinbutton', { name: /cantidad$/ })).toHaveCount(minimum * sides)
    await expect(target.getByText('Segundos realizados', { exact: true })).toHaveCount(
      minimum * sides,
    )
    const rest =
      relation.targetDose.restSeconds.kind === 'fixed'
        ? relation.targetDose.restSeconds.value
        : relation.targetDose.restSeconds.min
    if (rest > 0)
      await expect(target.getByRole('timer')).toHaveText(
        `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`,
      )
    for (const input of await target.getByRole('spinbutton', { name: /cantidad$/ }).all())
      await input.fill('1')
    await page.getByRole('button', { name: 'Guardar parcial', exact: true }).click()
    await expect
      .poll(async () => (await latest(page, member, plan.occurrences[0]!.id))?.content.status)
      .toBe('partial')
    await page.getByRole('button', { name: 'Completar sesión explícitamente', exact: true }).click()
    await expect
      .poll(async () => (await latest(page, member, plan.occurrences[0]!.id))?.content.status)
      .toBe('completed')
    expect(
      await api(page, member, 'routineVersion', { id: routine.programId, version: 1 }),
    ).toEqual(issued)
    expect(
      (await api(page, member, 'enrollmentRevision', { id: plan.enrollment.id, revision: 1 }))
        .enrollment.content.goal,
    ).toBe(plan.enrollment.content.goal)
    await assertProductViewport(page, info)
  } finally {
    await staff.context.close()
  }
})
