import { expect, test, type Page } from '@playwright/test'

const palettes = [
  { id: 'sage', name: 'Salvia' },
  { id: 'ocean', name: 'Océano' },
  { id: 'sunset', name: 'Atardecer' },
  { id: 'lavender', name: 'Lavanda' },
  { id: 'rose', name: 'Rosa' },
  { id: 'graphite', name: 'Grafito' },
] as const

async function openSettings(page: Page) {
  await page.goto('/')
  return showAppearance(page)
}

async function showAppearance(page: Page) {
  await page.getByRole('button', { name: 'Abrir ajustes', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const sections = dialog.getByRole('navigation', { name: 'Secciones de configuración', exact: true })
  if (await sections.isVisible()) await sections.getByRole('button', { name: 'Apariencia', exact: true }).click()
  await expect(dialog.getByRole('group', { name: 'Paleta de colores', exact: true })).toBeVisible()
  return dialog
}

function paletteButton(page: Page, name: string) {
  return page.getByRole('group', { name: 'Paleta de colores', exact: true })
    .getByRole('button', { name: new RegExp(`^${name}(?:\\s|$)`) })
}

async function expectAppearance(page: Page, palette: string, mode: 'light' | 'dark', preference: 'light' | 'dark' | 'system' = mode) {
  const root = page.locator('html')
  await expect(root).toHaveAttribute('data-color-theme', palette)
  await expect(root).toHaveAttribute('data-theme', mode)
  await expect(root).toHaveAttribute('data-theme-preference', preference)
  const appearance = await root.evaluate(element => {
    const style = getComputedStyle(element)
    return { colorScheme: style.colorScheme, browserChromeColor: style.getPropertyValue('--background').trim() }
  })
  expect(appearance.colorScheme).toBe(mode)
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', appearance.browserChromeColor)
}

test.beforeEach(async ({ page }) => {
  // Appearance acceptance does not depend on the anatomy atlas or GPU speed.
  await page.route('**/models/*.glb', route => route.abort())
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
})

test('six selectable palettes each render distinct light and dark appearances', async ({ page }, testInfo) => {
  const dialog = await openSettings(page)
  const chooser = dialog.getByRole('group', { name: 'Paleta de colores', exact: true })
  await expect(chooser.getByRole('button')).toHaveCount(6)
  await expectAppearance(page, 'sage', 'light', 'system')
  const appearances = new Map<string, string>()

  for (const mode of ['light', 'dark'] as const) {
    await dialog.getByRole('combobox', { name: 'Modo', exact: true }).selectOption(mode)
    const signatures: string[] = []
    for (const palette of palettes) {
      const choice = paletteButton(page, palette.name)
      await choice.click()
      await expect(choice).toHaveAttribute('aria-pressed', 'true')
      await expect(chooser.locator('button[aria-pressed="true"]')).toHaveCount(1)
      await expectAppearance(page, palette.id, mode)
      // Observe actual foreground/surface colors, so a dataset-only change fails.
      const appearance = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement)
        const modal = getComputedStyle(document.querySelector('dialog')!)
        return JSON.stringify({ background: root.backgroundColor, foreground: root.color, surface: modal.backgroundColor })
      })
      signatures.push(appearance)
      if (mode === 'light') appearances.set(palette.id, appearance)
      else expect(appearance).not.toBe(appearances.get(palette.id))
      await dialog.evaluate(element => { element.scrollTop = 0 })
      await page.screenshot({ path: testInfo.outputPath(`${palette.id}-${mode}.png`) })
    }
    expect(new Set(signatures).size).toBe(6)
  }
})

test('palette and mode survive reload as independent preferences', async ({ page }) => {
  let dialog = await openSettings(page)
  await dialog.getByRole('combobox', { name: 'Modo', exact: true }).selectOption('dark')
  await paletteButton(page, 'Atardecer').click()
  await expectAppearance(page, 'sunset', 'dark')
  await page.reload()
  await expectAppearance(page, 'sunset', 'dark')
  dialog = await showAppearance(page)
  await expect(dialog.getByRole('combobox', { name: 'Modo', exact: true })).toHaveValue('dark')
  await expect(paletteButton(page, 'Atardecer')).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('combobox', { name: 'Modo', exact: true }).selectOption('light')
  await expectAppearance(page, 'sunset', 'light')
  await page.reload()
  await expectAppearance(page, 'sunset', 'light')
})

test('system mode responds to device changes while preserving the chosen palette', async ({ page }) => {
  const dialog = await openSettings(page)
  await paletteButton(page, 'Lavanda').click()
  await expect(dialog.getByRole('combobox', { name: 'Modo', exact: true })).toHaveValue('system')
  await expectAppearance(page, 'lavender', 'light', 'system')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expectAppearance(page, 'lavender', 'dark', 'system')
  await page.reload()
  await expectAppearance(page, 'lavender', 'dark', 'system')
  await page.emulateMedia({ colorScheme: 'light' })
  await expectAppearance(page, 'lavender', 'light', 'system')
  const reopened = await showAppearance(page)
  await reopened.getByRole('combobox', { name: 'Modo', exact: true }).selectOption('dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expectAppearance(page, 'lavender', 'dark')
  await paletteButton(page, 'Océano').click()
  await expectAppearance(page, 'ocean', 'dark')
})

test('palette choices support keyboard activation and fit a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  const dialog = await openSettings(page)
  const first = paletteButton(page, 'Salvia')
  await first.focus()
  await expect(first).toBeFocused()
  await page.keyboard.press('Tab')
  const ocean = paletteButton(page, 'Océano')
  await expect(ocean).toBeFocused()
  await page.keyboard.press('Enter')
  await expectAppearance(page, 'ocean', 'light', 'system')
  await page.keyboard.press('Tab')
  const sunset = paletteButton(page, 'Atardecer')
  await expect(sunset).toBeFocused()
  await page.keyboard.press('Space')
  await expect(sunset).toHaveAttribute('aria-pressed', 'true')
  await expectAppearance(page, 'sunset', 'light', 'system')
  await expect(sunset).toBeFocused()
  const focus = await sunset.evaluate(element => {
    const style = getComputedStyle(element)
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }
  })
  expect(focus.style).not.toBe('none')
  expect(focus.width).toBeGreaterThanOrEqual(2)

  for (const mode of ['light', 'dark'] as const) {
    await dialog.getByRole('combobox', { name: 'Modo', exact: true }).selectOption(mode)
    for (const palette of palettes) {
      const choice = paletteButton(page, palette.name)
      await choice.click()
      await expectAppearance(page, palette.id, mode)
      const bounds = await choice.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(321)
      expect(bounds!.width).toBeGreaterThanOrEqual(44)
      expect(bounds!.height).toBeGreaterThanOrEqual(44)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    }
  }
})
