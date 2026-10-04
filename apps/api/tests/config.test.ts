import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../src/config.ts';

const valid = { DATABASE_URL: 'postgresql://localhost/test', BETTER_AUTH_SECRET: 'a'.repeat(40), APP_ORIGIN: 'http://localhost:5173' };

test('configuration requires explicit credentials, exact origin, and production HTTPS', () => {
  assert.equal(readConfig(valid).port, 3001);
  assert.throws(() => readConfig({ ...valid, BETTER_AUTH_SECRET: 'bad' }), /BETTER_AUTH_SECRET/);
  assert.throws(() => readConfig({ ...valid, APP_ORIGIN: 'http://localhost:5173/' }), /exact HTTP/);
  assert.throws(() => readConfig({ ...valid, NODE_ENV: 'production' }), /HTTPS/);
  assert.equal(readConfig({ ...valid, APP_ORIGIN: 'https://klisteniapp.example', NODE_ENV: 'production' }).production, true);
});

test('configuration errors never echo secrets', () => {
  assert.throws(() => readConfig({ ...valid, DATABASE_URL: 'sensitive-credential-value' }), (error: Error) => {
    assert.doesNotMatch(error.message, /sensitive-credential-value/);
    return true;
  });
});

test('SMTP configuration is optional, requires paired secrets and never permits insecure certificate flags', () => {
  const base = { DATABASE_URL: 'postgresql://test:test@localhost/test', BETTER_AUTH_SECRET: 'test-secret-longer-than-thirty-two-characters', APP_ORIGIN: 'http://localhost:5173' };
  assert.equal(readConfig(base).smtp, undefined);
  assert.throws(() => readConfig({ ...base, SMTP_HOST: 'smtp.example.test' }));
  assert.throws(() => readConfig({ ...base, SMTP_HOST: 'smtp.example.test', SMTP_FROM: 'from@example.test', SMTP_USER: 'user' }));
  assert.throws(() => readConfig({ ...base, SMTP_HOST: 'smtp.example.test', SMTP_FROM: 'Name <from@example.test>' }));
  assert.deepEqual(readConfig({ ...base, SMTP_HOST: 'smtp.example.test', SMTP_FROM: 'from@example.test', SMTP_USER: 'user', SMTP_PASSWORD: 'password' }).smtp, {
    host: 'smtp.example.test', port: 587, secure: false, from: 'from@example.test', user: 'user', password: 'password',
  });
});

test('subscriptions default off and cannot enable live mode or partially configured sandbox', () => {
  assert.equal(readConfig(valid).billing, undefined);
  assert.throws(() => readConfig({ ...valid, BILLING_MODE: 'live' }), /BILLING_MODE/);
  assert.throws(() => readConfig({ ...valid, BILLING_MODE: 'sandbox' }), /Sandbox billing/);
  const sandbox = { ...valid, APP_ORIGIN: 'https://klisteni.test', BILLING_MODE: 'sandbox', MP_ACCESS_TOKEN: 'fake-test-token', MP_WEBHOOK_SECRET: 's'.repeat(32), MP_SANDBOX_PAYER_EMAIL: 'buyer@example.test', MP_MONTHLY_AMOUNT: '100.25', MP_YEARLY_AMOUNT: '1000' };
  assert.equal(readConfig(sandbox).billing?.monthlyAmount, 100.25);
  assert.equal(readConfig(sandbox).billing?.mode, 'sandbox');
  assert.throws(() => readConfig({ ...sandbox, APP_ORIGIN: valid.APP_ORIGIN }), /HTTPS/);
  assert.throws(() => readConfig({ ...sandbox, MP_MONTHLY_AMOUNT: '0' }), /MP_MONTHLY_AMOUNT/);
  assert.throws(() => readConfig({ ...sandbox, MP_YEARLY_AMOUNT: '5.125' }), /MP_YEARLY_AMOUNT/);
  assert.throws(() => readConfig({ ...sandbox, MP_MONTHLY_AMOUNT: 'invalid-private-value' }), (error: Error) => {
    assert.doesNotMatch(error.message, /invalid-private-value|fake-test-token/);
    return true;
  });
});
