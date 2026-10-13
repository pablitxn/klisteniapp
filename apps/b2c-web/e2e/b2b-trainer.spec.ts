import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { Assignment, Exercise, Program } from '../../../packages/b2b-contracts/src/index.ts'

const password = 'browser-tests-only-password-2026'
const requireApi = createRequire(new URL('../../b2b-api/package.json', import.meta.url))
const { Pool } = requireApi('pg')
const center = 'atlas-demo-principal'
const north = 'atlas-demo-norte'
const protocol = (info: TestInfo) =>
  info.project.name.includes('webkit') && process.env.TRAINER_WEBKIT_HTTP === '1' ? 'http' : 'https'

async function login(
  page: Page,
  email = 'coach@atlas.example.test',
  origin = 'https://atlas.b2b.test',
) {
  if (test.info().project.name.includes('webkit') && process.env.TRAINER_WEBKIT_HTTP === '1')
    origin = origin.includes('sur.b2b.test') ? 'http://127.0.0.1:4468' : 'http://localhost:4468'
  await page.goto(`${origin}/manage`)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  for (let attempt = 0; attempt < 3; attempt++) {
    const pending = page.waitForResponse(
      (response) =>
        response.url().endsWith('/auth/sign-in/email') && response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
    const response = await pending
    if (response.status() !== 429) break
    // Keep the real login limiter; shared loopback traffic respects its retry window.
    await page.waitForTimeout(
      Math.min(60, Math.max(1, Number(response.headers()['retry-after']) || 60)) * 1000,
    )
  }
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
  if (email === 'coach@atlas.example.test') await select(page, center)
}
async function select(page: Page, branch: string, role = 'coach') {
  await page.getByLabel('Sede y función', { exact: true }).selectOption(`${branch}:${role}`)
  await expect(page.getByLabel('Sede y función', { exact: true })).toHaveValue(`${branch}:${role}`)
}
async function request(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown,
  branch = center,
  role = 'coach',
  org = 'atlas-demo',
) {
  return page.evaluate(
    async ({ path, method, body, branch, role, org }) => {
      const me = await (await fetch('/api/b2b/me')).json()
      const response = await fetch(`/api/b2b/orgs/${org}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Klisteni-B2B-Account': me.user.id,
          'X-Klisteni-B2B-Branch': branch,
          'X-Klisteni-B2B-Role': role,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      return { status: response.status, data: await response.json() }
    },
    { path, method, body, branch, role, org },
  )
}
async function sql(info: TestInfo, query: string, values: unknown[] = []) {
  const proxyPort = info.project.name.includes('webkit')
    ? '4368'
    : new URL(info.project.use.proxy!.server).port
  const map = JSON.parse(
    readFileSync(new URL('../../../.cache/trainer/fixture-map.json', import.meta.url), 'utf8'),
  )
  const schema = map[proxyPort]
  expect(schema).toMatch(/^b2b_trainer_browser_[a-f0-9]+$/)
  const url = new URL(process.env.B2B_TEST_DATABASE_URL!)
  expect(url.pathname).toMatch(/b2b.*test|test.*b2b/i)
  url.searchParams.set('options', `-c search_path=${schema}`)
  const pool = new Pool({ connectionString: url.href })
  try {
    return await pool.query(query, values)
  } finally {
    await pool.end()
  }
}
async function programs(page: Page): Promise<Program[]> {
  const response = await request(page, '/programs')
  expect(response.status).toBe(200)
  return response.data.programs
}
async function assignments(page: Page): Promise<Assignment[]> {
  const response = await request(page, '/assignments')
  expect(response.status).toBe(200)
  return response.data.assignments
}
function card(page: Page, name: string) {
  return page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
}
async function editor(page: Page, name: string) {
  await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
  await page.getByRole('button', { name: '+ Crear rutina', exact: true }).click()
  await page.getByLabel('Nombre de la rutina', { exact: true }).fill(name)
}
async function add(page: Page, exercise: Exercise) {
  await page.getByLabel('Ejercicio para agregar', { exact: true }).selectOption(exercise.id)
  await page.getByRole('button', { name: '+ Agregar movimiento', exact: true }).click()
}
async function baseExercises(page: Page): Promise<Exercise[]> {
  const response = await request(page, '/exercises')
  expect(response.status).toBe(200)
  return response.data.exercises.filter(
    (exercise: Exercise) => exercise.status === 'published' && !exercise.machineId,
  )
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Guardar borrador de rutina', exact: true }).click()
  await expect(
    page.getByText(
      'Borrador guardado. Podés publicarlo desde la lista de rutinas cuando esté listo.',
      { exact: true },
    ),
  ).toBeVisible()
}
async function createPublished(page: Page, name: string) {
  await editor(page, name)
  await add(page, (await baseExercises(page))[0])
  await save(page)
  await page.getByRole('button', { name: 'Volver a rutinas', exact: true }).click()
  await card(page, name).getByRole('button', { name: 'Publicar versión', exact: true }).click()
  await expect(card(page, name)).toContainText('V1')
  return (await programs(page)).find((item) => item.name === name)!
}
async function recipient(page: Page) {
  const option = page
    .getByLabel('Socio destinatario', { exact: true })
    .locator('option')
    .filter({ hasText: 'member@atlas.example.test' })
  await expect(option).toHaveCount(1)
  const id = (await option.getAttribute('value'))!
  await page.getByLabel('Socio destinatario', { exact: true }).selectOption(id)
  return id
}
test.afterEach(async ({ page }, info) => {
  if (!page.isClosed())
    await page.screenshot({ path: info.outputPath('final-screen.png'), fullPage: true })
})

test('T01 coach route inventory, restricted actions, reload and back/forward', async ({ page }) => {
  await login(page)
  for (const [section, route, heading] of [
    ['Seguimiento', 'reports', 'Acompañar también es observar.'],
    ['Personas', 'people', 'Personas antes que números.'],
    ['Rutinas', 'programs', 'Planes con intención.'],
    ['Ejercicios', 'catalog', 'Una biblioteca que crece.'],
    ['Equipamiento', 'equipment', ''],
    ['Archivos', 'media', ''],
  ]) {
    await page.getByRole('button', { name: section, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/manage/${route}$`))
    if (heading)
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(page.getByText('Cargando esta sección…', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await expect(page.getByRole('button', { name: '+ Invitar persona', exact: true })).toHaveCount(0)
  for (const route of ['preparation', 'brand', 'website', 'qr', 'whiteLabel']) {
    await page.goto(`/manage/${route}`)
    await expect(
      page.getByRole('heading', { name: 'No tenés permisos para esta sección', exact: true }),
    ).toBeVisible()
  }
  await page.goto('/backoffice/programs')
  await expect(
    page.getByRole('heading', { name: 'Planes con intención.', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Seguimiento', exact: true }).click()
  await page.goBack()
  await expect(
    page.getByRole('heading', { name: 'Planes con intención.', exact: true }),
  ).toBeVisible()
  await page.goForward()
  await expect(
    page.getByRole('heading', { name: 'Acompañar también es observar.', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Sede y función')).toHaveValue(`${center}:coach`)
})

test('T02 repetitions, time, RPE, alternatives, reorder, publish versions, persisted snapshots and follow-up', async ({
  page,
  context,
}, info) => {
  await login(page)
  const name = `Dosis ${randomUUID()}`
  const [movement, alternative] = await baseExercises(page)
  await editor(page, name)
  await expect(
    page.getByRole('button', { name: 'Guardar borrador de rutina', exact: true }),
  ).toBeDisabled()
  await add(page, movement)
  await page.getByLabel('Series · movimiento 1', { exact: true }).fill('2')
  await page.getByLabel('Repeticiones · movimiento 1', { exact: true }).fill('12')
  await page.getByLabel('Carga kg · movimiento 1', { exact: true }).fill('27.5')
  await page.getByLabel('Esfuerzo objetivo RPE · movimiento 1', { exact: true }).fill('7.5')
  await page.getByLabel('Descanso segundos · movimiento 1', { exact: true }).fill('95')
  await page
    .getByLabel('Indicaciones · movimiento 1', { exact: true })
    .fill('Controlar el recorrido')
  await page.getByText('Alternativas autorizadas (0)', { exact: true }).click()
  await page.getByLabel(alternative.name, { exact: true }).check()
  await add(page, alternative)
  await page.getByLabel('Tipo de objetivo · movimiento 2', { exact: true }).selectOption('duration')
  await page.getByLabel('Duración segundos · movimiento 2', { exact: true }).fill('45')
  await page.getByLabel('Series · movimiento 2', { exact: true }).fill('1')
  await page.getByLabel('Esfuerzo objetivo RPE · movimiento 2', { exact: true }).fill('6')
  await page.getByRole('button', { name: 'Subir movimiento 2', exact: true }).click()
  await expect(page.getByLabel('Duración segundos · movimiento 1', { exact: true })).toHaveValue(
    '45',
  )
  await page.getByRole('button', { name: 'Bajar movimiento 1', exact: true }).click()
  await save(page)
  const program = (await programs(page)).find((item) => item.name === name)!
  expect(program.steps[0]).toMatchObject({
    sets: 2,
    reps: 12,
    loadKg: 27.5,
    targetRpe: 7.5,
    restSeconds: 95,
    alternatives: [alternative.id],
  })
  expect(program.steps[1]).toMatchObject({ reps: null, durationSeconds: 45, targetRpe: 6 })
  await page.getByRole('button', { name: 'Volver a rutinas', exact: true }).click()
  await card(page, name).getByRole('button', { name: 'Publicar versión', exact: true }).click()
  await expect(card(page, name)).toContainText('V1')
  await card(page, name).getByRole('button', { name: 'Asignar a socio', exact: true }).click()
  await expect(page.getByRole('heading', { name: `Asignar ${name}`, exact: true })).toBeVisible()
  await recipient(page)
  await page.getByRole('button', { name: 'Confirmar asignación', exact: true }).click()
  await expect(
    page.getByText('Rutina asignada. El socio ya la puede ver en su espacio.', { exact: true }),
  ).toBeVisible()
  const assignment = (await assignments(page)).find(
    (item) => item.program.programId === program.id,
  )!
  await card(page, name).getByRole('button', { name: 'Editar borrador', exact: true }).click()
  await page.getByLabel('Repeticiones · movimiento 1', { exact: true }).fill('20')
  await save(page)
  await page.getByRole('button', { name: 'Volver a rutinas', exact: true }).click()
  await card(page, name).getByRole('button', { name: 'Publicar versión', exact: true }).click()
  await expect(card(page, name)).toContainText('V2')
  expect((await assignments(page)).find((item) => item.id === assignment.id)!.program).toEqual(
    assignment.program,
  )
  // Synthetic member records via API fixture; member UI is owned by its separate role session.
  const memberContext = await context.browser()!.newContext({ ...info.project.use })
  try {
    const memberPage = await memberContext.newPage()
    await login(memberPage, 'member@atlas.example.test')
    const makeSet = (index: number, set: number) => ({
      stepId: program.steps[index].id,
      set,
      exerciseId: index === 0 ? alternative.id : alternative.id,
      reps: index === 0 ? 9 : null,
      durationSeconds: index === 0 ? null : 38,
      loadKg: index === 0 ? 22.5 : null,
      rpe: 8,
      reason: index === 0 ? 'Unidad ocupada, alternativa autorizada' : '',
    })
    for (const status of ['completed', 'partial']) {
      const result = await request(
        memberPage,
        '/executions',
        'POST',
        {
          id: randomUUID(),
          assignmentId: assignment.id,
          status,
          sets:
            status === 'completed'
              ? [makeSet(0, 1), makeSet(0, 2), makeSet(1, 1)]
              : [makeSet(0, 1)],
          completedAt: new Date().toISOString(),
          notes: `Fixture ${status}`,
        },
        center,
        'member',
      )
      expect(result.status).toBe(201)
    }
  } finally {
    await memberContext.close()
  }
  await page.getByRole('button', { name: 'Seguimiento', exact: true }).click()
  const reports = card(page, name)
  await expect(reports).toHaveCount(2)
  await expect(reports.first()).toContainText('Versión asignada: 1')
  await expect(reports.first()).toContainText('12 reps · 27.5 kg · RPE 7.5/10')
  await expect(reports.first()).toContainText('9 reps · 22.5 kg · RPE 8/10')
  await expect(reports.first()).toContainText('Unidad ocupada, alternativa autorizada')
  await expect(page.getByText('Sin registrar', { exact: true }).first()).toBeVisible()
  await page.reload()
  await expect(card(page, name)).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const comparison = card(page, name).last().locator('.table-wrap')
  await comparison.evaluate((element) => {
    element.scrollLeft = element.scrollWidth
  })
  await expect(
    card(page, name)
      .last()
      .getByText('Unidad ocupada, alternativa autorizada', { exact: true })
      .first(),
  ).toBeVisible()
  await comparison.screenshot({ path: info.outputPath('alternative-column.png') })
})

test('T03 local draft recovery, cancellation and account/branch/role isolation', async ({
  page,
}) => {
  await login(page)
  const before = (await programs(page)).length
  const name = `Local ${randomUUID()}`
  await editor(page, name)
  await add(page, (await baseExercises(page))[0])
  await page.getByLabel('Series · movimiento 1', { exact: true }).fill('0')
  await page.getByRole('button', { name: 'Guardar borrador de rutina', exact: true }).click()
  expect((await programs(page)).length).toBe(before)
  await page.getByRole('button', { name: 'Volver a rutinas', exact: true }).click()
  await page.getByRole('button', { name: '+ Crear rutina', exact: true }).click()
  await expect(page.getByLabel('Nombre de la rutina', { exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Recuperar borrador local', exact: true }).click()
  await expect(page.getByLabel('Series · movimiento 1', { exact: true })).toHaveValue('0')
  await page.reload()
  await page.getByRole('button', { name: '+ Crear rutina', exact: true }).click()
  await page.getByRole('button', { name: 'Recuperar borrador local', exact: true }).click()
  await expect(page.getByLabel('Nombre de la rutina', { exact: true })).toHaveValue(name)
  await select(page, north)
  await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
  await page.getByRole('button', { name: '+ Crear rutina', exact: true }).click()
  await expect(page.getByLabel('Nombre de la rutina', { exact: true })).toHaveValue('')
  await expect(
    page.getByRole('button', { name: 'Recuperar borrador local', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await login(page, 'multi@b2b.example.test')
  await select(page, north, 'member')
  await page.goto('/manage/programs')
  await expect(
    page.getByRole('heading', { name: 'Este espacio es para el equipo del gimnasio', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await login(page)
  await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
  await page.getByRole('button', { name: '+ Crear rutina', exact: true }).click()
  await page.getByRole('button', { name: 'Recuperar borrador local', exact: true }).click()
  await expect(page.getByLabel('Nombre de la rutina', { exact: true })).toHaveValue(name)
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await login(page, 'coach-norte@atlas.example.test')
  await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
  await page.getByRole('button', { name: '+ Crear rutina', exact: true }).click()
  await expect(page.getByLabel('Nombre de la rutina', { exact: true })).toHaveValue('')
  await expect(
    page.getByRole('button', { name: 'Recuperar borrador local', exact: true }),
  ).toHaveCount(0)
})

test('T04 concurrent save resolves real 409 without overwriting the other tab', async ({
  page,
  context,
}) => {
  await login(page)
  const name = `Conflicto ${randomUUID()}`
  await createPublished(page, name)
  await card(page, name).getByRole('button', { name: 'Editar borrador', exact: true }).click()
  await page.getByLabel('Objetivo o descripción', { exact: true }).fill('Mi copia conservada')
  const other = await context.newPage()
  await other.goto('/manage/programs')
  await select(other, center)
  await other.getByRole('button', { name: 'Rutinas', exact: true }).click()
  await card(other, name).getByRole('button', { name: 'Editar borrador', exact: true }).click()
  await other.getByLabel('Objetivo o descripción', { exact: true }).fill('Edición de otra pestaña')
  await save(other)
  await page.getByRole('button', { name: 'Guardar borrador de rutina', exact: true }).click()
  await expect(
    page.getByText(
      'Este contenido cambió desde que empezaste a editar. Tu borrador local sigue en pantalla.',
      { exact: true },
    ),
  ).toBeVisible()
  await expect(page.getByLabel('Objetivo o descripción', { exact: true })).toHaveValue(
    'Mi copia conservada',
  )
  expect((await programs(page)).find((item) => item.name === name)!.description).toBe(
    'Edición de otra pestaña',
  )
  await page
    .getByRole('button', { name: 'Descartar mis cambios y cargar versión actual', exact: true })
    .click()
  await expect(page.getByLabel('Objetivo o descripción', { exact: true })).toHaveValue(
    'Edición de otra pestaña',
  )
  await other.close()
})

test('T05 failed resource load retries and rejected save retains the editor', async ({ page }) => {
  await login(page)
  await page.route(
    '**/orgs/atlas-demo/programs',
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'UNAVAILABLE', message: 'Fixture: temporalmente sin servicio' },
        }),
      }),
    { times: 1 },
  )
  await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reintentar carga', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reintentar carga', exact: true }).click()
  await expect(page.getByRole('button', { name: '+ Crear rutina', exact: true })).toBeVisible()
  const name = `Error ${randomUUID()}`
  await editor(page, name)
  await add(page, (await baseExercises(page))[0])
  await page.route(
    '**/orgs/atlas-demo/programs',
    async (route) => {
      if (route.request().method() === 'POST') await route.abort('failed')
      else await route.continue()
    },
    { times: 1 },
  )
  await page.getByRole('button', { name: 'Guardar borrador de rutina', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByLabel('Nombre de la rutina', { exact: true })).toHaveValue(name)
  expect((await programs(page)).filter((item) => item.name === name)).toHaveLength(0)
  await save(page)
  expect((await programs(page)).filter((item) => item.name === name)).toHaveLength(1)
})

test('T06 empty authorized members and reports, search and assignment cancellation', async ({
  page,
}) => {
  await login(page)
  await select(page, north)
  await page.getByRole('button', { name: 'Seguimiento', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'El recorrido se escribe entrenando', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Filtrar seguimiento por socio').locator('option')).toHaveCount(1)
  await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
  const name = `Sin socios ${randomUUID()}`
  await editor(page, name)
  await add(page, (await baseExercises(page))[0])
  await save(page)
  await page.getByRole('button', { name: 'Volver a rutinas', exact: true }).click()
  await card(page, name).getByRole('button', { name: 'Publicar versión', exact: true }).click()
  await expect(card(page, name)).toContainText('V1')
  await card(page, name).getByRole('button', { name: 'Asignar a socio', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Todavía no hay socios disponibles', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Confirmar asignación', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: `Asignar ${name}`, exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Personas', exact: true }).click()
  await page.getByLabel('Buscar persona', { exact: true }).fill('nadie-inexistente')
  await expect(page.locator('tbody tr')).toHaveCount(0)
})

test('T07 foreign resources, unauthorized member and restricted mutations are rejected', async ({
  page,
}, info) => {
  await login(page)
  expect((await request(page, '/programs/atlas-demo-norte-starter/versions/1')).status).toBe(404)
  expect((await request(page, '/programs/sur-demo-starter/versions/1')).status).toBe(404)
  expect(
    (await request(page, '/programs', 'GET', undefined, 'sur-demo-principal', 'coach', 'sur-demo'))
      .status,
  ).toBe(404)
  const response = await request(page, '/members', 'GET', undefined, north)
  expect(response.status).toBe(200)
  expect(
    response.data.members.filter((member: { role: string }) => member.role === 'member'),
  ).toHaveLength(0)
  const foreignMember = (
    await sql(info, "SELECT id FROM b2b_auth_user WHERE email='member-norte@atlas.example.test'")
  ).rows[0].id
  await sql(
    info,
    "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas-demo',$1,$2,'member')",
    [center, foreignMember],
  )
  try {
    expect(
      (
        await request(page, '/assignments', 'POST', {
          memberId: foreignMember,
          programId: 'atlas-demo-starter',
          version: 1,
        })
      ).status,
    ).toBe(403)
  } finally {
    await sql(
      info,
      "DELETE FROM b2b_branch_grant WHERE branch_id=$1 AND user_id=$2 AND role='member'",
      [center, foreignMember],
    )
  }
  expect(
    (
      await request(page, '/units', 'POST', {
        machineId: 'base-cable-station-v1',
        label: 'Forbidden trainer unit',
      })
    ).status,
  ).toBe(403)
  expect(
    (await request(page, '/members/unknown-fixture-member', 'PATCH', { active: false })).status,
  ).toBe(403)
  await page.goto('/manage/people')
  await expect(page.getByText('member-norte@atlas.example.test', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '+ Invitar persona', exact: true })).toHaveCount(0)
})

test('T08 response lost after assignment commit and double submit do not duplicate prescriptions', async ({
  page,
}) => {
  await login(page)
  const name = `Reintento ${randomUUID()}`
  const program = await createPublished(page, name)
  await card(page, name).getByRole('button', { name: 'Asignar a socio', exact: true }).click()
  await recipient(page)
  await page.route(
    '**/orgs/atlas-demo/assignments',
    async (route) => {
      if (route.request().method() === 'POST') {
        const response = await route.fetch()
        expect(response.ok()).toBe(true)
        await route.abort('failed')
      } else await route.continue()
    },
    { times: 1 },
  )
  await page.getByRole('button', { name: 'Confirmar asignación', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(
    (await assignments(page)).filter((item) => item.program.programId === program.id),
  ).toHaveLength(1)
  await page.reload()
  await card(page, name).getByRole('button', { name: 'Asignar a socio', exact: true }).click()
  await recipient(page)
  await page
    .getByRole('button', { name: 'Confirmar asignación', exact: true })
    .evaluate((button) => {
      ;(button as HTMLButtonElement).click()
      ;(button as HTMLButtonElement).click()
    })
  await expect(
    page.getByText('Rutina asignada. El socio ya la puede ver en su espacio.', { exact: true }),
  ).toBeVisible()
  expect(
    (await assignments(page)).filter((item) => item.program.programId === program.id),
  ).toHaveLength(1)
})

test('T09 response lost after new program commit preserves one draft on retry', async ({
  page,
}) => {
  await login(page)
  const name = `Creación ${randomUUID()}`
  await editor(page, name)
  await add(page, (await baseExercises(page))[0])
  await page.route(
    '**/orgs/atlas-demo/programs',
    async (route) => {
      if (route.request().method() === 'POST') {
        const response = await route.fetch()
        expect(response.ok()).toBe(true)
        await route.abort('failed')
      } else await route.continue()
    },
    { times: 1 },
  )
  await page.getByRole('button', { name: 'Guardar borrador de rutina', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect((await programs(page)).filter((item) => item.name === name)).toHaveLength(1)
  await page.reload()
  await page.getByRole('button', { name: '+ Crear rutina', exact: true }).click()
  await page.getByRole('button', { name: 'Recuperar borrador local', exact: true }).click()
  await save(page)
  expect((await programs(page)).filter((item) => item.name === name)).toHaveLength(1)
})

test('T10 expired session clears protected data and recovers account-scoped draft after login', async ({
  page,
}, info) => {
  await login(page)
  const name = `Expirado ${randomUUID()}`
  await editor(page, name)
  await add(page, (await baseExercises(page))[0])
  await sql(
    info,
    'UPDATE b2b_auth_session SET "expiresAt"=now()-interval \'1 hour\' WHERE "userId"=(SELECT id FROM b2b_auth_user WHERE email=\'coach@atlas.example.test\')',
  )
  await page.getByRole('button', { name: 'Guardar borrador de rutina', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible()
  await expect(page.getByLabel('Nombre de la rutina', { exact: true })).toHaveCount(0)
  await login(page)
  await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
  await page.getByRole('button', { name: '+ Crear rutina', exact: true }).click()
  await page.getByRole('button', { name: 'Recuperar borrador local', exact: true }).click()
  await expect(page.getByLabel('Nombre de la rutina', { exact: true })).toHaveValue(name)
})

test('T11 revoked coach context cannot save or retain report data after authorization refresh', async ({
  page,
}, info) => {
  await login(page)
  const name = `Revocado ${randomUUID()}`
  await editor(page, name)
  await add(page, (await baseExercises(page))[0])
  try {
    await sql(
      info,
      "UPDATE b2b_branch_grant SET active=false WHERE branch_id=$1 AND role='coach' AND user_id=(SELECT id FROM b2b_auth_user WHERE email='coach@atlas.example.test')",
      [center],
    )
    await page.getByRole('button', { name: 'Guardar borrador de rutina', exact: true }).click()
    await expect(page.getByLabel('Sede y función', { exact: true })).toHaveValue(`${north}:coach`)
    await expect(page.getByLabel('Nombre de la rutina', { exact: true })).toHaveCount(0)
    await page.goto('/manage/reports')
    await expect(
      page.getByRole('heading', { name: 'El recorrido se escribe entrenando', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByLabel('Sede y función', { exact: true }).locator(`option[value="${center}:coach"]`),
    ).toHaveCount(0)
    const result = await sql(info, "SELECT id FROM b2b_program WHERE data->>'name'=$1", [name])
    expect(result.rows).toHaveLength(0)
  } finally {
    await sql(
      info,
      "UPDATE b2b_branch_grant SET active=true WHERE branch_id=$1 AND role='coach' AND user_id=(SELECT id FROM b2b_auth_user WHERE email='coach@atlas.example.test')",
      [center],
    )
  }
})

test('T12 coach reviews and publishes textual exercise; withdrawn content blocks new assignments while snapshots survive', async ({
  page,
}) => {
  await login(page)
  const name = `Contenido ${randomUUID()}`
  await page.getByRole('button', { name: 'Ejercicios', exact: true }).click()
  await page.getByRole('button', { name: '+ Crear ejercicio', exact: true }).click()
  await page.getByLabel('Nombre del ejercicio', { exact: true }).fill(name)
  await page
    .getByLabel('Instrucciones paso a paso', { exact: true })
    .fill('Mantener apoyo estable.\nControlar el recorrido sin dolor.')
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click()
  await expect(
    page.getByText('Borrador guardado. Revisalo y publicalo desde el catálogo cuando esté listo.', {
      exact: true,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Volver al catálogo', exact: true }).click()
  await card(page, name).getByRole('button', { name: 'Revisar contenido', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Confirmar revisión del ejercicio', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('checkbox', {
      name: 'Revisé las instrucciones, el equipo compatible y los recursos de este ejercicio.',
      exact: true,
    })
    .check()
  await page.getByRole('button', { name: 'Confirmar revisión del ejercicio', exact: true }).click()
  await page.getByRole('button', { name: 'Publicar ejercicio revisado', exact: true }).click()
  await expect(card(page, name)).toContainText('PUBLICADO')
  const exercise: Exercise = (await request(page, '/exercises')).data.exercises.find(
    (item: Exercise) => item.name === name,
  )
  const routineName = `Programa ${name}`
  await editor(page, routineName)
  await add(page, exercise)
  await save(page)
  await page.getByRole('button', { name: 'Volver a rutinas', exact: true }).click()
  await card(page, routineName)
    .getByRole('button', { name: 'Publicar versión', exact: true })
    .click()
  await expect(card(page, routineName)).toContainText('V1')
  await card(page, routineName)
    .getByRole('button', { name: 'Asignar a socio', exact: true })
    .click()
  await recipient(page)
  await page.getByRole('button', { name: 'Confirmar asignación', exact: true }).click()
  await expect(
    page.getByText('Rutina asignada. El socio ya la puede ver en su espacio.', { exact: true }),
  ).toBeVisible()
  const assigned = (await assignments(page)).find((item) => item.program.name === routineName)!
  await page.getByRole('button', { name: 'Ejercicios', exact: true }).click()
  await card(page, name).getByRole('button', { name: 'Editar', exact: true }).click()
  await page
    .getByLabel('Instrucciones paso a paso', { exact: true })
    .fill('Nuevo contenido aún sin revisar.')
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click()
  await expect(
    page.getByText('Borrador guardado. Revisalo y publicalo desde el catálogo cuando esté listo.', {
      exact: true,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
  await card(page, routineName)
    .getByRole('button', { name: 'Asignar a socio', exact: true })
    .click()
  await recipient(page)
  await page.getByRole('button', { name: 'Confirmar asignación', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect((await assignments(page)).find((item) => item.id === assigned.id)!.program).toEqual(
    assigned.program,
  )
  expect(
    (await assignments(page)).filter((item) => item.program.name === routineName),
  ).toHaveLength(1)
})

test('T13 revoked accompaniment hides member and prescriptions without deleting their snapshots', async ({
  page,
}, info) => {
  await login(page)
  const before = await assignments(page)
  expect(before.length).toBeGreaterThan(0)
  const memberId = before[0].memberId
  const removed = await sql(
    info,
    "DELETE FROM b2b_coach_assignment WHERE branch_id=$1 AND coach_id=(SELECT id FROM b2b_auth_user WHERE email='coach@atlas.example.test') AND member_id=$2 RETURNING *",
    [center, memberId],
  )
  try {
    await page.goto('/manage/reports')
    await expect(
      page.getByRole('heading', { name: 'El recorrido se escribe entrenando', exact: true }),
    ).toBeVisible()
    expect((await assignments(page)).filter((item) => item.memberId === memberId)).toHaveLength(0)
    expect((await request(page, `/assignments?memberId=${memberId}`)).status).toBe(403)
    const stored = await sql(
      info,
      'SELECT snapshot FROM b2b_program_version WHERE program_id=$1 AND version=$2',
      [before[0].program.programId, before[0].program.version],
    )
    expect(stored.rows[0].snapshot).toMatchObject({
      name: before[0].program.name,
      steps: before[0].program.steps,
    })
  } finally {
    for (const row of removed.rows)
      await sql(
        info,
        'INSERT INTO b2b_coach_assignment(organization_id,branch_id,coach_id,member_id) VALUES($1,$2,$3,$4)',
        [row.organization_id, row.branch_id, row.coach_id, row.member_id],
      )
  }
})

test('T14 paused service preserves read access and disables routine mutations', async ({
  page,
}, info) => {
  await login(page)
  try {
    await sql(info, "UPDATE b2b_organization SET service_enabled=false WHERE id='atlas-demo'")
    await page.goto('/manage/programs')
    await expect(
      page.getByText('El servicio del gimnasio está pausado.', { exact: false }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Crear rutina', exact: true })).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Publicar versión', exact: true }).first(),
    ).toBeDisabled()
    expect(
      (await request(page, '/programs/atlas-demo-starter/publish', 'POST', { expectedRevision: 0 }))
        .status,
    ).toBe(402)
    await page.getByRole('button', { name: 'Seguimiento', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Acompañar también es observar.', exact: true }),
    ).toBeVisible()
  } finally {
    await sql(info, "UPDATE b2b_organization SET service_enabled=true WHERE id='atlas-demo'")
  }
})

test('T15 a late save response cannot carry data or success notice into another branch', async ({
  page,
}) => {
  await login(page)
  const name = `Tardío ${randomUUID()}`
  await editor(page, name)
  await add(page, (await baseExercises(page))[0])
  let release!: () => void
  let committed!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const ready = new Promise<void>((resolve) => {
    committed = resolve
  })
  await page.route(
    '**/orgs/atlas-demo/programs',
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      const response = await route.fetch()
      expect(response.ok()).toBe(true)
      committed()
      await pending
      await route.fulfill({ response })
    },
    { times: 1 },
  )
  try {
    await page.getByRole('button', { name: 'Guardar borrador de rutina', exact: true }).click()
    await ready
    await select(page, north)
    await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
    await page.getByRole('button', { name: '+ Crear rutina', exact: true }).click()
    release()
    await expect(page.getByLabel('Nombre de la rutina', { exact: true })).toHaveValue('')
    await expect(
      page.getByText(
        'Borrador guardado. Podés publicarlo desde la lista de rutinas cuando esté listo.',
        { exact: true },
      ),
    ).toHaveCount(0)
    expect((await programs(page)).filter((item) => item.name === name)).toHaveLength(1)
    const other = await request(page, '/programs', 'GET', undefined, north)
    expect(other.data.programs.filter((item: Program) => item.name === name)).toHaveLength(0)
  } finally {
    release()
  }
})

test('T16 trainer creates, publishes and assigns in both brands and all four branches', async ({
  page,
  context,
}, info) => {
  for (const [brand, suffix, coach, member] of [
    ['atlas', 'principal', 'coach@atlas.example.test', 'member@atlas.example.test'],
    ['atlas', 'norte', 'coach-norte@atlas.example.test', 'member-norte@atlas.example.test'],
    ['sur', 'principal', 'coach@sur.example.test', 'member@sur.example.test'],
    ['sur', 'oeste', 'coach-oeste@sur.example.test', 'member-oeste@sur.example.test'],
  ]) {
    await context.clearCookies()
    await login(page, coach, `${protocol(info)}://${brand}.b2b.test`)
    const org = `${brand}-demo`,
      branch = `${org}-${suffix}`,
      name = `Circuito ${branch} ${randomUUID()}`
    await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
    await page.getByRole('button', { name: '+ Crear rutina', exact: true }).click()
    await page.getByLabel('Nombre de la rutina', { exact: true }).fill(name)
    const exercises = (await request(page, '/exercises', 'GET', undefined, branch, 'coach', org))
      .data.exercises
    await add(
      page,
      exercises.find((item: Exercise) => item.status === 'published' && !item.machineId),
    )
    await save(page)
    await page.getByRole('button', { name: 'Volver a rutinas', exact: true }).click()
    await card(page, name).getByRole('button', { name: 'Publicar versión', exact: true }).click()
    await expect(card(page, name)).toContainText('V1')
    await card(page, name).getByRole('button', { name: 'Asignar a socio', exact: true }).click()
    const option = page
      .getByLabel('Socio destinatario', { exact: true })
      .locator('option')
      .filter({ hasText: member })
    await page
      .getByLabel('Socio destinatario', { exact: true })
      .selectOption((await option.getAttribute('value'))!)
    await page.getByRole('button', { name: 'Confirmar asignación', exact: true }).click()
    await expect(
      page.getByText('Rutina asignada. El socio ya la puede ver en su espacio.', { exact: true }),
    ).toBeVisible()
    const persisted = (
      await request(page, '/assignments', 'GET', undefined, branch, 'coach', org)
    ).data.assignments.find((item: Assignment) => item.program.name === name)
    expect(persisted.branchId).toBe(branch)
    expect(persisted.program.version).toBe(1)
    await page.reload()
    await expect(card(page, name)).toBeVisible()
    await page.screenshot({ path: info.outputPath(`${branch}-trainer.png`), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('T17 trainer image library persists files, validates unsupported inputs and stays branch-scoped', async ({
  page,
}) => {
  await login(page)
  await page.getByRole('button', { name: 'Archivos', exact: true }).click()
  await page.getByLabel('Archivo del gimnasio', { exact: true }).setInputFiles({
    name: 'unsupported.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Synthetic invalid upload'),
  })
  await page.getByRole('button', { name: 'Subir a la biblioteca', exact: true }).click()
  await expect(page.getByText('Elegí un archivo del tipo indicado.', { exact: true })).toBeVisible()
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const drawing = canvas.getContext('2d')!
    drawing.fillStyle = '#93401f'
    drawing.fillRect(0, 0, 64, 64)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  const label = `Imagen ${randomUUID()}`
  await page.getByLabel('Archivo del gimnasio', { exact: true }).setInputFiles({
    name: 'trainer-fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  })
  await page.getByLabel('Nombre del archivo', { exact: true }).fill(label)
  await page.getByRole('button', { name: 'Subir a la biblioteca', exact: true }).click()
  await expect(
    page.getByText('Archivo guardado en la biblioteca del gimnasio.', { exact: true }),
  ).toBeVisible()
  const media = (await request(page, '/media')).data.media.filter(
    (item: { label: string }) => item.label === label,
  )
  expect(media).toHaveLength(1)
  expect(media[0].bytes).toBe(Buffer.from(png, 'base64').length)
  await page.reload()
  await page.getByLabel('Buscar en la biblioteca de archivos', { exact: true }).fill(label)
  await expect(page.locator('.media-library-item').filter({ hasText: label })).toHaveCount(1)
  await select(page, north)
  await page.getByRole('button', { name: 'Archivos', exact: true }).click()
  await expect(page.locator('.media-library-item').filter({ hasText: label })).toHaveCount(0)
})

test('T18 browser validates dosage bounds and double-clicking save and publish creates one program/version', async ({
  page,
}) => {
  await login(page)
  const name = `Límites ${randomUUID()}`
  await editor(page, name)
  await add(page, (await baseExercises(page))[0])
  for (const [label, invalid, valid] of [
    ['Series · movimiento 1', '31', '2'],
    ['Repeticiones · movimiento 1', '0', '12'],
    ['Carga kg · movimiento 1', '-1', '2.5'],
    ['Descanso segundos · movimiento 1', '3601', '0'],
    ['Esfuerzo objetivo RPE · movimiento 1', '11', '7.5'],
  ]) {
    await page.getByLabel(label, { exact: true }).fill(invalid)
    await page.getByRole('button', { name: 'Guardar borrador de rutina', exact: true }).click()
    expect(
      await page
        .getByLabel(label, { exact: true })
        .evaluate((input) => (input as HTMLInputElement).validity.valid),
    ).toBe(false)
    expect((await programs(page)).filter((item) => item.name === name)).toHaveLength(0)
    await page.getByLabel(label, { exact: true }).fill(valid)
  }
  await page
    .getByRole('button', { name: 'Guardar borrador de rutina', exact: true })
    .evaluate((button) => {
      ;(button as HTMLButtonElement).click()
      ;(button as HTMLButtonElement).click()
    })
  await expect(
    page.getByText(
      'Borrador guardado. Podés publicarlo desde la lista de rutinas cuando esté listo.',
      { exact: true },
    ),
  ).toBeVisible()
  expect((await programs(page)).filter((item) => item.name === name)).toHaveLength(1)
  await page.getByRole('button', { name: 'Volver a rutinas', exact: true }).click()
  await card(page, name)
    .getByRole('button', { name: 'Publicar versión', exact: true })
    .evaluate((button) => {
      ;(button as HTMLButtonElement).click()
      ;(button as HTMLButtonElement).click()
    })
  await expect(card(page, name)).toContainText('V1')
  expect((await programs(page)).find((item) => item.name === name)!.publishedVersion).toBe(1)
})

test('T19 lost publication response rejects stale retry and reload reveals only version one', async ({
  page,
}) => {
  await login(page)
  const name = `Publicación ${randomUUID()}`
  await editor(page, name)
  await add(page, (await baseExercises(page))[0])
  await save(page)
  await page.getByRole('button', { name: 'Volver a rutinas', exact: true }).click()
  const program = (await programs(page)).find((item) => item.name === name)!
  await page.route(
    `**/programs/${program.id}/publish`,
    async (route) => {
      const response = await route.fetch()
      expect(response.ok()).toBe(true)
      await route.abort('failed')
    },
    { times: 1 },
  )
  await card(page, name).getByRole('button', { name: 'Publicar versión', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect((await programs(page)).find((item) => item.id === program.id)!.publishedVersion).toBe(1)
  const rejected = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/programs/${program.id}/publish`) && response.status() === 409,
  )
  await card(page, name).getByRole('button', { name: 'Publicar versión', exact: true }).click()
  await rejected
  await page.reload()
  await expect(card(page, name)).toContainText('V1')
  expect((await request(page, `/programs/${program.id}/versions/2`)).status).toBe(404)
})

test('T20 lost update response conserves the local draft and resolves the accepted revision explicitly', async ({
  page,
}) => {
  await login(page)
  const name = `Edición ${randomUUID()}`
  const program = await createPublished(page, name)
  await card(page, name).getByRole('button', { name: 'Editar borrador', exact: true }).click()
  await page
    .getByLabel('Objetivo o descripción', { exact: true })
    .fill('Cambio guardado con respuesta perdida')
  await page.route(
    `**/programs/${program.id}`,
    async (route) => {
      const response = await route.fetch()
      expect(response.ok()).toBe(true)
      await route.abort('failed')
    },
    { times: 1 },
  )
  await page.getByRole('button', { name: 'Guardar borrador de rutina', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect((await programs(page)).find((item) => item.id === program.id)!.description).toBe(
    'Cambio guardado con respuesta perdida',
  )
  await page.getByRole('button', { name: 'Guardar borrador de rutina', exact: true }).click()
  await expect(
    page.getByText(
      'Este contenido cambió desde que empezaste a editar. Tu borrador local sigue en pantalla.',
      { exact: true },
    ),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Descartar mis cambios y cargar versión actual', exact: true })
    .click()
  await expect(page.getByLabel('Objetivo o descripción', { exact: true })).toHaveValue(
    'Cambio guardado con respuesta perdida',
  )
  expect((await programs(page)).find((item) => item.id === program.id)!.revision).toBe(
    program.revision + 1,
  )
})
