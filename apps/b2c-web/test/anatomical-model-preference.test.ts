import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'
import { createDefaultPersonalData, type AnatomicalModelVariant, type ServerState } from '@klisteniapp/scene-schema'
import { AccountApiError, accountApi } from '../src/lib/account-api.ts'
import { useAppStore as accountStore, selectAnatomicalModel } from '../src/lib/store.ts'
import { useAppStore as localStore, selectAnatomicalModel as localModel } from '../src/lib/store.local.ts'
import { LOCAL_PERSONAL_KEY, PREF_KEY, initial, loadLocalPersonal, loadPreferences } from '../src/lib/store.persistence.ts'

const values = new Map<string, string>()
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value) },
  removeItem: (key: string) => { values.delete(key) },
  key: (index: number) => [...values.keys()][index] ?? null,
  get length() { return values.size },
}
const userA = { id: 'model-account-a', email: 'a@example.test', name: 'A' }
const userB = { id: 'model-account-b', email: 'b@example.test', name: 'B' }
function state(anatomicalModel?: AnatomicalModelVariant, revision = 0): ServerState {
  const data = createDefaultPersonalData('Model owner', 'UTC')
  if (anatomicalModel) data.settings.anatomicalModel = anatomicalModel
  data.settings.health!.profile = { sex: 'male', heightCm: 178 }
  data.progress.cardio = [{ id: 'keep-history', date: '2026-10-03', activity: 'walk', minutes: 20 }]
  return { data, revision }
}
function reloadLocal() {
  localStore.setState({ ...initial(), preferences: loadPreferences(), localPersonalData: loadLocalPersonal(), localRevision: 0 })
}
beforeEach(async () => {
  mock.restoreAll()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  mock.method(accountApi, 'signOut', async () => null)
  await accountStore.getState().signOut()
  values.clear()
  await accountStore.getState().signOut()
  reloadLocal()
  mock.method(accountApi, 'signIn', async () => null)
  mock.method(accountApi, 'session', async () => userA)
  mock.method(accountApi, 'state', async () => state())
  mock.method(accountApi, 'access', async () => ({ status: 'lifetime' as const, cloudWrite: true, trialEndsAt: null, paidThrough: null }))
})

test('legacy local and account settings default to male without inferring from health sex or shared appearance', async () => {
  const legacy = state().data
  legacy.settings.health!.profile.sex = 'female'
  values.set(LOCAL_PERSONAL_KEY, JSON.stringify(legacy))
  values.set(PREF_KEY, JSON.stringify({ anatomicalModel: 'female' }))
  values.set('klisteniapp.display.v1', JSON.stringify({ anatomicalModel: 'female' }))
  reloadLocal()
  assert.equal(localModel(localStore.getState()), 'male')
  assert.equal(localStore.getState().preferences.anatomicalModel, 'male')
  mock.method(accountApi, 'state', async () => ({ data: legacy, revision: 0 }))
  await accountStore.getState().signIn(userA.email, 'x')
  assert.equal(selectAnatomicalModel(accountStore.getState()), 'male')
})

test('local model selection survives reload and portable backup restore without changing health or training', async () => {
  const original = state().data
  assert.equal(await localStore.getState().importProgress(JSON.stringify(original)), null)
  assert.equal(await localStore.getState().updatePreferences({ anatomicalModel: 'female' }), null)
  reloadLocal()
  assert.equal(localModel(localStore.getState()), 'female')
  assert.equal(localStore.getState().preferences.anatomicalModel, 'female')
  const exported = localStore.getState().exportData()
  const backup = JSON.parse(exported)
  assert.equal(backup.settings.anatomicalModel, 'female')
  assert.deepEqual(backup.settings.health, original.settings.health)
  assert.deepEqual(backup.settings.routines, original.settings.routines)
  assert.deepEqual(backup.progress, original.progress)
  values.clear(); reloadLocal()
  assert.equal(await localStore.getState().importProgress(exported), null)
  assert.equal(localModel(localStore.getState()), 'female')
  assert.equal(localStore.getState().exportData(), exported)
})

test('legacy settings and backups cannot erase the local model while an explicit backup can replace it', async () => {
  assert.equal(await localStore.getState().updatePreferences({ anatomicalModel: 'female' }), null)
  const legacy = state().data
  assert.equal(await localStore.getState().saveSettings(legacy.settings), null)
  assert.equal(localModel(localStore.getState()), 'female')
  assert.equal(await localStore.getState().importProgress(JSON.stringify(legacy)), null)
  assert.equal(localModel(localStore.getState()), 'female')
  legacy.settings.anatomicalModel = 'male'
  assert.equal(await localStore.getState().importProgress(JSON.stringify(legacy)), null)
  reloadLocal()
  assert.equal(localModel(localStore.getState()), 'male')
})

