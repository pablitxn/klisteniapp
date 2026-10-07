import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'
import { createDefaultPersonalData, type ServerState, type YogaData, type YogaLog, type YogaPractice } from '@klisteniapp/scene-schema'
import { accountApi, AccountApiError } from '../src/lib/account-api.ts'
import { useAppStore as accountStore } from '../src/lib/store.ts'
import { useAppStore as localStore } from '../src/lib/store.local.ts'
import { LOCAL_PERSONAL_KEY, initial, loadLocalPersonal, loadPreferences } from '../src/lib/store.persistence.ts'
import { yogaState } from '../src/lib/store.yoga.ts'

const yogaTransport = accountApi.yoga
const settingsTransport = accountApi.settings
const values = new Map<string, string>()
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value) },
  removeItem: (key: string) => { values.delete(key) },
  key: (index: number) => [...values.keys()][index] ?? null,
  get length() { return values.size },
}
const a = { id: 'yoga-a', name: 'A', email: 'a@example.test' }
const b = { id: 'yoga-b', name: 'B', email: 'b@example.test' }
const practice: YogaPractice = { id: 'practice', name: 'Pausa', intention: 'Respirar', steps: [{ id: 'one', asanaId: 'savasana', durationSeconds: 60, side: 'both' }] }
const log: YogaLog = { id: 'log', date: '2026-10-07', completedAt: '2026-10-07T10:00:00Z', practiceSnapshot: practice, completedSteps: [{ stepId: 'one', asanaId: 'savasana', durationSeconds: 20, side: 'both' }], durationSeconds: 20 }
const yoga: YogaData = { practices: [practice], logs: [log] }
function serverState(yogaData?: YogaData, revision = 0): ServerState {
  const data = createDefaultPersonalData('Owner', 'UTC')
  if (yogaData) data.settings.yoga = structuredClone(yogaData)
  return { data, revision }
}
function reloadLocal() {
  const data = loadLocalPersonal()
  localStore.setState({ ...initial(), preferences: loadPreferences(), localPersonalData: data, localRevision: 0, ...yogaState(data) })
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
  mock.method(accountApi, 'session', async () => a)
  mock.method(accountApi, 'state', async () => serverState())
  mock.method(accountApi, 'access', async () => ({ status: 'lifetime' as const, cloudWrite: true, trialEndsAt: null, paidThrough: null }))
})

test('both guest builds persist practices and partial logs, roundtrip backups, and preserve yoga through legacy imports', async () => {
  for (const store of [localStore, accountStore]) {
    assert.equal(await store.getState().saveYogaPractice(practice), true)
    assert.equal(await store.getState().addYogaLog(log), true)
    const raw = store.getState().exportData()
    assert.deepEqual(JSON.parse(raw).settings.yoga, yoga)
    assert.equal(await store.getState().saveYogaPractice({ ...practice, name: 'Edit' }), true)
    assert.equal(store.getState().yogaLogs[0].practiceSnapshot.name, 'Pausa')
    assert.equal(await store.getState().deleteYogaPractice(practice.id), true)
    assert.equal(store.getState().yogaLogs.length, 1)
    assert.equal(await store.getState().importProgress(raw), null)
    assert.deepEqual(store.getState().yogaPractices, [practice])
    assert.equal(await store.getState().importProgress(JSON.stringify(createDefaultPersonalData('Legacy', 'UTC'))), null)
    assert.deepEqual(store.getState().yogaLogs, [log])
    assert.equal(await store.getState().saveSettings(createDefaultPersonalData('Legacy settings', 'UTC').settings), null)
    assert.deepEqual(store.getState().yogaLogs, [log])
  }
  reloadLocal()
  assert.deepEqual(localStore.getState().yogaLogs, [log])
  await accountStore.getState().signOut()
  assert.deepEqual(accountStore.getState().yogaLogs, [log])
})

test('quota errors never claim a yoga write succeeded or replace the durable snapshot', async () => {
  for (const store of [localStore, accountStore]) {
    const before = store.getState().localRevision
    const failing = mock.method(storage, 'setItem', () => { throw new Error('Quota') })
    assert.equal(await store.getState().saveYogaPractice(practice), false)
    assert.deepEqual(store.getState().yogaPractices, [])
    assert.equal(store.getState().localRevision, before)
    assert.match(store.getState().storageError!, /No pudimos guardar/)
    failing.mock.restore()
  }
  assert.equal(values.has(LOCAL_PERSONAL_KEY), false)
})

test('confirmed account yoga uses the captured owner/revision without leaking into local or pending storage', async () => {
  await accountStore.getState().signIn(a.email, 'x')
  const saved = mock.method(accountApi, 'yoga', async (data: YogaData, revision: number, owner: string) => {
    assert.equal(owner, a.id)
    assert.equal(revision, 0)
    assert.deepEqual(data, { practices: [practice], logs: [] })
    return serverState(data, 1)
  })
  assert.equal(await accountStore.getState().saveYogaPractice(practice), true)
  assert.equal(saved.mock.callCount(), 1)
  assert.deepEqual(accountStore.getState().yogaPractices, [practice])
  assert.deepEqual(JSON.parse(accountStore.getState().exportData()).settings.yoga.practices, [practice])
  assert.equal(values.size, 0)
  await accountStore.getState().signOut()
  assert.deepEqual(accountStore.getState().yogaPractices, [])
  mock.method(accountApi, 'session', async () => b)
  await accountStore.getState().signIn(b.email, 'x')
  assert.deepEqual(accountStore.getState().yogaPractices, [])
})

