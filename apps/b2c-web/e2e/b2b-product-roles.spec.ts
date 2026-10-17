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
  pacePasswordAdmission,
  type Page,
  type Principal,
} from './fixtures/b2b-product/app-fixture'
import {
  ProductEndpoints,
  type ProductInput,
} from '../../../packages/b2b-contracts/src/product-v2.ts'
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

async function inviteThroughUi(
  page: Page,
  who: Principal,
  role: ProductInput<'inviteMember'>['role'],
  grants: ProductInput<'inviteMember'>['branchGrants'],
  email = `wp12-ui-invite-${operation()}@example.test`,
) {
  const branches = await api(page, who, 'invitationBranches', {})
  const form = page.getByRole('form', { name: 'Invitar persona', exact: true })
  await expect(form.getByLabel('Email de la persona invitada')).toHaveValue('')
  await form.getByLabel('Nombre de la persona invitada').fill(`Synthetic UI ${role}`)
  await form.getByLabel('Email de la persona invitada').fill(email)
  await form.getByLabel('Rol de la persona invitada').selectOption(role)
  for (const branch of branches)
    for (const grantRole of ['coach', 'member'] as const)
      await form
        .getByLabel(
          `${grantRole === 'coach' ? 'Entrenador' : 'Socio'} en ${branch.name} (${branch.branchId})`,
          { exact: true },
        )
        .selectOption('none')
  // These actual selections deliberately preserve the user's explicit array order.
  for (const grant of grants) {
    const branch = branches.find((row) => row.branchId === grant.branchId)!
    expect(branch).toBeTruthy()
    await form
      .getByLabel(
        `${grant.role === 'coach' ? 'Entrenador' : 'Socio'} en ${branch.name} (${branch.branchId})`,
        { exact: true },
      )
      .selectOption(grant.active ? 'active' : 'inactive')
  }
  const create = form.getByRole('button', { name: 'Crear invitación', exact: true })
  if (!grants.length) {
    await expect(create).toBeDisabled()
    await form
      .getByRole('checkbox', {
        name: 'Confirmo que esta invitación no incluirá funciones por sede',
        exact: true,
      })
      .check()
  }
  const submitted = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/product\/v2\/invitations\/[^/]+$/.test(new URL(response.url()).pathname),
  )
  await create.click()
  const response = await submitted
  expect(response.ok()).toBe(true)
  expect(response.request().postDataJSON()).toMatchObject({ email, role, branchGrants: grants })
  const invitation = ProductEndpoints.inviteMember.output.parse(await response.json())
  expect(invitation.role).toBe(role)
  expect(new URL(invitation.invitationUrl).origin).toBe(new URL(page.url()).origin)
  await expect(page.getByLabel('Enlace para compartir', { exact: true })).toHaveValue(
    invitation.invitationUrl,
  )
  await expect(form.getByLabel('Email de la persona invitada')).toHaveValue('')
  return { invitation, email }
}

