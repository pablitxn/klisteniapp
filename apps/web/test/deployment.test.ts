import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadDeployment, parsePublicProfile } from '../config/deployment.ts'

const profile = { operatorName: 'Example operator', contactEmail: 'contact@example.test', hosting: 'Example hosting', accountRetention: 'Until deletion is requested', backupRetention: '30 days', logRetention: '14 days', analyticsRetention: '90 days', emailProvider: 'Example mail', updatedAt: '2026-10-04' }

test('demo is default and does not read an instance profile or analytics environment', () => {
  assert.deepEqual(loadDeployment({ KLISTENI_PUBLIC_PROFILE_FILE: '/nonexistent/profile.json', VITE_UMAMI_SCRIPT_URL: 'https://unused.example.test/script.js' }, '/'), { instanceMode: false, publicProfile: null })
  assert.throws(() => loadDeployment({ VITE_APP_MODE: 'preview' }, '/'), /VITE_APP_MODE/)
})
test('instance fails closed without a readable, complete public profile', () => {
  assert.throws(() => loadDeployment({ VITE_APP_MODE: 'instance' }, '/'), /requires/)
  assert.throws(() => loadDeployment({ VITE_APP_MODE: 'instance', KLISTENI_PUBLIC_PROFILE_FILE: 'absent.json' }, '/'), /Cannot read/)
  for (const bad of [null, [], {}, { ...profile, contactEmail: 'not an email' }, { ...profile, operatorName: 'x'.repeat(121) }, { ...profile, hosting: 10 }, { ...profile, updatedAt: '2026-02-30' }, { ...profile, updatedAt: 'yesterday' }, { ...profile, operatorName: 'name\nextra' }, { ...profile, accessToken: 'must-not-enter-a-public-bundle' }]) {
    assert.throws(() => parsePublicProfile(bad))
  }
  assert.throws(() => parsePublicProfile(JSON.parse(JSON.stringify(profile).replace(/}$/, ',"__proto__":{}}'))))
})
test('instance embeds only the validated external JSON fields at build time', () => {
  const root = mkdtempSync(join(tmpdir(), 'klisteni-public-profile-'))
  try {
    writeFileSync(join(root, 'profile.json'), JSON.stringify(profile))
    assert.deepEqual(loadDeployment({ VITE_APP_MODE: 'instance', KLISTENI_PUBLIC_PROFILE_FILE: 'profile.json' }, root), { instanceMode: true, publicProfile: profile })
  } finally { rmSync(root, { recursive: true, force: true }) }
})
