import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createDefaultPersonalData, createEmptyHealthData } from '@klisteniapp/scene-schema'
import { useAppStore, STORAGE_KEY, LOCAL_PERSONAL_KEY } from '../src/lib/store.local.ts'
import { initial, loadPreferences, loadLocalPersonal } from '../src/lib/store.persistence.ts'

const values = new Map<string, string>()
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value) },
  removeItem: (key: string) => { values.delete(key) },
  clear: () => values.clear(), key: (index: number) => [...values.keys()][index] ?? null,
  get length() { return values.size },
}
function reload() {
  useAppStore.setState({ ...initial(), preferences: loadPreferences(), localPersonalData: loadLocalPersonal(), localRevision: 0 })
}
beforeEach(() => {
  values.clear()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  reload()
})

test('local mode starts ready, reads legacy keys, and never calls a transport', async () => {
  const original = globalThis.fetch
  globalThis.fetch = () => { throw new Error('Local mode must not send requests') }
  try {
    values.set(STORAGE_KEY, JSON.stringify({ version: 1, workouts: [], cardio: [{ id: 'legacy-walk', date: '2026-09-28', activity: 'walk', minutes: 12 }] }))
    values.set('klisteniapp.preferences.v1', JSON.stringify({ weeklyGoal: 3, sets: 1, exerciseIds: ['squat'], reducedMotion: true }))
    reload()
    assert.equal(useAppStore.getState().authStatus, 'anonymous')
    assert.equal(useAppStore.getState().progress.cardio[0]?.minutes, 12)
    assert.equal(useAppStore.getState().preferences.weeklyGoal, 3)
    assert.equal(await useAppStore.getState().addCardio({ id: 'another', date: '2026-09-29', activity: 'bike', minutes: 20 }), null)
    await useAppStore.getState().refreshSession()
    await useAppStore.getState().refreshState()
    reload()
    assert.equal(useAppStore.getState().progress.cardio.length, 2)
    assert.equal(JSON.parse(useAppStore.getState().exportData()).version, 1)
  } finally { globalThis.fetch = original }
})
test('local health and goals retain revision checks, persist, export and restore complete version 2 copies', async () => {
  const data = createDefaultPersonalData('Mi práctica guardada', 'UTC')
  data.settings.health = createEmptyHealthData()
  data.settings.health.profile = { heightCm: 178 }
  data.settings.health.goals = [{ id: 'goal-local', title: 'Sostener mi práctica', metric: 'weeklyTrainingDays', target: 3, startDate: '2026-09-28' }]
  data.progress.cardio = [{ id: 'record-local', date: '2026-09-28', activity: 'walk', minutes: 25 }]
  assert.equal(await useAppStore.getState().importProgress(JSON.stringify(data)), null)
  assert.deepEqual(JSON.parse(useAppStore.getState().exportData()), data)
  const health = structuredClone(data.settings.health)
  health.profile.heightCm = 179
  assert.notEqual(await useAppStore.getState().saveHealth(health, 0), null)
  assert.equal(await useAppStore.getState().saveHealth(health, 1), null)
  reload()
  assert.equal(useAppStore.getState().localPersonalData?.settings.health?.profile.heightCm, 179)
  assert.equal(useAppStore.getState().localPersonalData?.settings.health?.goals[0]?.id, 'goal-local')
  assert.equal(useAppStore.getState().progress.cardio[0]?.minutes, 25)
  const exported = useAppStore.getState().exportData()
  values.clear(); reload()
  assert.equal(await useAppStore.getState().importProgress(exported), null)
  assert.equal(useAppStore.getState().exportData(), exported)
})
test('corrupt originals remain recoverable and invalid imports cannot overwrite local data', async () => {
  values.set(STORAGE_KEY, '{broken-progress')
  reload()
  assert.ok(useAppStore.getState().storageError)
  assert.equal(await useAppStore.getState().addCardio({ id: 'valid', date: '2026-09-28', activity: 'walk', minutes: 10 }), null)
  assert.equal(values.get('klisteniapp.progress.recovery'), '{broken-progress')
  const previous = values.get(STORAGE_KEY)
  assert.notEqual(await useAppStore.getState().importProgress('{invalid'), null)
  assert.equal(values.get(STORAGE_KEY), previous)
  values.set(LOCAL_PERSONAL_KEY, '{broken-personal'); reload()
  assert.equal(useAppStore.getState().exportData(), '{broken-personal')
  assert.notEqual(await useAppStore.getState().saveHealth(createEmptyHealthData(), 0), null)
  assert.equal(values.get(LOCAL_PERSONAL_KEY), '{broken-personal')
})


