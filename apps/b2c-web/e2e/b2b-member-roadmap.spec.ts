import { expect, test, type Page } from '@playwright/test'
import type { Me, Program, Execution } from '../../../packages/b2b-contracts/src/index.ts'

async function login(page: Page, role: 'admin' | 'member') {
  await page.goto(role === 'admin' ? '/backoffice/' : '/app')
  await page.getByLabel('Email', { exact: true }).fill(`${role}@atlas.example.test`)
  await page.getByLabel('Contraseña', { exact: true }).fill('browser-tests-only-password-2026')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
}

function routine(page: Page, name = 'Inicio · fuerza y técnica') {
  return page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
}

test('member keyboard and touch controls keep optional voice and real-time rest separate from training records', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const events: string[] = []
    Object.defineProperty(window, '__voiceEvents', { value: events })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: class {
        text: string
        constructor(text: string) {
          this.text = text
        }
      },
    })
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: (utterance: { text: string }) => events.push(`speak:${utterance.text}`),
        cancel: () => events.push('cancel'),
        pause: () => events.push('pause'),
        resume: () => events.push('resume'),
        getVoices: () => [],
      },
    })
  })
  let saves = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/executions')) saves += 1
  })
  await login(page, 'member')
  const start = routine(page).getByRole('button', { name: 'Empezar sesión', exact: true })
  await start.focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Inicio · fuerza y técnica' }),
  ).toBeFocused()
  const movement = page.locator('.session-step').first()
  await movement.locator('summary').first().focus()
  await page.keyboard.press('Enter')
  const listen = movement.getByRole('button', { name: 'Escuchar instrucciones', exact: true })
  await expect(listen).toBeVisible()
  await expect(movement.locator('canvas')).toHaveCount(0)
  expect(
    await page.evaluate(() => (window as unknown as { __voiceEvents: string[] }).__voiceEvents),
  ).toEqual([])
  if (testInfo.project.use.hasTouch) await listen.tap()
  else await listen.click()
  await movement.getByRole('button', { name: 'Pausar voz', exact: true }).click()
  await expect(movement.getByText('Voz en pausa.', { exact: true })).toBeVisible()
  await movement.getByRole('button', { name: 'Reanudar voz', exact: true }).click()
  await movement.locator('summary').first().click()
  await expect.poll(() =>
    page.evaluate(() => (window as unknown as { __voiceEvents: string[] }).__voiceEvents),
  ).toContain('cancel')

  await page.clock.install()
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 1000))
  const rest = movement.getByRole('button', { name: 'Iniciar descanso', exact: true })
  if (testInfo.project.use.hasTouch) await rest.tap()
  else await rest.click()
  await page.clock.fastForward(35_000)
  await expect(movement.getByRole('timer')).toHaveText('0:25')
  await movement.getByRole('button', { name: 'Pausar descanso', exact: true }).click()
  await page.clock.fastForward(10_000)
  await expect(movement.getByRole('timer')).toHaveText('0:25')
  await movement.getByRole('button', { name: 'Reanudar descanso', exact: true }).click()
  await page.clock.fastForward(26_000)
  await expect(movement.getByRole('timer')).toHaveText('0:00')
  await expect(
    movement.getByText('Terminó el descanso. Continuá cuando estés listo.', { exact: true }),
  ).toBeVisible()
  for (const checkbox of await page.getByRole('checkbox', { name: 'Hecha', exact: true }).all())
    await expect(checkbox).not.toBeChecked()
  expect(saves).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Guardar parcial', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'Marcá al menos una serie realizada antes de guardar.',
  )
  await expect(page.getByRole('alert').locator('..')).toBeFocused()
  expect(saves).toBe(0)
})