test('a failed local model save does not advertise an unpersisted selection', async () => {
  const before = localStore.getState().localRevision
  mock.method(storage, 'setItem', (key: string) => { if (key === LOCAL_PERSONAL_KEY) throw new Error('Quota exceeded') })
  assert.notEqual(await localStore.getState().updatePreferences({ anatomicalModel: 'female' }), null)
  assert.equal(localModel(localStore.getState()), 'male')
  assert.equal(localStore.getState().localRevision, before)
  assert.equal(values.get(LOCAL_PERSONAL_KEY), undefined)
})

test('the instance local fallback persists the model and local-to-account import carries it explicitly', async () => {
  assert.equal(await accountStore.getState().updatePreferences({ anatomicalModel: 'female' }), null)
  assert.equal(selectAnatomicalModel(accountStore.getState()), 'female')
  await accountStore.getState().signOut()
  assert.equal(selectAnatomicalModel(accountStore.getState()), 'female')
  assert.equal(JSON.parse(accountStore.getState().exportData()).settings.anatomicalModel, 'female')
  await accountStore.getState().signIn(userA.email, 'x')
  assert.equal(selectAnatomicalModel(accountStore.getState()), 'male')
  const imported = mock.method(accountApi, 'importData', async (...[data, includeSettings, revision, userId]: Parameters<typeof accountApi.importData>) => {
    assert.equal(data.version, 2)
    assert.equal(includeSettings, true)
    assert.equal(revision, 0)
    assert.equal(userId, userA.id)
    if (data.version !== 2) throw new Error('Expected personal backup')
    assert.equal(data.settings.anatomicalModel, 'female')
    return { data, revision: 1 }
  })
  assert.equal(await accountStore.getState().importLocalData(true), null)
  assert.equal(imported.mock.callCount(), 1)
  assert.equal(selectAnatomicalModel(accountStore.getState()), 'female')
})

test('account model saves are revision checked and remain isolated across users and logout', async () => {
  await accountStore.getState().signIn(userA.email, 'x')
  const original = structuredClone(accountStore.getState().personalData!)
  const saved = mock.method(accountApi, 'settings', async (...[settings, revision, userId]: Parameters<typeof accountApi.settings>) => {
    assert.equal(revision, 0)
    assert.equal(userId, userA.id)
    assert.deepEqual(settings, { ...original.settings, anatomicalModel: 'female' })
    return { data: { ...original, settings }, revision: 1 }
  })
  assert.equal(await accountStore.getState().updatePreferences({ anatomicalModel: 'female' }), null)
  assert.equal(saved.mock.callCount(), 1)
  assert.equal(selectAnatomicalModel(accountStore.getState()), 'female')
  assert.equal(JSON.parse(accountStore.getState().exportData()).settings.anatomicalModel, 'female')
  assert.equal(values.size, 0)
  await accountStore.getState().signOut()
  assert.equal(selectAnatomicalModel(accountStore.getState()), 'male')
  mock.method(accountApi, 'session', async () => userB)
  await accountStore.getState().signIn(userB.email, 'x')
  assert.equal(selectAnatomicalModel(accountStore.getState()), 'male')
  assert.equal(accountStore.getState().preferences.anatomicalModel, 'male')
  await accountStore.getState().signOut()
  mock.method(accountApi, 'session', async () => userA)
  mock.method(accountApi, 'state', async () => state('female', 1))
  await accountStore.getState().signIn(userA.email, 'x')
  assert.equal(selectAnatomicalModel(accountStore.getState()), 'female')
})

test('a model save conflict adopts the canonical server choice and reports the rejected write', async () => {
  await accountStore.getState().signIn(userA.email, 'x')
  mock.method(accountApi, 'settings', async () => { throw new AccountApiError('Conflict', 409, 'REVISION_CONFLICT') })
  mock.method(accountApi, 'state', async () => state('male', 2))
  assert.notEqual(await accountStore.getState().updatePreferences({ anatomicalModel: 'female' }), null)
  assert.equal(selectAnatomicalModel(accountStore.getState()), 'male')
  assert.equal(accountStore.getState().revision, 2)
  assert.equal(values.size, 0)
})
