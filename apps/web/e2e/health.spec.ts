import { expect, test, type Page } from '@playwright/test'
import { createDefaultPersonalData, type ServerState } from '@klisteniapp/scene-schema'

const account = { id: 'health-browser-test', email: 'health@example.test', name: 'Persona de prueba' }
async function mockAccount(page: Page, configure?: (state: ServerState) => void) {
  let state: ServerState = { data: createDefaultPersonalData(account.name, 'Europe/Paris'), revision: 0 }
  configure?.(state)
  const writes: unknown[] = []
  let reject = false
  await page.route('**/models/*.glb', route => route.abort())
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/get-session') return route.fulfill({ json: { user: account } })
    if (path === '/api/me/state') return route.fulfill({ json: state })
    if (path === '/api/me/health') {
      expect(route.request().method()).toBe('PUT')
      expect(route.request().headers()['x-klisteni-account']).toBe(account.id)
      const body = route.request().postDataJSON()
      writes.push(body)
      if (reject || body.expectedRevision !== state.revision) return route.fulfill({ status: 409, json: { code: 'REVISION_CONFLICT', error: 'Cambió en otro dispositivo' } })
      state = { data: { ...state.data, settings: { ...state.data.settings, health: body.health } }, revision: state.revision + 1 }
      return route.fulfill({ json: state })
    }
    return route.fulfill({ status: 404, json: { error: 'Not found' } })
  })
  await page.goto('/')
  await expect(page.locator('.local-badge')).toContainText('Sincronizado con tu cuenta')
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('button', { name: 'Mi salud', exact: true }).click()
  return { writes, getState: () => state, conflict: () => { reject = true; state = { data: { ...state.data, settings: { ...state.data.settings, health: { ...state.data.settings.health!, profile: { context: 'Contexto guardado desde otro dispositivo' } } } }, revision: state.revision + 1 } }, resume: () => { reject = false } }
}
async function section(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Secciones de mi salud' }).getByRole('button', { name, exact: true }).click()
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Guardar en mi cuenta', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Guardado en tu cuenta.' })).toBeVisible()
}

