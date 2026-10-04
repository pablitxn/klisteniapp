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
