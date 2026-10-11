import { ColorThemeSchema, type ColorTheme } from '@klisteniapp/scene-schema'
export type { ColorTheme } from '@klisteniapp/scene-schema'

export type LanguagePreference = 'es' | 'en' | 'fr'
export type ThemePreference = 'light' | 'dark' | 'system'
export interface DisplayPreferences {
  language: LanguagePreference
  theme: ThemePreference
  colorTheme: ColorTheme
  reducedMotion: boolean
}

export const DISPLAY_KEY = 'klisteniapp.display.v1'
const LEGACY_PREFERENCES_KEY = 'klisteniapp.preferences.v1'
export const displayDefaults: DisplayPreferences = { language: 'es', theme: 'system', colorTheme: 'sage', reducedMotion: false }
export function isLanguagePreference(value: unknown): value is LanguagePreference { return value === 'es' || value === 'en' || value === 'fr' }
export function isThemePreference(value: unknown): value is ThemePreference { return value === 'light' || value === 'dark' || value === 'system' }
export function isColorTheme(value: unknown): value is ColorTheme { return ColorThemeSchema.safeParse(value).success }

function readStored(key: string): Partial<DisplayPreferences> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    return value && typeof value === 'object' ? value as Partial<DisplayPreferences> : {}
  } catch { return {} }
}

/** Read before React mounts, including legacy preferences without display fields. */
export function loadDisplayPreferences(): DisplayPreferences {
  const legacy = readStored(LEGACY_PREFERENCES_KEY)
  const current = readStored(DISPLAY_KEY)
  const language = isLanguagePreference(current.language) ? current.language : legacy.language
  const theme = isThemePreference(current.theme) ? current.theme : legacy.theme
  const colorTheme = isColorTheme(current.colorTheme) ? current.colorTheme : legacy.colorTheme
  return {
    language: isLanguagePreference(language) ? language : displayDefaults.language,
    theme: isThemePreference(theme) ? theme : displayDefaults.theme,
    colorTheme: isColorTheme(colorTheme) ? colorTheme : displayDefaults.colorTheme,
    reducedMotion: typeof current.reducedMotion === 'boolean' ? current.reducedMotion : legacy.reducedMotion === true,
  }
}

export function saveDisplayPreferences(patch: Partial<DisplayPreferences>): boolean {
  try {
    const value = JSON.stringify({ ...loadDisplayPreferences(), ...patch })
    localStorage.setItem(DISPLAY_KEY, value)
    return localStorage.getItem(DISPLAY_KEY) === value
  } catch { return false }
}

export function resolvedTheme(theme: ThemePreference, systemDark: boolean): 'light' | 'dark' {
  return theme === 'system' ? systemDark ? 'dark' : 'light' : theme
}

export function applyTheme(theme: ThemePreference, colorTheme: ColorTheme = 'sage'): void {
  if (typeof document === 'undefined') return
  const dark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = resolvedTheme(theme, dark)
  document.documentElement.dataset.theme = resolved
  document.documentElement.dataset.themePreference = theme
  document.documentElement.dataset.colorTheme = colorTheme
  document.documentElement.style.colorScheme = resolved
}
