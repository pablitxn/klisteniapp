import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test'
import { get } from 'node:http'
import { randomUUID } from 'node:crypto'
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ProductEndpoints,
  type ProductEndpoint,
  type ProductInput,
  type ProductOutput,
  type Dose,
  type OrganizationRoleV2,
  type RoutineVersionV2,
  type Enrollment,
  type Occurrence,
  type SessionContent,
} from '../../../../../packages/b2b-contracts/src/product-v2.ts'
export { expect }
export type { Page, TestInfo, BrowserContext }

export type Actor = {
  id: string
  email: string
  memberships: Array<{ organizationId: string; intendedRole: string; active: boolean }>
}
type Organization = { id: string; host: string; branches: Record<string, string> }
type RouteName =
  | 'programming'
  | 'history'
  | 'health'
  | 'trainerHealth'
  | 'people'
  | 'workout'
  | 'reports'
export type ProductFixture = {
  fixtureVersion: number
  phase: string
  featuresActivated: boolean
  runKey: string
  organizations: Record<string, Organization>
  actors: Record<string, Actor>
  preservation: { beforeSha256: string; afterSha256: string; counts: Record<string, number> }
  resources: {
    legacy: Array<{
      organizationId: string
      branchId: string
      memberId: string
      programId: string
      assignmentId: string
      executionId: string
      mediaId: string
    }>
  }
  routes?: Partial<Record<RouteName, string>>
  entryPoints?: { workoutButtonName?: string }
  readiness?: { remoteHealthInvalidation?: boolean; localRecoveryBinding?: boolean }
}
export type Principal = {
  actor: Actor
  organization: Organization
  branchId: string
  role: OrganizationRoleV2
}
export function unavailable(info: TestInfo, reason: string): never {
  info.annotations.push({ type: 'unavailable', description: reason })
  base.skip(true, `Unavailable: ${reason}`)
  throw new Error('Playwright did not stop an unavailable scenario')
}
function fixtureMap(info: TestInfo): Promise<ProductFixture> {
  const { fixtureControlPort: port, fixtureIndex: index } = info.project.metadata
  if (
    !Number.isInteger(port) ||
    Number(port) < 1024 ||
    Number(port) > 65535 ||
    !Number.isInteger(index) ||
    Number(index) < 0 ||
    Number(index) > 5
  ) {
    return Promise.reject(new Error('INTEGRATION fixture control metadata is missing or invalid'))
  }
  // Runner-to-loopback read: never send this through the browser's scoped host proxy.
  return new Promise((resolve, reject) => {
    const request = get(`http://127.0.0.1:${port}/fixtures?project=${index}`, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        body += chunk
        if (body.length > 2_000_000) request.destroy(new Error('Fixture map exceeds bound'))
      })
      response.on('end', () => {
        try {
          expect(
            response.statusCode,
            'Fixture control must be a successful read, not a mocked response',
          ).toBe(200)
          const parsed = JSON.parse(body) as ProductFixture
          expect(parsed.fixtureVersion).toBeGreaterThanOrEqual(2)
          expect(parsed.organizations && parsed.actors && parsed.resources).toBeTruthy()
          resolve(parsed)
        } catch (error) {
          reject(error)
        }
      })
    })
    request.setTimeout(10_000, () => request.destroy(new Error('Fixture control read timed out')))
    request.on('error', reject)
  })
}
export const test = base.extend<{ product: ProductFixture }>({
  product: async ({ context }, use, info) => {
    if (
      info.project.metadata.fixtureControlPort === undefined ||
      info.project.metadata.fixtureIndex === undefined
    ) {
      unavailable(
        info,
        'Use an INTEGRATION product config; this existing harness has no product fixture control',
      )
    }
    const product = await fixtureMap(info)
    if (!product.featuresActivated)
      unavailable(info, `Real fixture phase ${product.phase} has product activation disabled`)
    // Existing HTTP QA convention: cryptographic UUIDs only; this does not make a
    // fictitious HTTP origin secure, alter TLS trust, or change cookie rules.
    if (info.project.metadata.b2bProduct?.mode === 'white-label-http') {
      await context.addInitScript(() => {
        if (!crypto.randomUUID)
          Object.defineProperty(crypto, 'randomUUID', {
            value: () => {
              const bytes = crypto.getRandomValues(new Uint8Array(16))
              bytes[6] = (bytes[6]! & 15) | 64
              bytes[8] = (bytes[8]! & 63) | 128
              const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
              return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
            },
          })
      })
    }
    await use(product)
  },
})
export function principal(
  product: ProductFixture,
  label = 'member',
  brand = 'atlas',
  secondary = false,
): Principal {
  const actor =
    Object.entries(product.actors).find(([key]) => key.endsWith(`-${brand}-${label}`))?.[1] ??
    Object.entries(product.actors).find(([key]) => key.endsWith(`-${label}`))?.[1]
  const organization = Object.values(product.organizations).find(
    (org) => org.host === `${brand}.b2b.test`,
  )
  expect(actor, `Named seed actor ${brand}/${label}`).toBeTruthy()
  expect(organization, `Named seed organization ${brand}`).toBeTruthy()
  const branchId = Object.entries(organization!.branches).find(([key]) =>
    key.endsWith(secondary ? (brand === 'atlas' ? '-norte' : '-oeste') : '-principal'),
  )?.[1]
  expect(branchId).toBeTruthy()
  const role =
    label.includes('coach') || (label === 'mixed-role' && !secondary)
      ? 'coach'
      : label.includes('admin')
        ? label === 'new-admin'
          ? 'admin'
          : 'superadmin'
        : 'member'
  return { actor: actor!, organization: organization!, branchId: branchId!, role }
}
/** Respect the locked database limiter, which expires after an idle window. */
export async function pacePasswordAdmission(info: TestInfo) {
  mkdirSync(info.project.outputDir, { recursive: true })
  const pacePath = join(info.project.outputDir, 'wp12-auth-pace.json')
  const previous = existsSync(pacePath)
    ? (JSON.parse(readFileSync(pacePath, 'utf8')) as { at: number; count?: number })
    : { at: 0, count: 0 }
  // better-auth1.7.7 updates lastRequest on every accepted admission. A steady
  // seven-second cadence never expires its counter: reserve at most nine slots,
  // then allow a full idle minute plus margin. No credential/cookie is retained.
  const gap = (previous.count ?? 1) >= 9 ? 61_000 : 0
  const wait = Math.max(0, Number(previous.at) + gap - Date.now())
  if (wait) {
    info.annotations.push({
      type: 'auth-pacing',
      description: `Real password admission waits ${wait}ms for the unchanged database guard`,
    })
    info.setTimeout(info.timeout + wait + 1000)
    let remaining = wait
    while (remaining > 0) {
      const chunk = Math.min(remaining, 30_000)
      await new Promise((resolve) => setTimeout(resolve, chunk))
      remaining -= chunk
    }
  }
  const now = Date.now()
  writeFileSync(
    pacePath,
    JSON.stringify({
      at: now,
      count: now - Number(previous.at) >= 60_000 ? 1 : (previous.count ?? 1) + 1,
    }),
    { mode: 0o600 },
  )
}
export async function login(page: Page, who: Principal, info: TestInfo) {
  const mode = info.project.metadata.b2bProduct.mode
  const origin =
    mode === 'unified-http'
      ? String(info.project.use.baseURL)
      : `${mode === 'white-label-http' ? 'http' : 'https'}://${who.organization.host}`
  await page.goto(`${origin}/app`)
  await page.getByLabel('Email', { exact: true }).fill(who.actor.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('b2b-product-synthetic-password-2026')
  await pacePasswordAdmission(info)
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/auth/sign-in/email') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  expect((await response).status(), 'Real composed UI password admission').toBe(200)
  const organizations = page.getByRole('combobox', { name: 'Organización', exact: true })
  await expect(organizations).toBeVisible()
  if ((await organizations.inputValue()) !== who.organization.id)
    await organizations.selectOption(who.organization.id)
  const access = await api(page, who, 'access', {})
  expect(access.userId).toBe(who.actor.id)
  if (access.accessMode === 'export-only') return
  expect(access.accessMode).toBe('active')
  const selector = page.getByRole('combobox', { name: 'Sede y función', exact: true })
  await expect(selector).toBeVisible()
  {
    const exact = JSON.stringify([who.branchId, who.role])
    const options = await selector
      .locator('option')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value))
    const legacyAdmin = JSON.stringify([who.branchId, 'admin'])
    const value = options.includes(exact)
      ? exact
      : who.role === 'superadmin' && options.includes(legacyAdmin)
        ? legacyAdmin
        : exact
    if ((await selector.inputValue()) !== value) await selector.selectOption(value)
  }
}
export async function open(
  page: Page,
  product: ProductFixture,
  info: TestInfo,
  route: RouteName,
  values: Record<string, string> = {},
) {
  const template = product.routes?.[route]
  if (!template) {
    // These are the actual composed navigation labels in candidate 04ac103,
    // not test-only routes or injected component mounts.
    const labels = {
      programming: 'Programación',
      history: 'Mi rutina e historial',
      health: 'Mi salud',
      trainerHealth: 'Salud compartida',
      people: 'Personas',
      reports: 'Historial',
    }
    if (route === 'workout')
      unavailable(info, 'Workouts open through the actual issued-session action')
    await page
      .getByRole('navigation', { name: 'Secciones del gimnasio', exact: true })
      .getByRole('link', { name: labels[route], exact: true })
      .click()
    if (route === 'trainerHealth') {
      expect(values.memberId, 'An actual member must be selected for trainer health').toBeTruthy()
      await page
        .getByRole('combobox', { name: 'Persona', exact: true })
        .selectOption(values.memberId!)
    }
    return
  }
  const path = template.replace(/\{(\w+)\}/g, (_, key) => {
    if (!values[key]) throw new Error(`Missing bound route parameter ${key}`)
    return encodeURIComponent(values[key])
  })
  expect(path.startsWith('/') && !path.startsWith('//')).toBe(true)
  await page.goto(new URL(path, page.url()).href)
  if (route === 'trainerHealth') {
    expect(values.memberId, 'An actual member must be selected for trainer health').toBeTruthy()
    await page
      .getByRole('combobox', { name: 'Persona', exact: true })
      .selectOption(values.memberId!)
  }
}
export async function raw<K extends ProductEndpoint>(
  page: Page,
  who: Principal,
  key: K,
  input: ProductInput<K>,
  overrides: { branchId?: string; organizationId?: string; role?: OrganizationRoleV2 } = {},
) {
  const endpoint = ProductEndpoints[key]
  const parsed = endpoint.input.parse(input) as Record<string, unknown>
  const parameters = { ...parsed }
  const path = endpoint.path.replace(/:([a-zA-Z]+)/g, (_, name) => {
    const value = parameters[name]
    delete parameters[name]
    return encodeURIComponent(String(value))
  })
  const base =
    endpoint.scope === 'self'
      ? path
      : `/orgs/${encodeURIComponent(overrides.organizationId ?? who.organization.id)}${path}`
  const query =
    endpoint.scope === 'self'
      ? new URLSearchParams({ organizationId: overrides.organizationId ?? who.organization.id })
      : new URLSearchParams(
          endpoint.method === 'GET'
            ? Object.entries(parameters).map(([k, v]) => [k, String(v)])
            : [],
        )
  return page.request.fetch(
    new URL(`/api/b2b${base}${query.size ? `?${query}` : ''}`, page.url()).href,
    {
      method: endpoint.method,
      headers: {
        Origin: new URL(page.url()).origin,
        'X-Klisteni-B2B-Contract': '2',
        'X-Klisteni-B2B-Account': who.actor.id,
        'X-Klisteni-B2B-Branch': overrides.branchId ?? who.branchId,
        'X-Klisteni-B2B-Role': overrides.role ?? who.role,
      },
      ...(endpoint.method === 'POST' ? { data: parsed } : {}),
    },
  )
}
export async function api<K extends ProductEndpoint>(
  page: Page,
  who: Principal,
  key: K,
  input: ProductInput<K>,
): Promise<ProductOutput<K>> {
  const response = await raw(page, who, key, input)
  expect(
    response.ok(),
    `${key}: HTTP ${response.status()} ${(await response.text()).slice(0, 800)}`,
  ).toBe(true)
  return ProductEndpoints[key].output.parse(await response.json()) as ProductOutput<K>
}
export const operation = () => randomUUID()
export const date = (offset = 0) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}
export const monday = (value = date()) => {
  const d = new Date(`${value}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}
export const addDays = (value: string, amount: number) => {
  const d = new Date(`${value}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + amount)
  return d.toISOString().slice(0, 10)
}
const inventory = JSON.parse(
  readFileSync(new URL('./scenarios.json', import.meta.url), 'utf8'),
) as { scenarios: Array<{ id: string }> }
export function caseWeek() {
  const id = base.info().title.match(/B2BP-[A-Z]+-\d{3}/)?.[0]
  const index = inventory.scenarios.findIndex((scenario) => scenario.id === id)
  if (index < 0) throw new Error('A scenario ID is required for isolated historical week data')
  return addDays(monday(date(-14)), -7 * index)
}
export function dose(overrides: Partial<Dose> = {}): Dose {
  return {
    mode: 'repetitions',
    sets: { kind: 'fixed', value: 1 },
    repetitions: { kind: 'fixed', value: 5 },
    durationSeconds: null,
    load: { mode: 'bodyweight' },
    restSeconds: { kind: 'fixed', value: 60 },
    laterality: 'bilateral',
    targetRpe: null,
    notes: 'Synthetic actual transport acceptance',
    ...overrides,
  }
}
export async function publish(
  page: Page,
  staff: Principal,
  content?: ProductInput<'saveRoutine'>['content'],
): Promise<RoutineVersionV2> {
  const exercises = await api(page, staff, 'catalogExercises', {})
  const exercise =
    exercises.find((item) => item.id === 'squat' && item.status === 'published') ??
    exercises.find((item) => item.status === 'published' && !item.machineId)
  expect(
    exercise,
    'At least one currently published equipment-free canonical exercise',
  ).toBeTruthy()
  const routine = await api(page, staff, 'saveRoutine', {
    id: operation(),
    operationId: operation(),
    expectedRevision: 0,
    content: content ?? {
      name: `WP12 ${operation()}`,
      description: 'Synthetic browser case',
      steps: [
        { id: operation(), exerciseId: exercise!.id, dose: dose(), substitutionPolicy: 'reviewed' },
      ],
    },
  })
  return api(page, staff, 'publishRoutine', {
    id: routine.id,
    expectedRevision: routine.revision,
    operationId: operation(),
  })
}
export async function prescribe(
  page: Page,
  staff: Principal,
  member: Principal,
  options: {
    weekStart?: string
    weekdays?: number[]
    routine?: RoutineVersionV2
    timeZone?: string
    durationDays?: number
  } = {},
) {
  const routine = options.routine ?? (await publish(page, staff))
  const start = options.weekStart ?? caseWeek()
  const content = {
    name: `WP12 goal ${operation()}`,
    goal: 'Preserve routine, occurrence and actual links',
    timeZone: options.timeZone ?? 'UTC',
    stages: [
      {
        id: operation(),
        name: 'Synthetic stage',
        startDate: start,
        endDate: addDays(start, (options.durationDays ?? 7) - 1),
        slots: (options.weekdays ?? [1, 2, 3, 4]).map((weekday) => ({
          id: operation(),
          weekday,
          routine: {
            programId: routine.programId,
            version: routine.version,
            schemaVersion: 2 as const,
          },
        })),
      },
    ],
  }
  const goal = await api(page, staff, 'saveGoal', {
    id: operation(),
    operationId: operation(),
    expectedRevision: 0,
    memberId: member.actor.id,
    content,
  })
  const enrollment = await api(page, staff, 'enroll', {
    id: operation(),
    operationId: operation(),
    expectedRevision: 0,
    memberId: member.actor.id,
    goalProgramId: goal.id,
    issuedGoalRevision: goal.revision,
    content,
  })
  const occurrences = (
    await api(page, staff, 'occurrences', {
      memberId: member.actor.id,
      weekStart: start,
      timeZone: content.timeZone,
    })
  ).filter((item) => item.enrollmentId === enrollment.id)
  expect(occurrences).toHaveLength(content.stages[0]!.slots.length)
  return { routine, goal, enrollment, occurrences, weekStart: start }
}
export function actualContent(
  routine: RoutineVersionV2,
  performedDate: string,
  status: SessionContent['status'] = 'completed',
): SessionContent {
  const segments = routine.steps.map((step) => ({
    segmentId: operation(),
    originalStepId: step.id,
    exerciseId: step.exerciseId,
    dose: step.dose,
    relation: null,
    confirmedConditions: [],
    createdAt: `${performedDate}T10:00:00Z`,
  }))
  return {
    status,
    explicitCompletion: status === 'completed',
    performedAt: `${performedDate}T10:00:00Z`,
    notes: 'WP12 synthetic actual',
    correctionReason: '',
    segments,
    selectedSegments: segments.map((s) => ({
      originalStepId: s.originalStepId,
      segmentId: s.segmentId,
    })),
    sets:
      status === 'draft'
        ? []
        : segments.flatMap((s) =>
            Array.from(
              { length: s.dose.sets.kind === 'fixed' ? s.dose.sets.value : s.dose.sets.min },
              (_, index) =>
                (s.dose.laterality === 'bilateral'
                  ? ['both' as const]
                  : ['left' as const, 'right' as const]
                ).map((side) => ({
                  performedSetId: operation(),
                  segmentId: s.segmentId,
                  ordinal: index + 1,
                  side,
                  repetitions: s.dose.mode === 'repetitions' ? 1 : null,
                  durationSeconds: s.dose.mode === 'duration' ? 1 : null,
                  loadKg: s.dose.load.mode === 'external' ? 0 : null,
                  rpe: null,
                  notes: '',
                })),
            ).flat(),
          ),
  }
}
export async function record(
  page: Page,
  member: Principal,
  routine: RoutineVersionV2,
  occurrence: Occurrence,
  status: SessionContent['status'] = 'completed',
) {
  const input: ProductInput<'saveSession'> = {
    id: operation(),
    operationId: operation(),
    expectedRevision: 0,
    origin: { kind: 'occurrence', occurrenceId: occurrence.id, routine: occurrence.routine },
    content: actualContent(routine, occurrence.scheduledDate, status),
  }
  return { ...(await api(page, member, 'saveSession', input)), sent: input }
}
export async function updateActive(page: Page, staff: Principal, who: Principal, active: boolean) {
  const current = (await api(page, staff, 'people', {})).find(
    (item) => item.userId === who.actor.id,
  )
  expect(current).toBeTruthy()
  return api(page, staff, 'updateMember', {
    memberId: who.actor.id,
    expectedRevision: current!.revision,
    operationId: operation(),
    active,
  })
}
export async function newPage(context: BrowserContext, info: TestInfo, timezoneId = 'UTC') {
  const browser = context.browser()!
  const use = info.project.use
  const separate = await browser.newContext({
    viewport: use.viewport,
    hasTouch: use.hasTouch,
    isMobile: use.isMobile,
    proxy: use.proxy,
    baseURL: use.baseURL,
    locale: 'es-AR',
    timezoneId,
    ignoreHTTPSErrors: false,
  })
  if (info.project.metadata.b2bProduct?.mode === 'white-label-http')
    await separate.addInitScript(() => {
      if (!crypto.randomUUID)
        Object.defineProperty(crypto, 'randomUUID', {
          value: () => {
            const bytes = crypto.getRandomValues(new Uint8Array(16))
            bytes[6] = (bytes[6]! & 15) | 64
            bytes[8] = (bytes[8]! & 63) | 128
            const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
            return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
          },
        })
    })
  return { context: separate, page: await separate.newPage() }
}
export type Prescription = {
  routine: RoutineVersionV2
  enrollment: Enrollment
  occurrences: Occurrence[]
  weekStart: string
}

