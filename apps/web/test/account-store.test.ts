import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { createDefaultPersonalData, type ServerState, type CardioLog } from '@klisteniapp/scene-schema'
import { accountApi, AccountApiError } from '../src/lib/account-api.ts'
import { useAppStore, STORAGE_KEY } from '../src/lib/store.ts'

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
const userA = { id: 'account-a', email: 'a@example.test', name: 'Persona A' }
const userB = { id: 'account-b', email: 'b@example.test', name: 'Persona B' }
const cardio = (id: string): CardioLog => ({ id, date: '2026-10-03', activity: 'walk', minutes: 20 })
const state = (name = 'Persona A', logs: CardioLog[] = [], revision = 0): ServerState => {
  const data = createDefaultPersonalData(name, 'Europe/Paris')
  data.progress.cardio = logs
  return { data, revision }
}
async function setup() {
  mock.restoreAll()
  mock.method(accountApi, 'signOut', async () => null)
  await useAppStore.getState().signOut()
  storage.clear()
  mock.method(accountApi, 'access', async () => ({ status: 'trial' as const, cloudWrite: true, trialEndsAt: '2099-01-01T00:00:00Z', paidThrough: null }))
  mock.method(accountApi, 'signIn', async () => null)
  mock.method(accountApi, 'session', async () => userA)
  mock.method(accountApi, 'state', async () => state())
}

test('private account data never replaces demo storage, and logout restores the demo', async () => {
  await setup()
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, workouts: [], cardio: [cardio('demo')] }))
  mock.method(accountApi, 'state', async () => state('Persona A', [cardio('private')], 1))
  assert.equal(await useAppStore.getState().signIn('a@example.test', 'not-stored'), null)
  assert.equal(useAppStore.getState().progress.cardio[0]?.id, 'private')
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).cardio[0].id, 'demo')
  assert.equal(JSON.parse(useAppStore.getState().exportData()).version, 2)
  await useAppStore.getState().signOut()
  assert.equal(useAppStore.getState().user, null)
  assert.equal(useAppStore.getState().progress.cardio[0]?.id, 'demo')
  assert.equal(JSON.parse(useAppStore.getState().exportData()).version, 1)
  assert.equal([...storage.values.values()].some((value) => value.includes('not-stored')), false)
})

test('durable pending mutation survives logout and only replays for its owner', async () => {
  await setup()
  await useAppStore.getState().signIn('a@example.test', 'x')
  const add = mock.method(accountApi, 'addCardio', async () => { throw new AccountApiError('Sin conexión') })
  assert.equal(await useAppStore.getState().addCardio(cardio('pending-a')), null)
  assert.equal(useAppStore.getState().syncStatus, 'pending')
  assert.equal(useAppStore.getState().pendingCount, 1)
  assert.equal(JSON.parse(useAppStore.getState().exportData()).progress.cardio[0].id, 'pending-a')
  assert.equal(storage.getItem(STORAGE_KEY), null)
  await useAppStore.getState().signOut()
  mock.method(accountApi, 'session', async () => userB)
  mock.method(accountApi, 'state', async () => state('Persona B'))
  await useAppStore.getState().signIn('b@example.test', 'x')
  assert.equal(useAppStore.getState().pendingCount, 0)
  assert.equal(useAppStore.getState().progress.cardio.length, 0)
  assert.equal(add.mock.callCount(), 1)
  await useAppStore.getState().signOut()
  mock.method(accountApi, 'session', async () => userA)
  mock.method(accountApi, 'state', async () => state())
  const replay = mock.method(accountApi, 'addCardio', async (log: CardioLog, id: string) => {
    assert.equal(id, userA.id)
    assert.equal(log.id, 'pending-a')
    return state('Persona A', [log], 1)
  })
  await useAppStore.getState().signIn('a@example.test', 'x')
  assert.equal(replay.mock.callCount(), 1)
  assert.equal(useAppStore.getState().pendingCount, 0)
  assert.equal(useAppStore.getState().syncStatus, 'idle')
  assert.equal([...storage.values.keys()].some((key) => key.startsWith('klisteniapp.pending')), false)
})

test('an old in-flight response cannot populate another account after logout', async () => {
  await setup()
  await useAppStore.getState().signIn('a@example.test', 'x')
  let release!: (result: ServerState) => void
  mock.method(accountApi, 'addCardio', () => new Promise<ServerState>((resolve) => { release = resolve }))
  const inFlight = useAppStore.getState().addCardio(cardio('old-response'))
  await new Promise((resolve) => setImmediate(resolve))
  await useAppStore.getState().signOut()
  mock.method(accountApi, 'session', async () => userB)
  mock.method(accountApi, 'state', async () => state('Persona B'))
  const login = useAppStore.getState().signIn('b@example.test', 'x')
  release(state('Persona A', [cardio('old-response')], 1))
  assert.notEqual(await inFlight, null)
  assert.equal(await login, null)
  assert.equal(useAppStore.getState().user?.id, userB.id)
  assert.deepEqual(useAppStore.getState().progress.cardio, [])
})

