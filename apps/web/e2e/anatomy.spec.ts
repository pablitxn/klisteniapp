import { expect, test } from '@playwright/test'

// Headless software WebGL compiles three tissue materials and renders the full atlas.
test.setTimeout(process.env.CI ? 180_000 : 90_000)

test('registered atlas loads, layers switch, and enlarged view is keyboard accessible', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const viewer = page.getByRole('region', {
    name: 'Demostración 3D del ejercicio',
  })
  await expect(viewer.locator('.viewer-play')).toBeEnabled({ timeout: 30_000 })
  await viewer.getByRole('button', { name: 'Anatomía', exact: true }).click()
  await expect(viewer).toContainText('Posición anatómica')
  for (const name of ['Piel', 'Huesos', 'Músculos']) {
    const layer = viewer.getByRole('button', { name, exact: true })
    await layer.click()
    await expect(layer).toHaveAttribute('aria-pressed', 'true')
  }
  await viewer.getByRole('button', { name: 'Mostrar trabajo muscular' }).click()
  await expect(viewer).toContainText('Apoyo y estabilización')
  await page.getByRole('button', { name: 'Cuádriceps', exact: true }).click()
  await expect(viewer.locator('.anatomy-selection')).toContainText('Cuádriceps')
  await viewer.getByRole('button', { name: 'Ampliar visor' }).click()
  const dialog = page.getByRole('dialog', {
    name: 'Demostración 3D del ejercicio',
  })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'Cerrar vista ampliada' }),
  ).toBeFocused()
  await dialog.locator('.anatomy-provenance summary').focus()
  await page.keyboard.press('Tab')
  await expect(
    dialog.getByRole('button', { name: 'Cerrar vista ampliada' }),
  ).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.locator('.anatomy-provenance summary')).toBeFocused()
  await dialog
    .getByRole('button', { name: 'Quitar selección anatómica' })
    .click()
  await page.screenshot({ path: '/private/tmp/klisteni-anatomy-muscles.png' })
  await dialog.getByRole('button', { name: 'Piel', exact: true }).click()
  await page.screenshot({ path: '/private/tmp/klisteni-anatomy-skin.png' })
  await dialog.getByRole('button', { name: 'Espalda', exact: true }).click()
  await expect(
    dialog.getByRole('button', { name: 'Espalda', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Ampliar visor' }),
  ).toBeFocused()
  await viewer.locator('.anatomy-provenance summary').click()
  await expect(viewer).toContainText('no representa una medición de tu cuerpo')
  const notice = await page.request.get('/models/NOTICE.md')
  expect(notice.ok()).toBe(true)
  expect(await notice.text()).toContain('CC BY-SA 4.0')
  expect(errors).toEqual([])
})

test('mobile atlas fits narrow screens and all six demonstrations remain controllable', async ({
  page,
}) => {
  // Six full-atlas poses plus keyboard scrubbing take ~30s each on CI SwiftShader.
  test.setTimeout(process.env.CI ? 300_000 : 90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.viewer-play')).toBeEnabled({ timeout: 30_000 })
  for (const name of [
    'Flexiones',
    'Sentadilla',
    'Puente',
    'Dead bug',
    'W en el suelo',
    'Talones',
  ]) {
    await page.locator('.exercise-row').filter({ hasText: name }).click()
    const slider = page.getByRole('slider', {
      name: 'Posición de la demostración',
    })
    await slider.focus()
    await page.keyboard.press('End')
    await page.keyboard.press('Home')
    await expect(
      page.getByRole('button', { name: 'Reproducir demostración' }),
    ).toBeVisible()
    await page.keyboard.press('End')
    await expect(slider).toHaveValue('1')
    await expect(page.locator('.viewer-fallback')).toHaveCount(0)
  }
  await page.getByRole('button', { name: 'Ampliar visor' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.setViewportSize({ width: 320, height: 740 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(321)
  await page.getByRole('button', { name: 'Cerrar vista ampliada' }).click()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(321)
})
