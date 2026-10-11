import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Me, PublicSite, PublicUnit } from '../../../packages/b2b-contracts/src/index.ts'

const password = 'browser-tests-only-password-2026'
const longUnitLabel = 'Polea 02 · estación de tracción y fortalecimiento con ajuste de asiento independiente'

async function activate(control: Locator, touch: boolean) {
  if (touch) await control.tap()
  else await control.click()
}
async function signIn(page: Page, email: string) {
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
}

test('reference QR has two units of one model, private drafts and a readable long title on touch screens', async ({ page, hasTouch }) => {
  const site = await (await page.request.get('/api/b2b/public/atlas-demo')).json() as PublicSite
  const units = site.units.filter(unit => unit.machineId === 'base-cable-station-v1')
  expect(units.map(unit => unit.id).sort()).toEqual(['atlas-demo-cable-01', 'atlas-demo-cable-02'])
  const unit = await (await page.request.get('/api/b2b/public/atlas-demo/units/atlas-demo-cable-02')).json() as PublicUnit
  expect(unit.exercises.find(exercise => exercise.id === 'atlas-demo-cable-row')?.animationId).toBeNull()
  expect(unit.exercises.some(exercise => exercise.id === 'atlas-demo-cable-row-draft')).toBe(false)
  await page.goto('/g/atlas-demo/units/atlas-demo-cable-02')
  await expect(page.getByRole('heading', { name: longUnitLabel, exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  await expect(page.locator('.hero')).toHaveScreenshot('public-unit-long-title.png')
  const exercise = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Remo en polea sentado', exact: true }) })
  // WebKit's emulation reports maxTouchPoints inconsistently on Linux. Check
  // the interaction delivered to the page rather than this capability hint.
  await page.evaluate(() => {
    const target = document.querySelector('main')!
    target.addEventListener('touchstart', () => target.setAttribute('data-touch-observed', 'true'), { once: true, passive: true })
  })
  await activate(exercise.locator('summary'), Boolean(hasTouch))
  if (hasTouch) await expect(page.locator('main')).toHaveAttribute('data-touch-observed', 'true')
  await expect(exercise.locator('ol li')).toHaveCount(3)
  await expect(exercise.locator('canvas')).toHaveCount(0)
  await activate(page.getByRole('link', { name: 'Ver este equipo en mi rutina →', exact: true }), Boolean(hasTouch))
  await expect(page).toHaveURL(/unit=atlas-demo-cable-02/)
  await signIn(page, 'member@atlas.example.test')
  await expect(page.getByText(/Estás consultando el equipo que abriste desde su ficha/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('member can sign in, navigate and save a partial session using the keyboard with reduced motion', async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Ingresá a tu espacio', exact: true })).toBeVisible()
  await expect(page.locator('.access-card')).toHaveScreenshot('member-sign-in.png')
  // Begin at a labelled control, then exercise the native tab order and keys.
  await page.getByLabel('Email', { exact: true }).focus()
  await page.keyboard.type('member@atlas.example.test')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Contraseña', { exact: true })).toBeFocused()
  await page.keyboard.type(password)
  await page.keyboard.press('Tab')
  const signInButton = page.getByRole('button', { name: 'Iniciar sesión', exact: true })
  await expect(signInButton).toBeFocused()
  expect(await signInButton.evaluate(button => getComputedStyle(button).outlineStyle)).not.toBe('none')
  await page.keyboard.press('Enter')
  const routine = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Inicio · fuerza y técnica', exact: true }) })
  await routine.getByRole('button', { name: 'Empezar sesión', exact: true }).focus()
  await page.keyboard.press('Enter')
  const checkbox = page.getByRole('checkbox', { name: 'Hecha', exact: true }).first()
  await checkbox.focus()
  await page.keyboard.press('Space')
  await expect(checkbox).toBeChecked()
  await page.getByRole('button', { name: 'Guardar parcial', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Tu sesión quedó guardada.', { exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Hecha', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('reference coach without assigned members cannot inspect another coach student', async ({ page }) => {
  await page.goto('/app')
  await signIn(page, 'member@atlas.example.test')
  const member = await (await page.request.get('/api/b2b/me')).json() as Me
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await page.goto('/backoffice/')
  await signIn(page, 'unassigned-coach@atlas.example.test')
  const coach = await (await page.request.get('/api/b2b/me')).json() as Me
  const headers = { 'X-Klisteni-B2B-Account': coach.user.id }
  expect((await page.request.get(`/api/b2b/orgs/atlas-demo/executions?memberId=${member.user.id}`, { headers })).status()).toBe(403)
  expect((await page.request.get('/api/b2b/orgs/sur-demo/reports', { headers })).status()).toBe(403)
  const assignments = await page.request.get('/api/b2b/orgs/atlas-demo/assignments', { headers })
  expect(assignments.ok()).toBe(true)
  expect((await assignments.json()).assignments).toEqual([])
})
