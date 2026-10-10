import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../src/config.ts';
const env = { B2B_DATABASE_URL: 'postgres://example@example.test/klisteni_b2b', B2B_AUTH_SECRET: 'b2b-config-test-only-secret-with-length', B2B_APP_ORIGIN: 'http://localhost:4200' };
test('B2B requires dedicated configuration and cannot inherit consumer credentials', () => {
  assert.throws(() => readConfig({ DATABASE_URL: env.B2B_DATABASE_URL, BETTER_AUTH_SECRET: env.B2B_AUTH_SECRET, APP_ORIGIN: env.B2B_APP_ORIGIN }));
  assert.throws(() => readConfig({ ...env, DATABASE_URL: env.B2B_DATABASE_URL }));
  assert.throws(() => readConfig({ ...env, BETTER_AUTH_SECRET: env.B2B_AUTH_SECRET }));
  assert.throws(() => readConfig({ ...env, NODE_ENV: 'production' }));
  assert.throws(() => readConfig({ ...env, B2B_APP_ORIGIN: 'http://localhost:4200/app' }));
  assert.equal(readConfig(env).port, 4201); assert.equal(readConfig(env).demoMode, false);
});