test('timed prescriptions recover real duration and effort and save an immutable completed session', async ({
  page,
}) => {
  await login(page, 'admin')
  const me = (await (await page.request.get('/api/b2b/me')).json()) as Me
  const headers = { Origin: new URL(page.url()).origin, 'X-Klisteni-B2B-Account': me.user.id }
  const members = (await (
    await page.request.get('/api/b2b/orgs/atlas-demo/members', { headers })
  ).json()) as { members: Array<{ userId: string; email: string }> }
  const memberId = members.members.find(
    (member) => member.email === 'member@atlas.example.test',
  )!.userId
  const name = `Trabajo por tiempo ${Date.now()}`
  const step = {
    id: 'timed-step',
    exerciseId: 'squat',
    sets: 2,
    reps: null,
    durationSeconds: 45,
    targetRpe: 7,
    loadKg: null,
    restSeconds: 30,
    alternatives: [],
    notes: 'Seguí la duración indicada por tu entrenador.',
  }
  const created = await page.request.post('/api/b2b/orgs/atlas-demo/programs', {
    headers,
    data: { name, description: 'Registro de duración y esfuerzo real.', steps: [step] },
  })
  expect(created.ok()).toBeTruthy()
  const { program } = (await created.json()) as { program: Program }
  const published = await page.request.post(
    `/api/b2b/orgs/atlas-demo/programs/${program.id}/publish`,
    { headers, data: { expectedRevision: program.revision } },
  )
  expect(published.ok()).toBeTruthy()
  const assigned = await page.request.post('/api/b2b/orgs/atlas-demo/assignments', {
    headers,
    data: { memberId, programId: program.id, version: 1 },
  })
  expect(assigned.ok()).toBeTruthy()
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await login(page, 'member')
  await routine(page, name).getByRole('button', { name: 'Empezar sesión', exact: true }).click()
  await expect(page.getByLabel('Duración segundos · 1/1', { exact: true })).toHaveValue('45')
  await expect(page.getByLabel('Esfuerzo percibido · 1/1', { exact: true })).toHaveValue('')
  await page.getByLabel('Duración segundos · 1/1', { exact: true }).fill('38')
  await page.getByLabel('Esfuerzo percibido · 1/1', { exact: true }).selectOption('7.5')
  await page.getByRole('checkbox', { name: 'Hecha', exact: true }).first().check()
  await page.reload()
  await routine(page, name).getByRole('button', { name: 'Empezar sesión', exact: true }).click()
  await expect(
    page.getByText('Recuperamos el borrador de tu sesión. Podés continuar donde la dejaste.', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.getByLabel('Duración segundos · 1/1', { exact: true })).toHaveValue('38')
  await expect(page.getByLabel('Esfuerzo percibido · 1/1', { exact: true })).toHaveValue('7.5')
  await expect(
    page.getByLabel('Esfuerzo percibido · 1/1', { exact: true }).locator('option:checked'),
  ).toHaveText('7.5 / 10')
  await expect(page.getByRole('checkbox', { name: 'Hecha', exact: true }).first()).toBeChecked()
  await page.getByRole('checkbox', { name: 'Hecha', exact: true }).nth(1).check()
  await page.getByRole('button', { name: 'Completar sesión', exact: true }).click()
  await expect(page.getByText('Tu sesión quedó guardada.', { exact: true })).toBeVisible()
  const history = routine(page, name)
  await history.getByText('Ver lo que hiciste', { exact: true }).click()
  await expect(history).toContainText('38 s · RPE 7.5/10')
  await expect(history).toContainText('45 s · RPE 7/10')
  const identity = (await (await page.request.get('/api/b2b/me')).json()) as Me
  const { executions } = (await (
    await page.request.get('/api/b2b/orgs/atlas-demo/executions', {
      headers: { 'X-Klisteni-B2B-Account': identity.user.id },
    })
  ).json()) as { executions: Execution[] }
  const execution = executions.find((item) => item.program.programId === program.id)!
  expect(execution.sets[0]).toMatchObject({ reps: null, durationSeconds: 38, rpe: 7.5 })
  expect(execution.program.steps[0]).toMatchObject({
    reps: null,
    durationSeconds: 45,
    targetRpe: 7,
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('empty movement search has a recoverable state and written instructions survive unavailable speech', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'speechSynthesis')
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true })
    Reflect.deleteProperty(window, 'SpeechSynthesisUtterance')
  })
  await login(page, 'member')
  await page.getByRole('button', { name: 'Movimientos', exact: true }).click()
  await page.getByLabel('Buscar movimiento', { exact: true }).fill('ningún-movimiento-xyz')
  await expect(
    page.getByRole('heading', { name: 'No encontramos ese movimiento', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Limpiar búsqueda', exact: true }).click()
  await expect(page.getByLabel('Buscar movimiento', { exact: true })).toHaveValue('')
  const movement = page.locator('.member-catalog-card').first()
  await movement.locator('summary').click()
  await expect(movement.locator('ol li').first()).toBeVisible()
  await expect(
    movement.getByText(
      'La lectura en voz no está disponible en este navegador. Seguí las instrucciones escritas.',
      { exact: true },
    ),
  ).toBeVisible()
})
