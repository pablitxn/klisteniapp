import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppRoot from './AppRoot'
import i18n from './i18n'
import { applyTheme } from './i18n/preferences'
import { useAppStore, type Preferences } from './lib/store'
import './styles.css'
import './themes.css'

function applyAppearance(preferences: Preferences) {
  applyTheme(preferences.theme, preferences.colorTheme)
  const browserColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  const background = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
  if (browserColor && background) browserColor.content = background
}

function applyDisplay(preferences: Preferences) {
  document.documentElement.lang = preferences.language
  applyAppearance(preferences)
  if (i18n.language !== preferences.language) void i18n.changeLanguage(preferences.language)
}
// Restore browser preferences before rendering; account loading can later update them.
applyDisplay(useAppStore.getState().preferences)
useAppStore.subscribe((state, previous) => {
  if (state.preferences.language !== previous.preferences.language || state.preferences.theme !== previous.preferences.theme || state.preferences.colorTheme !== previous.preferences.colorTheme) applyDisplay(state.preferences)
})
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const preferences = useAppStore.getState().preferences
  applyAppearance(preferences)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
)