test(scenarioTitle('B2BP-ROLES-003'), async ({ page, context, product }, info) => {
  test.setTimeout(180_000)
  const superadmin = principal(product, 'superadmin')
  await login(page, superadmin, info)
  await open(page, product, info, 'people')
  const form = page.getByRole('form', { name: 'Invitar persona', exact: true })
  await expect(form.getByLabel('Rol de la persona invitada', { exact: true })).toBeVisible()
  const options = await form
    .getByLabel('Rol de la persona invitada')
    .locator('option')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value))
  for (const role of ['admin', 'coach', 'member']) expect(options).toContain(role)
  const peer = await newPage(context, info),
    activated = await newPage(context, info)
  let surStaff: Awaited<ReturnType<typeof staffSession>> | undefined
  try {
    const secondary = principal(product, 'secondary-member', 'atlas', true)
    const grants = [
      { branchId: superadmin.branchId, role: 'coach' as const, active: true },
      { branchId: superadmin.branchId, role: 'member' as const, active: true },
      { branchId: secondary.branchId, role: 'member' as const, active: false },
    ]
    await inviteThroughUi(page, superadmin, 'admin', [])
    await inviteThroughUi(page, superadmin, 'coach', [
      { branchId: superadmin.branchId, role: 'coach', active: true },
    ])
    const mixed = await inviteThroughUi(page, superadmin, 'member', grants)
    const admin = principal(product, 'new-admin')
    await login(peer.page, admin, info)
    await open(peer.page, product, info, 'people')
    await expect(
      peer.page
        .getByRole('form', { name: 'Invitar persona', exact: true })
        .getByLabel('Rol de la persona invitada', { exact: true }),
    ).toBeVisible()
    const allowed = await peer.page
      .getByRole('form', { name: 'Invitar persona', exact: true })
      .getByLabel('Rol de la persona invitada')
      .locator('option')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value))
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
    for (const role of ['coach', 'member'] as const)
      await inviteThroughUi(peer.page, admin, role, [
        { branchId: admin.branchId, role, active: true },
      ])
    await activated.page.goto(mixed.invitation.invitationUrl)
    await activated.page.getByLabel('Tu nombre', { exact: true }).fill('Synthetic accepted member')
    const password = 'wp12-synthetic-new-password-2026'
    await activated.page.getByLabel('Nueva contraseña', { exact: true }).fill(password)
    const acceptance = activated.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/invitations/accept'),
    )
    await activated.page.getByRole('button', { name: 'Activar mi cuenta', exact: true }).click()
    expect((await acceptance).ok()).toBe(true)
    await activated.page.getByRole('link', { name: 'Iniciar sesión', exact: true }).click()
    await activated.page.getByLabel('Email', { exact: true }).fill(mixed.email)
    await activated.page.getByLabel('Contraseña', { exact: true }).fill(password)
    await pacePasswordAdmission(info)
    const admitted = activated.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().endsWith('/auth/sign-in/email'),
    )
    await activated.page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
    const admission = await admitted
    expect(admission.status()).toBe(200)
    const identity = (await admission.json()).user
    expect(identity.email).toBe(mixed.email)
    const member: Principal = {
      organization: superadmin.organization,
      branchId: superadmin.branchId,
      role: 'coach',
      actor: { id: identity.id, email: identity.email, memberships: [] },
    }
    const selector = activated.page.getByRole('combobox', { name: 'Sede y función', exact: true })
    await expect(selector).toBeVisible()
    const contexts = await selector
      .locator('option')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value))
    for (const role of ['coach', 'member'])
      expect(contexts).toContain(JSON.stringify([member.branchId, role]))
    expect(contexts).not.toContain(JSON.stringify([secondary.branchId, 'member']))
    await selector.selectOption(JSON.stringify([member.branchId, 'coach']))
    expect((await api(activated.page, member, 'access', {})).capabilities).toContain(
      'edit-planning',
    )
    expect(
      (
        await raw(
          activated.page,
          member,
          'access',
          {},
          { branchId: secondary.branchId, role: 'member' },
        )
      ).status(),
    ).toBe(403)
    await assertProductViewport(activated.page, info)
    // Existing-account acceptance replaces a different mounted actor in this same tab.
    const foreignStaff = {
      ...(await newPage(context, info)),
      who: principal(product, 'superadmin', 'sur'),
    }
    surStaff = foreignStaff
    await login(foreignStaff.page, foreignStaff.who, info)
    await open(foreignStaff.page, product, info, 'people')
    const additional = await inviteThroughUi(
      foreignStaff.page,
      foreignStaff.who,
      'member',
      [{ branchId: foreignStaff.who.branchId, role: 'member', active: true }],
      mixed.email,
    )
    await page.goto(additional.invitation.invitationUrl)
    await page.getByRole('button', { name: 'Ya tengo una cuenta de gimnasio', exact: true }).click()
    await page.getByLabel('Email', { exact: true }).fill(mixed.email)
    await page.getByLabel('Contraseña', { exact: true }).fill(password)
    await page.getByRole('checkbox', { name: /Acepto incorporarme a esta marca/ }).check()
    await pacePasswordAdmission(info)
    const fresh = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/invitations/sign-in'),
    )
    await page
      .getByRole('button', { name: 'Aceptar invitación con mi cuenta', exact: true })
      .click()
    expect((await fresh).ok()).toBe(true)
    const organization = page.getByRole('combobox', { name: 'Organización', exact: true })
    await expect(organization).toBeVisible()
    await organization.selectOption(foreignStaff.who.organization.id)
    const inSur: Principal = {
      ...member,
      organization: foreignStaff.who.organization,
      branchId: foreignStaff.who.branchId,
      role: 'member',
    }
    expect((await api(page, inSur, 'access', {})).userId).toBe(identity.id)
    expect((await raw(page, { ...inSur, actor: superadmin.actor }, 'access', {})).status()).toBe(
      401,
    )
    await page
      .getByRole('combobox', { name: 'Sede y función', exact: true })
      .selectOption(JSON.stringify([inSur.branchId, 'member']))
    await assertProductViewport(page, info)
  } finally {
    await surStaff?.context.close()
    await activated.context.close()
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
  const filtered = await raw(page, staff, 'audit', { id: foreign.actor.id })
  expect(filtered.ok()).toBe(true)
  expect(await filtered.json()).toEqual([])
  expect(filtered.headers()['cache-control']).toContain('no-store')
  const foreignScope = await raw(
    page,
    staff,
    'audit',
    { id: foreign.actor.id },
    { organizationId: foreign.organization.id, branchId: foreign.branchId },
  )
  expect([403, 404, 409]).toContain(foreignScope.status())
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
