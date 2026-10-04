import assert from 'node:assert/strict'
import test from 'node:test'
import { accountApi, AccountApiError } from '../src/lib/account-api.ts'
import { createDefaultPersonalData } from '@klisteniapp/scene-schema'

test('account writes send cookie and captured account guard without credentials in local state', async (t) => {
  const state = { data: createDefaultPersonalData('Test'), revision: 1 }
  const fetch = t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, '/api/me/logs')
    assert.equal(options.credentials, 'same-origin')
    assert.equal(options.cache, 'no-store')
    assert.equal((options.headers as Record<string, string>)['X-Klisteni-Account'], 'owner-a')
    assert.equal((options.headers as Record<string, string>)['Content-Type'], 'application/json')
    assert.equal(JSON.parse(String(options.body)).kind, 'cardio')
    return new Response(JSON.stringify(state), { headers: { 'Content-Type': 'application/json' } })
  })
  const result = await accountApi.addCardio({ id: 'record', date: '2026-10-03', activity: 'walk', minutes: 10 }, 'owner-a')
  assert.deepEqual(result, state)
  assert.equal(fetch.mock.callCount(), 1)
})

test('malformed JSON cannot masquerade as a logged-out session', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{', { headers: { 'Content-Type': 'application/json' } }))
  await assert.rejects(accountApi.session(), (error: unknown) => error instanceof AccountApiError && error.code === 'INVALID_RESPONSE')
})

test('only a valid null JSON session represents anonymous state', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('null', { headers: { 'Content-Type': 'application/json' } }))
  assert.equal(await accountApi.session(), null)
})

test('API preserves authorization failure codes and does not accept invalid personal state', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'Cambió la cuenta', code: 'ACCOUNT_CHANGED' }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
  await assert.rejects(accountApi.state('owner-a'), (error: unknown) => error instanceof AccountApiError && error.status === 401 && error.code === 'ACCOUNT_CHANGED')
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: { version: 2 }, revision: 1 }), { headers: { 'Content-Type': 'application/json' } }))
  await assert.rejects(accountApi.state('owner-a'), (error: unknown) => error instanceof AccountApiError && error.code === 'INVALID_RESPONSE')
})