test('network errors retain the unsaved caller draft and conflict refreshes canonical yoga while returning false', async () => {
  await accountStore.getState().signIn(a.email, 'x')
  mock.method(accountApi, 'yoga', async () => { throw new AccountApiError('Sin conexión') })
  assert.equal(await accountStore.getState().saveYogaPractice(practice), false)
  assert.deepEqual(accountStore.getState().yogaPractices, [])
  assert.equal(accountStore.getState().accountError, 'Sin conexión')
  assert.equal(accountStore.getState().pendingCount, 0)
  assert.equal(values.size, 0)
  const newer = { practices: [{ ...practice, name: 'Otro dispositivo' }], logs: [] }
  mock.method(accountApi, 'yoga', async () => { throw new AccountApiError('Conflict', 409, 'REVISION_CONFLICT') })
  mock.method(accountApi, 'state', async () => serverState(newer, 2))
  assert.equal(await accountStore.getState().saveYogaPractice(practice), false)
  assert.equal(accountStore.getState().yogaPractices[0].name, 'Otro dispositivo')
  assert.equal(accountStore.getState().revision, 2)
  assert.equal(practice.name, 'Pausa')
})

test('an in-flight yoga response cannot repopulate another owner or local data after logout', async () => {
  await accountStore.getState().signIn(a.email, 'x')
  let release!: (result: ServerState) => void
  mock.method(accountApi, 'yoga', () => new Promise<ServerState>(resolve => { release = resolve }))
  const write = accountStore.getState().saveYogaPractice(practice)
  await new Promise(resolve => setImmediate(resolve))
  await accountStore.getState().signOut()
  mock.method(accountApi, 'session', async () => b)
  const login = accountStore.getState().signIn(b.email, 'x')
  release(serverState(yoga, 1))
  assert.equal(await write, false)
  await login
  assert.equal(accountStore.getState().user?.id, b.id)
  assert.deepEqual(accountStore.getState().yogaPractices, [])
  assert.deepEqual(accountStore.getState().yogaLogs, [])
  assert.equal(values.size, 0)
})

test('expired accounts can request removals, but additions and edits never reach the transport', async () => {
  mock.method(accountApi, 'state', async () => serverState(yoga, 2))
  await accountStore.getState().signIn(a.email, 'x')
  accountStore.getState().setAccess({ status: 'expired', cloudWrite: false, trialEndsAt: null, paidThrough: null })
  const save = mock.method(accountApi, 'yoga', async (data: YogaData) => serverState(data, 3))
  assert.equal(await accountStore.getState().saveYogaPractice({ ...practice, name: 'Edit' }), false)
  assert.equal(await accountStore.getState().addYogaLog({ ...log, id: 'new' }), false)
  assert.equal(save.mock.callCount(), 0)
  assert.equal(await accountStore.getState().deleteYogaLog(log.id), true)
  assert.equal(save.mock.callCount(), 1)
  assert.deepEqual(accountStore.getState().yogaLogs, [])
})

test('local observation imports carry yoga logs even without restoring account settings', async () => {
  assert.equal(await accountStore.getState().saveYogaPractice(practice), true)
  assert.equal(await accountStore.getState().addYogaLog(log), true)
  await accountStore.getState().signIn(a.email, 'x')
  const imported = mock.method(accountApi, 'importData', async (...[data, includeSettings, revision, owner]: Parameters<typeof accountApi.importData>) => {
    assert.equal(owner, a.id)
    assert.equal(revision, 0)
    assert.equal(includeSettings, false)
    assert.equal(data.version, 2)
    if (data.version !== 2) throw new Error('Expected personal data')
    assert.deepEqual(data.settings.yoga, yoga)
    return serverState({ practices: [], logs: [log] }, 1)
  })
  assert.equal(await accountStore.getState().importLocalData(false), null)
  assert.equal(imported.mock.callCount(), 1)
  assert.deepEqual(accountStore.getState().yogaPractices, [])
  assert.deepEqual(accountStore.getState().yogaLogs, [log])
})

test('invalid logs and historical rewrites are rejected before persistence', async () => {
  assert.equal(await localStore.getState().addYogaLog(log), true)
  const raw = values.get(LOCAL_PERSONAL_KEY)
  assert.equal(await localStore.getState().addYogaLog({ ...log, durationSeconds: 100 }), false)
  assert.equal(await localStore.getState().addYogaLog({ ...log, notes: 'Rewrite' }), false)
  assert.equal(values.get(LOCAL_PERSONAL_KEY), raw)
  assert.equal(await localStore.getState().addYogaLog(log), true)
  assert.equal(localStore.getState().yogaLogs.length, 1)
})

test('yoga transport uses the dedicated owner-pinned endpoint and ordinary settings omit growing history', async () => {
  const state = serverState(yoga, 1)
  mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, '/api/me/yoga')
    assert.equal(options.method, 'PUT')
    assert.equal(options.credentials, 'same-origin')
    assert.equal((options.headers as Record<string, string>)['X-Klisteni-Account'], a.id)
    assert.deepEqual(JSON.parse(String(options.body)), { yoga, expectedRevision: 0 })
    return new Response(JSON.stringify(state), { headers: { 'Content-Type': 'application/json' } })
  })
  assert.deepEqual(await yogaTransport(yoga, 0, a.id), state)
  mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    assert.equal(JSON.parse(String(options.body)).settings.yoga, undefined)
    return new Response(JSON.stringify(state), { headers: { 'Content-Type': 'application/json' } })
  })
  await settingsTransport(state.data.settings, 1, a.id)
  assert.deepEqual(state.data.settings.yoga, yoga)
})