test('health starts empty, saves body profile and measures, and supports correction and deletion on mobile', async ({ page }, testInfo) => {
  const api = await mockAccount(page)
  await expect(page.getByText('Tu punto de partida empieza con un dato.')).toBeVisible()
  expect(api.writes).toHaveLength(0)
  await section(page, 'Cuerpo')
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click()
  await page.getByLabel('Altura (cm)', { exact: true }).fill('178')
  await save(page)
  expect(api.getState().data.settings.health?.profile.heightCm).toBe(178)
  await page.getByRole('button', { name: 'Agregar registro', exact: true }).click()
  await page.getByLabel('Peso (kg)', { exact: true }).fill('79.2')
  await page.getByLabel('Cintura (cm)', { exact: true }).fill('94')
  await page.getByLabel('Grasa corporal estimada (%)', { exact: true }).fill('27')
  await save(page)
  expect(api.getState().data.settings.health?.measurements).toHaveLength(1)
  await page.getByRole('button', { name: /^Editar medición corporal/ }).click()
  await page.getByLabel('Cintura (cm)', { exact: true }).fill('93')
  await save(page)
  expect(api.getState().data.settings.health?.measurements).toHaveLength(1)
  expect(api.getState().data.settings.health?.measurements[0]?.waistCm).toBe(93)
  await section(page, 'Resumen')
  await expect(page.locator('.health-trend-value')).toContainText('79,2 kg')
  await page.screenshot({ path: testInfo.outputPath('health-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('health-mobile.png'), fullPage: true })
  await section(page, 'Cuerpo')
  await page.getByRole('button', { name: /^Eliminar medición corporal/ }).click()
  expect(api.getState().data.settings.health?.measurements).toHaveLength(1)
  await page.getByRole('button', { name: 'Sí, eliminar', exact: true }).click()
  await expect.poll(() => api.getState().data.settings.health?.measurements.length).toBe(0)
})

test('health revision conflicts retain the filled draft and never fall back to local storage', async ({ page }) => {
  const api = await mockAccount(page)
  await section(page, 'Cuerpo')
  await page.getByRole('button', { name: 'Agregar registro', exact: true }).click()
  await page.getByLabel('Peso (kg)', { exact: true }).fill('80.5')
  api.conflict()
  await page.getByRole('button', { name: 'Guardar en mi cuenta', exact: true }).click()
  await expect(page.locator('.health-error')).toContainText('cambió')
  await expect(page.getByLabel('Peso (kg)', { exact: true })).toHaveValue('80.5')
  expect(api.getState().data.settings.health?.measurements).toHaveLength(0)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain('weightKg')
  api.resume()
  await page.getByRole('button', { name: 'Revisé la versión actual', exact: true }).click()
  await expect(page.getByLabel('Peso (kg)', { exact: true })).toHaveValue('80.5')
  await save(page)
  expect(api.getState().data.settings.health?.measurements[0]?.weightKg).toBe(80.5)
  expect(api.getState().data.settings.health?.profile.context).toBe('Contexto guardado desde otro dispositivo')
})

test('health file imports preview before sending, deduplicate repeated records and reject future dates', async ({ page }) => {
  const api = await mockAccount(page)
  await section(page, 'Importar')
  const file = {
    format: 'klisteniapp.health', version: 1, exportedAt: '2026-09-28T12:00:00Z', timeZone: 'Europe/Paris',
    records: { measurements: [{ id: 'watch-measurement-1', date: '2026-09-28', recordedAt: '2026-09-28T09:00:00Z', source: { kind: 'samsung-health', device: 'Galaxy Watch8', externalId: 'original-1' }, weightKg: 80, bodyFatPercent: 26 }], sleep: [], activity: [], nutrition: [], supplements: [] },
  }
  const upload = () => page.locator('.health-file input[type="file"]').setInputFiles({ name: 'health.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) })
  await upload()
  expect(api.writes).toHaveLength(0)
  await page.getByRole('button', { name: /Confirmar importación/ }).click()
  await expect.poll(() => api.getState().data.settings.health?.measurements.length).toBe(1)
  await expect(page.getByRole('status').filter({ hasText: 'Guardado en tu cuenta.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar importación', exact: true })).toHaveCount(0)
  await expect(page.locator('.health-file input[type="file"]')).toBeEnabled()
  await upload()
  await expect(page.locator('.health-import-counts')).toContainText('1')
  expect(api.writes).toHaveLength(1)
  file.records.measurements[0]!.date = '2099-01-01'
  file.records.measurements[0]!.recordedAt = '2099-01-01T09:00:00Z'
  await upload()
  await expect(page.getByRole('alert').filter({ hasText: /futura/ })).toBeVisible()
  expect(api.writes).toHaveLength(1)
})

test('sleep, exercise response, meals, supplements and dated goals are editable account records', async ({ page }) => {
  const api = await mockAccount(page)
  await section(page, 'Sueño y actividad')
  const sleep = page.locator('.health-card').filter({ has: page.getByRole('heading', { name: 'Tu descanso', exact: true }) })
  await sleep.getByRole('button', { name: 'Agregar registro', exact: true }).click()
  await page.getByLabel('Tiempo dormido (min)', { exact: false }).fill('420')
  await page.getByLabel('Sueño profundo (min)', { exact: true }).fill('85')
  await save(page)
  const activity = page.locator('.health-card').filter({ has: page.getByRole('heading', { name: 'Movimiento y pulso', exact: true }) })
  await activity.getByRole('button', { name: 'Agregar registro', exact: true }).click()
  await page.getByLabel('Frecuencia cardíaca media (lpm)', { exact: true }).fill('132')
  await page.getByLabel('Frecuencia cardíaca máxima (lpm)', { exact: true }).fill('160')
  await page.getByLabel('Actividad o ejercicio (opcional)', { exact: true }).fill('Rutina de fuerza')
  await save(page)
  await section(page, 'Alimentación')
  const meals = page.locator('.health-card').filter({ has: page.getByRole('heading', { name: 'Tus comidas', exact: true }) })
  await meals.getByRole('button', { name: 'Agregar registro', exact: true }).click()
  await page.getByLabel('Comida o detalle', { exact: true }).fill('Almuerzo registrado')
  await page.getByLabel('Energía registrada (kcal)', { exact: true }).fill('550')
  await page.getByLabel('Proteínas (g)', { exact: true }).fill('30')
  await save(page)
  const supplements = page.locator('.health-card').filter({ has: page.getByRole('heading', { name: 'Tus suplementos', exact: true }) })
  await supplements.getByRole('button', { name: 'Agregar registro', exact: true }).click()
  await page.getByLabel('Suplemento', { exact: false }).fill('Creatina')
  await page.getByLabel('Cantidad registrada', { exact: true }).fill('3')
  await page.getByLabel('Unidad de la cantidad', { exact: true }).fill('g')
  await save(page)
  await section(page, 'Objetivos')
  await page.getByRole('button', { name: 'Crear objetivo', exact: true }).click()
  await page.getByLabel('Nombre del objetivo', { exact: false }).fill('Observar mi descanso')
  await page.getByRole('combobox', { name: 'Qué quiero observar', exact: true }).selectOption('sleepMinutes')
  await page.getByLabel('Mi objetivo (min)', { exact: false }).fill('480')
  await save(page)
  await expect(page.getByRole('heading', { name: 'Observar mi descanso', exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Avance de Observar mi descanso' })).toHaveAttribute('aria-valuenow', '0')
  const health = api.getState().data.settings.health!
  expect(health.sleep[0]?.durationMinutes).toBe(420)
  expect(health.activity[0]).toMatchObject({ averageHeartRateBpm: 132, maxHeartRateBpm: 160, activityLabel: 'Rutina de fuerza' })
  expect(health.nutrition[0]).toMatchObject({ meal: 'Almuerzo registrado', energyKcal: 550, proteinG: 30 })
  expect(health.supplements[0]).toMatchObject({ name: 'Creatina', dose: 3, unit: 'g', taken: true })
  expect(health.goals[0]).toMatchObject({ title: 'Observar mi descanso', target: 480, metric: 'sleepMinutes' })
})

test('overlapping sleep never completes a goal and corrections retain source identity and exact original times', async ({ page }) => {
  const api = await mockAccount(page, state => {
    const health = state.data.settings.health!
    const night = { date: '2026-10-02', recordedAt: '2026-10-02T08:00:00Z', durationMinutes: 420, startAt: '2026-10-01T22:00:15.123Z', endAt: '2026-10-02T06:00:15.123Z', timeZone: 'Europe/Paris' }
    health.sleep = [
      { id: 'baseline', date: '2026-10-01', recordedAt: '2026-10-01T08:00:00Z', durationMinutes: 360, source: { kind: 'manual' } },
      { ...night, id: 'samsung-night', source: { kind: 'samsung-health', externalId: 'night-original' } },
      { ...night, id: 'health-connect-night', source: { kind: 'health-connect', externalId: 'night-copy' } },
    ]
    health.goals = [{ id: 'sleep-goal', title: 'Mi descanso', metric: 'sleepMinutes', target: 480, startDate: '2026-10-01' }]
  })
  await section(page, 'Objetivos')
  await expect(page.locator('.health-goal')).toContainText('Revisar registros')
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await section(page, 'Sueño y actividad')
  const imported = page.locator('.health-row').filter({ hasText: 'Samsung Health' })
  await expect(imported).toContainText('Esta fecha necesita revisión')
  await imported.getByRole('button', { name: /^Editar registro de sueño/ }).click()
  await expect(page.getByRole('combobox', { name: 'Origen', exact: true })).toBeDisabled()
  await page.getByLabel('Notas (opcional)', { exact: true }).fill('Anotación manual sin cambiar los horarios')
  await save(page)
  const updated = api.getState().data.settings.health!.sleep.find(record => record.id === 'samsung-night')!
  expect(updated.startAt).toBe('2026-10-01T22:00:15.123Z')
  expect(updated.endAt).toBe('2026-10-02T06:00:15.123Z')
  expect(updated.source).toEqual({ kind: 'samsung-health', externalId: 'night-original' })
  expect(updated.modifiedAt).toBeTruthy()
})

test('personal dashboard filters periods and body sources without inventing sleep or meal coverage', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-10-04T12:00:00Z'))
  const api = await mockAccount(page, state => {
    const health = state.data.settings.health!
    const base = (id: string, date: string) => ({ id, date, recordedAt: `${date}T09:00:00Z`, source: { kind: 'manual' as const } })
    health.measurements = [
      { ...base('initial', '2026-09-15'), weightKg: 82, waistCm: 98 },
      { ...base('recent', '2026-10-01'), weightKg: 80, waistCm: 96 },
      { ...base('latest', '2026-10-03'), weightKg: 79, waistCm: 95 },
      { ...base('watch', '2026-10-03'), source: { kind: 'samsung-health', device: 'Galaxy Watch8' }, weightKg: 79.5, bodyFatPercent: 26 },
    ]
    health.sleep = [
      { ...base('sleep-valid', '2026-10-01'), durationMinutes: 420 },
      { ...base('sleep-ambiguous-1', '2026-10-02'), durationMinutes: 420 },
      { ...base('sleep-ambiguous-2', '2026-10-02'), durationMinutes: 420 },
    ]
    health.nutrition = [{ ...base('lunch', '2026-10-01'), meal: 'Almuerzo', energyKcal: 500 }, { ...base('snack', '2026-10-03'), meal: 'Merienda', proteinG: 20 }]
    health.goals = [{ id: 'waist-goal', title: 'Seguir mi cintura', metric: 'waistCm', target: 90, startDate: '2026-09-15' }]
    health.supplements = [{ ...base('creatine', '2026-10-03'), name: 'Creatina', taken: true }, { ...base('vitamins', '2026-10-03'), name: 'Multivitamínico', taken: false }]
    state.data.progress.workouts = ['2026-09-15', '2026-10-01', '2026-10-01', '2026-10-03'].map((date, index) => ({ id: `workout-${index}`, date, completedAt: `${date}T12:00:00Z`, durationMinutes: 20, exercises: [{ exerciseId: 'pushup', sets: 1, reps: 10 }] }))
  })
  const dashboard = page.getByRole('region', { name: 'Dashboard personal', exact: true })
  await expect(dashboard.getByRole('combobox', { name: 'Período del dashboard', exact: true })).toHaveValue('30')
  await expect(dashboard.locator('.health-trend-value')).toContainText('79 kg')
  await expect(dashboard.locator('.health-trend-change')).toContainText('-3 kg')
  await expect(dashboard.getByRole('img', { name: /^Peso por fecha/ })).toBeVisible()
  await expect(dashboard.locator('.health-metrics')).toContainText('3 / 30')
  await expect(dashboard.locator('.health-metrics')).toContainText('7 h 0 min')
  await expect(dashboard.getByRole('region', { name: 'Alimentación del período' })).toContainText('1 de 2 registros con este dato')
  await dashboard.getByText('Ver valores corporales', { exact: true }).click()
  const bodyTable = dashboard.getByRole('table', { name: 'Última medición diaria de la fuente seleccionada', exact: true })
  await expect(bodyTable).toContainText('2026-09-15')
  await dashboard.getByRole('combobox', { name: 'Período del dashboard', exact: true }).selectOption('7')
  await expect(bodyTable).not.toContainText('2026-09-15')
  await expect(dashboard.locator('.health-trend-change')).toContainText('-1 kg')
  await expect(dashboard.locator('.health-metrics')).toContainText('2 / 7')
  await expect(dashboard.getByRole('progressbar', { name: 'Avance de Seguir mi cintura' })).toHaveAttribute('aria-valuenow', '38')
  await dashboard.getByRole('combobox', { name: 'Fuente de las medidas', exact: true }).selectOption({ label: 'Samsung Health · Galaxy Watch8' })
  await expect(dashboard.locator('.health-trend-value')).toContainText('79,5 kg')
  await expect(dashboard.locator('.health-trend-change')).toContainText('Dos fechas con mediciones')
  await dashboard.getByRole('combobox', { name: 'Medida del gráfico', exact: true }).selectOption('bodyFatPercent')
  await expect(dashboard.locator('.health-trend-value')).toContainText('26 %')
  await expect(dashboard.getByText('Tu reloj todavía no está conectado', { exact: true })).toBeVisible()
  await dashboard.getByRole('combobox', { name: 'Fuente de las medidas', exact: true }).selectOption({ label: 'Manual' })
  await dashboard.getByRole('combobox', { name: 'Medida del gráfico', exact: true }).selectOption('weightKg')
  await dashboard.getByRole('combobox', { name: 'Período del dashboard', exact: true }).selectOption('30')
  await page.evaluate(() => scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('dashboard-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(dashboard.getByRole('combobox', { name: 'Período del dashboard', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('dashboard-mobile.png'), fullPage: true })
  await dashboard.getByRole('combobox', { name: 'Período del dashboard', exact: true }).selectOption('90')
  await expect(dashboard.locator('.health-metrics')).toContainText('3 / 90')
  expect(api.writes).toHaveLength(0)
})

test('free local health, goals and manual imports persist without an account or cloud writes', async ({ page }, testInfo) => {
  const privateRequests: string[] = []
  await page.route('**/models/*.glb', route => route.abort())
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path !== '/api/auth/get-session') privateRequests.push(path)
    return route.fulfill({ json: null })
  })
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('button', { name: 'Mi salud', exact: true }).click()
  await expect(page.getByText(/Modo local gratuito:/)).toBeVisible()
  await section(page, 'Cuerpo')
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click()
  await page.getByLabel('Altura (cm)', { exact: true }).fill('179')
  await page.getByRole('button', { name: 'Guardar en este dispositivo', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Guardado en este dispositivo.' })).toBeVisible()
  await section(page, 'Objetivos')
  await page.getByRole('button', { name: 'Crear objetivo', exact: true }).click()
  await page.getByLabel('Nombre del objetivo', { exact: false }).fill('Mi meta local')
  await page.getByLabel('Qué quiero observar', { exact: false }).selectOption('weeklyTrainingDays')
  await page.getByLabel(/Mi objetivo/).fill('3')
  await page.getByRole('button', { name: 'Guardar en este dispositivo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mi meta local', exact: true })).toBeVisible()
  await section(page, 'Importar')
  const file = {
    format: 'klisteniapp.health', version: 1, exportedAt: '2026-09-28T12:00:00Z', timeZone: 'Europe/Paris',
    records: { measurements: [{ id: 'local-import', date: '2026-09-28', recordedAt: '2026-09-28T09:00:00Z', source: { kind: 'samsung-health', device: 'Galaxy Watch8', externalId: 'local-origin' }, weightKg: 80 }], sleep: [], activity: [], nutrition: [], supplements: [] },
  }
  await page.locator('.health-file input[type="file"]').setInputFiles({ name: 'health.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) })
  await page.getByRole('button', { name: 'Confirmar importación', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Guardado en este dispositivo.' })).toBeVisible()
  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('klisteniapp.personal.v2')!))
  expect(local.settings.health.profile.heightCm).toBe(179)
  expect(local.settings.health.goals[0].title).toBe('Mi meta local')
  expect(local.settings.health.measurements).toHaveLength(1)
  await page.reload()
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('button', { name: 'Mi salud', exact: true }).click()
  await expect(page.locator('.health-trend-value')).toContainText('80 kg')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar mis datos', exact: true }).click()
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.json$/)
  expect(privateRequests).toEqual([])
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('free-local-health-mobile.png'), fullPage: true })
})