test('expanded and equipped local routines survive reload without admitting obsolete IDs', async () => {
  values.set('klisteniapp.preferences.v1', JSON.stringify({ weeklyGoal: 2, sets: 2, exerciseIds: ['squat', 'bent-knee-row', 'plank-shoulder-tap', 'removed-exercise'], reducedMotion: true }))
  reload()
  assert.deepEqual(useAppStore.getState().preferences.exerciseIds, ['squat', 'bent-knee-row', 'plank-shoulder-tap'])
  assert.equal(await useAppStore.getState().updatePreferences({ sets: 3 }), null)
  reload()
  assert.deepEqual(useAppStore.getState().preferences.exerciseIds, ['squat', 'bent-knee-row', 'plank-shoulder-tap'])
  assert.equal(useAppStore.getState().preferences.sets, 3)
})

test('local language, theme and palette persist across reloads without resetting health or training', async () => {
  const data = createDefaultPersonalData('Local profile', 'UTC')
  data.settings.health!.profile.heightCm = 178
  data.progress.cardio = [{ id: 'display-history', date: '2026-09-28', activity: 'walk', minutes: 20 }]
  assert.equal(await useAppStore.getState().importProgress(JSON.stringify(data)), null)
  assert.equal(await useAppStore.getState().updatePreferences({ language: 'fr', theme: 'dark', colorTheme: 'ocean' }), null)
  reload()
  assert.equal(useAppStore.getState().preferences.language, 'fr')
  assert.equal(useAppStore.getState().preferences.theme, 'dark')
  assert.equal(useAppStore.getState().preferences.colorTheme, 'ocean')
  assert.equal(useAppStore.getState().localPersonalData?.settings.profile.language, 'fr')
  assert.equal(useAppStore.getState().localPersonalData?.settings.profile.colorTheme, 'ocean')
  assert.equal(useAppStore.getState().localPersonalData?.settings.health?.profile.heightCm, 178)
  assert.equal(useAppStore.getState().progress.cardio[0]?.id, 'display-history')
  const legacy = structuredClone(data.settings)
  delete legacy.health
  assert.equal(await useAppStore.getState().saveSettings(legacy), null)
  assert.equal(useAppStore.getState().localPersonalData?.settings.profile.theme, 'dark')
  assert.equal(useAppStore.getState().localPersonalData?.settings.profile.colorTheme, 'ocean')
  assert.equal(useAppStore.getState().localPersonalData?.settings.health?.profile.heightCm, 178)
  const exported = useAppStore.getState().exportData()
  values.clear(); reload()
  assert.equal(await useAppStore.getState().importProgress(exported), null)
  reload()
  assert.equal(useAppStore.getState().preferences.colorTheme, 'ocean')
  assert.equal(JSON.parse(useAppStore.getState().exportData()).settings.profile.colorTheme, 'ocean')
})

test('a complete imported backup restores its explicit display preferences after reload', async () => {
  assert.equal(await useAppStore.getState().updatePreferences({ language: 'fr', theme: 'dark' }), null)
  const data = createDefaultPersonalData('Imported appearance', 'UTC')
  data.settings.profile.language = 'en'
  data.settings.profile.theme = 'light'
  data.settings.profile.colorTheme = 'rose'
  assert.equal(await useAppStore.getState().importProgress(JSON.stringify(data)), null)
  reload()
  assert.equal(useAppStore.getState().preferences.language, 'en')
  assert.equal(useAppStore.getState().preferences.theme, 'light')
  assert.equal(useAppStore.getState().preferences.colorTheme, 'rose')
})

test('palette-only changes retain light or dark mode and survive legacy backup imports', async () => {
  assert.equal(await useAppStore.getState().updatePreferences({ theme: 'dark' }), null)
  assert.equal(await useAppStore.getState().updatePreferences({ colorTheme: 'lavender' }), null)
  assert.equal(useAppStore.getState().preferences.theme, 'dark')
  const legacy = createDefaultPersonalData('Legacy backup', 'UTC')
  assert.equal(await useAppStore.getState().importProgress(JSON.stringify(legacy)), null)
  reload()
  assert.equal(useAppStore.getState().preferences.colorTheme, 'lavender')
  assert.equal(useAppStore.getState().preferences.theme, 'dark')
  assert.equal(JSON.parse(useAppStore.getState().exportData()).settings.profile.colorTheme, 'lavender')
})