test('private loads fail closed and keep local demo history out of the account', async () => {
  await setup()
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, workouts: [], cardio: [cardio('demo')] }))
  mock.method(accountApi, 'state', async () => { throw new AccountApiError('Servicio temporalmente inaccesible', 503) })
  assert.notEqual(await useAppStore.getState().signIn('a@example.test', 'x'), null)
  assert.equal(useAppStore.getState().user?.id, userA.id)
  assert.equal(useAppStore.getState().personalData, null)
  assert.deepEqual(useAppStore.getState().progress.cardio, [])
  assert.notEqual(await useAppStore.getState().addCardio(cardio('blocked')), null)
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).cardio[0].id, 'demo')
})

test('a settings conflict refreshes the canonical state without overwriting it', async () => {
  await setup()
  await useAppStore.getState().signIn('a@example.test', 'x')
  const edited = structuredClone(useAppStore.getState().personalData!.settings)
  edited.profile.displayName = 'My edit'
  const newer = state('Other device', [], 2)
  mock.method(accountApi, 'settings', async () => { throw new AccountApiError('Conflict', 409, 'REVISION_CONFLICT') })
  mock.method(accountApi, 'state', async () => newer)
  assert.notEqual(await useAppStore.getState().saveSettings(edited), null)
  assert.equal(useAppStore.getState().personalData?.settings.profile.displayName, 'Other device')
  assert.equal(useAppStore.getState().revision, 2)
})

test('signed-in display updates preserve personal state and use its captured revision', async () => {
  await setup()
  const original = state('Appearance owner', [cardio('keep-history')], 7)
  original.data.settings.health!.profile.heightCm = 178
  mock.method(accountApi, 'state', async () => original)
  await useAppStore.getState().signIn('a@example.test', 'x')
  const save = mock.method(accountApi, 'settings', async (...[settings, revision, userId]: Parameters<typeof accountApi.settings>) => {
    assert.equal(revision, 7)
    assert.equal(userId, userA.id)
    assert.equal(settings.profile.language, 'fr')
    assert.equal(settings.profile.theme, 'dark')
    assert.equal(settings.profile.colorTheme, 'sunset')
    assert.equal(settings.profile.displayName, 'Appearance owner')
    assert.equal(settings.health?.profile.heightCm, 178)
    assert.deepEqual(settings.routines, original.data.settings.routines)
    return { data: { ...original.data, settings }, revision: 8 }
  })
  assert.equal(await useAppStore.getState().updatePreferences({ language: 'fr', theme: 'dark', colorTheme: 'sunset' }), null)
  assert.equal(save.mock.callCount(), 1)
  assert.equal(useAppStore.getState().revision, 8)
  assert.equal(useAppStore.getState().progress.cardio[0]?.id, 'keep-history')
  assert.equal(useAppStore.getState().preferences.theme, 'dark')
  assert.equal(useAppStore.getState().preferences.colorTheme, 'sunset')
  assert.equal(JSON.parse(useAppStore.getState().exportData()).settings.profile.colorTheme, 'sunset')
  assert.equal(JSON.parse(storage.getItem('klisteniapp.display.v1')!).language, 'fr')
  assert.equal(JSON.parse(storage.getItem('klisteniapp.display.v1')!).colorTheme, 'sunset')
  assert.equal(storage.getItem('klisteniapp.personal.v2'), null)
  assert.equal([...storage.values.values()].some(value => value.includes('heightCm')), false)
})

test('a display conflict reports failure and accepts the refreshed server preferences', async () => {
  await setup()
  await useAppStore.getState().signIn('a@example.test', 'x')
  const newer = state('Newer device', [], 3)
  newer.data.settings.profile.language = 'en'
  newer.data.settings.profile.theme = 'light'
  newer.data.settings.profile.colorTheme = 'graphite'
  mock.method(accountApi, 'settings', async () => { throw new AccountApiError('Conflict', 409, 'REVISION_CONFLICT') })
  mock.method(accountApi, 'state', async () => newer)
  assert.notEqual(await useAppStore.getState().updatePreferences({ language: 'fr', theme: 'dark', colorTheme: 'rose' }), null)
  assert.equal(useAppStore.getState().revision, 3)
  assert.equal(useAppStore.getState().personalData?.settings.profile.displayName, 'Newer device')
  assert.equal(useAppStore.getState().preferences.language, 'en')
  assert.equal(useAppStore.getState().preferences.theme, 'light')
  assert.equal(useAppStore.getState().preferences.colorTheme, 'graphite')
  assert.equal(JSON.parse(storage.getItem('klisteniapp.display.v1')!).colorTheme, 'graphite')
})

