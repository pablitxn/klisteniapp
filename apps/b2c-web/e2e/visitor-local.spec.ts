import { expect, test, type Locator, type Page } from '@playwright/test'
import { openSettings } from './settings-helpers'
import { healthImport, personalKey, practice, progressKey, visitorData } from './fixtures/visitor-local'

const instance = process.env.VISITOR_INSTANCE === '1'
async function nav(page: Page, name: string) {
  const mobile = (page.viewportSize()?.width ?? 1440) < 768
  await page.getByRole('navigation', { name: mobile ? 'Navegación móvil' : 'Navegación principal', exact: true }).getByRole('button', { name, exact: true }).click()
}
async function health(page: Page, name: string) {
  await nav(page, 'Mi salud')
  await page.getByRole('navigation', { name: 'Secciones de mi salud', exact: true }).getByRole('button', { name, exact: true }).click()
}
async function seed(page: Page) {
  await page.addInitScript(({ data, personalKey, progressKey }) => {
    if (sessionStorage.getItem('visitor-fixture')) return
    localStorage.setItem(personalKey, JSON.stringify(data))
    localStorage.setItem(progressKey, JSON.stringify(data.progress))
    sessionStorage.setItem('visitor-fixture', '1')
  }, { data: visitorData(), personalKey, progressKey })
}
async function boot(page: Page) {
  await page.goto('/')
  await expect(page.locator('.local-badge')).toHaveText('Guardado en este dispositivo')
  await expect(page.getByRole('button', { name: 'Empezar mi rutina', exact: true })).toBeEnabled()
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
}
async function readPersonal(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), personalKey)
}
async function readProgress(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), progressKey)
}
async function upload(page: Page, selector: string, value: unknown) {
  await page.locator(selector).setInputFiles({ name: 'ficticio-qa.json', mimeType: 'application/json', buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) })
}
async function exported(page: Page) {
  await openSettings(page, 'Datos')
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar mis datos', exact: true }).click()
  const stream = await (await pending).createReadStream()
  if (!stream) throw new Error('Exportación sin contenido')
  let text = ''
  for await (const chunk of stream) text += String(chunk)
  return JSON.parse(text)
}
test.beforeEach(async ({ page }) => {
  // Data flows exercise the shipped fallback. Existing atlas acceptance exercises
  // the actual model separately; no assets or previews are changed.
  await page.route('**/models/*.glb', route => route.abort())
})

test('V01 empty routes, library filters, anatomy links and progress never invent history', async ({ page }, info) => {
  await boot(page)
  await expect(page.locator('.stats-bar')).toContainText('0 XP')
  for (const name of ['Ejercicios', 'Yoga', 'Mi cuerpo', 'Mi progreso', 'Mi salud', 'Mi rutina']) {
    await nav(page, name)
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath(`empty-${name.replaceAll(' ', '-')}.png`), fullPage: true })
  }
  await nav(page, 'Ejercicios')
  const search = page.getByRole('textbox', { name: 'Buscar ejercicio o músculo' })
  await search.fill('triceps')
  expect(await page.locator('.library-card').count()).toBeGreaterThan(0)
  await search.fill('zz-ficticio-sin-resultados')
  await expect(page.locator('.library-card')).toHaveCount(0)
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click()
  expect(await page.locator('.library-card').count()).toBeGreaterThan(6)
  await nav(page, 'Mi cuerpo')
  await page.getByRole('searchbox', { name: 'Buscar anatomía o yoga', exact: true }).fill('triceps')
  await expect(page.locator('.body-muscle')).toHaveCount(1)
  await page.locator('.body-muscle summary').click()
  await expect(page.locator('.body-muscle')).toContainText('Extienden')
  expect(await page.evaluate(key => localStorage.getItem(key), progressKey)).toBeNull()
})

