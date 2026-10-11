import { expect, type Page } from '@playwright/test'

export type SettingsSection = 'Cuenta y planificación' | 'Apariencia' | 'Privacidad' | 'Datos' | 'Configuración inicial'

export async function openSettings(page: Page, section: SettingsSection = 'Apariencia') {
  const dialog = page.getByRole('dialog', { name: 'Configuración', exact: true })
  if (!await dialog.isVisible()) await page.getByRole('button', { name: 'Abrir ajustes', exact: true }).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('navigation', { name: 'Secciones de configuración', exact: true }).getByRole('button', { name: section, exact: true }).click()
  return dialog
}

export async function openAccountSettings(page: Page) {
  return openSettings(page, 'Cuenta y planificación')
}