test('same stable log ID retries without creating another pending record', async () => {
  await setup()
  await useAppStore.getState().signIn('a@example.test', 'x')
  mock.method(accountApi, 'addCardio', async () => { throw new AccountApiError('Offline') })
  await useAppStore.getState().addCardio(cardio('same-id'))
  await useAppStore.getState().addCardio(cardio('same-id'))
  assert.equal(useAppStore.getState().pendingCount, 1)
  assert.equal(useAppStore.getState().progress.cardio.length, 1)
})

test('an account-cookie mismatch preserves its queue and closes private state', async () => {
  await setup()
  await useAppStore.getState().signIn('a@example.test', 'x')
  mock.method(accountApi, 'addCardio', async (_log: CardioLog, id: string) => {
    assert.equal(id, userA.id)
    throw new AccountApiError('Account changed', 401, 'ACCOUNT_CHANGED')
  })
  assert.notEqual(await useAppStore.getState().addCardio(cardio('owner-a')), null)
  assert.equal(useAppStore.getState().user, null)
  assert.equal(useAppStore.getState().progress.cardio.length, 0)
  assert.equal([...storage.values.keys()].filter((key) => key.startsWith('klisteniapp.pending')).length, 1)
})

test('full account imports default to logs only and require explicit settings flag', async () => {
  await setup()
  await useAppStore.getState().signIn('a@example.test', 'x')
  const include: boolean[] = []
  mock.method(accountApi, 'importData', async (...[, includeSettings, revision, id]: Parameters<typeof accountApi.importData>) => {
    include.push(includeSettings)
    assert.equal(revision, 0)
    assert.equal(id, userA.id)
    return state()
  })
  const raw = JSON.stringify(state().data)
  assert.equal(await useAppStore.getState().importProgress(raw), null)
  assert.equal(await useAppStore.getState().importProgress(raw, true), null)
  assert.deepEqual(include, [false, true])
})

test('account restore synchronizes the saved palette and keeps it available after logout', async () => {
  await setup()
  await useAppStore.getState().signIn('a@example.test', 'x')
  const backup = state('Restored palette', [cardio('restored-history')]).data
  backup.settings.profile.theme = 'dark'
  backup.settings.profile.colorTheme = 'lavender'
  mock.method(accountApi, 'importData', async (...[data, includeSettings, revision, userId]: Parameters<typeof accountApi.importData>) => {
    assert.equal(includeSettings, true)
    assert.equal(revision, 0)
    assert.equal(userId, userA.id)
    assert.equal(data.version, 2)
    assert.deepEqual(data, backup)
    return { data: backup, revision: 1 }
  })
  assert.equal(await useAppStore.getState().importProgress(JSON.stringify(backup), true), null)
  assert.equal(useAppStore.getState().preferences.colorTheme, 'lavender')
  assert.equal(useAppStore.getState().preferences.theme, 'dark')
  assert.deepEqual(JSON.parse(useAppStore.getState().exportData()), backup)
  await useAppStore.getState().signOut()
  assert.equal(useAppStore.getState().preferences.colorTheme, 'lavender')
  assert.equal(useAppStore.getState().preferences.theme, 'dark')
})

test('local-to-account import keeps an explicitly saved palette', async () => {
  await setup()
  assert.equal(await useAppStore.getState().updatePreferences({ colorTheme: 'ocean', theme: 'light' }), null)
  await useAppStore.getState().signIn('a@example.test', 'x')
  const imported = mock.method(accountApi, 'importData', async (...[data, includeSettings, revision, userId]: Parameters<typeof accountApi.importData>) => {
    assert.equal(data.version, 2)
    assert.equal(includeSettings, true)
    assert.equal(revision, 0)
    assert.equal(userId, userA.id)
    if (data.version !== 2) throw new Error('Expected personal data')
    assert.equal(data.settings.profile.colorTheme, 'ocean')
    assert.equal(data.settings.profile.theme, 'light')
    return { data, revision: 1 }
  })
  assert.equal(await useAppStore.getState().importLocalData(true), null)
  assert.equal(imported.mock.callCount(), 1)
  assert.equal(useAppStore.getState().preferences.colorTheme, 'ocean')
})

