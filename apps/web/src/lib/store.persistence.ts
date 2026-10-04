import { PersonalDataSchema, createDefaultPersonalData, dateInTimeZone, type PersonalData, type PersonalSettings } from '@klisteniapp/scene-schema'
import { exercises, starterRoutine } from '../data/exercises.ts'
import { emptyProgress, parseProgress } from './progress.ts'
import { displayDefaults, loadDisplayPreferences, type ColorTheme, type LanguagePreference, type ThemePreference } from '../i18n/preferences.ts'

export const STORAGE_KEY = 'klisteniapp.progress.v1'
export const RECOVERY_KEY = 'klisteniapp.progress.recovery'
export const PREF_KEY = 'klisteniapp.preferences.v1'
export const LOCAL_PERSONAL_KEY = 'klisteniapp.personal.v2'
export function loadLocalPersonal(): PersonalData | null {
  try {
    const raw = localStorage.getItem(LOCAL_PERSONAL_KEY)
    if (raw) return PersonalDataSchema.parse(JSON.parse(raw))
  } catch { return null }
  return createDefaultPersonalData('Mi práctica', Intl.DateTimeFormat().resolvedOptions().timeZone)
}
export interface Preferences {
  weeklyGoal: number
  sets: number
  exerciseIds: string[]
  reducedMotion: boolean
  language: LanguagePreference
  theme: ThemePreference
  colorTheme: ColorTheme
}
export const defaults: Preferences = {
  weeklyGoal: 2,
  sets: 2,
  exerciseIds: [...starterRoutine.exerciseIds],
  ...displayDefaults,
}
export function initial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const result = parseProgress(raw)
    return {
      progress: result.data,
      storageError: result.error,
      recoveryRaw: result.error ? raw : localStorage.getItem(RECOVERY_KEY),
    }
  } catch {
    return {
      progress: emptyProgress(),
      storageError:
        'El navegador no permite guardar datos. Podés exportar una copia desde Ajustes.',
      recoveryRaw: null,
    }
  }
}
export function loadPreferences(): Preferences {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PREF_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return { ...defaults, ...loadDisplayPreferences() }
    const data = raw as Partial<Preferences>
    const ids = Array.isArray(data.exerciseIds)
      ? [
          ...new Set(
            data.exerciseIds.filter((id) =>
              exercises.some((e) => e.id === id),
            ),
          ),
        ]
      : defaults.exerciseIds
    return {
      weeklyGoal: [2, 3, 4].includes(data.weeklyGoal ?? 0)
        ? data.weeklyGoal!
        : 2,
      sets: [1, 2, 3].includes(data.sets ?? 0) ? data.sets! : 2,
      exerciseIds: ids.length ? ids : defaults.exerciseIds,
      ...loadDisplayPreferences(),
    }
  } catch {
    return { ...defaults, ...loadDisplayPreferences() }
  }
}
export { DISPLAY_KEY } from '../i18n/preferences.ts'
export function localSummary() {
  const data = initial().progress
  let hasPreferences = false
  try { hasPreferences = localStorage.getItem(PREF_KEY) !== null || localStorage.getItem(LOCAL_PERSONAL_KEY) !== null } catch { /* optional storage */ }
  return data.workouts.length || data.cardio.length || hasPreferences ? { workouts: data.workouts.length, cardio: data.cardio.length, hasPreferences } : null
}
export function accountPreferences(settings: PersonalSettings): Preferences {
  const routine = settings.routines.find((item) => item.id === settings.activeRoutineId)!
  const today = dateInTimeZone(new Date(), settings.profile.timeZone)
  const plan = [...settings.plans].filter((item) => item.effectiveFrom <= today).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]
  const display = loadDisplayPreferences()
  return { exerciseIds: routine.exerciseIds, sets: routine.sets, weeklyGoal: plan?.weekdays.length ?? 2, ...display,
    language: settings.profile.language ?? display.language, theme: settings.profile.theme ?? display.theme,
    colorTheme: settings.profile.colorTheme ?? display.colorTheme }
}
