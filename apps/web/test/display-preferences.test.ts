import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { DISPLAY_KEY, applyTheme, loadDisplayPreferences, resolvedTheme, saveDisplayPreferences } from '../src/i18n/preferences.ts'
import { accountPreferences, loadPreferences } from '../src/lib/store.persistence.ts'
import { createDefaultPersonalData } from '@klisteniapp/scene-schema'

const values = new Map<string, string>()
beforeEach(() => {
  values.clear()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  } })
})

test('old preferences keep Spanish and system defaults while retaining reduced motion', () => {
  values.set('klisteniapp.preferences.v1', JSON.stringify({ weeklyGoal: 3, sets: 1, exerciseIds: ['squat'], reducedMotion: true }))
  assert.deepEqual(loadDisplayPreferences(), { language: 'es', theme: 'system', colorTheme: 'sage', reducedMotion: true })
  assert.equal(loadPreferences().weeklyGoal, 3)
  assert.equal(saveDisplayPreferences({ language: 'fr', theme: 'dark' }), true)
  assert.deepEqual(loadDisplayPreferences(), { language: 'fr', theme: 'dark', colorTheme: 'sage', reducedMotion: true })
  assert.equal(loadPreferences().language, 'fr')
})

test('invalid or unreadable display preferences safely fall back without discarding legacy values', () => {
  values.set('klisteniapp.preferences.v1', JSON.stringify({ language: 'en', theme: 'light', colorTheme: 'ocean' }))
  values.set(DISPLAY_KEY, JSON.stringify({ language: 'invalid', theme: 'invalid', colorTheme: 'invalid' }))
  assert.equal(loadDisplayPreferences().language, 'en')
  assert.equal(loadDisplayPreferences().theme, 'light')
  assert.equal(loadDisplayPreferences().colorTheme, 'ocean')
  values.set(DISPLAY_KEY, '{broken')
  assert.equal(loadDisplayPreferences().language, 'en')
  assert.equal(loadDisplayPreferences().colorTheme, 'ocean')
  values.set('klisteniapp.preferences.v1', JSON.stringify({ colorTheme: ['sage'] }))
  assert.equal(loadDisplayPreferences().colorTheme, 'sage')
})

test('account appearance follows explicit server values and older accounts keep browser choices', () => {
  saveDisplayPreferences({ language: 'fr', theme: 'dark', colorTheme: 'lavender' })
  const settings = createDefaultPersonalData('Test').settings
  assert.equal(accountPreferences(settings).language, 'fr')
  assert.equal(accountPreferences(settings).theme, 'dark')
  assert.equal(accountPreferences(settings).colorTheme, 'lavender')
  settings.profile.language = 'en'
  settings.profile.theme = 'light'
  settings.profile.colorTheme = 'rose'
  assert.equal(accountPreferences(settings).language, 'en')
  assert.equal(accountPreferences(settings).theme, 'light')
  assert.equal(accountPreferences(settings).colorTheme, 'rose')
})

test('system appearance resolves OS changes while explicit light and dark stay fixed', () => {
  assert.equal(resolvedTheme('system', true), 'dark')
  assert.equal(resolvedTheme('system', false), 'light')
  assert.equal(resolvedTheme('light', true), 'light')
  assert.equal(resolvedTheme('dark', false), 'dark')
  const root = { dataset: {} as Record<string, string>, style: { colorScheme: '' } }
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: root } })
  Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => ({ matches: true }) })
  applyTheme('system', 'graphite')
  assert.equal(root.dataset.theme, 'dark')
  assert.equal(root.dataset.themePreference, 'system')
  assert.equal(root.dataset.colorTheme, 'graphite')
  assert.equal(root.style.colorScheme, 'dark')
  Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => ({ matches: false }) })
  applyTheme('system', 'graphite')
  assert.equal(root.dataset.theme, 'light')
  assert.equal(root.dataset.colorTheme, 'graphite')
  applyTheme('light', 'ocean')
  assert.equal(root.dataset.theme, 'light')
  assert.equal(root.dataset.colorTheme, 'ocean')
  applyTheme('dark')
  assert.equal(root.dataset.colorTheme, 'sage')
})
