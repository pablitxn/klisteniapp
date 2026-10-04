import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { createDefaultPersonalData, createEmptyHealthData, type HealthData, type ServerState } from '@klisteniapp/scene-schema'
import { accountApi, AccountApiError } from '../src/lib/account-api.ts'
import { useAppStore } from '../src/lib/store.ts'

class MemoryStorage {
  values = new Map<string, string>()
  get length() { return this.values.size }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
  clear() { this.values.clear() }
}
const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
const owner = { id: 'health-owner', email: 'health@example.test', name: 'Health test' }
const state = (revision = 0): ServerState => ({ data: createDefaultPersonalData('Health test', 'Europe/Paris'), revision })
function health(): HealthData {
  const value = createEmptyHealthData()
  value.profile.heightCm = 178
  return value
}
async function setup() {
  mock.restoreAll()
  mock.method(accountApi, 'signOut', async () => null)
  await useAppStore.getState().signOut()
  storage.clear()
  mock.method(accountApi, 'access', async () => ({ status: 'trial' as const, cloudWrite: true, trialEndsAt: '2099-01-01T00:00:00Z', paidThrough: null }))
  mock.method(accountApi, 'signIn', async () => null)
  mock.method(accountApi, 'session', async () => owner)
  mock.method(accountApi, 'state', async () => state())
  await useAppStore.getState().signIn(owner.email, 'test-only')
}

test('health saves require its captured revision and exports include confirmed server data', async () => {
  await setup()
  const result = state(1)
  result.data.settings.health = health()
  const save = mock.method(accountApi, 'health', async (data: HealthData, revision: number, userId: string) => {
    assert.deepEqual(data, health())
    assert.equal(revision, 0)
    assert.equal(userId, owner.id)
    return result
  })
  assert.equal(await useAppStore.getState().saveHealth(health(), 0), null)
  assert.equal(save.mock.callCount(), 1)
  assert.equal(useAppStore.getState().revision, 1)
  assert.equal(JSON.parse(useAppStore.getState().exportData()).settings.health.profile.heightCm, 178)
  assert.equal([...storage.values.values()].some(value => value.includes('heightCm')), false)
  assert.notEqual(await useAppStore.getState().saveHealth(health(), 0), null)
  assert.equal(save.mock.callCount(), 1)
})

test('failed health saves never pretend to be saved or spill into local demo/pending storage', async () => {
  await setup()
  mock.method(accountApi, 'health', async () => { throw new AccountApiError('Sin conexión') })
  const draft = health()
  assert.equal(await useAppStore.getState().saveHealth(draft, 0), 'Sin conexión')
  assert.equal(useAppStore.getState().personalData?.settings.health?.profile.heightCm, undefined)
  assert.equal(useAppStore.getState().syncStatus, 'error')
  assert.equal(useAppStore.getState().pendingCount, 0)
  assert.equal(storage.length, 0)
  assert.equal(draft.profile.heightCm, 178)
})

test('health conflict refreshes current state while rejecting the stale write', async () => {
  await setup()
  const newer = state(2)
  newer.data.settings.health = health()
  newer.data.settings.health.profile.heightCm = 180
  mock.method(accountApi, 'health', async () => { throw new AccountApiError('Conflict', 409, 'REVISION_CONFLICT') })
  mock.method(accountApi, 'state', async () => newer)
  assert.notEqual(await useAppStore.getState().saveHealth(health(), 0), null)
  assert.equal(useAppStore.getState().personalData?.settings.health?.profile.heightCm, 180)
  assert.equal(useAppStore.getState().revision, 2)
})

test('an in-flight health response cannot restore private data after logout', async () => {
  await setup()
  let release!: (value: ServerState) => void
  mock.method(accountApi, 'health', () => new Promise<ServerState>(resolve => { release = resolve }))
  const write = useAppStore.getState().saveHealth(health(), 0)
  await new Promise(resolve => setImmediate(resolve))
  await useAppStore.getState().signOut()
  const result = state(1)
  result.data.settings.health = health()
  release(result)
  assert.notEqual(await write, null)
  assert.equal(useAppStore.getState().personalData, null)
  assert.equal(useAppStore.getState().user, null)
  assert.equal(JSON.parse(useAppStore.getState().exportData()).settings, undefined)
})

