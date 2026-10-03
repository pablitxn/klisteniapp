import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPayload, consentExpiry, POLICY_VERSION, readConsent, resolveAnalyticsConfig } from '../src/lib/analytics-policy.ts'

const location = { hostname: 'klisteniapp.orchid-labs.xyz', origin: 'https://klisteniapp.orchid-labs.xyz', protocol: 'https:' }
const env = { VITE_UMAMI_SCRIPT_URL: '/umami/script.js', VITE_UMAMI_HOST_URL: '/umami', VITE_UMAMI_WEBSITE_ID: '6dcf08a0-0ddd-44d0-ad57-d41fe5489e6b', VITE_UMAMI_ALLOWED_HOSTNAME: location.hostname }

test('only explicit production configuration on the exact hostname enables analytics', () => {
  assert.ok(resolveAnalyticsConfig(env, location, true))
  assert.equal(resolveAnalyticsConfig(env, location, false), null)
  for (const field of Object.keys(env)) assert.equal(resolveAnalyticsConfig({ ...env, [field]: '' }, location, true), null)
  assert.equal(resolveAnalyticsConfig(env, { ...location, hostname: 'preview.example' }, true), null)
  assert.equal(resolveAnalyticsConfig(env, { ...location, protocol: 'http:' }, true), null)
  assert.equal(resolveAnalyticsConfig({ ...env, VITE_UMAMI_SCRIPT_URL: 'https://user:password@example.org/script.js' }, location, true), null)
})

test('a visit is reconstructed exclusively from public constants', () => {
  assert.deepEqual(buildPayload(resolveAnalyticsConfig(env, location, true)!), { website: env.VITE_UMAMI_WEBSITE_ID, hostname: location.hostname, url: '/', title: 'Klisteni', referrer: '' })
})

test('expired, malformed and different-policy choices require a new decision', () => {
  const now = Date.UTC(2026, 9, 3)
  const record = { choice: 'accepted', version: POLICY_VERSION, expiresAt: consentExpiry(now) }
  assert.deepEqual(readConsent(JSON.stringify(record), now), record)
  for (const raw of ['{broken', 'null', JSON.stringify({ ...record, extra: 'personal' }), JSON.stringify({ ...record, version: 'old' }), JSON.stringify({ ...record, expiresAt: now }), JSON.stringify({ ...record, choice: 'yes' })]) assert.equal(readConsent(raw, now), null)
})

test('six calendar months clamp month ends instead of extending permission', () => {
  assert.equal(new Date(consentExpiry(Date.UTC(2026, 7, 31, 12))).toISOString(), '2027-02-28T12:00:00.000Z')
})
