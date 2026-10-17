import { readFileSync } from 'node:fs'
import {
  test,
  expect,
  principal,
  login,
  open,
  api,
  raw,
  newPage,
  staffSession,
  updateActive,
  prescribe,
  record,
  operation,
  type Page,
} from './fixtures/b2b-product/app-fixture'
import { scenarioTitle, assertProductViewport } from './fixtures/b2b-product/browser-assertions'
import { importThroughUi, healthFile, grantThroughUi } from './fixtures/b2b-product/health-journey'
import { PersonalExportSchema } from '../../../packages/b2b-contracts/src/product-v2.ts'
async function restricted(page: Page) {
  await expect(
    page.getByRole('heading', { name: 'Tu membresía está inactiva', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Descargar mis registros', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Completar sesión explícitamente', exact: true }),
  ).toHaveCount(0)
}

test(scenarioTitle('B2BP-INACTIVE-001'), async ({ page, context, product }, info) => {
  const inactive = principal(product, 'inactive-member')
  await login(page, inactive, info)
  await restricted(page)
  const access = await api(page, inactive, 'access', {})
  expect(access).toMatchObject({
    userId: inactive.actor.id,
    organizationId: inactive.organization.id,
    accessMode: 'export-only',
    capabilities: ['export-own-records'],
  })
  const peer = await newPage(context, info)
  try {
    const foreign = principal(product, 'member', 'sur')
    const denied = await peer.page.request.post(
      new URL('/api/b2b/auth/sign-in/email', page.url()).href,
      {
        headers: { Origin: new URL(page.url()).origin, 'X-Klisteni-B2B-Contract': '2' },
        data: { email: foreign.actor.email, password: 'b2b-product-synthetic-password-2026' },
      },
    )
    expect(denied.ok()).toBe(false)
    expect((await peer.context.cookies()).filter((cookie) => /session/i.test(cookie.name))).toEqual(
      [],
    )
  } finally {
    await peer.context.close()
  }
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-INACTIVE-002'), async ({ page, product }, info) => {
  const inactive = principal(product, 'inactive-member')
  await login(page, inactive, info)
  await restricted(page)
  const base = `/api/b2b/orgs/${inactive.organization.id}/product/v2`
  const headers = {
    Origin: new URL(page.url()).origin,
    'X-Klisteni-B2B-Contract': '2',
    'X-Klisteni-B2B-Account': inactive.actor.id,
    'X-Klisteni-B2B-Branch': inactive.branchId,
    'X-Klisteni-B2B-Role': 'member',
  }
  for (const [method, path, extra] of [
    ['GET', '/routines', {}],
    ['HEAD', '/routines', {}],
    ['GET', '/health/own', {}],
    ['GET', '/routines', { Range: 'bytes=0-20' }],
  ] as const) {
    const response = await page.request.fetch(new URL(base + path, page.url()).href, {
      method,
      headers: { ...headers, ...extra },
    })
    expect(response.ok(), `${method} ${path} must be denied in export-only mode`).toBe(false)
    expect(response.headers()['cache-control']).toContain('no-store')
  }
  const deniedWrite = await raw(page, inactive, 'previewHealthImport', {
    operationId: operation(),
    expectedRevision: 0,
    format: 'klisteniapp.health',
    version: 1,
    raw: healthFile().raw,
  })
  expect([403, 409]).toContain(deniedWrite.status())
  expect(deniedWrite.headers()['cache-control']).toContain('no-store')
  expect((await raw(page, inactive, 'personalExport', {})).ok()).toBe(true)
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-INACTIVE-003'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  let paused = false
  try {
    await login(page, member, info)
    await updateActive(staff.page, staff.who, member, false)
    paused = true
    await page.reload()
    await restricted(page)
    for (const path of [
      '/manage/programs',
      '/app/history',
      '/manage/media',
      '/unknown-wp12-route',
      '/',
    ]) {
      await page.goto(new URL(path, page.url()).href)
      await restricted(page)
    }
    await page.goBack()
    await restricted(page)
    await page.goForward()
    await restricted(page)
    await assertProductViewport(page, info)
  } finally {
    if (paused) await updateActive(staff.page, staff.who, member, true)
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-INACTIVE-004'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  let paused = false
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const saved = await record(page, member, plan.routine, plan.occurrences[0]!)
    await api(page, member, 'saveSession', {
      id: saved.session.id,
      expectedRevision: saved.session.revision,
      operationId: operation(),
      origin: saved.session.origin,
      content: {
        ...saved.session.content,
        notes: 'Accepted correction retained in owner export',
        correctionReason: 'Owner correction',
      },
    })
    await importThroughUi(page, product, info, member)
    await updateActive(staff.page, staff.who, member, false)
    paused = true
    await page.reload()
    await restricted(page)
    await expect(page.getByRole('heading', { name: 'Qué incluye' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Qué queda fuera' })).toBeVisible()
    const download = page.waitForEvent('download')
    const response = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/b2b/self/exports',
    )
    await page.getByRole('button', { name: 'Descargar mis registros' }).click()
    const actualResponse = await response
    expect(actualResponse.ok()).toBe(true)
    expect(actualResponse.headers()['cache-control']).toContain('no-store')
    const archive = PersonalExportSchema.parse(
      JSON.parse(readFileSync((await (await download).path())!, 'utf8')),
    )
    expect(archive).toMatchObject({ ownerId: member.actor.id, serverAcceptedOnly: true })
    for (const branch of archive.training) {
      expect(branch.ownerId).toBe(member.actor.id)
      expect(branch.scope.organizationId).toBe(member.organization.id)
      expect(branch.scope.memberId).toBe(member.actor.id)
    }
    expect(
      archive.training
        .flatMap((branch) => branch.sessionRevisions)
        .filter((r) => r.id === saved.session.id),
    ).toHaveLength(2)
    expect(
      archive.training
        .flatMap((branch) => branch.routines)
        .some((r) => r.snapshot.programId === plan.routine.programId),
    ).toBe(true)
    expect(JSON.stringify(archive.health.data)).toContain('wp12-synthetic-measurement-source')
    const legacy = product.resources.legacy.find((item) => item.memberId === member.actor.id)!
    expect(
      archive.training
        .flatMap((branch) => branch.legacyExecutions)
        .some((r) => r.original.id === legacy.executionId),
    ).toBe(true)
    expect(JSON.stringify(archive)).not.toContain(principal(product, 'member', 'sur').actor.id)
    expect(Object.keys(archive).sort()).toEqual([
      'exportedAt',
      'format',
      'health',
      'ownerId',
      'serverAcceptedOnly',
      'training',
      'version',
    ])
    await assertProductViewport(page, info)
  } finally {
    if (paused) await updateActive(staff.page, staff.who, member, true)
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-INACTIVE-008'), async ({ page, context, product }, info) => {
  const member = principal(product),
    staff = await staffSession(context, product, info)
  let paused = false
  try {
    const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
    await login(page, member, info)
    const accepted = await record(page, member, plan.routine, plan.occurrences[0]!)
    await importThroughUi(page, product, info, member)
    await grantThroughUi(page)
    const consent = (await api(page, member, 'healthConsents', {})).find(
      (c) => c.status === 'active' && c.scope.branchId === member.branchId,
    )!
    await updateActive(staff.page, staff.who, member, false)
    paused = true
    await page.reload()
    await restricted(page)
    expect(
      (await raw(page, member, 'operationReceipt', { id: accepted.sent.operationId })).ok(),
    ).toBe(false)
    await updateActive(staff.page, staff.who, member, true)
    paused = false
    await page.getByRole('button', { name: 'Actualizar mi acceso', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Tu membresía está inactiva', exact: true }),
    ).toHaveCount(0)
    const access = await api(page, member, 'access', {})
    expect(access).toMatchObject({
      userId: member.actor.id,
      accessMode: 'active',
      organizationId: member.organization.id,
    })
    expect(access.branches).toContainEqual({ branchId: member.branchId, role: 'member' })
    expect(await api(page, member, 'sessionRevisions', { id: accepted.session.id })).toEqual([
      accepted.session,
    ])
    expect(
      (await api(page, member, 'healthConsents', {})).find((c) => c.id === consent.id),
    ).toMatchObject({ status: 'revoked', revision: consent.revision + 1 })
    await open(page, product, info, 'history')
    await expect(page.getByRole('region', { name: 'Sesiones realizadas' })).toContainText(
      accepted.session.id,
    )
    await assertProductViewport(page, info)
  } finally {
    if (paused) await updateActive(staff.page, staff.who, member, true)
    await staff.context.close()
  }
})

test(scenarioTitle('B2BP-INACTIVE-007'), async ({ page, context, product }, info) => {
  const member = principal(product, 'multi-member')
  await login(page, member, info)
  await restricted(page)
  expect((await api(page, member, 'access', {})).accessMode).toBe('export-only')
  const peer = await newPage(context, info)
  try {
    const active = principal(product, 'multi-member', 'sur')
    await login(peer.page, active, info)
    expect((await api(peer.page, active, 'access', {})).accessMode).toBe('active')
    expect((await raw(page, member, 'routines', {})).ok()).toBe(false)
    await restricted(page)
  } finally {
    await peer.context.close()
  }
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-INACTIVE-009'), async ({ page, product }, info) => {
  const member = principal(product, 'inactive-member')
  await login(page, member, info)
  await restricted(page)
  const origin = new URL(page.url()).origin
  const external: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) external.push(request.url())
  })
  const cookies = await page.context().cookies()
  await expect(page.getByText(/B2C es un producto de pago separado/)).toBeVisible()
  const result = await api(page, member, 'b2cInvitation', {})
  expect(result).toMatchObject({ separateProduct: true, paid: true, automaticConversion: false })
  await page.getByRole('button', { name: 'Consultar invitación B2C' }).click()
  if (result.url) {
    const link = page.getByRole('link', { name: 'Conocer B2C en otro sitio' })
    const url = new URL((await link.getAttribute('href'))!)
    expect(url.protocol).toBe('https:')
    expect(url.origin).not.toBe(origin)
    expect(url.username + url.password + url.search + url.hash).toBe('')
    await expect(link).toHaveAttribute('rel', /noopener/)
    await expect(link).toHaveAttribute('rel', /noreferrer/)
    await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer')
  } else await expect(page.getByText('No hay una invitación B2C configurada.')).toBeVisible()
  expect(external).toEqual([])
  expect(await page.context().cookies()).toEqual(cookies)
  await assertProductViewport(page, info)
})

test(scenarioTitle('B2BP-INACTIVE-012'), async ({ page, product }, info) => {
  const member = principal(product, 'inactive-member')
  await login(page, member, info)
  await restricted(page)
  await page.route(
    '**/api/b2b/self/exports?**',
    async (route) => {
      await route.abort('failed')
    },
    { times: 1 },
  )
  await page.getByRole('button', { name: 'Descargar mis registros' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'No pudimos descargar tus registros' }),
  ).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Reintentar exportación' }).focus()
  await page.keyboard.press('Enter')
  const archive = PersonalExportSchema.parse(
    JSON.parse(readFileSync((await (await download).path())!, 'utf8')),
  )
  expect(archive.ownerId).toBe(member.actor.id)
  await assertProductViewport(page, info)
})
