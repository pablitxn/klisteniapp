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
  staffSession,
} from './fixtures/b2b-product/app-fixture'
import type { ProductInput } from '../../../packages/b2b-contracts/src/product-v2.ts'
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

test(scenarioTitle('B2BP-ROLES-002'), async ({ page, context, product }, info) => {
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
  const ambiguous = principal(product, 'mixed-role')
  const peer = await newPage(context, info)
  try {
    await login(peer.page, ambiguous, info)
    const branchless = await peer.page.request.get(
      `/api/b2b/orgs/${ambiguous.organization.id}/product/v2/people`,
      {
        headers: {
          'X-Klisteni-B2B-Contract': '2',
          'X-Klisteni-B2B-Account': ambiguous.actor.id,
          'X-Klisteni-B2B-Role': 'coach',
        },
      },
    )
    expect(branchless.status()).toBe(400)
    expect((await branchless.json()).code).toBe('BRANCH_REQUIRED')
  } finally {
    await peer.context.close()
  }
  await open(page, product, info, 'people')
  await expect(page.getByText(foreign.actor.email, { exact: true })).toHaveCount(0)
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-ROLES-003'), async ({ page, context, product }, info) => {
  const superadmin = principal(product, 'superadmin')
  await login(page, superadmin, info)
  await open(page, product, info, 'people')
  const options = await page
    .getByRole('form', { name: 'Invitar persona', exact: true })
    .getByLabel('Rol de la persona invitada', { exact: true })
    .locator('option')
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLOptionElement).value))
  for (const role of ['admin', 'coach', 'member']) expect(options).toContain(role)
  const peer = await newPage(context, info),
    admin = principal(product, 'new-admin')
  try {
    await login(peer.page, admin, info)
    await open(peer.page, product, info, 'people')
    const allowed = await peer.page
      .getByRole('form', { name: 'Invitar persona', exact: true })
      .getByLabel('Rol de la persona invitada', { exact: true })
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

test(scenarioTitle('B2BP-ROLES-008'), async ({ page, context, product }, info) => {
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
  const staff = await staffSession(context, product, info)
  const before = (await api(staff.page, staff.who, 'people', {})).find(
    (p) => p.userId === mixed.actor.id,
  )!
  let revoked = false,
    release!: () => void,
    arrived!: () => void
  let queued!: ProductInput<'saveRoutine'>
  const held = new Promise<void>((resolve) => {
      arrived = resolve
    }),
    gate = new Promise<void>((resolve) => {
      release = resolve
    })
  try {
    await open(page, product, info, 'programming')
    await page.getByRole('button', { name: 'Crear rutina', exact: true }).click()
    const name = `Revoked queued planning ${operation()}`
    await page.getByLabel('Nombre de la rutina', { exact: true }).fill(name)
    await page.route(
      '**/product/v2/routines/*',
      async (route) => {
        if (route.request().method() !== 'POST') return route.continue()
        queued = route.request().postDataJSON()
        arrived()
        await gate
        try {
          await route.continue()
        } catch (e) {
          if (!/abort|closed|handled/i.test(String(e))) throw e
        }
      },
      { times: 1 },
    )
    await page.getByRole('button', { name: 'Guardar borrador incompleto', exact: true }).click()
    await held
    await api(staff.page, staff.who, 'updateMember', {
      memberId: mixed.actor.id,
      expectedRevision: before.revision,
      operationId: operation(),
      branchGrants: before.branchGrants.map((g) => ({
        ...g,
        active: g.branchId === mixed.branchId && g.role === 'coach' ? false : g.active,
      })),
    })
    revoked = true
    release()
    expect((await raw(page, mixed, 'saveRoutine', queued)).status()).toBe(403)
    expect((await raw(page, mixed, 'operationReceipt', { id: queued.operationId })).ok()).toBe(
      false,
    )
    await expect(page.getByLabel('Nombre de la rutina', { exact: true })).toHaveCount(0)
    expect((await raw(staff.page, staff.who, 'routine', { id: queued.id })).status()).toBe(404)
    await assertProductViewport(page, info)
  } finally {
    release?.()
    if (revoked) {
      const current = (await api(staff.page, staff.who, 'people', {})).find(
        (p) => p.userId === mixed.actor.id,
      )!
      await api(staff.page, staff.who, 'updateMember', {
        memberId: mixed.actor.id,
        expectedRevision: current.revision,
        operationId: operation(),
        branchGrants: before.branchGrants,
      })
    }
    await staff.context.close()
  }
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

test(scenarioTitle('B2BP-ROLES-004'), async ({ page, product }, info) => {
  const who = principal(product, 'superadmin', 'sur')
  await login(page, who, info)
  const paused: string[] = []
  try {
    const people = await api(page, who, 'people', {})
    for (const person of people.filter(
      (p) => p.active && p.role === 'superadmin' && p.userId !== who.actor.id,
    )) {
      await api(page, who, 'updateMember', {
        memberId: person.userId,
        expectedRevision: person.revision,
        operationId: operation(),
        active: false,
      })
      paused.push(person.userId)
    }
    const current = (await api(page, who, 'people', {})).find((p) => p.userId === who.actor.id)!
    for (const change of [{ active: false }, { role: 'admin' as const }]) {
      const denied = await raw(page, who, 'updateMember', {
        memberId: who.actor.id,
        expectedRevision: current.revision,
        operationId: operation(),
        ...change,
      })
      expect(denied.status()).toBe(409)
      expect((await denied.json()).code).toBe('LAST_SUPERADMIN')
    }
    for (const role of ['platform-admin', 'operator']) {
      const denied = await page.request.post(
        `/api/b2b/orgs/${who.organization.id}/product/v2/people/${who.actor.id}`,
        {
          headers: {
            Origin: new URL(page.url()).origin,
            'X-Klisteni-B2B-Contract': '2',
            'X-Klisteni-B2B-Account': who.actor.id,
            'X-Klisteni-B2B-Branch': who.branchId,
            'X-Klisteni-B2B-Role': who.role,
          },
          data: {
            memberId: who.actor.id,
            expectedRevision: current.revision,
            operationId: operation(),
            role,
          },
        },
      )
      expect(denied.status()).toBe(400)
    }
    expect(
      (await api(page, who, 'people', {})).find((p) => p.userId === who.actor.id),
    ).toMatchObject({ role: 'superadmin', active: true, revision: current.revision })
    await open(page, product, info, 'people')
    await expect(
      page.getByRole('heading', { name: 'Personas del gimnasio', exact: true }),
    ).toBeVisible()
    await assertProductViewport(page, info)
  } finally {
    for (const id of paused) {
      const current = (await api(page, who, 'people', {})).find((p) => p.userId === id)!
      await api(page, who, 'updateMember', {
        memberId: id,
        expectedRevision: current.revision,
        operationId: operation(),
        active: true,
      })
    }
  }
})

test(scenarioTitle('B2BP-ROLES-006'), async ({ page, product }, info) => {
  const staff = principal(product, 'superadmin')
  await login(page, staff, info)
  const target = (await api(page, staff, 'people', {})).find(
    (p) => p.userId === principal(product).actor.id,
  )!
  await open(page, product, info, 'people')
  const trigger = page.getByRole('button', { name: `Ver cambios de ${target.name}`, exact: true })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const drawer = page.getByRole('dialog', {
    name: `Cambios registrados: ${target.name}`,
    exact: true,
  })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Cerrar cambios', exact: true })).toBeFocused()
  expect(await drawer.innerText()).not.toMatch(
    /weightKg|durationSeconds|performedSets|sessionRevisions|wp12-synthetic-measurement-source/,
  )
  const foreign = principal(product, 'member', 'sur')
  expect((await raw(page, staff, 'audit', { id: foreign.actor.id })).ok()).toBe(false)
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-ROLES-009'), async ({ page, context, product }, info) => {
  const coach = principal(product, 'cover-coach'),
    other = principal(product, 'member', 'sur')
  await login(page, coach, info)
  const access = await api(page, coach, 'access', {})
  expect(access.organizationId).toBe(coach.organization.id)
  expect(
    (
      await raw(
        page,
        coach,
        'people',
        {},
        { organizationId: other.organization.id, branchId: other.branchId },
      )
    ).ok(),
  ).toBe(false)
  const peer = await newPage(context, info)
  try {
    if (info.project.metadata.b2bProduct.mode !== 'unified-http') {
      const foreignOrigin = `${new URL(page.url()).protocol}//sur.b2b.test`
      const cookies = (await context.cookies()).map((c) => ({
        name: c.name,
        value: c.value,
        expires: c.expires,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite,
        url: `${foreignOrigin}/`,
      }))
      await peer.context.addCookies(cookies)
      await peer.page.goto(`${foreignOrigin}/app`)
      await expect(
        peer.page.getByRole('navigation', { name: 'Secciones del gimnasio' }),
      ).toHaveCount(0)
      await expect(peer.page.getByLabel('Email', { exact: true })).toBeVisible()
    }
    await open(page, product, info, 'programming')
    await expect(
      page.getByRole('heading', { name: 'Rutinas y programas por objetivo', exact: true }),
    ).toBeVisible()
    await assertProductViewport(page, info)
  } finally {
    await peer.context.close()
  }
})
