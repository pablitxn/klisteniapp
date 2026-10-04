import { create } from 'zustand'
import { CardioLogSchema, WorkoutLogSchema, PersonalDataSchema, PersonalSettingsSchema, ProgressDataSchema, createDefaultPersonalData, dateInTimeZone, type PersonalData, type PersonalSettings, type ServerState } from '@klisteniapp/scene-schema'
import { AccountApiError, accountApi, type AccountUser } from './account-api.ts'
import { exercises, starterRoutine } from '../data/exercises.ts'
import { emptyProgress, parseProgress, serializeProgress } from './progress.ts'
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
const DISPLAY_KEY = 'klisteniapp.display.v1'
const PENDING_PREFIX = 'klisteniapp.pending.v1.'
const REJECTED_PREFIX = 'klisteniapp.rejected.v1.'
const CHANGED_ACCOUNT = 'La sesión cambió. Volvé a abrir tu cuenta antes de guardar.'
function localSummary() {
  const data = initial().progress
  let hasPreferences = false
  try { hasPreferences = localStorage.getItem(PREF_KEY) !== null } catch { /* optional storage */ }
  return data.workouts.length || data.cardio.length || hasPreferences ? { workouts: data.workouts.length, cardio: data.cardio.length, hasPreferences } : null
}
function accountPreferences(settings: PersonalSettings): Preferences {
  const routine = settings.routines.find((item) => item.id === settings.activeRoutineId)!
  const today = dateInTimeZone(new Date(), settings.profile.timeZone)
  const plan = [...settings.plans].filter((item) => item.effectiveFrom <= today).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]
  let reducedMotion = loadPreferences().reducedMotion
  try { reducedMotion = JSON.parse(localStorage.getItem(DISPLAY_KEY) ?? 'null')?.reducedMotion ?? reducedMotion } catch { /* optional storage */ }
  return { exerciseIds: routine.exerciseIds, sets: routine.sets, weeklyGoal: plan?.weekdays.length ?? 2, reducedMotion }
}
type Operation = { kind: 'workout'; log: WorkoutLog } | { kind: 'cardio'; log: CardioLog } | { kind: 'delete'; id: string }
type Pending = Operation & { key: string; createdAt: number }
type Rejected = { operation: Pending; reason: string; rejectedAt: string }
function errorText(error: unknown) { return error instanceof Error ? error.message : 'No pudimos guardar los cambios.' }
export interface AppStore {
  progress: ProgressData
  preferences: Preferences
  storageError: string | null
  recoveryRaw: string | null
  authStatus: 'loading' | 'anonymous' | 'authenticated'
  user: AccountUser | null
  accountLoading: boolean
  accountError: string | null
  personalData: PersonalData | null
  revision: number | null
  syncStatus: 'idle' | 'saving' | 'pending' | 'error'
  pendingCount: number
  rejectedCount: number
  localDataAvailable: ReturnType<typeof localSummary>
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<string | null>
  refreshSession: () => Promise<string | null>
  refreshState: () => Promise<string | null>
  saveSettings: (settings: PersonalSettings) => Promise<string | null>
  importLocalData: (includeSettings?: boolean) => Promise<string | null>
  exportData: () => string
  exportRejectedData: () => string
  retryPending: () => Promise<string | null>
  addWorkout: (workout: WorkoutLog) => Promise<string | null>
  addCardio: (cardio: CardioLog) => Promise<string | null>
  removeLog: (id: string) => Promise<string | null>
  updatePreferences: (patch: Partial<Preferences>) => Promise<string | null>
  importProgress: (raw: string, includeSettings?: boolean) => Promise<string | null>
}
export const useAppStore = create<AppStore>((set, get) => {
  let generation = 0
  let work: Promise<unknown> = Promise.resolve()
  let pending: Pending[] = []
  let rejected: Rejected[] = []
  let canonical: ServerState | null = null
  let pendingClock = 0
  let sessionRefresh: Promise<string | null> | null = null
  let logoutUnconfirmed = false
  const current = (token: number, userId: string) => token === generation && get().user?.id === userId
  function readPending(userId: string) {
    const prefix = `${PENDING_PREFIX}${encodeURIComponent(userId)}.`
    const found = new Map(pending.map((entry) => [entry.key, entry]))
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key?.startsWith(prefix)) continue
        if (rejected.some((entry) => entry.operation.key === key)) continue
        try {
          const raw = JSON.parse(localStorage.getItem(key)!) as Pending
          if (raw.key !== key || !Number.isFinite(raw.createdAt)) continue
          if (raw.kind === 'workout') raw.log = WorkoutLogSchema.parse(raw.log)
          else if (raw.kind === 'cardio') raw.log = CardioLogSchema.parse(raw.log)
          else if (raw.kind !== 'delete' || typeof raw.id !== 'string') continue
          found.set(key, raw)
        } catch { /* Preserve unreadable originals. */ }
      }
    } catch { /* In-memory pending data remains exportable. */ }
    pending = [...found.values()].sort((a, b) => a.createdAt - b.createdAt || a.key.localeCompare(b.key))
  }
  function publish(state = canonical) {
    if (!state) return
    canonical = state
    let progress = state.data.progress
    for (const item of pending) {
      const id = item.kind === 'delete' ? item.id : item.log.id
      progress = { ...progress, workouts: progress.workouts.filter((log) => log.id !== id), cardio: progress.cardio.filter((log) => log.id !== id) }
      if (item.kind === 'workout') progress.workouts = [...progress.workouts, item.log]
      if (item.kind === 'cardio') progress.cardio = [...progress.cardio, item.log]
    }
    set({ personalData: { ...state.data, progress }, progress, preferences: accountPreferences(state.data.settings), revision: state.revision, pendingCount: pending.length })
  }
  function readRejected(userId: string) {
    const prefix = `${REJECTED_PREFIX}${encodeURIComponent(userId)}.`
    const found = new Map(rejected.map((entry) => [entry.operation.key, entry]))
    try {
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index)
        if (!key?.startsWith(prefix)) continue
        try {
          const value = JSON.parse(localStorage.getItem(key)!) as Rejected
          if (value.operation?.key && typeof value.reason === 'string') found.set(value.operation.key, value)
        } catch { /* Preserve an unreadable recovery file. */ }
      }
    } catch { /* In-memory rejected operations remain exportable. */ }
    rejected = [...found.values()]
    set({ rejectedCount: rejected.length })
  }
  function preserveRejected(item: Pending, error: unknown, userId: string) {
    const entry = { operation: item, reason: errorText(error), rejectedAt: new Date().toISOString() }
    rejected.push(entry)
    try {
      const key = `${REJECTED_PREFIX}${encodeURIComponent(userId)}.${crypto.randomUUID()}`
      localStorage.setItem(key, JSON.stringify(entry))
      set({ rejectedCount: rejected.length })
      return localStorage.getItem(key) === JSON.stringify(entry)
    } catch { set({ storageError: 'La copia del registro rechazado está solo en memoria. Descargá los registros para recuperar antes de cerrar.' }) }
    set({ rejectedCount: rejected.length })
    return false
  }
  function clearPrivate() {
    generation++
    pending = []
    rejected = []
    canonical = null
    set({ user: null, personalData: null, revision: null, progress: emptyProgress(), preferences: { ...defaults }, recoveryRaw: null, storageError: null, pendingCount: 0, rejectedCount: 0, syncStatus: 'idle', accountError: null })
  }
  function anonymous(error: string | null = null) {
    clearPrivate()
    set({ ...initial(), preferences: loadPreferences(), authStatus: 'anonymous', accountLoading: false, accountError: error, localDataAvailable: localSummary() })
  }
  function serialized(action: (token: number, userId: string) => Promise<string | null>) {
    const token = generation, userId = get().user?.id
    const next = work.then(() => !userId || !current(token, userId) ? CHANGED_ACCOUNT : action(token, userId))
    work = next.catch(() => undefined)
    return next
  }
  function fail(error: unknown, token: number, userId: string) {
    if (!current(token, userId)) return CHANGED_ACCOUNT
    const text = errorText(error)
    if (error instanceof AccountApiError && error.status === 401) {
      anonymous('Tu sesión venció. Iniciá sesión para recuperar tus cambios pendientes.')
      return text
    }
    set({ accountError: text, syncStatus: pending.length ? 'pending' : 'error', accountLoading: false })
    return text
  }
  function removePending(item: Pending, preserveStored = false) {
    try { if (!preserveStored) localStorage.removeItem(item.key) } catch { /* Replays are idempotent. */ }
    pending = pending.filter((entry) => entry.key !== item.key)
  }
  async function drain(token: number, userId: string): Promise<string | null> {
    readPending(userId)
    publish()
    while (pending.length) {
      if (!current(token, userId)) return CHANGED_ACCOUNT
      const item = pending[0]!
      set({ syncStatus: 'saving', accountError: null })
      try {
        const state = item.kind === 'workout' ? await accountApi.addWorkout(item.log, userId) : item.kind === 'cardio' ? await accountApi.addCardio(item.log, userId) : await accountApi.removeLog(item.id, userId)
        if (!current(token, userId)) return CHANGED_ACCOUNT
        removePending(item)
        publish(state)
      } catch (error) {
        if (!current(token, userId)) return CHANGED_ACCOUNT
        if (error instanceof AccountApiError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429) {
          const recovered = preserveRejected(item, error, userId)
          removePending(item, !recovered)
          try { const state = await accountApi.state(userId); if (current(token, userId)) publish(state) } catch { publish() }
        }
        return fail(error, token, userId)
      }
    }
    set({ syncStatus: 'idle', accountError: null, storageError: rejected.length ? get().storageError : null })
    return null
  }
  function saveLocal(progress: ProgressData) {
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
  function enqueue(operation: Operation) {
    return serialized(async (token, userId) => {
      if (!canonical) return 'Tu cuenta todavía no terminó de cargar.'
      readPending(userId)
      const id = operation.kind === 'delete' ? operation.id : operation.log.id
      let item = pending.find((entry) => entry.kind === operation.kind && (entry.kind === 'delete' ? entry.id : entry.log.id) === id)
      if (item && item.kind !== 'delete' && operation.kind !== 'delete' && JSON.stringify(item.log) !== JSON.stringify(operation.log)) {
        return 'Este registro ya tiene una versión pendiente. Sincronizala antes de cambiar sus datos.'
      }
      if (!item) {
        item = { ...operation, key: `${PENDING_PREFIX}${encodeURIComponent(userId)}.${crypto.randomUUID()}`, createdAt: pendingClock = Math.max(Date.now(), pendingClock + 1) }
        pending.push(item)
      }
      let durable = false
      try { localStorage.setItem(item.key, JSON.stringify(item)); durable = localStorage.getItem(item.key) === JSON.stringify(item) }
      catch { set({ storageError: 'El cambio pendiente está solo en memoria. Exportá tus datos antes de cerrar.' }) }
      publish()
      const error = await drain(token, userId)
      // A queued durable operation is safe to close; the account banner reports pending sync.
      return error && durable && current(token, userId) && pending.some((entry) => entry.key === item.key) ? null : error
    })
  }
  async function refreshCanonical(token: number, userId: string) {
    try {
      const state = await accountApi.state(userId)
      if (!current(token, userId)) return CHANGED_ACCOUNT
      readPending(userId)
      publish(state)
      set({ accountLoading: false, accountError: null })
      return drain(token, userId)
    } catch (error) { return fail(error, token, userId) }
  }
  async function loadSession(token: number): Promise<string | null> {
    try {
      const user = await accountApi.session()
      if (token !== generation) return CHANGED_ACCOUNT
      if (!user) { anonymous(); return null }
      if (get().user?.id !== user.id) clearPrivate()
      set({ user, authStatus: 'authenticated', accountLoading: true, accountError: null, localDataAvailable: localSummary() })
      readRejected(user.id)
      return serialized(refreshCanonical)
    } catch (error) {
      if (token !== generation) return CHANGED_ACCOUNT
      if (get().user) return fail(error, token, get().user!.id)
      const text = errorText(error)
      anonymous(text)
      return text
    }
  }
  async function handleConflict(error: unknown, token: number, userId: string) {
    if (error instanceof AccountApiError && error.status === 409 && current(token, userId)) {
      try { const state = await accountApi.state(userId); if (current(token, userId)) publish(state) } catch { /* retain original conflict */ }
      return fail(new Error('Tu cuenta cambió o contiene registros incompatibles con esta copia. Actualizamos los datos; revisalos antes de guardar otra vez.'), token, userId)
    }
    return fail(error, token, userId)
  }
  function importAccount(data: PersonalData | ProgressData, includeSettings: boolean) {
    const expectedRevision = get().revision
    return serialized(async (token, userId) => {
      if (!canonical || expectedRevision === null) return 'Tu cuenta todavía no terminó de cargar.'
      if (pending.length) return 'Sincronizá los cambios pendientes antes de importar una copia.'
      set({ syncStatus: 'saving', accountError: null })
      try {
        const state = await accountApi.importData(data, includeSettings, expectedRevision, userId)
        if (!current(token, userId)) return CHANGED_ACCOUNT
        publish(state)
        set({ syncStatus: 'idle' })
        return null
      } catch (error) { return handleConflict(error, token, userId) }
    })
  }
  return {
    ...initial(), preferences: loadPreferences(), authStatus: 'loading', user: null, accountLoading: false, accountError: null,
    personalData: null, revision: null, syncStatus: 'idle', pendingCount: 0, rejectedCount: 0, localDataAvailable: localSummary(),
    signIn: async (email, password) => {
      logoutUnconfirmed = false
      clearPrivate()
      const token = generation
      set({ authStatus: 'loading', accountLoading: true })
      try {
        await accountApi.signIn(email, password)
        if (token !== generation) return CHANGED_ACCOUNT
        return loadSession(token)
      } catch (error) {
        if (token !== generation) return CHANGED_ACCOUNT
        const text = errorText(error)
        anonymous(text)
        return text
      }
    },
    signOut: async () => {
      const owner = get().user?.id
      clearPrivate()
      const token = generation
      set({ authStatus: 'loading', accountLoading: true })
      try {
        await accountApi.signOut(owner)
        if (token !== generation) return CHANGED_ACCOUNT
        logoutUnconfirmed = false
        anonymous()
        return null
      } catch {
        if (token !== generation) return CHANGED_ACCOUNT
        logoutUnconfirmed = true
        const text = 'No pudimos cerrar la sesión en el servidor. Volvé a intentarlo. Tus datos privados se ocultaron en este dispositivo.'
        anonymous(text)
        return text
      }
    },
    refreshSession: () => {
      if (logoutUnconfirmed) return Promise.resolve(get().accountError)
      if (sessionRefresh) return sessionRefresh
      sessionRefresh = loadSession(generation).finally(() => { sessionRefresh = null })
      return sessionRefresh
    },
    refreshState: () => serialized(refreshCanonical),
    retryPending: () => serialized(drain),
    addWorkout: async (workout) => {
      const parsed = WorkoutLogSchema.safeParse(workout)
      if (!parsed.success) return 'La sesión tiene datos inválidos.'
      if (get().authStatus === 'loading') return 'Esperá mientras verificamos tu sesión.'
      return get().user ? enqueue({ kind: 'workout', log: parsed.data }) : saveLocal({ ...get().progress, workouts: [...get().progress.workouts.filter((log) => log.id !== parsed.data.id), parsed.data] })
    },
    addCardio: async (cardio) => {
      const parsed = CardioLogSchema.safeParse(cardio)
      if (!parsed.success) return 'La actividad tiene datos inválidos.'
      if (get().authStatus === 'loading') return 'Esperá mientras verificamos tu sesión.'
      return get().user ? enqueue({ kind: 'cardio', log: parsed.data }) : saveLocal({ ...get().progress, cardio: [...get().progress.cardio.filter((log) => log.id !== parsed.data.id), parsed.data] })
    },
    removeLog: async (id) => {
      if (get().authStatus === 'loading') return 'Esperá mientras verificamos tu sesión.'
      return get().user ? enqueue({ kind: 'delete', id }) : saveLocal({ ...get().progress, workouts: get().progress.workouts.filter((log) => log.id !== id), cardio: get().progress.cardio.filter((log) => log.id !== id) })
    },
    saveSettings: (settings) => {
      const parsed = PersonalSettingsSchema.safeParse(settings)
      if (!parsed.success) return Promise.resolve('Revisá el perfil, la rutina y los días elegidos.')
      const expectedRevision = get().revision
      return serialized(async (token, userId) => {
        if (!canonical || expectedRevision === null) return 'Tu cuenta todavía no terminó de cargar.'
        if (canonical.revision !== expectedRevision) return 'Los datos cambiaron mientras editabas. Revisá la cuenta antes de guardar otra vez.'
        set({ syncStatus: 'saving', accountError: null })
        try {
          const state = await accountApi.settings(parsed.data, expectedRevision, userId)
          if (!current(token, userId)) return CHANGED_ACCOUNT
          publish(state)
          set({ syncStatus: pending.length ? 'pending' : 'idle' })
          return null
        } catch (error) { return handleConflict(error, token, userId) }
      })
    },
    updatePreferences: async (patch) => {
      if (get().authStatus === 'loading') return 'Esperá mientras verificamos tu sesión.'
      if (get().user) {
        if (patch.reducedMotion !== undefined) {
          try { localStorage.setItem(DISPLAY_KEY, JSON.stringify({ reducedMotion: patch.reducedMotion })) }
          catch { return 'No pudimos guardar la preferencia de movimiento en este dispositivo.' }
          set({ preferences: { ...get().preferences, reducedMotion: patch.reducedMotion } })
        }
        if (patch.weeklyGoal !== undefined) return 'Elegí los días de entrenamiento en tu cuenta para cambiar el objetivo semanal.'
        if (patch.exerciseIds === undefined && patch.sets === undefined) return null
        const data = get().personalData
        if (!data) return 'Tu cuenta todavía no terminó de cargar.'
        const settings = { ...data.settings, routines: data.settings.routines.map((routine) => routine.id === data.settings.activeRoutineId
          ? { ...routine, ...(patch.sets === undefined ? {} : { sets: patch.sets }), ...(patch.exerciseIds === undefined ? {} : { exerciseIds: patch.exerciseIds as typeof routine.exerciseIds }) } : routine) }
        return get().saveSettings(settings)
      }
      const preferences = { ...get().preferences, ...patch }
      set({ preferences })
      try { localStorage.setItem(PREF_KEY, JSON.stringify(preferences)); set({ storageError: null, localDataAvailable: localSummary() }); return null }
      catch { const error = 'No pudimos guardar tus preferencias en este navegador.'; set({ storageError: error }); return error }
    },
    importProgress: async (raw, includeSettings = false) => {
      let data: PersonalData | ProgressData
      try {
        const value: unknown = JSON.parse(raw)
        const personal = PersonalDataSchema.safeParse(value)
        data = personal.success ? personal.data : ProgressDataSchema.parse(value)
      } catch { return 'El archivo no contiene un historial válido de Klisteni.' }
      if (get().authStatus === 'loading') return 'Esperá mientras verificamos tu sesión.'
      if (get().user) return importAccount(data, data.version === 2 && includeSettings)
      if (data.version === 2) return 'Iniciá sesión para importar una copia completa de una cuenta.'
      return saveLocal(data)
    },
    importLocalData: async (includeSettings = true) => {
      const user = get().user
      if (!user) return 'Iniciá sesión antes de incorporar el historial local.'
      const local = initial()
      if (local.storageError) return local.storageError
      if (!includeSettings) return importAccount(local.progress, false)
      const preferences = loadPreferences()
      const data = createDefaultPersonalData(get().personalData?.settings.profile.displayName ?? user.name, get().personalData?.settings.profile.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
      data.progress = local.progress
      data.settings.routines[0] = { ...data.settings.routines[0]!, exerciseIds: preferences.exerciseIds as typeof data.settings.routines[number]['exerciseIds'], sets: preferences.sets }
      // A legacy weekly goal does not identify weekdays. Do not invent a schedule.
      return importAccount(data, true)
    },
    exportData: () => get().user && get().personalData ? JSON.stringify(PersonalDataSchema.parse(get().personalData)) : serializeProgress(get().progress),
    exportRejectedData: () => {
      if (get().user) readRejected(get().user!.id)
      return JSON.stringify({ format: 'klisteniapp-rejected-operations', version: 1, operations: get().user ? rejected : [] }, null, 2)
    },
  }
})