export async function showWeek(
  page: Page,
  product: ProductFixture,
  info: TestInfo,
  week: string,
  timeZone = 'UTC',
) {
  await open(page, product, info, 'history')
  await expect(
    page.getByRole('heading', { name: 'Mi rutina e historial', exact: true }),
  ).toBeVisible()
  // Date-only clock controls the requested calendar week; authoritative server
  // asOf/closed counts remain unmodified real responses. No mocked DTO is used.
  await page.clock.setFixedTime(new Date(`${week}T12:00:00Z`))
  await page.reload()
  await page
    .getByRole('combobox', { name: 'Zona horaria de la inscripción', exact: true })
    .selectOption(timeZone)
  await expect(page.getByRole('heading', { name: `Semana del ${week}`, exact: true })).toBeVisible()
}
export async function startWorkout(
  page: Page,
  product: ProductFixture,
  info: TestInfo,
  plan: Prescription,
  sessionId = operation(),
) {
  const occurrence = plan.occurrences[0]!
  const accepted = page.waitForResponse((r) => {
    if (
      r.request().method() !== 'POST' ||
      !/\/sessions\/[^/]+\/revisions$/.test(new URL(r.url()).pathname)
    )
      return false
    return r.request().postDataJSON()?.origin?.occurrenceId === occurrence.id
  })
  void accepted.catch(() => {}) // A failed UI assertion must not leave an unhandled waiter at teardown.
  if (product.routes?.workout) {
    await open(page, product, info, 'workout', {
      occurrenceId: occurrence.id,
      sessionId,
      programId: plan.routine.programId,
      version: String(plan.routine.version),
    })
  } else {
    await showWeek(page, product, info, plan.weekStart)
    if (product.entryPoints?.workoutButtonName) {
      await page
        .locator(`[id="scheduled-occurrence-${occurrence.id}"]`)
        .getByRole('button', { name: product.entryPoints.workoutButtonName, exact: true })
        .click()
    } else {
      await page
        .getByRole('button', { name: `Abrir sesión del ${occurrence.scheduledDate}`, exact: true })
        .click()
    }
  }
  await expect(page.getByRole('heading', { name: plan.routine.name, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar parcial', exact: true })).toBeVisible()
  await page
    .getByLabel('Fecha y hora realizada (ISO con zona)', { exact: true })
    .fill(`${occurrence.scheduledDate}T10:00:00Z`)
  const response = await accepted
  expect(response.ok(), 'The real issued workout must acknowledge its initial draft').toBe(true)
  return (await response.json()).session.id as string
}
export async function staffSession(
  context: BrowserContext,
  product: ProductFixture,
  info: TestInfo,
  label = 'superadmin',
) {
  const peer = await newPage(context, info)
  const who = principal(product, label)
  await login(peer.page, who, info)
  return { ...peer, who }
}
export async function latest(page: Page, member: Principal, occurrenceId: string) {
  const sessions = await api(page, member, 'sessions', { memberId: member.actor.id })
  return sessions
    .filter(
      (session): session is Extract<ProductOutput<'sessions'>[number], { schemaVersion: 2 }> =>
        session.schemaVersion === 2 &&
        session.origin.kind === 'occurrence' &&
        session.origin.occurrenceId === occurrenceId,
    )
    .sort((a, b) =>
      b.schemaVersion === 2 && a.schemaVersion === 2 ? b.revision - a.revision : 0,
    )[0]
}