test('a rejected operation remains downloadable without blocking later valid writes', async () => {
  await setup()
  await useAppStore.getState().signIn('a@example.test', 'x')
  mock.method(accountApi, 'addCardio', async () => { throw new AccountApiError('Registro eliminado previamente', 409, 'LOG_DELETED') })
  assert.notEqual(await useAppStore.getState().addCardio(cardio('rejected')), null)
  assert.equal(useAppStore.getState().pendingCount, 0)
  assert.equal(useAppStore.getState().rejectedCount, 1)
  assert.equal(JSON.parse(useAppStore.getState().exportRejectedData()).operations[0].operation.log.id, 'rejected')
  mock.method(accountApi, 'addCardio', async (log: CardioLog) => state('Persona A', [log], 1))
  assert.equal(await useAppStore.getState().addCardio(cardio('valid')), null)
  assert.deepEqual(useAppStore.getState().progress.cardio.map((log) => log.id), ['valid'])
  await useAppStore.getState().signOut()
  assert.equal(useAppStore.getState().rejectedCount, 0)
  assert.deepEqual(JSON.parse(useAppStore.getState().exportRejectedData()).operations, [])
  await useAppStore.getState().signIn('a@example.test', 'x')
  assert.equal(useAppStore.getState().rejectedCount, 1)
})

test('failed logout hides private state and cannot silently log back in on focus', async () => {
  await setup()
  await useAppStore.getState().signIn('a@example.test', 'x')
  mock.method(accountApi, 'signOut', async () => { throw new AccountApiError('Network failed') })
  assert.notEqual(await useAppStore.getState().signOut(), null)
  const session = mock.method(accountApi, 'session', async () => userA)
  await useAppStore.getState().refreshSession()
  assert.equal(session.mock.callCount(), 0)
  assert.equal(useAppStore.getState().user, null)
  assert.deepEqual(useAppStore.getState().progress.cardio, [])
})

test('expiration preserves pending cloud changes and lets deletions bypass the paused writes', async () => {
  await setup()
  const trial = { status: 'trial' as const, cloudWrite: true, trialEndsAt: '2099-01-01T00:00:00Z', paidThrough: null }
  const expired = { ...trial, status: 'expired' as const, cloudWrite: false }
  mock.method(accountApi, 'access', async () => trial)
  await useAppStore.getState().signIn(userA.email, 'x')
  mock.method(accountApi, 'addCardio', async () => { throw new AccountApiError('Sin conexión') })
  await useAppStore.getState().addCardio(cardio('before-expiry'))
  mock.method(accountApi, 'access', async () => expired)
  await useAppStore.getState().refreshState()
  assert.equal(useAppStore.getState().access?.status, 'expired')
  assert.equal(useAppStore.getState().pendingCount, 1)
  assert.equal(useAppStore.getState().rejectedCount, 0)
  assert.notEqual(await useAppStore.getState().addCardio(cardio('after-expiry')), null)
  assert.equal(useAppStore.getState().pendingCount, 1)
  const remove = mock.method(accountApi, 'removeLog', async () => state())
  await useAppStore.getState().removeLog('obsolete')
  assert.equal(remove.mock.callCount(), 1)
  assert.equal(useAppStore.getState().pendingCount, 1)
  assert.equal(JSON.parse(useAppStore.getState().exportData()).progress.cardio[0].id, 'before-expiry')
  mock.method(accountApi, 'access', async () => ({ ...trial, status: 'lifetime' as const }))
  mock.method(accountApi, 'addCardio', async (log: CardioLog) => state('Persona A', [log], 1))
  await useAppStore.getState().refreshState()
  assert.equal(useAppStore.getState().pendingCount, 0)
  assert.equal(useAppStore.getState().progress.cardio[0]?.id, 'before-expiry')
})

test('a server 402 keeps the original queued operation recoverable instead of rejecting it', async () => {
  await setup()
  await useAppStore.getState().signIn(userA.email, 'x')
  mock.method(accountApi, 'addCardio', async () => { throw new AccountApiError('Acceso vencido', 402, 'CLOUD_ACCESS_REQUIRED') })
  await useAppStore.getState().addCardio(cardio('race-with-expiry'))
  assert.equal(useAppStore.getState().access?.status, 'expired')
  assert.equal(useAppStore.getState().pendingCount, 1)
  assert.equal(useAppStore.getState().rejectedCount, 0)
  assert.equal([...storage.values.keys()].filter(key => key.startsWith('klisteniapp.pending')).length, 1)
  assert.equal(JSON.parse(useAppStore.getState().exportData()).progress.cardio[0].id, 'race-with-expiry')
})
