import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { after, before, describe, test } from 'node:test';
import type { Server } from 'node:http';
import { createServer as createTcpServer, type AddressInfo } from 'node:net';
import { Pool } from 'pg';
import { createDefaultPersonalData, type ServerState } from '@klisteniapp/scene-schema';
import { createAuth } from '../src/auth.ts';
import { createPool } from '../src/database.ts';
import type { Config } from '../src/config.ts';
import { createApiServer } from '../src/http.ts';
import { migrate } from '../src/migrate.ts';
import { createProvisionedUser, operateUser } from '../src/operator-service.ts';
import { StateRepository, lockUser } from '../src/state.ts';

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
    const data = createDefaultPersonalData('Restored', 'Europe/Sarajevo');
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
