import { create } from 'zustand'
import { CardioLogSchema, WorkoutLogSchema, HealthDataSchema, PersonalDataSchema, PersonalSettingsSchema, ProgressDataSchema, preserveOptionalPersonalSettings, type PersonalData, type ProgressData } from '@klisteniapp/scene-schema'
import type { AppStore } from './store.ts'
import { STORAGE_KEY, RECOVERY_KEY, PREF_KEY, LOCAL_PERSONAL_KEY, initial, loadPreferences, loadLocalPersonal, localSummary, accountPreferences } from './store.persistence.ts'
import { parseProgress, serializeProgress } from './progress.ts'
import { saveDisplayPreferences } from '../i18n/preferences.ts'

export { STORAGE_KEY, LOCAL_PERSONAL_KEY } from './store.persistence.ts'
export type { Preferences } from './store.persistence.ts'

// This entry point has no transport dependency. Vite selects it for the demo.
export const useAppStore = create<AppStore>((set, get) => {
  function saveProgress(progress: ProgressData) {
    set({ progress })
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw && parseProgress(raw).error) {
        const older = localStorage.getItem(RECOVERY_KEY)
        if (older && older !== raw) localStorage.setItem(`${RECOVERY_KEY}.${Date.now()}`, older)
        localStorage.setItem(RECOVERY_KEY, raw)
        set({ recoveryRaw: raw })
      }
      localStorage.setItem(STORAGE_KEY, serializeProgress(progress))
      set({ storageError: null, localDataAvailable: localSummary() })
      return null
    } catch {
      const error = 'No pudimos guardar los cambios en este navegador. Exportá tus datos antes de cerrar.'
      set({ storageError: error })
      return error
    }
  }
  function snapshot(data: PersonalData): PersonalData {
    const preferences = get().preferences
    return { ...data, progress: get().progress, settings: { ...data.settings, routines: data.settings.routines.map(routine => routine.id === data.settings.activeRoutineId ? { ...routine, sets: preferences.sets, exerciseIds: preferences.exerciseIds as typeof routine.exerciseIds } : routine) } }
  }
  function savePersonal(data: PersonalData, expectedRevision: number) {
    if (get().localRevision !== expectedRevision) return 'Tus datos locales cambiaron. Revisá la versión actual antes de guardar.'
    if (!get().localPersonalData) return 'La copia local no se puede leer. Exportala antes de reemplazarla.'
    try {
      const parsed = PersonalDataSchema.parse(data)
      const encoded = JSON.stringify(parsed)
      localStorage.setItem(LOCAL_PERSONAL_KEY, encoded)
      if (localStorage.getItem(LOCAL_PERSONAL_KEY) !== encoded) throw new Error('Storage unavailable')
      set({ localPersonalData: parsed, localRevision: expectedRevision + 1, localDataAvailable: localSummary() })
      return null
    } catch { return 'No pudimos guardar tus datos personales en este navegador. El formulario conserva tus cambios.' }
  }
  return {
    ...initial(), preferences: loadPreferences(), localPersonalData: loadLocalPersonal(), localRevision: 0,
    authStatus: 'anonymous', user: null, access: null, accountLoading: false, accountError: null,
    personalData: null, revision: null, syncStatus: 'idle', pendingCount: 0, rejectedCount: 0, localDataAvailable: localSummary(),
    setAccess: () => {}, signIn: async () => null, signOut: async () => null, refreshSession: async () => null,
    refreshState: async () => null, retryPending: async () => null, importLocalData: async () => null,
    exportRejectedData: () => JSON.stringify({ format: 'klisteniapp-rejected-operations', version: 1, operations: [] }),
    addWorkout: async workout => {
      const parsed = WorkoutLogSchema.safeParse(workout)
      if (!parsed.success) return 'La sesión tiene datos inválidos.'
      return saveProgress({ ...get().progress, workouts: [...get().progress.workouts.filter(log => log.id !== parsed.data.id), parsed.data] })
    },
    addCardio: async cardio => {
      const parsed = CardioLogSchema.safeParse(cardio)
      if (!parsed.success) return 'La actividad tiene datos inválidos.'
      return saveProgress({ ...get().progress, cardio: [...get().progress.cardio.filter(log => log.id !== parsed.data.id), parsed.data] })
    },
    removeLog: async id => saveProgress({ ...get().progress, workouts: get().progress.workouts.filter(log => log.id !== id), cardio: get().progress.cardio.filter(log => log.id !== id) }),
    saveSettings: async settings => {
      const parsed = PersonalSettingsSchema.safeParse(settings)
      if (!parsed.success) return 'Revisá el perfil, la rutina y los días elegidos.'
      const data = get().localPersonalData
      if (!data) return 'La copia local no se puede leer. Exportala antes de reemplazarla.'
      return savePersonal({ ...data, progress: get().progress, settings: preserveOptionalPersonalSettings(data.settings, parsed.data) }, get().localRevision)
    },
    saveHealth: async (health, expectedRevision) => {
      const parsed = HealthDataSchema.safeParse(health)
      if (!parsed.success) return 'Revisá los valores, las unidades y las fechas de tus registros de salud.'
      const data = get().localPersonalData
      if (!data) return 'La copia local no se puede leer. Exportala antes de reemplazarla.'
      return savePersonal(snapshot({ ...data, settings: { ...data.settings, health: parsed.data } }), expectedRevision)
    },
    updatePreferences: async patch => {
      const preferences = { ...get().preferences, ...patch }
      try {
        localStorage.setItem(PREF_KEY, JSON.stringify(preferences))
        if (patch.language !== undefined || patch.theme !== undefined || patch.colorTheme !== undefined || patch.reducedMotion !== undefined) {
          if (!saveDisplayPreferences({ language: preferences.language, theme: preferences.theme, colorTheme: preferences.colorTheme, reducedMotion: preferences.reducedMotion })) throw new Error('Storage unavailable')
        }
        set({ preferences, storageError: null, localDataAvailable: localSummary() })
        if (patch.language !== undefined || patch.theme !== undefined || patch.colorTheme !== undefined) {
          const data = get().localPersonalData
          if (!data) return 'La copia local no se puede leer. Exportala antes de reemplazarla.'
          return savePersonal(snapshot({ ...data, settings: { ...data.settings, profile: { ...data.settings.profile,
            ...(patch.language === undefined ? {} : { language: patch.language }), ...(patch.theme === undefined ? {} : { theme: patch.theme }),
            ...(patch.colorTheme === undefined ? {} : { colorTheme: patch.colorTheme }),
          } } }), get().localRevision)
        }
        return null
      }
      catch { const error = 'No pudimos guardar tus preferencias en este navegador.'; set({ storageError: error }); return error }
    },
    importProgress: async raw => {
      let data: PersonalData | ProgressData
      try {
        const value: unknown = JSON.parse(raw)
        const personal = PersonalDataSchema.safeParse(value)
        data = personal.success ? personal.data : ProgressDataSchema.parse(value)
      } catch { return 'El archivo no contiene un historial válido de Klisteni.' }
      if (data.version === 2) {
        // An older backup has no palette field and cannot clear an existing choice.
        const previousColorTheme = get().localPersonalData?.settings.profile.colorTheme
        if (data.settings.profile.colorTheme === undefined && previousColorTheme !== undefined) data.settings.profile.colorTheme = previousColorTheme
        const failure = savePersonal(data, get().localRevision)
        if (failure) return failure
        const preferences = { ...accountPreferences(data.settings), reducedMotion: get().preferences.reducedMotion }
        try {
          localStorage.setItem(PREF_KEY, JSON.stringify(preferences))
          if ((data.settings.profile.language !== undefined || data.settings.profile.theme !== undefined || data.settings.profile.colorTheme !== undefined)
            && !saveDisplayPreferences({ language: preferences.language, theme: preferences.theme, colorTheme: preferences.colorTheme })) throw new Error('Storage unavailable')
        }
        catch { return 'Guardamos la copia personal pero no pudimos guardar sus preferencias. Exportá tus datos antes de cerrar.' }
        set({ preferences })
        return saveProgress(data.progress)
      }
      return saveProgress(data)
    },
    exportData: () => {
      const data = get().localPersonalData
      let hasPersonal = false
      try { hasPersonal = localStorage.getItem(LOCAL_PERSONAL_KEY) !== null } catch { /* Export in-memory data below. */ }
      if (hasPersonal && !data) return localStorage.getItem(LOCAL_PERSONAL_KEY) ?? ''
      return hasPersonal && data ? JSON.stringify(PersonalDataSchema.parse(snapshot(data))) : serializeProgress(get().progress)
    },
  }
})
