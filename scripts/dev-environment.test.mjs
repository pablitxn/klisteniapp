import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setupDev } from './dev-environment.mjs';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'klisteni-dev-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const app of ['b2c-api', 'b2b-api', 'b2c-web']) mkdirSync(join(directory, 'apps', app), { recursive: true });
  return directory;
}

test('repeated setup preserves credentials and uses independent private local databases', t => {
  const directory = fixture(t);
  const first = setupDev(directory);
  const files = ['.env', 'apps/b2c-api/.env.development.local', 'apps/b2b-api/.env.development.local',
    'apps/b2c-web/.env.development.local', '.cache/dev/b2c-login.private.json', '.cache/dev/b2b-password.env'];
  const before = files.map(file => readFileSync(join(directory, file), 'utf8'));
  assert.deepEqual(setupDev(directory), first);
  assert.deepEqual(files.map(file => readFileSync(join(directory, file), 'utf8')), before);
  for (const file of files) assert.equal(statSync(join(directory, file)).mode & 0o777, 0o600);
  assert.notEqual(first.b2c.BETTER_AUTH_SECRET, first.b2b.B2B_AUTH_SECRET);
  assert.equal(new URL(first.b2c.DATABASE_URL).port, '54331');
  assert.equal(new URL(first.b2b.B2B_DATABASE_URL).port, '54332');
});

test('setup refuses conflicting API configuration without overwriting or exposing it', t => {
  const directory = fixture(t);
  setupDev(directory);
  const path = join(directory, 'apps/b2c-api/.env.development.local');
  const value = 'DATABASE_URL=postgresql://private-user:private-password@remote.example/live\n';
  writeFileSync(path, value);
  assert.throws(() => setupDev(directory), error => {
    assert.match(error.message, /conflicting DATABASE_URL/);
    assert.doesNotMatch(error.message, /private-password|remote.example/);
    return true;
  });
  assert.equal(readFileSync(path, 'utf8'), value);
});

test('setup preserves an unrelated root .env and existing API .env', t => {
  const directory = fixture(t);
  const path = join(directory, '.env');
  writeFileSync(path, 'UNRELATED_SETTING=preserve-me\n');
  assert.throws(() => setupDev(directory), /existing settings were preserved/);
  assert.equal(readFileSync(path, 'utf8'), 'UNRELATED_SETTING=preserve-me\n');
  rmSync(path);
  const apiPath = join(directory, 'apps/b2c-api/.env');
  writeFileSync(apiPath, 'DATABASE_URL=postgresql://remote.example/live\n');
  setupDev(directory);
  assert.equal(readFileSync(apiPath, 'utf8'), 'DATABASE_URL=postgresql://remote.example/live\n');
});
