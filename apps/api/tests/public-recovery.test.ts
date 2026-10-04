import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Pool, type PoolClient } from 'pg';
import { AccountAdministration, type AdminActor } from '../src/accounts.ts';
import { createAuth } from '../src/auth.ts';
import type { Config } from '../src/config.ts';
import { createPool } from '../src/database.ts';
import { createApiServer } from '../src/http.ts';
import { migrate } from '../src/migrate.ts';
import type { AccountMailer, AccountMessage } from '../src/mail.ts';
import { createProvisionedUser } from '../src/operator-service.ts';
import { PublicRecovery, RECOVERY_COOLDOWN_MS } from '../src/public-recovery.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
const password = 'public-recovery-test-password-456';
const endpoint = '/api/account/request-recovery';
const tokenFromMail = (message: AccountMessage) => new URL(message.text.match(/https?:\/\/\S+/)![0]).hash.slice('#token='.length);

describe('public password recovery with PostgreSQL and an injected mail transport', { skip: !databaseUrl }, () => {
  let adminPool: Pool;
  let pool: Pool;
  let config: Config;
  let auth: ReturnType<typeof createAuth>;
  let service: AccountAdministration;
  let recovery: PublicRecovery;
  let server: ReturnType<typeof createApiServer>;
  let base: string;
  let ip = 1;
  let now: Date;
  let mailFails = false;
  let mailGate: Promise<void> | undefined;
  let mailEntered: (() => void) | undefined;
  const messages: AccountMessage[] = [];
  const phases: string[] = [];
  const schema = `klisteni_recovery_${randomUUID().replaceAll('-', '')}`;
  const fakeMailer: AccountMailer = { send: async message => {
    phases.push('smtp'); messages.push(message); mailEntered?.();
    if (mailGate) await mailGate;
    if (mailFails) throw new Error('Injected SMTP failure');
  } };
  class ObservedAdministration extends AccountAdministration {
    override transaction<T>(operation: (client: PoolClient) => Promise<T>, actor?: AdminActor): Promise<T> {
      phases.push('account-work');
      return super.transaction(operation, actor);
    }
  }
  const email = () => `recover-${randomUUID()}@example.test`;
  async function user(disabled = false) {
    const value = await createProvisionedUser(pool, config, { email: email(), name: 'Recovery fixture', password });
    if (disabled) await pool.query('UPDATE auth_user SET disabled = true WHERE id = $1', [value.id]);
    return value;
  }
  async function request(path: string, body?: unknown, headers: Record<string, string> = {}, method = 'POST') {
    return fetch(`${base}${path}`, { method, headers: { origin: config.origin, 'content-type': 'application/json', 'x-test-ip': `198.51.100.${ip++}`, ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  }
  async function accepted(address: string, headers?: Record<string, string>) {
    const response = await request(endpoint, { email: address }, headers);
    assert.equal(response.status, 202, await response.clone().text());
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);
    assert.deepEqual(await response.json(), { ok: true });
    return response;
  }
  before(async () => {
    adminPool = new Pool({ connectionString: databaseUrl });
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    config = { databaseUrl: url.href, origin: 'http://localhost:5173', secret: 'public-recovery-tests-only-secret-1234567890', host: '127.0.0.1', port: 3001, production: false, trustedClientIpHeader: 'x-test-ip' };
    pool = createPool(config);
    auth = createAuth(pool, config);
    await migrate(pool, auth);
    service = new ObservedAdministration(pool, auth, config, fakeMailer, () => now);
    recovery = new PublicRecovery(service);
    server = createApiServer({ auth, pool, config, administration: service, publicRecovery: recovery });
    server.on('request', (req, res) => { if (req.url === endpoint) res.once('finish', () => phases.push('response-finish')); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  beforeEach(async () => {
    await recovery.idle();
    now = new Date(Math.floor(Date.now() / 3600000) * 3600000);
    service.mailer = fakeMailer; mailFails = false; mailGate = undefined; mailEntered = undefined;
    phases.length = 0; messages.length = 0;
  });
  after(async () => {
    if (server) { const drained = server.closeRecovery(); await new Promise<void>(resolve => server.close(() => resolve())); await drained; }
    await pool?.end();
    if (adminPool) { await adminPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await adminPool.end(); }
  });

  test('HTTP finishes before account work and remains independent of a blocked SMTP operation', async () => {
    const account = await user();
    let release!: () => void;
    mailGate = new Promise(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { mailEntered = resolve; });
    try {
      await accepted(account.email.toUpperCase());
      await entered;
      assert.ok(phases.indexOf('response-finish') < phases.indexOf('account-work'));
      assert.ok(phases.indexOf('account-work') < phases.indexOf('smtp'));
      assert.equal(messages.length, 1);
      const token = tokenFromMail(messages[0]);
      const row = (await pool.query('SELECT token_hash, created_at, expires_at, delivery_status FROM account_token WHERE email = $1', [account.email])).rows[0];
      assert.equal(row.token_hash, createHash('sha256').update(token).digest('hex'));
      assert.notEqual(row.token_hash, token);
      assert.equal(row.expires_at.getTime() - row.created_at.getTime(), 3600000);
      assert.equal(row.delivery_status, 'not_requested');
    } finally { release(); await recovery.idle(); }
    assert.equal((await pool.query('SELECT delivery_status FROM account_token WHERE email = $1', [account.email])).rows[0].delivery_status, 'smtp_accepted');
  });

  test('existing, missing, disabled, unavailable and failed SMTP paths share the same generic response', async () => {
    const existing = await user();
    const disabled = await user(true);
    const absent = email();
    for (const address of [existing.email, absent, disabled.email]) { await accepted(address); await recovery.idle(); }
    assert.equal(messages.length, 1);
    assert.equal(messages[0].to, existing.email);
    assert.equal((await pool.query('SELECT id FROM account_token WHERE email = ANY($1::text[])', [[absent, disabled.email]])).rowCount, 0);
    const unavailable = await user();
    service.mailer = null;
    await accepted(unavailable.email); await recovery.idle();
    assert.equal((await pool.query('SELECT id FROM account_token WHERE email = $1', [unavailable.email])).rowCount, 0);
    service.mailer = fakeMailer; mailFails = true;
    const failed = await user();
    await accepted(failed.email); await recovery.idle();
    assert.equal((await pool.query('SELECT delivery_status FROM account_token WHERE email = $1', [failed.email])).rows[0].delivery_status, 'failed');
    assert.equal((await pool.query('SELECT id FROM auth_user WHERE email = $1', [absent])).rowCount, 0);
  });

  test('request schema, same origin, JSON and method rules are enforced without account registration', async () => {
    const address = email();
    assert.equal((await request(endpoint, { email: 'invalid' })).status, 400);
    assert.equal((await request(endpoint, { email: address, role: 'admin' })).status, 400);
    assert.equal((await request(endpoint, { email: address }, { origin: 'https://other.example' })).status, 403);
    assert.equal((await request(endpoint, { email: address }, { 'sec-fetch-site': 'cross-site' })).status, 403);
    assert.equal((await request(endpoint, { email: address }, { 'content-type': 'text/plain' })).status, 415);
    assert.equal((await request(endpoint, undefined, {}, 'GET')).status, 404);
    assert.equal((await request('/api/auth/sign-up/email', { email: address, name: 'No signup', password })).status, 404);
    assert.equal((await pool.query('SELECT id FROM auth_user WHERE email = $1', [address])).rowCount, 0);
  });

  test('email cooldown is atomic across worker instances, rolling, persistent, and limited to three per hour', async () => {
    const account = await user();
    const replica = new PublicRecovery(service);
    const results = await Promise.all(Array.from({ length: 16 }, (_, index) => (index % 2 ? recovery : replica).reserve(account.email)));
    assert.equal(results.filter(Boolean).length, 1);
    for (const reservation of results) reservation?.start();
    await Promise.all([recovery.idle(), replica.idle()]);
    assert.equal(messages.length, 1);
    const first = tokenFromMail(messages[0]);
    now = new Date(now.getTime() + RECOVERY_COOLDOWN_MS - 1);
    assert.equal(await replica.reserve(account.email), undefined);
    now = new Date(now.getTime() + 1);
    const second = await replica.reserve(account.email); assert.ok(second); second.start(); await replica.idle();
    now = new Date(now.getTime() + RECOVERY_COOLDOWN_MS);
    const third = await recovery.reserve(account.email); assert.ok(third); third.start(); await recovery.idle();
    now = new Date(now.getTime() + RECOVERY_COOLDOWN_MS);
    assert.equal(await new PublicRecovery(service).reserve(account.email), undefined);
    assert.equal(messages.length, 3);
    await assert.rejects(service.tokenInfo(first), { code: 'INVALID_TOKEN' });
    assert.equal((await pool.query('SELECT id FROM account_token WHERE email = $1 AND revoked_at IS NULL', [account.email])).rowCount, 1);
    const keys = (await pool.query('SELECT key FROM account_rate_limit')).rows.map(row => row.key);
    assert.ok(keys.every(key => /^[a-f0-9]{64}$/.test(key)));
    assert.ok(keys.every(key => !key.includes(account.email)));
    await replica.close();
  });

  test('repeated public requests preserve a recent recovery link issued by an administrator', async () => {
    const account = await user();
    const issued = await service.recovery(undefined, account.id, false);
    const token = new URL(issued.url).hash.slice('#token='.length);
    await accepted(account.email); await recovery.idle();
    await accepted(account.email); await recovery.idle();
    assert.equal(messages.length, 0);
    assert.equal((await service.tokenInfo(token)).email, account.email);
    assert.equal((await pool.query('SELECT id FROM account_token WHERE email = $1', [account.email])).rowCount, 1);
  });

  test('persistent IP throttling returns 429 regardless of whether an email belongs to anyone', async () => {
    const headers = { 'x-test-ip': '203.0.113.99' };
    for (let count = 0; count < 10; count++) await accepted(email(), headers);
    const account = await user();
    const response = await request(endpoint, { email: account.email }, headers);
    assert.equal(response.status, 429);
    assert.equal((await response.json()).code, 'RATE_LIMITED');
    await recovery.idle();
    assert.equal(messages.length, 0);
    now = new Date(now.getTime() + 60000);
    await accepted(account.email, headers); await recovery.idle();
    assert.equal(messages.length, 1);
  });

  test('full pending capacity is rejected before spending the email quota', async () => {
    const queue = new PublicRecovery(service);
    const reservations = await Promise.all(Array.from({ length: 32 }, () => queue.reserve(email())));
    assert.equal(reservations.filter(Boolean).length, 32);
    const address = email();
    assert.equal(await queue.reserve(address), undefined);
    reservations[0]!.cancel();
    const retry = await queue.reserve(address);
    assert.ok(retry, 'Full-capacity request must not consume the email cooldown');
    retry.cancel();
    for (const reservation of reservations) reservation?.cancel();
    await queue.close();
    assert.equal(await queue.reserve(email()), undefined);
    assert.equal(messages.length, 0);
  });

  test('an emailed link resets once, rejects replay and revokes every old session', async () => {
    const account = await user();
    const login = async (pass: string) => request('/api/auth/sign-in/email', { email: account.email, password: pass });
    assert.equal((await login(password)).status, 200);
    assert.equal((await login(password)).status, 200);
    assert.equal((await pool.query('SELECT id FROM auth_session WHERE "userId" = $1', [account.id])).rowCount, 2);
    await accepted(account.email); await recovery.idle();
    const token = tokenFromMail(messages[0]);
    assert.equal((await request('/api/account/token-info', { token })).status, 200);
    const newPassword = 'public-recovery-new-password-789';
    const reset = await Promise.all([1, 2].map(() => request('/api/account/reset-password', { token, password: newPassword })));
    assert.deepEqual(reset.map(response => response.status).sort(), [200, 400]);
    assert.equal((await pool.query('SELECT id FROM auth_session WHERE "userId" = $1', [account.id])).rowCount, 0);
    assert.equal((await request('/api/account/reset-password', { token, password: newPassword })).status, 400);
    assert.equal((await login(password)).status, 401);
    assert.equal((await login(newPassword)).status, 200);
  });

  test('only two mail operations run concurrently and shutdown drains admitted work before closing', async () => {
    const accounts = await Promise.all([1, 2, 3, 4].map(() => user()));
    let release!: () => void;
    mailGate = new Promise(resolve => { release = resolve; });
    let twoEntered!: () => void;
    const entered = new Promise<void>(resolve => { twoEntered = resolve; });
    mailEntered = () => { if (messages.length === 2) twoEntered(); };
    try {
      for (const account of accounts) await accepted(account.email);
      await entered;
      assert.equal(messages.length, 2);
      let drained = false;
      const closing = server.closeRecovery().then(() => { drained = true; });
      await new Promise<void>(resolve => setImmediate(resolve));
      assert.equal(drained, false);
      assert.equal(await recovery.reserve(email()), undefined);
      release();
      await closing;
      assert.equal(messages.length, 4);
      assert.equal(drained, true);
    } finally { release(); await recovery.idle(); }
  });
});
