import {
  test,
  expect,
  principal,
  login,
  open,
  api,
  raw,
  prescribe,
  operation,
  publish,
  newPage,
} from './fixtures/b2b-product/app-fixture'
import { scenarioTitle, assertProductViewport } from './fixtures/b2b-product/browser-assertions'

test(scenarioTitle('B2BP-ROLES-001'), async ({ page, context, product }, info) => {
  const coach = principal(product, 'cover-coach'),
    member = principal(product)
  await login(page, coach, info)
  const people = await api(page, coach, 'people', {})
  const target = people.find((person) => person.userId === member.actor.id)!
  expect(target.coachIds).not.toContain(coach.actor.id)
  await open(page, product, info, 'people')
  await page.getByLabel('Buscar persona').fill(member.actor.email)
  await expect(page.getByText(member.actor.email, { exact: true })).toBeVisible()
  const plan = await prescribe(page, coach, member)
  const peer = await newPage(context, info)
  try {
    await login(peer.page, member, info)
    await open(peer.page, product, info, 'history')
    await expect(peer.page.getByRole('region', { name: 'Continuidad de la rutina' })).toContainText(
      plan.enrollment.content.name,
    )
    await expect(peer.page.getByRole('region', { name: 'Continuidad de la rutina' })).toContainText(
      plan.enrollment.content.goal,
    )
    await assertProductViewport(peer.page, info)
  } finally {
    await peer.context.close()
  }
})

test(scenarioTitle('B2BP-ROLES-002'), async ({ page, product }, info) => {
  const coach = principal(product, 'cover-coach')
  await login(page, coach, info)
  expect(
    (await api(page, coach, 'people', {})).some((p) => p.userId === principal(product).actor.id),
  ).toBe(true)
  const foreign = principal(product, 'member', 'sur')
  for (const [who, override] of [
    [foreign, {}],
    [principal(product, 'secondary-member', 'atlas', true), {}],
    [
      principal(product),
      { branchId: principal(product, 'secondary-member', 'atlas', true).branchId },
    ],
  ] as const) {
    const denied = await raw(page, coach, 'sessions', { memberId: who.actor.id }, override)
    expect([403, 404, 409]).toContain(denied.status())
  }
  const branchless = await page.request.get(
    `/api/b2b/orgs/${coach.organization.id}/product/v2/people`,
    {
      headers: {
        'X-Klisteni-B2B-Contract': '2',
        'X-Klisteni-B2B-Account': coach.actor.id,
        'X-Klisteni-B2B-Role': 'coach',
      },
    },
  )
  expect([400, 403, 409]).toContain(branchless.status())
  await open(page, product, info, 'people')
  await expect(page.getByText(foreign.actor.email, { exact: true })).toHaveCount(0)
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-ROLES-003'), async ({ page, context, product }, info) => {
  const superadmin = principal(product, 'superadmin')
  await login(page, superadmin, info)
  await open(page, product, info, 'people')
  const options = await page
    .getByLabel('Rol en la marca', { exact: true })
    .locator('option')
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLOptionElement).value))
  for (const role of ['admin', 'coach', 'member']) expect(options).toContain(role)
  const peer = await newPage(context, info),
    admin = principal(product, 'new-admin')
  try {
    await login(peer.page, admin, info)
    await open(peer.page, product, info, 'people')
    const allowed = await peer.page
      .getByLabel('Rol en la marca')
      .locator('option')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLOptionElement).value))
    expect(allowed.sort()).toEqual(['coach', 'member'])
    for (const role of ['admin', 'superadmin'] as const) {
      const denied = await raw(peer.page, admin, 'inviteMember', {
        id: operation(),
        operationId: operation(),
        expectedRevision: 0,
        email: `wp12-denied-${operation()}@example.test`,
        name: 'Synthetic denied escalation',
        role,
        branchGrants: [],
      })
      expect([403, 409]).toContain(denied.status())
    }
    for (const role of ['coach', 'member'] as const) {
      const invited = await api(peer.page, admin, 'inviteMember', {
        id: operation(),
        operationId: operation(),
        expectedRevision: 0,
        email: `wp12-${operation()}@example.test`,
        name: 'Synthetic invitation',
        role,
        branchGrants: [{ branchId: admin.branchId, role, active: true }],
      })
      expect(invited.role).toBe(role)
    }
    await assertProductViewport(peer.page, info)
  } finally {
    await peer.context.close()
  }
})

test(scenarioTitle('B2BP-ROLES-005'), async ({ page, product }, info) => {
  const coach = principal(product, 'cover-coach')
  await login(page, coach, info)
  const routine = await publish(page, coach)
  const current = await api(page, coach, 'routine', { id: routine.programId })
  const input = {
    id: current.id,
    operationId: operation(),
    expectedRevision: current.revision,
    content: {
      name: current.name,
      description: 'Attributable browser change',
      steps: current.steps,
    },
  }
  const first = await api(page, coach, 'saveRoutine', input)
  await api(page, coach, 'saveRoutine', input)
  const audit = await api(page, coach, 'audit', { id: current.id })
  const row = audit.filter((entry) => entry.operationId === input.operationId)
  expect(row).toHaveLength(1)
  expect(row[0]).toMatchObject({
    actorId: coach.actor.id,
    organizationId: coach.organization.id,
    branchId: coach.branchId,
    afterRevision: first.revision,
  })
  expect(row[0]!.changedFields.length).toBeGreaterThan(0)
  expect(Date.parse(row[0]!.createdAt)).not.toBeNaN()
  await open(page, product, info, 'programming')
  await page.getByRole('button', { name: `Editar ${current.name}`, exact: true }).click()
  await expect(page.getByLabel('Descripción de la rutina')).toHaveValue(
    'Attributable browser change',
  )
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-ROLES-008'), async ({ page, product }, info) => {
  const mixed = principal(product, 'mixed-role')
  await login(page, mixed, info)
  expect((await api(page, mixed, 'people', {})).length).toBeGreaterThan(0)
  const low = principal(product, 'mixed-role', 'atlas', true)
  const denied = await raw(page, mixed, 'people', {}, { branchId: low.branchId, role: 'coach' })
  expect([403, 409]).toContain(denied.status())
  const memberAccess = await raw(
    page,
    mixed,
    'access',
    {},
    { branchId: low.branchId, role: 'member' },
  )
  expect(memberAccess.ok()).toBe(true)
  expect((await memberAccess.json()).capabilities).not.toContain('edit-planning')
  await open(page, product, info, 'people')
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-ROLES-007'), async ({ page, product }, info) => {
  const coach = principal(product, 'cover-coach'),
    inactive = principal(product, 'inactive-member')
  await login(page, coach, info)
  expect(await api(page, coach, 'sessions', { memberId: inactive.actor.id })).toBeInstanceOf(Array)
  await open(page, product, info, 'programming')
  await expect(
    page.getByLabel('Persona de esta sede').locator(`option[value="${inactive.actor.id}"]`),
  ).toHaveCount(0)
  await assertProductViewport(page, info)
})