test('anonymous and invalid health changes do not reach the API', async () => {
  await setup()
  const save = mock.method(accountApi, 'health', async () => state(1))
  const invalid = health()
  invalid.profile.heightCm = -1
  assert.notEqual(await useAppStore.getState().saveHealth(invalid, 0), null)
  await useAppStore.getState().signOut()
  assert.equal(await useAppStore.getState().saveHealth(health(), 0), null)
  assert.equal(useAppStore.getState().localPersonalData?.settings.health?.profile.heightCm, 178)
  assert.equal(JSON.parse(useAppStore.getState().exportData()).settings.health.profile.heightCm, 178)
  assert.equal(save.mock.callCount(), 0)
})

test('a local routine import omits health so legacy preferences cannot erase it', async () => {
  await setup()
  const current = state(2)
  current.data.settings.health = health()
  mock.method(accountApi, 'state', async () => current)
  await useAppStore.getState().refreshState()
  storage.setItem('klisteniapp.preferences.v1', JSON.stringify({ weeklyGoal: 2, sets: 2, exerciseIds: ['pushup'], reducedMotion: false }))
  const importData = mock.method(accountApi, 'importData', async (data: unknown) => {
    assert.equal((data as ServerState['data']).settings.health, undefined)
    return current
  })
  assert.equal(await useAppStore.getState().importLocalData(true), null)
  assert.equal(importData.mock.callCount(), 1)
  assert.equal(useAppStore.getState().personalData?.settings.health?.profile.heightCm, 178)
})

test('free local health persists separately and restores after account logout without uploading it', async () => {
  await setup()
  storage.clear()
  await useAppStore.getState().signOut()
  const cloud = mock.method(accountApi, 'health', async () => { throw new Error('Local health must not upload') })
  assert.equal(await useAppStore.getState().saveHealth(health(), 0), null)
  assert.equal(useAppStore.getState().localRevision, 1)
  assert.notEqual(await useAppStore.getState().saveHealth(health(), 0), null)
  const localRaw = storage.getItem('klisteniapp.personal.v2')
  assert.equal(JSON.parse(localRaw!).settings.health.profile.heightCm, 178)
  await useAppStore.getState().signIn(owner.email, 'x')
  assert.equal(useAppStore.getState().personalData?.settings.health?.profile.heightCm, undefined)
  assert.equal(JSON.parse(useAppStore.getState().exportData()).settings.health.profile.heightCm, undefined)
  await useAppStore.getState().signOut()
  assert.equal(useAppStore.getState().localPersonalData?.settings.health?.profile.heightCm, 178)
  assert.equal(storage.getItem('klisteniapp.personal.v2'), localRaw)
  assert.equal(cloud.mock.callCount(), 0)
})

test('an exported account including health and plans can be imported and exported in free local mode', async () => {
  await setup()
  storage.clear()
  await useAppStore.getState().signOut()
  const data = state().data
  data.settings.health = health()
  data.progress.cardio = [{ id: 'from-cloud', date: '2026-10-03', activity: 'walk', minutes: 25 }]
  const raw = JSON.stringify(data)
  assert.equal(await useAppStore.getState().importProgress(raw), null)
  assert.deepEqual(JSON.parse(useAppStore.getState().exportData()), data)
  await useAppStore.getState().signOut()
  assert.deepEqual(JSON.parse(useAppStore.getState().exportData()), data)
})

test('unreadable local personal copies are preserved and can be downloaded for recovery', async () => {
  await setup()
  storage.setItem('klisteniapp.personal.v2', '{broken-copy')
  await useAppStore.getState().signOut()
  assert.equal(useAppStore.getState().localPersonalData, null)
  assert.notEqual(await useAppStore.getState().saveHealth(health(), 0), null)
  assert.equal(storage.getItem('klisteniapp.personal.v2'), '{broken-copy')
  assert.equal(useAppStore.getState().exportData(), '{broken-copy')
})

test('expired cloud access blocks health edits but permits explicit deletion requests for server validation', async () => {
  await setup()
  useAppStore.getState().setAccess({ status: 'expired', cloudWrite: false, trialEndsAt: '2020-01-01T00:00:00Z', paidThrough: null })
  const save = mock.method(accountApi, 'health', async () => state(1))
  assert.notEqual(await useAppStore.getState().saveHealth(health(), 0), null)
  assert.equal(save.mock.callCount(), 0)
  assert.equal(await useAppStore.getState().saveHealth(health(), 0, true), null)
  assert.equal(save.mock.callCount(), 1)
})