test('V02 routine-only backup restores its order and sets in a separate browser context', async ({ page, browser }) => {
  await boot(page)
  await page.getByRole('button', { name: 'Personalizar', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Series por ejercicio').selectOption('1')
  await dialog.getByRole('button', { name: 'Subir Sentadilla', exact: true }).click()
  await dialog.getByRole('button', { name: 'Quitar W en el suelo', exact: true }).click()
  await dialog.getByRole('button', { name: 'Guardar mi rutina', exact: true }).click()
  const copy = await exported(page)
  expect(copy.version).toBe(2)
  const routine = copy.settings.routines.find((r: { id: string }) => r.id === copy.settings.activeRoutineId)
  expect(routine).toMatchObject({ sets: 1, exerciseIds: ['squat', 'pushup', 'glute-bridge', 'dead-bug', 'calf-raise'] })
  const other = await browser.newContext({ viewport: page.viewportSize()!, reducedMotion: 'reduce' })
  try {
    const fresh = await other.newPage()
    await fresh.route('**/models/*.glb', route => route.abort())
    await fresh.goto(new URL('/', page.url()).href)
    await expect(fresh.locator('.exercise-row')).toHaveCount(6)
    await openSettings(fresh, 'Datos')
    await upload(fresh, 'dialog input[type=file]', copy)
    await fresh.getByRole('button', { name: 'Reemplazar historial', exact: true }).click()
    await expect(fresh.getByText('Copia importada. Tu progreso ya está disponible.')).toBeVisible()
    await fresh.getByRole('button', { name: 'Cerrar', exact: true }).click()
    await fresh.reload()
    await expect(fresh.locator('.exercise-row')).toHaveCount(5)
    await expect(fresh.locator('.exercise-row').first()).toContainText('Sentadilla')
    await expect(fresh.locator('.routine-meta')).toContainText('1 serie por ejercicio')
    expect((await readProgress(fresh)).workouts).toHaveLength(0)
  } finally { await other.close() }
})

test('V03 cardio validates, cancels, double-submits once, persists and deletes with confirmation', async ({ page }) => {
  await boot(page)
  await page.getByRole('button', { name: 'Registrar actividad', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Duración (minutos)').fill('0')
  await dialog.getByRole('button', { name: 'Guardar actividad' }).click()
  expect(await page.evaluate(key => localStorage.getItem(key), progressKey)).toBeNull()
  await dialog.getByLabel('Duración (minutos)').fill('20')
  await dialog.getByLabel('¿Cuándo?').fill('2099-01-01')
  await dialog.getByRole('button', { name: 'Guardar actividad' }).click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Registrar actividad', exact: true }).click()
  await dialog.getByRole('button', { name: 'Bici', exact: true }).click()
  await dialog.getByLabel('Duración (minutos)').fill('25')
  await dialog.getByLabel(/Distancia \(km\)/).fill('4.5')
  await dialog.getByRole('button', { name: 'Guardar actividad' }).evaluate((node: HTMLButtonElement) => { node.click(); node.click() })
  await expect(dialog).not.toBeVisible()
  expect((await readProgress(page)).cardio).toHaveLength(1)
  await page.reload()
  await nav(page, 'Mi progreso')
  await expect(page.locator('.activity-history')).toContainText('25 min · 4,5 km')
  await page.getByRole('button', { name: /^Eliminar Bici del/ }).click()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  expect((await readProgress(page)).cardio).toHaveLength(1)
  await page.getByRole('button', { name: /^Eliminar Bici del/ }).click()
  await page.getByRole('button', { name: 'Sí, eliminar', exact: true }).click()
  expect((await readProgress(page)).cardio).toHaveLength(0)
})

test('V04 storage failure keeps cardio draft and retry persists one activity', async ({ page }) => {
  await boot(page)
  await page.getByRole('button', { name: 'Registrar actividad', exact: true }).click()
  await page.getByLabel('Duración (minutos)').fill('31')
  await page.evaluate(key => {
    const original = Storage.prototype.setItem
    ;(window as unknown as { restoreStorage: () => void }).restoreStorage = () => { Storage.prototype.setItem = original }
    Storage.prototype.setItem = function (name: string, value: string) { if (name === key) throw new DOMException('QA quota', 'QuotaExceededError'); original.call(this, name, value) }
  }, progressKey)
  await page.getByRole('button', { name: 'Guardar actividad' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('No pudimos guardar')
  await expect(page.getByLabel('Duración (minutos)')).toHaveValue('31')
  expect(await page.evaluate(key => localStorage.getItem(key), progressKey)).toBeNull()
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage())
  await page.getByRole('button', { name: 'Guardar actividad' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect((await readProgress(page)).cardio).toMatchObject([{ minutes: 31 }])
  await page.reload()
  await nav(page, 'Mi progreso')
  await expect(page.locator('.activity-history article')).toHaveCount(1)
})

test('V05 failed deletion keeps the saved activity visible and allows retry', async ({ page }) => {
  await boot(page)
  await page.getByRole('button', { name: 'Registrar actividad', exact: true }).click()
  await page.getByLabel('Duración (minutos)').fill('12')
  await page.getByRole('button', { name: 'Guardar actividad' }).click()
  await page.getByRole('button', { name: /^Eliminar Caminata del/ }).click()
  await page.evaluate(key => {
    const original = Storage.prototype.setItem
    ;(window as unknown as { restoreStorage: () => void }).restoreStorage = () => { Storage.prototype.setItem = original }
    Storage.prototype.setItem = function (name: string, value: string) { if (name === key) throw new DOMException('QA quota', 'QuotaExceededError'); original.call(this, name, value) }
  }, progressKey)
  await page.getByRole('button', { name: 'Sí, eliminar', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'No pudimos guardar' }).first()).toBeVisible()
  await expect(page.locator('.activity-history article')).toHaveCount(1)
  expect((await readProgress(page)).cardio).toHaveLength(1)
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage())
  await page.getByRole('button', { name: 'Sí, eliminar', exact: true }).click()
  await expect(page.locator('.activity-history article')).toHaveCount(0)
  expect((await readProgress(page)).cardio).toHaveLength(0)
})

test('V06 strength validates reps, protects active session, saves exact sets once and survives reload', async ({ page }) => {
  await boot(page)
  await page.getByRole('button', { name: 'Personalizar', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Series por ejercicio').selectOption('1')
  await dialog.getByRole('button', { name: 'Guardar mi rutina', exact: true }).click()
  await page.getByRole('button', { name: 'Empezar mi rutina', exact: true }).click()
  const session = page.getByRole('region', { name: 'Sesión en curso', exact: true })
  await expect(page.getByRole('button', { name: 'Personalizar', exact: true })).toBeDisabled()
  await session.getByLabel('Repeticiones', { exact: true }).fill('0')
  await expect(session.getByRole('button', { name: 'Registrar serie', exact: true })).toBeDisabled()
  for (let index = 0; index < 6; index++) {
    if (index) await session.getByRole('button', { name: 'Omitir descanso' }).click()
    await session.getByLabel('Repeticiones', { exact: true }).fill(String(index + 5))
    await session.getByRole('button', { name: 'Registrar serie' }).click()
  }
  await session.getByRole('button', { name: 'Guardar sesión', exact: true }).evaluate((node: HTMLButtonElement) => { node.click(); node.click() })
  await expect(session).not.toBeVisible()
  const saved = await readProgress(page)
  expect(saved.workouts).toHaveLength(1)
  expect(saved.workouts[0].exercises.map((entry: { reps: number }) => entry.reps)).toEqual([5, 6, 7, 8, 9, 10])
  await page.reload()
  await nav(page, 'Mi progreso')
  await expect(page.locator('.activity-history')).toContainText('6 ejercicios · 6 series')
})

test('V07 strength cancel and reload discard the unsaved session without awarding XP', async ({ page }) => {
  await boot(page)
  await page.getByRole('button', { name: 'Empezar mi rutina', exact: true }).click()
  const session = page.getByRole('region', { name: 'Sesión en curso', exact: true })
  await session.getByRole('button', { name: 'Registrar serie' }).click()
  await session.getByRole('button', { name: 'Salir de la sesión' }).click()
  await session.getByRole('button', { name: 'Seguir entrenando' }).click()
  await expect(session).toContainText('Serie 2 de 2')
  await session.getByRole('button', { name: 'Salir de la sesión' }).click()
  await session.getByRole('button', { name: 'Salir sin guardar' }).click()
  await expect(page.locator('.stats-bar')).toContainText('0 XP')
  await page.getByRole('button', { name: 'Empezar mi rutina', exact: true }).click()
  await session.getByRole('button', { name: 'Registrar serie' }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.reload()
  await expect(session).not.toBeVisible()
  expect(await page.evaluate(key => localStorage.getItem(key), progressKey)).toBeNull()
})

test('V08 health profile and every manual record persist, edit and delete without other data loss', async ({ page }, info) => {
  await seed(page); await boot(page)
  await health(page, 'Cuerpo')
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click()
  await page.getByLabel('Altura (cm)', { exact: true }).fill('179')
  await page.getByRole('button', { name: 'Guardar en este dispositivo', exact: true }).click()
  await page.getByRole('button', { name: 'Agregar registro', exact: true }).click()
  await page.getByLabel('Peso (kg)', { exact: true }).fill('79.2')
  await page.getByLabel('Cintura (cm)', { exact: true }).fill('94')
  await page.getByRole('button', { name: 'Guardar en este dispositivo', exact: true }).click()
  await page.getByRole('button', { name: /^Editar medición corporal/ }).click()
  await page.getByLabel('Cintura (cm)', { exact: true }).fill('93')
  await page.getByRole('button', { name: 'Guardar en este dispositivo', exact: true }).click()
  for (const record of [
    { section: 'Sueño y actividad', title: 'Tu descanso', field: 'Tiempo dormido (min)', value: '420', key: 'sleep', expected: { durationMinutes: 420 } },
    { section: 'Sueño y actividad', title: 'Movimiento y pulso', field: 'Frecuencia cardíaca media (lpm)', value: '132', key: 'activity', expected: { averageHeartRateBpm: 132 } },
    { section: 'Alimentación', title: 'Tus comidas', field: 'Comida o detalle', value: 'Comida ficticia QA', key: 'nutrition', expected: { meal: 'Comida ficticia QA' } },
    { section: 'Alimentación', title: 'Tus suplementos', field: 'Suplemento', value: 'Suplemento ficticio QA', key: 'supplements', expected: { name: 'Suplemento ficticio QA' } },
  ]) {
    await health(page, record.section)
    await page.locator('.health-card').filter({ has: page.getByRole('heading', { name: record.title, exact: true }) }).getByRole('button', { name: 'Agregar registro', exact: true }).click()
    await page.getByLabel(record.field, { exact: false }).fill(record.value)
    await page.getByRole('button', { name: 'Guardar en este dispositivo', exact: true }).click()
    expect((await readPersonal(page)).settings.health[record.key]).toMatchObject([record.expected])
  }
  await health(page, 'Objetivos')
  await page.getByRole('button', { name: 'Crear objetivo', exact: true }).click()
  await page.getByLabel('Nombre del objetivo', { exact: false }).fill('Objetivo ficticio QA')
  await page.getByRole('combobox', { name: 'Qué quiero observar', exact: true }).selectOption('weeklyTrainingDays')
  await page.getByLabel('Mi objetivo (días)', { exact: false }).fill('3')
  await page.getByRole('button', { name: 'Guardar en este dispositivo', exact: true }).click()
  const saved = await readPersonal(page)
  expect(saved.settings.health.profile.heightCm).toBe(179)
  expect(saved.settings.health.measurements).toMatchObject([{ weightKg: 79.2, waistCm: 93 }])
  expect(saved.settings.health.goals).toMatchObject([{ target: 3 }])
  expect(saved.settings.yoga.practices).toEqual([practice])
  await page.reload(); await health(page, 'Resumen')
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('health-records.png'), fullPage: true })
  await health(page, 'Cuerpo')
  await page.getByRole('button', { name: /^Eliminar medición corporal/ }).click()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.getByRole('button', { name: /^Eliminar medición corporal/ }).click()
  await page.getByRole('button', { name: 'Sí, eliminar', exact: true }).click()
  expect((await readPersonal(page)).settings.health.measurements).toHaveLength(0)
  expect((await readPersonal(page)).settings.health.sleep).toHaveLength(1)
})

test('V09 health validates empty, impossible and future input and preserves fields after quota failure', async ({ page }) => {
  await boot(page); await health(page, 'Cuerpo')
  await page.getByRole('button', { name: 'Agregar registro', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar en este dispositivo', exact: true }).click()
  await expect(page.locator('.health-error').first()).toBeVisible()
  await page.getByLabel('Peso (kg)', { exact: true }).fill('701')
  await page.getByRole('button', { name: 'Guardar en este dispositivo', exact: true }).click()
  expect(await page.evaluate(key => localStorage.getItem(key), personalKey)).toBeNull()
  await page.getByLabel('Peso (kg)', { exact: true }).fill('79')
  await page.evaluate(key => {
    const original = Storage.prototype.setItem
    ;(window as unknown as { restoreStorage: () => void }).restoreStorage = () => { Storage.prototype.setItem = original }
    Storage.prototype.setItem = function (name: string, value: string) { if (name === key) throw new DOMException('QA quota', 'QuotaExceededError'); original.call(this, name, value) }
  }, personalKey)
  await page.getByRole('button', { name: 'Guardar en este dispositivo', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'No pudimos guardar tus datos personales' })).toBeVisible()
  await expect(page.getByLabel('Peso (kg)', { exact: true })).toHaveValue('79')
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage())
  await page.getByRole('button', { name: 'Guardar en este dispositivo', exact: true }).click()
  expect((await readPersonal(page)).settings.health.measurements).toHaveLength(1)
  await health(page, 'Sueño y actividad')
  await page.locator('.health-card').filter({ has: page.getByRole('heading', { name: 'Tu descanso', exact: true }) }).getByRole('button', { name: 'Agregar registro', exact: true }).click()
  await page.getByLabel('Tiempo dormido (min)', { exact: false }).fill('100')
  await page.getByLabel('Sueño profundo (min)', { exact: true }).fill('101')
  await page.getByRole('button', { name: 'Guardar en este dispositivo', exact: true }).click()
  await expect(page.locator('.health-error').first()).toBeVisible()
  expect((await readPersonal(page)).settings.health.sleep).toHaveLength(0)
  await page.locator('.health-editor').getByRole('button', { name: 'Cancelar', exact: true }).first().click()
})

test('V10 health import previews, cancels, deduplicates, rejects corrupt/future/oversize files and exports empty template', async ({ page }) => {
  await seed(page); await boot(page); await health(page, 'Importar')
  const templateDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar plantilla JSON', exact: true }).click()
  const stream = await (await templateDownload).createReadStream()
  let template = ''; for await (const chunk of stream!) template += String(chunk)
  expect(JSON.parse(template).records.measurements).toEqual([])
  await upload(page, '.health-file input[type=file]', healthImport)
  await expect(page.locator('.health-import-counts')).toContainText('1 nuevos')
  expect((await readPersonal(page)).settings.health.measurements).toHaveLength(0)
  await page.getByRole('button', { name: 'Descartar', exact: true }).click()
  await upload(page, '.health-file input[type=file]', healthImport)
  await page.getByRole('button', { name: 'Confirmar importación', exact: true }).click()
  expect((await readPersonal(page)).settings.health.measurements).toHaveLength(1)
  await upload(page, '.health-file input[type=file]', healthImport)
  await expect(page.getByRole('button', { name: 'Confirmar importación', exact: true })).toBeDisabled()
  await upload(page, '.health-file input[type=file]', '{invalid')
  await expect(page.getByRole('alert')).toBeVisible()
  const future = structuredClone(healthImport)
  future.records.measurements[0].date = '2099-01-01'
  future.records.measurements[0].recordedAt = '2099-01-01T09:00:00Z'
  await upload(page, '.health-file input[type=file]', future)
  await expect(page.getByRole('alert')).toContainText('futura')
  await upload(page, '.health-file input[type=file]', ' '.repeat(2 * 1024 * 1024 + 1))
  await expect(page.getByRole('alert')).toContainText('supera 2 MiB')
  expect((await readPersonal(page)).settings.health.measurements).toHaveLength(1)
})

test('V11 personal and legacy import require confirmation, reject invalid copies and survive reload', async ({ page }) => {
  await seed(page); await boot(page)
  const before = await readPersonal(page)
  await openSettings(page, 'Datos')
  const legacy = { version: 1, workouts: [], cardio: [{ id: 'legacy-qa-walk', date: '2026-10-01', activity: 'walk', minutes: 15 }] }
  await upload(page, 'dialog input[type=file]', legacy)
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  expect((await readProgress(page)).cardio).toHaveLength(0)
  await upload(page, 'dialog input[type=file]', '{invalid')
  await page.getByRole('button', { name: 'Reemplazar historial', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('no contiene un historial válido')
  expect(await readPersonal(page)).toEqual(before)
  await upload(page, 'dialog input[type=file]', legacy)
  await page.getByRole('button', { name: 'Reemplazar historial', exact: true }).click()
  expect((await readProgress(page)).cardio).toEqual(legacy.cardio)
  expect((await readPersonal(page)).settings).toEqual(before.settings)
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  const copy = await exported(page)
  expect(copy.progress.cardio).toEqual(legacy.cardio)
  await upload(page, 'dialog input[type=file]', ' '.repeat(9 * 1024 * 1024 + 1))
  await expect(page.getByRole('dialog')).toContainText('demasiado grande')
  await page.reload()
  expect((await readProgress(page)).cardio).toEqual(legacy.cardio)
})

test('V12 yoga timer pauses, skips, saves one partial snapshot and preserves history when deleting practice', async ({ page }) => {
  await seed(page); await boot(page); await nav(page, 'Yoga')
  await page.clock.install()
  await page.getByRole('navigation', { name: 'Secciones de yoga' }).getByRole('button', { name: 'Mis prácticas', exact: true }).click()
  await page.getByRole('button', { name: `Comenzar ${practice.name}`, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Comenzar asana', exact: true }).click()
  await page.clock.runFor(2100)
  await dialog.getByRole('button', { name: 'Pausar', exact: true }).click()
  const paused = await dialog.getByRole('timer').textContent()
  await page.clock.runFor(10_000)
  await expect(dialog.getByRole('timer')).toHaveText(paused!)
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.clock.runFor(3100)
  await expect(dialog).toContainText('Tramo 2 de 3')
  await dialog.getByRole('button', { name: 'Saltar asana', exact: true }).click()
  await dialog.getByRole('button', { name: 'Comenzar asana', exact: true }).click()
  await page.clock.runFor(2100)
  await dialog.getByRole('button', { name: 'Terminar ahora', exact: true }).click()
  await dialog.getByRole('button', { name: 'Revisar y guardar', exact: true }).click()
  await dialog.getByLabel('¿Cómo te sentís? (opcional)', { exact: true }).fill('Nota ficticia QA')
  await dialog.getByRole('button', { name: 'Guardar registro', exact: true }).evaluate((node: HTMLButtonElement) => { node.click(); node.click() })
  await expect(dialog).not.toBeVisible()
  const yoga = (await readPersonal(page)).settings.yoga
  expect(yoga.logs).toHaveLength(1)
  expect(yoga.logs[0]).toMatchObject({ durationSeconds: 7, notes: 'Nota ficticia QA' })
  await page.getByRole('navigation', { name: 'Secciones de yoga' }).getByRole('button', { name: 'Mis prácticas', exact: true }).click()
  await page.getByRole('button', { name: `Eliminar ${practice.name}`, exact: true }).click()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.getByRole('button', { name: `Eliminar ${practice.name}`, exact: true }).click()
  await page.getByRole('button', { name: 'Sí, eliminar', exact: true }).click()
  expect((await readPersonal(page)).settings.yoga.practices).toHaveLength(0)
  expect((await readPersonal(page)).settings.yoga.logs).toHaveLength(1)
  await page.reload(); await nav(page, 'Mi progreso')
  await expect(page.locator('.activity-history')).toContainText(`Yoga · ${practice.name}`)
  await page.getByText('Ver práctica', { exact: true }).click()
  await expect(page.locator('.activity-history')).toContainText('Nota ficticia QA')
})

test('V13 privacy back/forward preserves setup draft and Escape restores keyboard focus', async ({ page }) => {
  await boot(page)
  const dialog = await openSettings(page, 'Configuración inicial')
  await dialog.getByRole('button', { name: 'Comenzar configuración', exact: true }).click()
  await dialog.getByLabel('Mi contexto', { exact: true }).fill('Borrador privado ficticio QA')
  await openSettings(page, 'Privacidad')
  await page.getByTestId('privacy-policy').click()
  await expect(page).toHaveURL(/\/privacy$/)
  await page.goBack()
  await expect(dialog).toBeVisible()
  await openSettings(page, 'Configuración inicial')
  await expect(dialog.getByLabel('Mi contexto', { exact: true })).toHaveValue('Borrador privado ficticio QA')
  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Tu práctica, bajo tu control.', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '← Volver a Klisteni', exact: true }).click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Abrir ajustes', exact: true })).toBeFocused()
  expect(await page.evaluate(key => localStorage.getItem(key), personalKey)).toBeNull()
})

test('V14 languages and appearance persist through reload with translated navigation and controls', async ({ page }, info) => {
  await boot(page)
  for (const item of [{ code: 'en', language: 'Language', mode: 'Mode', close: 'Close', title: 'Make room', library: 'Exercises' }, { code: 'fr', language: 'Langue', mode: 'Mode', close: 'Fermer', title: 'Faites', library: 'Exercices' }]) {
    await page.getByRole('button', { name: /Abrir ajustes|Open settings|Ouvrir les réglages/ }).click()
    await page.locator('dialog select').first().selectOption(item.code)
    await expect(page.getByRole('combobox', { name: item.language, exact: true })).toBeVisible()
    await page.getByRole('combobox', { name: item.mode, exact: true }).selectOption('dark')
    await page.getByRole('button', { name: item.close, exact: true }).click()
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', item.code)
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath(`language-${item.code}-dark.png`), fullPage: true })
  }
})

test('V15 anonymous instance remains local after API response loss and stale cookie; demo makes no API calls', async ({ page, context }) => {
  const writes: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method())) writes.push(new URL(request.url()).pathname) })
  await boot(page)
  const path = new URL(page.url())
  await context.addCookies([{ name: 'klisteniapp.session_token', value: 'ficticio-expirado-no-es-token-real', domain: path.hostname, path: '/', httpOnly: true, sameSite: 'Lax' }])
  await page.reload()
  await page.getByRole('button', { name: 'Registrar actividad', exact: true }).click()
  await page.getByLabel('Duración (minutos)').fill('17')
  await page.route('**/api/**', route => route.abort('failed'))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.getByRole('button', { name: 'Guardar actividad' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect((await readProgress(page)).cardio).toMatchObject([{ minutes: 17 }])
  await page.unroute('**/api/**')
  await page.reload(); await nav(page, 'Mi progreso')
  await expect(page.locator('.activity-history')).toContainText('17 min')
  expect(writes).toEqual([])
  if (!instance) await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toHaveCount(0)
})

test('V16 yoga background pause excludes hidden time and a full practice retries quota failure without duplication', async ({ page }) => {
  await seed(page); await boot(page); await nav(page, 'Yoga')
  await page.clock.install()
  await page.getByRole('navigation', { name: 'Secciones de yoga' }).getByRole('button', { name: 'Mis prácticas', exact: true }).click()
  await page.getByRole('button', { name: `Comenzar ${practice.name}`, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Comenzar asana', exact: true }).click()
  await page.clock.runFor(1100)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  await expect(dialog.getByRole('status')).toContainText('Pausamos el reloj')
  const paused = await dialog.getByRole('timer').textContent()
  await page.clock.runFor(60_000)
  await expect(dialog.getByRole('timer')).toHaveText(paused!)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')) })
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.clock.runFor(4100)
  for (let index = 0; index < 2; index++) {
    await dialog.getByRole('button', { name: 'Comenzar asana', exact: true }).click()
    await page.clock.runFor(5100)
  }
  await expect(dialog).toContainText('Práctica completa')
  await dialog.getByRole('textbox', { name: '¿Cómo te sentís? (opcional)', exact: true }).fill('Guardado ficticio con reintento')
  await page.evaluate(key => {
    const original = Storage.prototype.setItem
    ;(window as unknown as { restoreStorage: () => void }).restoreStorage = () => { Storage.prototype.setItem = original }
    Storage.prototype.setItem = function (name: string, value: string) { if (name === key) throw new DOMException('QA quota', 'QuotaExceededError'); original.call(this, name, value) }
  }, personalKey)
  await dialog.getByRole('button', { name: 'Guardar registro', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: '¿Cómo te sentís? (opcional)', exact: true })).toHaveValue('Guardado ficticio con reintento')
  expect((await readPersonal(page)).settings.yoga.logs).toHaveLength(0)
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage())
  await dialog.getByRole('button', { name: 'Guardar registro', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect((await readPersonal(page)).settings.yoga.logs).toMatchObject([{ durationSeconds: 15, notes: 'Guardado ficticio con reintento' }])
  await page.reload(); await nav(page, 'Yoga')
  await page.getByRole('navigation', { name: 'Secciones de yoga' }).getByRole('button', { name: 'Historial', exact: true }).click()
  await expect(page.locator('.yoga-history-card')).toHaveCount(1)
})

test('V17 corrupt personal copy remains exportable, blocks edits and accepts an explicit replacement', async ({ page }) => {
  await page.addInitScript(key => {
    if (sessionStorage.getItem('corrupt-qa')) return
    localStorage.setItem(key, '{personal-original-ficticio-corrupto')
    sessionStorage.setItem('corrupt-qa', '1')
  }, personalKey)
  await boot(page); await nav(page, 'Mi salud')
  await expect(page.getByRole('button', { name: 'Agregar registro', exact: true })).toHaveCount(0)
  await openSettings(page, 'Datos')
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar mis datos', exact: true }).click()
  const stream = await (await pending).createReadStream()
  let raw = ''; for await (const chunk of stream!) raw += String(chunk)
  expect(raw).toBe('{personal-original-ficticio-corrupto')
  await upload(page, 'dialog input[type=file]', visitorData())
  await page.getByRole('button', { name: 'Reemplazar historial', exact: true }).click()
  await expect(page.getByText('Copia importada. Tu progreso ya está disponible.')).toBeVisible()
  await page.reload(); await health(page, 'Cuerpo')
  await expect(page.getByRole('button', { name: 'Agregar registro', exact: true })).toBeEnabled()
  expect((await readPersonal(page)).settings.health.profile.heightCm).toBe(178)
  expect(await page.evaluate(() => localStorage.getItem('klisteniapp.progress.recovery'))).toBe(raw)
  await openSettings(page, 'Datos')
  const recoveryDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar original para recuperar', exact: true }).click()
  const recoveryStream = await (await recoveryDownload).createReadStream()
  let recovered = ''; for await (const chunk of recoveryStream!) recovered += String(chunk)
  expect(recovered).toBe(raw)
})

test('V18 real synthetic touch events navigate and save; native dialog traps keyboard focus', async ({ page }, info) => {
  const touch = Boolean(info.project.use.hasTouch)
  const activate = (control: Locator) => touch ? control.tap() : control.click()
  await boot(page)
  await page.evaluate(() => {
    const pointerTypes: string[] = []
    ;(window as unknown as { pointerTypes: string[] }).pointerTypes = pointerTypes
    document.addEventListener('pointerdown', event => pointerTypes.push(event.pointerType), true)
  })
  const navigation = page.getByRole('navigation', { name: touch ? 'Navegación móvil' : 'Navegación principal', exact: true })
  await activate(navigation.getByRole('button', { name: 'Mi progreso', exact: true }))
  await activate(page.getByRole('button', { name: 'Agregar actividad', exact: true }))
  const dialog = page.getByRole('dialog')
  await activate(dialog.getByRole('button', { name: 'Bici', exact: true }))
  await dialog.getByLabel('Duración (minutos)').fill('22')
  await activate(dialog.getByRole('button', { name: 'Guardar actividad', exact: true }))
  await expect(dialog).not.toBeVisible()
  expect((await readProgress(page)).cardio).toMatchObject([{ activity: 'bike', minutes: 22 }])
  expect(await page.evaluate(() => (window as unknown as { pointerTypes: string[] }).pointerTypes)).toContain(touch ? 'touch' : 'mouse')
  await activate(page.getByRole('button', { name: 'Abrir ajustes', exact: true }))
  await expect(dialog).toBeVisible()
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('touch-cardio-history.png'), fullPage: true })
})
