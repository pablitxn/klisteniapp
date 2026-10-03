import { create } from 'zustand'
import { exercises, starterRoutine } from '../data/exercises'
import { emptyProgress, parseProgress, serializeProgress } from './progress'
import type {
  CardioLog,
  ProgressData,
  WorkoutLog,
} from '@klisteniapp/scene-schema'

export const STORAGE_KEY = 'klisteniapp.progress.v1'
const RECOVERY_KEY = 'klisteniapp.progress.recovery'
const PREF_KEY = 'klisteniapp.preferences.v1'
export interface Preferences {
  weeklyGoal: number
  sets: number
  exerciseIds: string[]
  reducedMotion: boolean
}
const defaults: Preferences = {
  weeklyGoal: 2,
  sets: 2,
  exerciseIds: [...starterRoutine.exerciseIds],
  reducedMotion: false,
}
function initial() {
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
function loadPreferences(): Preferences {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PREF_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return defaults
    const data = raw as Partial<Preferences>
    const ids = Array.isArray(data.exerciseIds)
      ? [
          ...new Set(
            data.exerciseIds.filter((id) =>
              exercises.some((e) => e.id === id && e.equipment === 'none'),
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
      reducedMotion: data.reducedMotion === true,
    }
  } catch {
    return defaults
  }
}
interface Store {
  progress: ProgressData
  preferences: Preferences
  storageError: string | null
  recoveryRaw: string | null
  addWorkout: (workout: WorkoutLog) => void
  addCardio: (cardio: CardioLog) => void
  removeLog: (id: string) => void
  updatePreferences: (patch: Partial<Preferences>) => void
  importProgress: (raw: string) => string | null
}
export const useAppStore = create<Store>((set, get) => {
  function save(progress: ProgressData) {
    set({ progress })
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw && parseProgress(raw).error) {
        const olderRecovery = localStorage.getItem(RECOVERY_KEY)
        if (olderRecovery && olderRecovery !== raw)
          localStorage.setItem(`${RECOVERY_KEY}.${Date.now()}`, olderRecovery)
        localStorage.setItem(RECOVERY_KEY, raw)
        set({ recoveryRaw: raw })
      }
      localStorage.setItem(STORAGE_KEY, serializeProgress(progress))
      set({ storageError: null })
      return null
    } catch {
      const error =
        'No pudimos guardar los cambios en este navegador. Exportá tus datos antes de cerrar.'
      set({ storageError: error })
      return error
    }
  }
  return {
    ...initial(),
    preferences: loadPreferences(),
    addWorkout: (workout) =>
      save({
        ...get().progress,
        workouts: [...get().progress.workouts, workout],
      }),
    addCardio: (cardio) =>
      save({ ...get().progress, cardio: [...get().progress.cardio, cardio] }),
    removeLog: (id) =>
      save({
        ...get().progress,
        workouts: get().progress.workouts.filter((l) => l.id !== id),
        cardio: get().progress.cardio.filter((l) => l.id !== id),
      }),
    updatePreferences: (patch) => {
      const preferences = { ...get().preferences, ...patch }
      set({ preferences })
      try {
        localStorage.setItem(PREF_KEY, JSON.stringify(preferences))
      } catch {
        set({
          storageError:
            'No pudimos guardar tus preferencias en este navegador.',
        })
      }
    },
    importProgress: (raw) => {
      const result = parseProgress(raw)
      if (result.error) return result.error
      return save(result.data)
    },
  }
})
