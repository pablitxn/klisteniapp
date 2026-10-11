import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { after, before, describe, test } from 'node:test';
import type { Server } from 'node:http';
import { createServer as createTcpServer, type AddressInfo } from 'node:net';
import { Pool } from 'pg';
import { createDefaultPersonalData, createEmptyHealthData, ExerciseIdSchema, HEALTH_DATA_MAX_BYTES, HealthDataSchema, type ServerState } from '@klisteniapp/scene-schema';
import { createAuth } from '../src/auth.ts';
import { createPool } from '../src/database.ts';
import type { Config } from '../src/config.ts';
import { createApiServer } from '../src/http.ts';
import { migrate } from '../src/migrate.ts';
import { createProvisionedUser, operateUser } from '../src/operator-service.ts';
import { LogRequestSchema, StateRepository, lockUser } from '../src/state.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
const password = 'test-only-password-123';
const cardio = (id = randomUUID() as string) => ({ id, date: '2026-10-05', activity: 'walk' as const, minutes: 30 });

describe('PostgreSQL account API', { skip: !databaseUrl }, () => {
  let admin: Pool;
  let pool: Pool;
  let server: Server;
  let base: string;
  let config: Config;
  let auth: ReturnType<typeof createAuth>;
  let ipSequence = 1;
  const schema = `klisteni_test_${randomUUID().replaceAll('-', '')}`;

  before(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scopedUrl = new URL(databaseUrl!);
    scopedUrl.searchParams.set('options', `-c search_path=${schema}`);
    config = { databaseUrl: scopedUrl.href, secret: 'integration-test-only-secret-1234567890', origin: 'http://localhost:5173', host: '127.0.0.1', port: 3001, production: false, trustedClientIpHeader: 'x-test-ip' };
    pool = createPool(config);
    auth = createAuth(pool, config);
    await migrate(pool, auth);
    // Running migrations twice must preserve both schema and data.
    await migrate(pool, auth);
    server = createApiServer({ pool, auth, config, repository: new StateRepository(pool, () => new Date('2026-10-07T12:00:00Z')) });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool?.end();
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
  });

  async function makeUser() {
    const email = `test-${randomUUID()}@example.test`;
    const user = await createProvisionedUser(pool, config, { email, name: 'Test user', password });
    const ip = `192.0.2.${ipSequence++}`;
    let cookie = '';
    async function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
      const result = await fetch(`${base}${path}`, {
        method,
        headers: { origin: config.origin, 'content-type': 'application/json', 'x-test-ip': ip, 'x-klisteni-account': user.id, cookie, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const setCookies = result.headers.getSetCookie();
      if (setCookies.length) cookie = setCookies.map((value) => value.split(';', 1)[0]).join('; ');
      return result;
    }
    async function login(value = password) { return request('POST', '/api/auth/sign-in/email', { email, password: value }); }
    const loginResponse = await login();
    assert.equal(loginResponse.status, 200, await loginResponse.text());
    assert.match(cookie, /klisteniapp\.session_token=/);
    return { user, email, ip, request, login, cookie: () => cookie, state: async () => {
      const response = await request('GET', '/api/me/state');
      assert.equal(response.status, 200, await response.clone().text());
      return await response.json() as ServerState;
    } };
  }

  test('yoga endpoint persists owner-scoped snapshots, rejects stale input and allows only deletion after expiry', async () => {
    const a = await makeUser(), b = await makeUser();
    const initial = await a.state();
    const practice = { id: 'yoga-practice', name: 'Pausa', intention: '', steps: [{ id: 'step', asanaId: 'savasana', durationSeconds: 60, side: 'both' }] };
    const log = { id: 'yoga-log', date: '2026-10-07', completedAt: '2026-10-07T10:00:00Z', practiceSnapshot: practice, completedSteps: [{ stepId: 'step', asanaId: 'savasana', durationSeconds: 20, side: 'both' }], durationSeconds: 20 };
    const yoga = { practices: [practice], logs: [log] };
    const response = await a.request('PUT', '/api/me/yoga', { yoga, expectedRevision: initial.revision });
    assert.equal(response.status, 200, await response.clone().text());
    const saved = await response.json() as ServerState;
    assert.deepEqual(saved.data.settings.yoga, yoga);
    assert.equal((await b.state()).data.settings.yoga, undefined);
    assert.equal((await a.request('PUT', '/api/me/yoga', { yoga, expectedRevision: initial.revision })).status, 409);
    assert.equal((await a.request('PUT', '/api/me/yoga', { yoga: { ...yoga, logs: [{ ...log, durationSeconds: 99 }] }, expectedRevision: saved.revision })).status, 400);
    assert.equal((await a.request('PUT', '/api/me/yoga', { yoga, expectedRevision: saved.revision }, { 'x-klisteni-account': b.user.id })).status, 401);
    await pool.query('UPDATE account_access SET lifetime = false, trial_ends_at = $2, paid_through = NULL WHERE user_id = $1', [a.user.id, new Date('2020-01-01T00:00:00Z')]);
    assert.equal((await a.request('PUT', '/api/me/yoga', { yoga: { practices: [{ ...practice, name: 'Edit' }], logs: [log] }, expectedRevision: saved.revision })).status, 402);
    const deleted = await a.request('PUT', '/api/me/yoga', { yoga: { practices: [], logs: [] }, expectedRevision: saved.revision });
    assert.equal(deleted.status, 200, await deleted.clone().text());
    assert.deepEqual((await a.state()).data.settings.yoga, { practices: [], logs: [] });
    for (const staleYoga of [{ practices: [], logs: [] }, yoga]) {
      const retry = await a.request('PUT', '/api/me/yoga', { yoga: staleYoga, expectedRevision: saved.revision });
      assert.equal(retry.status, 409, await retry.clone().text());
      assert.equal((await retry.json()).code, 'REVISION_CONFLICT');
    }
    assert.deepEqual((await a.state()).data.settings.yoga, { practices: [], logs: [] });
  });

  test('yoga HTTP accepts a history above the default body limit and rejects oversized bodies without changing state', async () => {
    const account = await makeUser();
    const initial = await account.state();
    const practice = { id: 'large-practice', name: 'Pausa', intention: '', steps: [{ id: 'step', asanaId: 'savasana', durationSeconds: 60, side: 'both' }] };
    const logs = Array.from({ length: 180 }, (_, index) => ({
      id: `large-log-${index}`, date: '2026-10-07', completedAt: '2026-10-07T10:00:00Z', practiceSnapshot: practice,
      completedSteps: [{ stepId: 'step', asanaId: 'savasana', durationSeconds: 20, side: 'both' }], durationSeconds: 20, notes: 'a'.repeat(3000),
    }));
    const yoga = { practices: [practice], logs };
    assert.ok(Buffer.byteLength(JSON.stringify(yoga)) > 512 * 1024);
    const response = await account.request('PUT', '/api/me/yoga', { yoga, expectedRevision: initial.revision });
    assert.equal(response.status, 200, await response.clone().text());
    const saved = await response.json() as ServerState;
    assert.deepEqual(saved.data.settings.yoga, yoga);
    const tooLarge = await account.request('PUT', '/api/me/yoga', { yoga, expectedRevision: saved.revision, padding: 'x'.repeat(5 * 1024 * 1024) });
    assert.equal(tooLarge.status, 413, await tooLarge.clone().text());
    assert.equal((await tooLarge.json()).code, 'BODY_TOO_LARGE');
    assert.deepEqual(await account.state(), saved);
  });

  test('yoga imports roll back other observations on conflict and preserve yoga on legacy restore', async () => {
    const account = await makeUser();
    const initial = await account.state();
    const practice = { id: 'import-practice', name: 'Pausa', intention: '', steps: [{ id: 'step', asanaId: 'savasana', durationSeconds: 60, side: 'both' }] };
    const log = { id: 'import-log', date: '2026-10-07', completedAt: '2026-10-07T10:00:00Z', practiceSnapshot: practice, completedSteps: [{ stepId: 'step', asanaId: 'savasana', durationSeconds: 20, side: 'both' }], durationSeconds: 20 };
    const created = await account.request('PUT', '/api/me/yoga', { yoga: { practices: [practice], logs: [log] }, expectedRevision: initial.revision });
    assert.equal(created.status, 200, await created.clone().text());
    const saved = await created.json() as ServerState;
    const backup = createDefaultPersonalData('Backup', 'UTC');
    backup.progress.cardio = [cardio('rollback-cardio')];
    backup.settings.yoga = { ...saved.data.settings.yoga!, logs: [{ ...saved.data.settings.yoga!.logs[0], notes: 'Conflicting history' }] };
    const conflict = await account.request('POST', '/api/me/import', { data: backup, includeSettings: false });
    assert.equal(conflict.status, 409, await conflict.clone().text());
    assert.equal((await conflict.json()).code, 'YOGA_LOG_CONFLICT');
    assert.deepEqual(await account.state(), saved, 'cardio inserted earlier in the import must also roll back');
    const legacy = structuredClone(saved.data);
    delete legacy.settings.yoga;
    legacy.settings.profile.displayName = 'Legacy restore';
    const restored = await account.request('POST', '/api/me/import', { data: legacy, includeSettings: true, expectedRevision: saved.revision });
    assert.equal(restored.status, 200, await restored.clone().text());
    const result = await restored.json() as ServerState;
    assert.equal(result.data.settings.profile.displayName, 'Legacy restore');
    assert.deepEqual(result.data.settings.yoga, saved.data.settings.yoga);
  });

  test('health, readiness, private route authentication and no registration', async () => {
    assert.equal((await fetch(`${base}/api/healthz`)).status, 200);
    assert.equal((await fetch(`${base}/api/readyz`)).status, 200);
    assert.equal((await fetch(`${base}/api/me/state`)).status, 401);
    for (const path of ['/api/auth/sign-up/email', '/api/auth/admin/create-user', '/api/auth/request-password-reset']) {
      const response = await fetch(`${base}${path}`, { method: 'POST', headers: { origin: config.origin, 'content-type': 'application/json' }, body: '{}' });
      assert.equal(response.status, 404);
    }
    await assert.rejects(auth.api.signUpEmail({ body: { email: 'no-registration@example.test', name: 'Denied', password } }));
  });

  test('readiness fails when application schema has not been migrated', async () => {
    const emptySchema = `${schema}_empty`;
    await admin.query(`CREATE SCHEMA ${emptySchema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set('options', `-c search_path=${emptySchema}`);
    const emptyPool = createPool({ databaseUrl: url.href });
    const unready = createApiServer({ pool: emptyPool, auth, config });
    try {
      await new Promise<void>((resolve) => unready.listen(0, '127.0.0.1', resolve));
      const unreadyBase = `http://127.0.0.1:${(unready.address() as AddressInfo).port}`;
      assert.equal((await fetch(`${unreadyBase}/api/healthz`)).status, 200);
      assert.equal((await fetch(`${unreadyBase}/api/readyz`)).status, 503);
    } finally {
      await new Promise<void>((resolve) => unready.close(() => resolve()));
      await emptyPool.end();
      await admin.query(`DROP SCHEMA ${emptySchema}`);
    }
  });

  test('cookies are HttpOnly and same-site, API has no-store and enforces mutation origin', async () => {
    const user = await makeUser();
    const response = await user.login();
    assert.match(response.headers.getSetCookie().join('; '), /HttpOnly/i);
    assert.match(response.headers.getSetCookie().join('; '), /SameSite=Lax/i);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    for (const origin of ['', 'https://evil.example', 'http://sub.localhost:5173']) {
      assert.equal((await user.request('POST', '/api/me/logs', { kind: 'cardio', log: cardio() }, { origin })).status, 403);
      assert.equal((await user.request('POST', '/api/auth/sign-in/email', { email: user.email, password }, { origin })).status, 403);
    }
    assert.equal((await user.request('POST', '/api/me/logs', {}, { 'content-type': 'text/plain' })).status, 415);
    assert.equal((await user.state()).data.progress.cardio.length, 0);
  });

  test('account ownership and stale-tab guards never allow cross-account data access', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const log = cardio('owned-log');
    assert.equal((await a.request('POST', '/api/me/logs', { kind: 'cardio', log })).status, 200);
    assert.equal((await b.state()).data.progress.cardio.length, 0);
    const wrongAccount = await b.request('POST', '/api/me/logs', { kind: 'cardio', log }, { 'x-klisteni-account': a.user.id });
    assert.equal(wrongAccount.status, 401);
    assert.equal((await wrongAccount.json()).code, 'ACCOUNT_CHANGED');
    assert.equal((await a.request('GET', '/api/me/state', undefined, { 'x-klisteni-account': '' })).status, 401);
    for (const [method, path, body] of [
      ['GET', '/api/auth/list-sessions', undefined],
      ['POST', '/api/auth/revoke-other-sessions', {}],
      ['POST', '/api/auth/revoke-session', { token: 'irrelevant' }],
      ['POST', '/api/auth/change-password', { currentPassword: password, newPassword: 'stale-tab-password-999' }],
      ['POST', '/api/auth/sign-out', {}],
    ] as const) {
      const stale = await b.request(method, path, body, { 'x-klisteni-account': a.user.id });
      assert.equal(stale.status, 401);
      assert.equal((await stale.json()).code, 'ACCOUNT_CHANGED');
    }
    assert.equal((await b.request('GET', '/api/me/state')).status, 200);
    assert.equal((await b.request('DELETE', '/api/me/logs/owned-log')).status, 200);
    assert.equal((await a.state()).data.progress.cardio.length, 1);
    assert.equal((await b.request('POST', '/api/me/logs', { kind: 'cardio', log: cardio(), userId: a.user.id })).status, 400);
  });

  test('log writes are idempotent, conflicting IDs fail, and tombstones block resurrection', async () => {
    const user = await makeUser();
    const log = cardio('stable-id');
    const first = await (await user.request('POST', '/api/me/logs', { kind: 'cardio', log })).json() as ServerState;
    const retry = await (await user.request('POST', '/api/me/logs', { kind: 'cardio', log })).json() as ServerState;
    assert.equal(first.revision, retry.revision);
    assert.equal((await user.request('POST', '/api/me/logs', { kind: 'cardio', log: { ...log, minutes: 45 } })).status, 409);
    assert.equal((await user.request('DELETE', '/api/me/logs/stable-id')).status, 200);
    assert.equal((await user.request('POST', '/api/me/logs', { kind: 'cardio', log })).status, 409);
    const deleted = await user.state();
    const repeatedDelete = await (await user.request('DELETE', '/api/me/logs/stable-id')).json() as ServerState;
    assert.equal(repeatedDelete.revision, deleted.revision);
    assert.equal((await user.request('DELETE', '/api/me/logs/arrives-later')).status, 200);
    assert.equal((await user.request('POST', '/api/me/logs', { kind: 'cardio', log: cardio('arrives-later') })).status, 409);
    assert.equal((await user.state()).data.progress.cardio.length, 0);
  });

  test('workout log body limit accepts valid sessions above 32 KiB and rejects bodies above 64 KiB', async () => {
    const user = await makeUser();
    const payload = LogRequestSchema.parse({
      kind: 'workout',
      log: {
        id: 'w'.repeat(200), date: '2026-10-05', completedAt: '2026-10-05T12:00:00Z',
        exercises: Array.from({ length: 500 }, () => ({ exerciseId: 'quadruped-leg-extension', sets: 30, reps: 1000 })),
        durationMinutes: 1440, timeZone: 'Europe/Paris',
        routineSnapshot: { id: 'r'.repeat(200), name: 'N'.repeat(100), exerciseIds: ExerciseIdSchema.options, sets: 10 },
      },
    });
    const size = Buffer.byteLength(JSON.stringify(payload));
    assert.ok(size > 32 * 1024 && size < 64 * 1024, `Expected a valid payload between 32 and 64 KiB, got ${size} bytes`);
    const response = await user.request('POST', '/api/me/logs', payload);
    assert.equal(response.status, 200, await response.clone().text());
    const saved = await user.state();
    assert.deepEqual(saved.data.progress.workouts, [payload.log]);

    // Whitespace keeps the JSON and its schema valid, isolating the HTTP size guard.
    const oversizedJson = JSON.stringify({ ...payload, log: { ...payload.log, id: 'too-large' } });
    const oversizedBody = oversizedJson + ' '.repeat(64 * 1024 + 1 - Buffer.byteLength(oversizedJson));
    assert.equal(Buffer.byteLength(oversizedBody), 64 * 1024 + 1);
    assert.ok(LogRequestSchema.safeParse(JSON.parse(oversizedBody)).success);
    const oversized = await fetch(`${base}/api/me/logs`, {
      method: 'POST',
      headers: { origin: config.origin, 'content-type': 'application/json', 'x-test-ip': user.ip, 'x-klisteni-account': user.user.id, cookie: user.cookie() },
      body: oversizedBody,
    });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).code, 'BODY_TOO_LARGE');
    assert.deepEqual(await user.state(), saved);
  });

  test('concurrent devices append without loss and settings reject stale revisions', async () => {
    const user = await makeUser();
    const responses = await Promise.all(Array.from({ length: 8 }, (_, index) => user.request('POST', '/api/me/logs', { kind: 'cardio', log: cardio(`parallel-${index}`) })));
    assert.ok(responses.every((response) => response.status === 200));
    const initial = await user.state();
    assert.equal(initial.data.progress.cardio.length, 8);
    const updates = await Promise.all(['First', 'Second'].map((displayName) => user.request('PUT', '/api/me/settings', {
      expectedRevision: initial.revision,
      settings: { ...initial.data.settings, profile: { ...initial.data.settings.profile, displayName } },
    })));
    assert.deepEqual(updates.map((response) => response.status).sort(), [200, 409]);
    assert.equal((await user.state()).data.progress.cardio.length, 8);
  });

  test('private health roundtrips with provenance, account isolation and revision conflicts', async () => {
    const a = await makeUser(); const b = await makeUser();
    const initial = await a.state();
    const health = createEmptyHealthData();
    health.profile = { heightCm: 180, context: 'Información privada' };
    health.measurements = [{ id: 'body-1', date: '2026-10-01', recordedAt: '2026-10-01T10:00:00Z', source: { kind: 'samsung-health', device: 'Galaxy Watch8', externalId: 'native-1' }, weightKg: 80, bodyFatPercent: 22, skeletalMuscleKg: 31, waistCm: 96 }];
    health.goals = [{ id: 'goal-1', title: 'Mi meta elegida', metric: 'waistCm', target: 92, startDate: '2026-10-01' }];
    const response = await a.request('PUT', '/api/me/health', { health, expectedRevision: initial.revision });
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const saved = await response.json() as ServerState;
    assert.deepEqual(saved.data.settings.health, health);
    assert.deepEqual(saved.data.settings.routines, initial.data.settings.routines);
    assert.deepEqual((await b.state()).data.settings.health, createEmptyHealthData());
    assert.equal((await b.request('PUT', '/api/me/health', { health, expectedRevision: 0 }, { 'x-klisteni-account': a.user.id })).status, 401);
    assert.equal((await a.request('PUT', '/api/me/health', { health, expectedRevision: initial.revision })).status, 409);
    const repeated = await (await a.request('PUT', '/api/me/health', { health, expectedRevision: saved.revision })).json() as ServerState;
    assert.equal(repeated.revision, saved.revision);
    assert.deepEqual((await a.state()).data.settings.health, health);
    const concurrent = await Promise.all([181, 182].map((heightCm) => a.request('PUT', '/api/me/health', { health: { ...health, profile: { heightCm } }, expectedRevision: saved.revision })));
    assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 409]);
  });

  test('old settings and legacy backups cannot erase health or rewrite begun plans', async () => {
    const user = await makeUser();
    const state = await user.state();
    const health = createEmptyHealthData(); health.profile = { heightCm: 179 };
    const saved = await (await user.request('PUT', '/api/me/health', { health, expectedRevision: state.revision })).json() as ServerState;
    const legacySettings = structuredClone(saved.data.settings);
    delete legacySettings.health;
    const plans = [{ id: 'plan-health', effectiveFrom: '2026-10-05', weekdays: [1, 3, 5], routineId: 'starter' }];
    const changed = await user.request('PUT', '/api/me/settings', { settings: { ...legacySettings, plans, profile: { ...legacySettings.profile, displayName: 'Nuevo nombre' } }, expectedRevision: saved.revision });
    assert.equal(changed.status, 200, await changed.clone().text());
    const withPlan = await changed.json() as ServerState;
    assert.deepEqual(withPlan.data.settings.health, health);
    const legacyBackup = { ...withPlan.data, settings: { ...legacySettings, plans } };
    const imported = await user.request('POST', '/api/me/import', { data: legacyBackup, includeSettings: true, expectedRevision: withPlan.revision });
    assert.equal(imported.status, 200, await imported.clone().text());
    assert.deepEqual((await user.state()).data.settings.health, health);
    const latest = await user.state();
    assert.equal((await user.request('PUT', '/api/me/settings', { settings: { ...latest.data.settings, plans: [] }, expectedRevision: latest.revision })).status, 409);
    const cleared = await user.request('PUT', '/api/me/health', { health: createEmptyHealthData(), expectedRevision: latest.revision });
    assert.equal(cleared.status, 200);
    const result = await cleared.json() as ServerState;
    assert.deepEqual(result.data.settings.plans, plans);
    assert.deepEqual(result.data.settings.health, createEmptyHealthData());
  });

  test('health backup import merges observations idempotently and preserves profile/goals unless requested', async () => {
    const user = await makeUser(); const initial = await user.state();
    const health = createEmptyHealthData(); health.profile.heightCm = 170;
    health.measurements = [{ id: 'existing-health', date: '2026-10-01', recordedAt: '2026-10-01T10:00:00Z', source: { kind: 'health-connect', externalId: 'provider-1' }, weightKg: 75 }];
    await user.request('PUT', '/api/me/health', { health, expectedRevision: initial.revision });
    const incoming = createEmptyHealthData(); incoming.profile.heightCm = 190;
    incoming.measurements = [{ ...health.measurements[0], id: 'exporter-renamed-id' }, { ...health.measurements[0], id: 'new-health', source: { kind: 'manual' }, date: '2026-10-02', weightKg: 74.8 }];
    incoming.goals = [{ id: 'g-import', title: 'Objetivo del archivo', metric: 'weightKg', target: 70, startDate: '2026-10-01' }];
    const backup = createDefaultPersonalData('Imported'); backup.settings.health = incoming;
    backup.progress.cardio = [cardio('health-import-cardio')];
    const imported = await user.request('POST', '/api/me/import', { data: backup });
    assert.equal(imported.status, 200, await imported.clone().text());
    const saved = await imported.json() as ServerState;
    assert.equal(saved.data.settings.health!.measurements.length, 2);
    assert.equal(saved.data.settings.health!.profile.heightCm, 170);
    assert.deepEqual(saved.data.settings.health!.goals, []);
    const retry = await (await user.request('POST', '/api/me/import', { data: backup })).json() as ServerState;
    assert.equal(retry.revision, saved.revision);
    const conflict = structuredClone(backup);
    conflict.settings.health!.measurements[0].weightKg = 71;
    conflict.progress.cardio.push(cardio('atomic-not-added'));
    assert.equal((await user.request('POST', '/api/me/import', { data: conflict })).status, 409);
    assert.deepEqual(await user.state(), saved);
    const restored = await user.request('POST', '/api/me/import', { data: backup, includeSettings: true, expectedRevision: saved.revision });
    assert.equal(restored.status, 200, await restored.clone().text());
    assert.equal((await user.state()).data.settings.health!.profile.heightCm, 190);
    assert.deepEqual((await user.state()).data.settings.health!.goals, incoming.goals);
  });

  test('health writes reject invalid, duplicate and future observations through every input route', async () => {
    const user = await makeUser(); const initial = await user.state();
    const health = createEmptyHealthData();
    const entry = { id: 'body-safe', date: '2026-10-01', recordedAt: '2026-10-01T10:00:00Z', source: { kind: 'manual' as const }, weightKg: 80 };
    for (const measurements of [
      [{ ...entry, date: '2027-01-01' }], [{ ...entry, recordedAt: '2027-01-01T00:00:00Z' }],
      [{ ...entry, bodyFatPercent: 101 }], [entry, entry], [{ ...entry, weightLbs: 180 }],
    ]) {
      const invalid = { ...health, measurements };
      assert.equal((await user.request('PUT', '/api/me/health', { health: invalid, expectedRevision: initial.revision })).status, 400);
      assert.equal((await user.request('PUT', '/api/me/settings', { settings: { ...initial.data.settings, health: invalid }, expectedRevision: initial.revision })).status, 400);
      assert.equal((await user.request('POST', '/api/me/import', { data: { ...initial.data, settings: { ...initial.data.settings, health: invalid } } })).status, 400);
      assert.deepEqual(await user.state(), initial);
    }
    assert.equal((await user.request('PUT', '/api/me/health', { health, expectedRevision: initial.revision, userId: 'another' })).status, 400);
  });

  test('activity may link only to this account workouts and links survive later workout deletion', async () => {
    const a = await makeUser(); const b = await makeUser();
    const workout = { id: 'linked-strength', date: '2026-10-01', completedAt: '2026-10-01T10:00:00Z', exercises: [{ exerciseId: 'pushup', sets: 2, reps: 8 }], durationMinutes: 20 };
    await a.request('POST', '/api/me/logs', { kind: 'workout', log: workout });
    const health = createEmptyHealthData();
    health.activity = [{ id: 'activity-linked', date: '2026-10-01', recordedAt: '2026-10-01T10:00:00Z', source: { kind: 'manual' }, workoutId: workout.id, averageHeartRateBpm: 120 }];
    const aState = await a.state(); const bState = await b.state();
    assert.equal((await b.request('PUT', '/api/me/health', { health, expectedRevision: bState.revision })).status, 400);
    assert.equal((await a.request('PUT', '/api/me/health', { health, expectedRevision: aState.revision })).status, 200);
    assert.equal((await a.request('DELETE', `/api/me/logs/${workout.id}`)).status, 200);
    const current = await a.state();
    assert.equal(current.data.settings.health!.activity[0].workoutId, workout.id);
    assert.equal((await a.request('PUT', '/api/me/health', { health, expectedRevision: current.revision })).status, 200);
    const newLink = { ...health, activity: [...health.activity, { ...health.activity[0], id: 'cannot-add-deleted-link' }] };
    assert.equal((await a.request('PUT', '/api/me/health', { health: newLink, expectedRevision: current.revision })).status, 400);
    assert.deepEqual(await a.state(), current);
  });

  test('export after workout deletion restores every health observation and repeat imports stay idempotent', async () => {
    const original = await makeUser();
    const workout = { id: 'export-deleted-workout', date: '2026-10-01', completedAt: '2026-10-01T10:00:00Z', exercises: [{ exerciseId: 'pushup', sets: 2, reps: 8 }], durationMinutes: 20 };
    await original.request('POST', '/api/me/logs', { kind: 'workout', log: workout });
    const health = createEmptyHealthData();
    health.activity = [{ id: 'portable-activity', date: '2026-10-01', recordedAt: '2026-10-01T10:00:00Z', source: { kind: 'health-connect', externalId: 'portable-provider' }, workoutId: workout.id, averageHeartRateBpm: 120, notes: 'Se conserva toda la observación' }];
    await original.request('PUT', '/api/me/health', { health, expectedRevision: (await original.state()).revision });
    await original.request('DELETE', `/api/me/logs/${workout.id}`);
    // exportData serializes this confirmed account state, which excludes deleted workouts.
    const exported = JSON.parse(JSON.stringify((await original.state()).data));
    assert.deepEqual(exported.progress.workouts, []);
    assert.equal(exported.settings.health.activity[0].workoutId, workout.id);
    const expectedActivity = { ...health.activity[0] };
    delete expectedActivity.workoutId;
    for (const includeSettings of [false, true]) {
      const destination = await makeUser();
      const initial = await destination.state();
      const response = await destination.request('POST', '/api/me/import', { data: exported, includeSettings, expectedRevision: initial.revision });
      assert.equal(response.status, 200, await response.clone().text());
      const saved = await response.json() as ServerState;
      assert.deepEqual(saved.data.settings.health!.activity, [expectedActivity]);
      assert.deepEqual(saved.data.progress.workouts, []);
      const repeated = await destination.request('POST', '/api/me/import', { data: exported, includeSettings, expectedRevision: saved.revision });
      assert.equal(repeated.status, 200, await repeated.clone().text());
      assert.deepEqual(await repeated.json(), saved);
      assert.equal((await destination.request('PUT', '/api/me/health', { health, expectedRevision: saved.revision })).status, 400);
    }
    const prior = await original.state();
    const repeatedOriginal = await original.request('POST', '/api/me/import', { data: exported });
    assert.equal(repeatedOriginal.status, 200);
    assert.deepEqual(await repeatedOriginal.json(), prior);
  });

  test('import resolves links only against active own workouts and does not resurrect tombstones', async () => {
    const other = await makeUser(); const destination = await makeUser();
    const workout = { id: 'foreign-or-missing', date: '2026-10-01', completedAt: '2026-10-01T10:00:00Z', exercises: [{ exerciseId: 'pushup' as const, sets: 2, reps: 8 }], durationMinutes: 20 };
    await other.request('POST', '/api/me/logs', { kind: 'workout', log: workout });
    const backup = createDefaultPersonalData('Portable');
    backup.settings.health!.activity = [{ id: 'foreign-activity', date: workout.date, recordedAt: workout.completedAt, source: { kind: 'manual' }, workoutId: workout.id, averageHeartRateBpm: 125 }];
    let response = await destination.request('POST', '/api/me/import', { data: backup });
    assert.equal(response.status, 200);
    assert.equal((await response.json() as ServerState).data.settings.health!.activity[0].workoutId, undefined);
    const deletedId = 'imported-tombstone';
    await destination.request('DELETE', `/api/me/logs/${deletedId}`);
    const incoming = createDefaultPersonalData('Portable');
    incoming.progress.workouts = [{ ...workout, id: deletedId }, { ...workout, id: 'available-imported' }];
    incoming.settings.health!.activity = [
      { ...backup.settings.health!.activity[0], id: 'deleted-activity', workoutId: deletedId },
      { ...backup.settings.health!.activity[0], id: 'available-activity', workoutId: 'available-imported' },
    ];
    const before = await destination.state();
    response = await destination.request('POST', '/api/me/import', { data: incoming });
    assert.equal(response.status, 409);
    assert.deepEqual(await destination.state(), before);
    // A normal export omits the deleted workout but may retain the historical link.
    incoming.progress.workouts = incoming.progress.workouts.filter(({ id }) => id !== deletedId);
    response = await destination.request('POST', '/api/me/import', { data: incoming });
    assert.equal(response.status, 200, await response.clone().text());
    const saved = await response.json() as ServerState;
    assert.deepEqual(saved.data.progress.workouts.map(({ id }) => id), ['available-imported']);
    assert.equal(saved.data.settings.health!.activity.find(({ id }) => id === 'deleted-activity')!.workoutId, undefined);
    assert.equal(saved.data.settings.health!.activity.find(({ id }) => id === 'available-activity')!.workoutId, 'available-imported');
    assert.deepEqual((await other.state()).data.progress.workouts, [workout]);
  });

  test('individually valid backup imports cannot grow health beyond its editable size and fail atomically', async () => {
    const user = await makeUser();
    const batch = (prefix: string) => {
      const data = createDefaultPersonalData('Portable');
      data.settings.health!.measurements = Array.from({ length: 600 }, (_, index) => ({ id: `${prefix}-${index}`, date: '2026-10-01', recordedAt: '2026-10-01T10:00:00Z', source: { kind: 'manual' as const }, weightKg: 80, notes: 'á'.repeat(1900) }));
      assert.equal(HealthDataSchema.safeParse(data.settings.health).success, true);
      assert.ok(Buffer.byteLength(JSON.stringify({ data })) < 5 * 1024 * 1024);
      return data;
    };
    const first = batch('first'); const second = batch('second');
    assert.ok(Buffer.byteLength(JSON.stringify(first.settings.health)) + Buffer.byteLength(JSON.stringify(second.settings.health)) > HEALTH_DATA_MAX_BYTES);
    assert.equal((await user.request('POST', '/api/me/import', { data: first })).status, 200);
    const saved = await user.state();
    second.progress.cardio = [cardio('size-failure-atomic-log')];
    for (const includeSettings of [false, true]) {
      const response = await user.request('POST', '/api/me/import', { data: second, includeSettings, expectedRevision: saved.revision });
      assert.equal(response.status, 400, await response.clone().text());
      assert.deepEqual(await user.state(), saved);
    }
    const smaller = structuredClone(saved.data.settings.health!);
    smaller.measurements.pop();
    assert.equal((await user.request('PUT', '/api/me/health', { health: smaller, expectedRevision: saved.revision })).status, 200);
    assert.equal((await user.state()).data.settings.health!.measurements.length, 599);
  });

  test('legacy import merges atomically and reimport is idempotent', async () => {
    const user = await makeUser();
    const existing = cardio('existing');
    await user.request('POST', '/api/me/logs', { kind: 'cardio', log: existing });
    const before = await user.state();
    const collision = await user.request('POST', '/api/me/import', { data: { version: 1, workouts: [], cardio: [cardio('new'), { ...existing, minutes: 90 }] } });
    assert.equal(collision.status, 409);
    assert.deepEqual(await user.state(), before);
    const imported = { data: { version: 1, workouts: [], cardio: [existing, cardio('new')] } };
    assert.equal((await user.request('POST', '/api/me/import', imported)).status, 200);
    const once = await user.state();
    assert.equal((await user.request('POST', '/api/me/import', imported)).status, 200);
    assert.deepEqual(await user.state(), once);
    await user.request('DELETE', '/api/me/logs/new');
    assert.equal((await user.request('POST', '/api/me/import', imported)).status, 409);
  });

  test('plan history cannot be rewritten and new plan changes start next week', async () => {
    const user = await makeUser();
    const initial = await user.state();
    const settings = { ...initial.data.settings, plans: [{ id: 'first', effectiveFrom: '2026-10-05', weekdays: [1, 3, 5], routineId: initial.data.settings.activeRoutineId }] };
    assert.equal((await user.request('PUT', '/api/me/settings', { expectedRevision: initial.revision, settings })).status, 200);
    const current = await user.state();
    assert.equal((await user.request('PUT', '/api/me/settings', { expectedRevision: current.revision, settings: { ...settings, plans: [{ ...settings.plans[0], weekdays: [2] }] } })).status, 409);
    assert.equal((await user.request('PUT', '/api/me/settings', { expectedRevision: current.revision, settings: { ...settings, plans: [...settings.plans, { ...settings.plans[0], id: 'next', effectiveFrom: '2026-10-12', weekdays: [2, 4] }] } })).status, 200);
  });

  test('explicit full restore accepts historical plans only into a pristine account', async () => {
    const user = await makeUser();
    const data = createDefaultPersonalData('Restored', 'Europe/Paris');
    data.settings.plans = [{ id: 'historic', effectiveFrom: '2026-09-07', weekdays: [1, 3], routineId: data.settings.activeRoutineId }];
    const full = { data, includeSettings: true, expectedRevision: 0 };
    assert.equal((await user.request('POST', '/api/me/import', full)).status, 200);
    const restored = await user.state();
    assert.equal(restored.data.settings.plans[0].effectiveFrom, '2026-09-07');
    const changed = structuredClone(data);
    changed.settings.plans[0].weekdays = [2];
    assert.equal((await user.request('POST', '/api/me/import', { data: changed, includeSettings: true, expectedRevision: restored.revision })).status, 409);
    const nonPristine = await makeUser();
    await nonPristine.request('DELETE', '/api/me/logs/never-created');
    assert.equal((await nonPristine.request('POST', '/api/me/import', { ...full, expectedRevision: 1 })).status, 409);
  });

  test('operator disable, enable, reset and revocation invalidate server sessions', async () => {
    const user = await makeUser();
    await operateUser(pool, auth, user.email, 'disable');
    assert.equal((await user.request('GET', '/api/me/state')).status, 401);
    assert.equal((await user.login()).status, 401);
    await operateUser(pool, auth, user.email, 'enable');
    assert.equal((await user.request('GET', '/api/me/state')).status, 401);
    assert.equal((await user.login()).status, 200);
    await operateUser(pool, auth, user.email, 'reset-password', 'replacement-password-456');
    assert.equal((await user.request('GET', '/api/me/state')).status, 401);
    assert.equal((await user.login()).status, 401);
    assert.equal((await user.login('replacement-password-456')).status, 200);
    await operateUser(pool, auth, user.email, 'revoke-sessions');
    assert.equal((await user.request('GET', '/api/me/state')).status, 401);
  });

  test('password change and session controls revoke other devices', async () => {
    const user = await makeUser();
    const firstCookie = user.cookie();
    assert.equal((await user.login()).status, 200);
    const sessionsResponse = await user.request('GET', '/api/auth/list-sessions');
    assert.equal(sessionsResponse.status, 200);
    const sessions = await sessionsResponse.json() as { token: string }[];
    assert.equal(sessions.length, 2);
    assert.equal((await user.request('POST', '/api/auth/revoke-other-sessions', {})).status, 200);
    assert.equal((await user.request('GET', '/api/me/state', undefined, { cookie: firstCookie })).status, 401);
    assert.equal((await user.request('GET', '/api/me/state')).status, 200);
    const beforeChange = user.cookie();
    const changed = await user.request('POST', '/api/auth/change-password', {
      currentPassword: password, newPassword: 'new-password-for-self-987', revokeOtherSessions: true,
    });
    assert.equal(changed.status, 200, await changed.clone().text());
    assert.equal((await user.request('GET', '/api/me/state', undefined, { cookie: beforeChange })).status, 401);
    assert.equal((await user.login()).status, 401);
    assert.equal((await user.login('new-password-for-self-987')).status, 200);
  });

  test('an overlapping password reset prevents a queued login using the previous password', async () => {
    const user = await makeUser();
    const context = await auth.$context;
    const newHash = await context.password.hash('reset-during-login-123');
    const gate = await pool.connect();
    let pending: Promise<Response> | undefined;
    try {
      await gate.query('BEGIN');
      await lockUser(gate, user.user.id);
      pending = user.login();
      // Observe an actual PostgreSQL lock waiter, rather than relying on a race delay.
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const locks = await pool.query(`SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND NOT granted
          AND database = (SELECT oid FROM pg_database WHERE datname = current_database()) LIMIT 1`);
        if (locks.rowCount) { waiting = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true, 'login must lock before password verification');
      await gate.query('UPDATE auth_account SET password = $2 WHERE "userId" = $1', [user.user.id, newHash]);
      await gate.query('DELETE FROM auth_session WHERE "userId" = $1', [user.user.id]);
      await gate.query('COMMIT');
      assert.equal((await pending).status, 401);
      assert.equal((await user.login('reset-during-login-123')).status, 200);
    } finally {
      await gate.query('ROLLBACK');
      gate.release();
      await pending?.catch(() => undefined);
    }
  });

  test('production session cookies use Secure and have no cross-subdomain Domain', async () => {
    const user = await makeUser();
    const productionConfig = { ...config, origin: 'https://klisteniapp.example', production: true };
    const productionAuth = createAuth(pool, productionConfig);
    const response = await productionAuth.handler(new Request('https://klisteniapp.example/api/auth/sign-in/email', {
      method: 'POST',
      headers: { origin: productionConfig.origin, 'content-type': 'application/json', 'x-klisteniapp-client-ip': '192.0.2.250' },
      body: JSON.stringify({ email: user.email, password }),
    }));
    assert.equal(response.status, 200);
    const cookies = response.headers.getSetCookie().join('; ');
    assert.match(cookies, /Secure/i);
    assert.match(cookies, /HttpOnly/i);
    assert.doesNotMatch(cookies, /Domain=/i);
  });

  test('the server entrypoint starts and exits cleanly on SIGTERM', async () => {
    const portReservation = createTcpServer();
    await new Promise<void>((resolve) => portReservation.listen(0, '127.0.0.1', resolve));
    const port = (portReservation.address() as AddressInfo).port;
    await new Promise<void>((resolve) => portReservation.close(() => resolve()));
    const child = spawn(process.execPath, [fileURLToPath(new URL('../src/server.ts', import.meta.url))], {
      env: { ...process.env, DATABASE_URL: config.databaseUrl, BETTER_AUTH_SECRET: config.secret, APP_ORIGIN: config.origin, HOST: '127.0.0.1', PORT: String(port), NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const exited = once(child, 'exit');
    const deadline = setTimeout(() => child.kill('SIGKILL'), 10000);
    try {
      await new Promise<void>((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', () => reject(new Error('server exited before startup')));
        child.stdout.on('data', (chunk: Buffer) => { if (chunk.toString().includes('API listening')) resolve(); });
      });
      assert.equal((await fetch(`http://127.0.0.1:${port}/api/readyz`)).status, 200);
      child.kill('SIGTERM');
      const [code, signal] = await exited;
      assert.equal(code, 0);
      assert.equal(signal, null);
    } finally { clearTimeout(deadline); child.kill('SIGKILL'); }
  });

  test('logout invalidates the previous cookie and login is rate limited in PostgreSQL', async () => {
    const user = await makeUser();
    const oldCookie = user.cookie();
    assert.equal((await user.request('POST', '/api/auth/sign-out', {})).status, 200);
    assert.equal((await user.request('GET', '/api/me/state', undefined, { cookie: oldCookie })).status, 401);
    let result: Response | undefined;
    for (let count = 0; count < 6; count += 1) result = await user.login('definitely-wrong-password');
    assert.equal(result!.status, 429);
    const persisted = await pool.query('SELECT count(*)::int AS count FROM auth_rate_limit');
    assert.ok(persisted.rows[0].count > 0);
  });
});
