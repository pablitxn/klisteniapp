import { expect, test, type Page } from '@playwright/test'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

async function localOnly(page: Page) {
  const unexpected: string[] = []
  page.on('request', request => {
    const url = new URL(request.url())
    if (/^https?:/.test(url.protocol) && (url.origin !== new URL(test.info().project.use.baseURL!).origin || /^\/(api|umami)(\/|$)/.test(url.pathname))) unexpected.push(url.pathname)
  })
  await page.route('**/models/*.glb', route => route.abort())
  return unexpected
}
async function health(page: Page, section: string) {
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('button', { name: 'Mi salud', exact: true }).click()
  await page.getByRole('navigation', { name: 'Secciones de mi salud' }).getByRole('button', { name: section, exact: true }).click()
}

test('demo artifacts contain no account transports, payments, analytics tracker or instance profile', async () => {
  const assets = resolve(process.env.KLISTENI_DEMO_BUILD_OUTPUT ?? 'dist', 'assets')
  const scripts = (await readdir(assets)).filter(file => file.endsWith('.js'))
  expect(scripts.length).toBeGreaterThan(0)
  const code = (await Promise.all(scripts.map(file => readFile(resolve(assets, file), 'utf8')))).join('\n')
  expect(code).not.toMatch(/\/api\/(?:auth|admin|account|me|billing)\b|api\.mercadopago|unused\.example\.test|Entrar a Klisteni|Iniciar sesión|Guardar entre dispositivos con una cuenta|Guardar en mi cuenta|Nube pausada|Operador de la instancia de ejemplo/)
})

test('demo ignores account routes and analytics configuration; home and privacy make no private requests', async ({ page }) => {
  const requests = await localOnly(page)
  await page.goto('/?account=login&billing=return')
  await expect(page.getByRole('heading', { name: 'Tu cuerpo. Tu primer gimnasio.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toHaveCount(0)
  await expect(page.getByTestId('analytics-consent-banner')).toHaveCount(0)
  await expect(page.getByTestId('privacy-preferences')).toHaveCount(0)
  await expect(page.locator('.local-badge')).toHaveText('Guardado en este dispositivo')
  await page.getByTestId('privacy-policy').click()
  await expect(page).toHaveURL(/\/privacy$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu práctica, bajo tu control.')
  await page.goto('/account/join#token=ignored-in-public-demo')
  await expect(page.getByRole('heading', { name: 'Tu cuerpo. Tu primer gimnasio.' })).toBeVisible()
  await health(page, 'Resumen')
  await expect(page.getByRole('button', { name: 'Guardar entre dispositivos con una cuenta' })).toHaveCount(0)
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange')) })
  expect(requests).toEqual([])
})

test('demo health and goals persist locally and a complete export can be restored without cloud access', async ({ page }) => {
  const requests = await localOnly(page)
  await page.goto('/')
  await health(page, 'Cuerpo')
  await page.getByRole('button', { name: 'Agregar registro', exact: true }).click()
  await page.getByLabel('Peso (kg)', { exact: true }).fill('79.2')
  await page.getByRole('button', { name: 'Guardar en este dispositivo', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Guardado en este dispositivo.' })).toBeVisible()
  await health(page, 'Objetivos')
  await page.getByRole('button', { name: 'Crear objetivo', exact: true }).click()
  await page.getByLabel('Nombre del objetivo', { exact: false }).fill('Observar mi práctica local')
  await page.getByRole('combobox', { name: 'Qué quiero observar', exact: true }).selectOption('weeklyTrainingDays')
  await page.getByLabel('Mi objetivo (días)', { exact: false }).fill('3')
  await page.getByRole('button', { name: 'Guardar en este dispositivo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Observar mi práctica local', exact: true })).toBeVisible()
  await page.reload()
  await health(page, 'Objetivos')
  await expect(page.getByRole('heading', { name: 'Observar mi práctica local', exact: true })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar mis datos', exact: true }).click()
  const stream = await (await downloadPromise).createReadStream()
  if (!stream) throw new Error('Expected local data export')
  let exported = ''
  for await (const chunk of stream) exported += String(chunk)
  const copy = JSON.parse(exported)
  expect(copy.settings.health.measurements[0].weightKg).toBe(79.2)
  expect(copy.settings.health.goals[0].target).toBe(3)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Abrir ajustes', exact: true }).click()
  await page.getByRole('dialog').locator('input[type="file"]').setInputFiles({ name: 'local-copy.json', mimeType: 'application/json', buffer: Buffer.from(exported) })
  await page.getByRole('button', { name: 'Reemplazar historial', exact: true }).click()
  await expect(page.getByText('Copia importada. Tu progreso ya está disponible.')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await health(page, 'Objetivos')
  await expect(page.getByRole('heading', { name: 'Observar mi práctica local', exact: true })).toBeVisible()
  expect(requests).toEqual([])
})
