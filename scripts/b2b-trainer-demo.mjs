// Reuses ONLY the disposable trainer harness. No real account or external origin.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { whiteLabelTLS } from './b2b-wl-tls.mjs'

if (
  (await fetch('http://127.0.0.1:4360/')
    .then((response) => response.text())
    .catch(() => null)) !== 'trainer QA ready'
)
  throw new Error('Start scripts/b2b-trainer-e2e-server.mjs with a disposable test database first.')
const require = createRequire(new URL('../apps/b2c-web/package.json', import.meta.url))
const { chromium, expect } = require('@playwright/test')
const smoke = process.argv.includes('--smoke')
const browser = await chromium.launch({
  headless: smoke,
  ...(process.env.TRAINER_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.TRAINER_CHROMIUM_EXECUTABLE }
    : {}),
  args: [`--ignore-certificate-errors-spki-list=${whiteLabelTLS().spki}`],
})
const options = {
  proxy: { server: 'http://127.0.0.1:4362' },
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  locale: 'es-AR',
}
const center = 'atlas-demo-principal'
async function login(page, email) {
  await page.goto('https://atlas.b2b.test/manage')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill('browser-tests-only-password-2026')
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = page.waitForResponse(
      (response) =>
        response.url().endsWith('/auth/sign-in/email') && response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
    const response = await result
    if (response.status() !== 429) break
    await page.waitForTimeout(
      Math.min(60, Math.max(1, Number(response.headers()['retry-after']) || 60)) * 1000,
    )
  }
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
}
async function request(page, role, path, method = 'GET', body) {
  const result = await page.evaluate(
    async ({ role, path, method, body, center }) => {
      const identity = await (await fetch('/api/b2b/me')).json()
      const response = await fetch(`/api/b2b/orgs/atlas-demo${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Klisteni-B2B-Account': identity.user.id,
          'X-Klisteni-B2B-Branch': center,
          'X-Klisteni-B2B-Role': role,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      return { ok: response.ok, status: response.status, data: await response.json() }
    },
    { role, path, method, body, center },
  )
  if (!result.ok) throw new Error(`Synthetic demo fixture ${path}: HTTP ${result.status}`)
  return result.data
}
try {
  const coach = await browser.newContext(options)
  const page = await coach.newPage()
  await login(page, 'coach@atlas.example.test')
  await page.getByLabel('Sede y función', { exact: true }).selectOption(`${center}:coach`)
  const name = 'Demostración entrenador · tiempo y repeticiones'
  let program = (await request(page, 'coach', '/programs')).programs.find(
    (item) => item.name === name,
  )
  if (!program)
    program = (
      await request(page, 'coach', '/programs', 'POST', {
        name,
        description: 'Datos ficticios para revisar prescripción, alternativas y seguimiento.',
        steps: [
          {
            id: 'demo-reps',
            exerciseId: 'squat',
            sets: 2,
            reps: 12,
            loadKg: 10,
            targetRpe: 7.5,
            restSeconds: 90,
            alternatives: ['quarter-squat'],
          },
          {
            id: 'demo-time',
            exerciseId: 'quarter-squat',
            sets: 1,
            reps: null,
            durationSeconds: 45,
            targetRpe: 6,
            restSeconds: 60,
          },
        ],
      })
    ).program
  if (!program.publishedVersion)
    await request(page, 'coach', `/programs/${program.id}/publish`, 'POST', {
      expectedRevision: program.revision,
    })
  const member = (await request(page, 'coach', '/members')).members.find(
    (item) => item.email === 'member@atlas.example.test',
  )
  let assignment = (await request(page, 'coach', '/assignments')).assignments.find(
    (item) => item.memberId === member.userId && item.program.programId === program.id,
  )
  if (!assignment)
    assignment = (
      await request(page, 'coach', '/assignments', 'POST', {
        memberId: member.userId,
        programId: program.id,
        version: 1,
      })
    ).assignment
  const memberContext = await browser.newContext(options)
  const memberPage = await memberContext.newPage()
  await login(memberPage, 'member@atlas.example.test')
  const prior = (await request(memberPage, 'member', '/executions')).executions
  const repetition = (set) => ({
    stepId: 'demo-reps',
    set,
    exerciseId: 'quarter-squat',
    reps: 9,
    loadKg: 7.5,
    rpe: 8,
    reason: 'Alternativa autorizada de demostración',
  })
  for (const status of ['partial', 'completed']) {
    const id = `demo-trainer-${assignment.id}-${status}`
    if (prior.some((item) => item.id === id)) continue
    await request(memberPage, 'member', '/executions', 'POST', {
      id,
      assignmentId: assignment.id,
      status,
      sets:
        status === 'partial'
          ? [repetition(1)]
          : [
              repetition(1),
              repetition(2),
              {
                stepId: 'demo-time',
                set: 1,
                exerciseId: 'quarter-squat',
                reps: null,
                durationSeconds: 38,
                rpe: 8,
              },
            ],
      completedAt: new Date().toISOString(),
      notes: `Registro ${status} ficticio para revisión manual.`,
    })
  }
  await memberContext.close()
  await page.goto('https://atlas.b2b.test/manage/reports')
  await expect(
    page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) }),
  ).toHaveCount(2)
  console.info(
    'Demostración sintética lista en Atlas/Centro como entrenador. El navegador usa el proxy local 4362.',
  )
  if (smoke) {
    mkdirSync(new URL('../.cache/trainer/', import.meta.url), { recursive: true })
    await page.screenshot({
      path: new URL('../.cache/trainer/manual-demo.png', import.meta.url).pathname,
      fullPage: true,
    })
  } else await new Promise((resolve) => browser.once('disconnected', resolve))
} finally {
  await browser.close()
}
