import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import { Pool } from 'pg';
import { betterAuth } from 'better-auth';
import { AccountAdministration } from '../src/accounts.ts';
import { createAuth } from '../src/auth.ts';
import type { Config } from '../src/config.ts';
import { createPool } from '../src/database.ts';
import { createApiServer } from '../src/http.ts';
import { migrate } from '../src/migrate.ts';
import type { AccountMessage } from '../src/mail.ts';
import { operateUser } from '../src/operator-service.ts';

type Issued = Awaited<ReturnType<AccountAdministration['invite']>>;
const password = 'invitation-test-password-456';
const databaseUrl = process.env.TEST_DATABASE_URL;
const tokenFrom = (issued: Issued) => new URL(issued.url).hash.slice('#token='.length);

describe('account invitations, administration and recovery with PostgreSQL', { skip: !databaseUrl }, () => {
  let adminPool: Pool;
  let pool: Pool;
  let auth: ReturnType<typeof createAuth>;
  let service: AccountAdministration;
  let server: Server;
  let config: Config;
  let base: string;
  let admin: Awaited<ReturnType<typeof login>>;
  let bootstrap: Issued;
  let ip = 1;
  let mailFails = false;
  const messages: AccountMessage[] = [];
  const schema = `klisteni_invitation_${randomUUID().replaceAll('-', '')}`;

  async function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    return fetch(`${base}${path}`, { method, headers: { origin: config.origin, 'content-type': 'application/json', 'x-test-ip': `198.51.100.${ip++}`, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  async function login(email: string, pass = password) {
    let cookie = '';
    let id = '';
    async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
      const response = await request(method, path, body, { cookie, 'x-klisteni-account': id, ...headers });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) cookie = cookies.map(value => value.split(';', 1)[0]).join('; ');
      return response;
    }
    const response = await call('POST', '/api/auth/sign-in/email', { email, password: pass });
    assert.equal(response.status, 200, await response.clone().text());
    const body = await response.json();
    id = body.user.id;
    const session = await (await call('GET', '/api/auth/get-session')).json();
    return { id, email, role: session.user.role, actor: { id, sessionId: session.session.id as string }, call, cookie: () => cookie };
  }
  async function invitation(name = 'Invited', sendEmail = false) {
    const response = await admin.call('POST', '/api/admin/invitations', { email: `invite-${randomUUID()}@example.test`, name, sendEmail });
    assert.equal(response.status, 201, await response.clone().text());
    return await response.json() as Issued;
  }
  async function invitedUser() {
    const issued = await invitation();
    const activated = await request('POST', '/api/account/activate', { token: tokenFrom(issued), name: 'Invited', password });
    assert.equal(activated.status, 201, await activated.clone().text());
    return login(issued.invitation.email);
  }

  before(async () => {
    adminPool = new Pool({ connectionString: databaseUrl });
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    config = { databaseUrl: url.href, origin: 'http://localhost:5173', secret: 'invitation-tests-only-secret-1234567890', host: '127.0.0.1', port: 3001, production: false, trustedClientIpHeader: 'x-test-ip' };
    pool = createPool(config);
    auth = createAuth(pool, config);
    await migrate(pool, auth);
    await migrate(pool, auth);
    service = new AccountAdministration(pool, auth, config, { send: async (message) => { if (mailFails) throw new Error('Injected SMTP failure'); messages.push(message); } });
    server = createApiServer({ auth, pool, config, administration: service });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    bootstrap = await service.bootstrap({ email: 'bootstrap@example.test', name: 'Administrator', sendEmail: false });
    await assert.rejects(service.bootstrap({ email: 'bootstrap@example.test', name: 'Administrator', sendEmail: false }), { code: 'BOOTSTRAP_PENDING' });
    const initial = bootstrap;
    bootstrap = await service.bootstrap({ email: 'bootstrap@example.test', name: 'Administrator', sendEmail: false, reissue: true });
    await assert.rejects(service.tokenInfo(tokenFrom(initial)), { code: 'INVALID_TOKEN' });
    assert.equal((await request('POST', '/api/account/activate', { token: tokenFrom(bootstrap), name: 'Administrator', password })).status, 201);
    admin = await login(bootstrap.invitation.email);
  });
  after(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await pool?.end();
    if (adminPool) { await adminPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await adminPool.end(); }
  });

  test('upgrading an existing account database adds user roles without promoting or losing users', async () => {
    const upgradeSchema = `${schema}_upgrade`;
    await adminPool.query(`CREATE SCHEMA ${upgradeSchema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set('options', `-c search_path=${upgradeSchema}`);
    const upgradeConfig = { ...config, databaseUrl: url.href };
    const upgradePool = createPool(upgradeConfig);
    try {
      const updatedAuth = createAuth(upgradePool, upgradeConfig);
      const legacyAuth = betterAuth({ ...updatedAuth.options, user: {
        modelName: 'auth_user', additionalFields: { disabled: { type: 'boolean', defaultValue: false, input: false } },
      } });
      await migrate(upgradePool, legacyAuth);
      await upgradePool.query(`INSERT INTO auth_user (id, name, email, "emailVerified", "createdAt", "updatedAt", disabled)
        VALUES ('legacy-user', 'Legacy', 'legacy@example.test', false, now(), now(), false)`);
      await migrate(upgradePool, updatedAuth);
      const users = await upgradePool.query('SELECT id, email, role FROM auth_user');
      assert.deepEqual(users.rows, [{ id: 'legacy-user', email: 'legacy@example.test', role: 'user' }]);
      await migrate(upgradePool, updatedAuth);
      assert.equal((await upgradePool.query('SELECT id FROM auth_user')).rowCount, 1);
    } finally {
      await upgradePool.end();
      await adminPool.query(`DROP SCHEMA ${upgradeSchema} CASCADE`);
    }
  });

  test('bootstrap is unique, creates an admin only through its one-time link and never shares a password', async () => {
    assert.equal(admin.role, 'admin');
    assert.equal(bootstrap.invitation.role, 'admin');
    assert.equal(bootstrap.delivery.status, 'not_requested');
    await assert.rejects(service.bootstrap({ email: 'another@example.test', name: 'Other', sendEmail: false }), { code: 'BOOTSTRAP_CLOSED' });
    const token = tokenFrom(bootstrap);
    const row = await pool.query('SELECT token_hash, used_at FROM account_token WHERE id = $1', [bootstrap.invitation.id]);
    assert.equal(row.rows[0].token_hash, createHash('sha256').update(token).digest('hex'));
    assert.notEqual(row.rows[0].token_hash, token);
    assert.ok(row.rows[0].used_at);
    assert.equal((await request('POST', '/api/account/activate', { token, name: 'Again', password })).status, 400);
    assert.equal((await request('POST', '/api/auth/sign-up/email', { email: 'open@example.test', name: 'No', password, role: 'admin' })).status, 404);
  });

  test('GET never consumes links, info is read-only, and activation is atomic under concurrent requests', async () => {
    const issued = await invitation();
    const token = tokenFrom(issued);
    assert.equal(new URL(issued.url).pathname, '/account/activate');
    assert.equal(new URL(issued.url).search, '');
    assert.equal(Date.parse(issued.invitation.expiresAt) - Date.parse(issued.invitation.createdAt), 24 * 60 * 60 * 1000);
    assert.equal((await request('GET', '/api/account/activate')).status, 404);
    assert.equal((await request('GET', '/api/account/token-info')).status, 404);
    for (let count = 0; count < 2; count++) {
      const info = await request('POST', '/api/account/token-info', { token });
      assert.equal(info.status, 200);
      assert.equal(info.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await info.json(), { kind: 'activation', email: issued.invitation.email, name: 'Invited', expiresAt: issued.invitation.expiresAt, access: 'trial' });
    }
    assert.equal((await request('POST', '/api/account/activate', { token, name: 'Escalate', password, role: 'admin' })).status, 400);
    const results = await Promise.all([1, 2].map(() => request('POST', '/api/account/activate', { token, name: 'Accepted', password })));
    assert.deepEqual(results.map(result => result.status).sort(), [201, 400]);
    const user = await login(issued.invitation.email);
    assert.equal(user.role, 'user');
    assert.equal((await request('POST', '/api/account/token-info', { token })).status, 400);
  });

  test('admin metadata excludes tokens/passwords/progress and ordinary users cannot manage accounts', async () => {
    const user = await invitedUser();
    for (const path of ['/api/admin/users', '/api/admin/invitations']) {
      assert.equal((await user.call('GET', path)).status, 403);
      assert.equal((await request('GET', path)).status, 401);
      assert.equal((await admin.call('GET', path, undefined, { 'x-klisteni-account': user.id })).status, 401);
    }
    assert.equal((await user.call('POST', '/api/admin/invitations', { email: 'blocked@example.test', sendEmail: false })).status, 403);
    const issued = await invitation();
    const list = await admin.call('GET', '/api/admin/invitations');
    const text = await list.text();
    assert.doesNotMatch(text, new RegExp(tokenFrom(issued)));
    assert.doesNotMatch(text, /token_hash|password|workouts|personal_state/);
    const users = await (await admin.call('GET', '/api/admin/users')).json();
    assert.ok(users.users.some((entry: { id: string }) => entry.id === user.id));
    assert.deepEqual(Object.keys(users.users[0]).sort(), ['access', 'createdAt', 'disabled', 'email', 'id', 'name', 'role']);
    assert.equal((await admin.call('GET', '/api/me/state', undefined, { 'x-klisteni-account': user.id })).status, 401);
    assert.equal((await admin.call('POST', '/api/admin/invitations', { email: 'blocked@example.test', role: 'admin', sendEmail: false })).status, 400);
  });

  test('reissue invalidates old links; revocation and expiry block activation without creating users', async () => {
    const first = await invitation();
    const response = await admin.call('POST', `/api/admin/invitations/${first.invitation.id}/reissue`, { sendEmail: false });
    assert.equal(response.status, 201);
    const next = await response.json() as Issued;
    assert.notEqual(next.invitation.id, first.invitation.id);
    assert.equal((await request('POST', '/api/account/token-info', { token: tokenFrom(first) })).status, 400);
    assert.equal((await admin.call('POST', `/api/admin/invitations/${next.invitation.id}/revoke`, {})).status, 200);
    assert.equal((await request('POST', '/api/account/activate', { token: tokenFrom(next), name: 'No', password })).status, 400);
    const expired = await invitation();
    await pool.query("UPDATE account_token SET expires_at = now() - interval '1 second' WHERE id = $1", [expired.invitation.id]);
    assert.equal((await request('POST', '/api/account/token-info', { token: tokenFrom(expired) })).status, 400);
    assert.equal((await request('POST', '/api/account/activate', { token: tokenFrom(expired), name: 'No', password })).status, 400);
    assert.equal((await pool.query('SELECT id FROM auth_user WHERE email = ANY($1::text[])', [[first.invitation.email, expired.invitation.email]])).rowCount, 0);
  });

  test('mail sends only on explicit request and reports SMTP acceptance separately from delivery', async () => {
    const initialCount = messages.length;
    const notSent = await invitation('No mail', false);
    assert.equal(notSent.delivery.status, 'not_requested');
    assert.equal(messages.length, initialCount);
    const sent = await invitation('Mail requested', true);
    assert.equal(sent.delivery.status, 'smtp_accepted');
    assert.equal(messages.length, initialCount + 1);
    assert.equal(messages.at(-1)!.to, sent.invitation.email);
    assert.ok(messages.at(-1)!.text.includes(sent.url));
    assert.equal(messages.at(-1)!.text.includes(password), false);
    assert.ok(sent.invitation.smtpAcceptedAt);
    mailFails = true;
    const failed = await invitation('Mail failed', true);
    mailFails = false;
    assert.equal(failed.delivery.status, 'failed');
    assert.equal((await request('POST', '/api/account/token-info', { token: tokenFrom(failed) })).status, 200);
    const unavailable = await new AccountAdministration(pool, auth, config, null).invite(admin.actor, { email: `unavailable-${randomUUID()}@example.test`, sendEmail: true });
    assert.equal(unavailable.delivery.status, 'unavailable');
    assert.equal(unavailable.invitation.smtpAcceptedAt, null);
  });

  test('recovery lasts one hour, rotates credentials once and invalidates all old sessions', async () => {
    const user = await invitedUser();
    const second = await login(user.email);
    const response = await admin.call('POST', `/api/admin/users/${user.id}/recovery`, { sendEmail: false });
    assert.equal(response.status, 201);
    const issued = await response.json() as Issued;
    assert.equal(new URL(issued.url).pathname, '/account/recover');
    assert.equal(Date.parse(issued.invitation.expiresAt) - Date.parse(issued.invitation.createdAt), 60 * 60 * 1000);
    assert.equal((await request('POST', '/api/account/activate', { token: tokenFrom(issued), name: 'No', password })).status, 400);
    const newPassword = 'new-recovered-password-789';
    const results = await Promise.all([1, 2].map(() => request('POST', '/api/account/reset-password', { token: tokenFrom(issued), password: newPassword })));
    assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
    assert.equal((await user.call('GET', '/api/me/state')).status, 401);
    assert.equal((await second.call('GET', '/api/me/state')).status, 401);
    assert.equal((await request('POST', '/api/auth/sign-in/email', { email: user.email, password })).status, 401);
    assert.equal((await login(user.email, newPassword)).role, 'user');
    assert.equal((await request('POST', '/api/account/reset-password', { token: tokenFrom(issued), password })).status, 400);
  });

  test('management revokes sessions, disabled users cannot recover, and the last admin is protected in API and CLI', async () => {
    const user = await invitedUser();
    const recovery = await (await admin.call('POST', `/api/admin/users/${user.id}/recovery`, { sendEmail: false })).json() as Issued;
    assert.equal((await admin.call('POST', `/api/admin/users/${user.id}/disable`, {})).status, 200);
    assert.equal((await user.call('GET', '/api/me/state')).status, 401);
    assert.equal((await request('POST', '/api/account/reset-password', { token: tokenFrom(recovery), password })).status, 400);
    assert.equal((await admin.call('POST', `/api/admin/users/${user.id}/recovery`, { sendEmail: false })).status, 409);
    assert.equal((await admin.call('POST', `/api/admin/users/${user.id}/enable`, {})).status, 200);
    assert.equal((await user.call('GET', '/api/me/state')).status, 401);
    const enabled = await login(user.email);
    assert.equal((await admin.call('POST', `/api/admin/users/${user.id}/revoke-sessions`, {})).status, 200);
    assert.equal((await enabled.call('GET', '/api/me/state')).status, 401);
    const last = await admin.call('POST', `/api/admin/users/${admin.id}/disable`, {});
    assert.equal(last.status, 409);
    assert.equal((await last.json()).code, 'LAST_ADMIN');
    await assert.rejects(operateUser(pool, auth, admin.email, 'disable'), { code: 'LAST_ADMIN' });
    assert.equal((await admin.call('GET', '/api/admin/users')).status, 200);
  });

  test('changing a password invalidates issued recovery links and public token routes reject bad origins', async () => {
    const user = await invitedUser();
    const issued = await (await admin.call('POST', `/api/admin/users/${user.id}/recovery`, { sendEmail: false })).json() as Issued;
    const changed = await user.call('POST', '/api/auth/change-password', { currentPassword: password, newPassword: 'changed-own-password-123', revokeOtherSessions: true });
    assert.equal(changed.status, 200, await changed.clone().text());
    assert.equal((await request('POST', '/api/account/reset-password', { token: tokenFrom(issued), password })).status, 400);
    const fresh = await invitation();
    for (const origin of ['', 'https://outside.example']) {
      assert.equal((await request('POST', '/api/account/token-info', { token: tokenFrom(fresh) }, { origin })).status, 403);
      assert.equal((await request('POST', '/api/account/activate', { token: tokenFrom(fresh), name: 'No', password }, { origin })).status, 403);
    }
    let result: Response | undefined;
    for (let count = 0; count < 11; count++) result = await request('POST', '/api/account/token-info', { token: 'invalid' }, { 'x-test-ip': '203.0.113.240' });
    assert.equal(result!.status, 429);
    assert.equal(result!.headers.get('cache-control'), 'no-store');
  });

  test('public campaign HTTP flow creates a trial and enforces the cloud paywall with local export access', async () => {
    const issue = await admin.call('POST', '/api/admin/share-invitations', { label: 'Community', maxUses: 5, expiresInDays: 7 });
    assert.equal(issue.status, 201, await issue.clone().text());
    const issued = await issue.json();
    const token = tokenFrom(issued);
    assert.equal(new URL(issued.url).pathname, '/account/join');
    const info = await request('POST', '/api/account/share-info', { token });
    assert.equal(info.status, 200);
    assert.equal((await info.json()).trialDays, 15);
    assert.equal((await request('GET', '/api/account/join')).status, 404);
    const payload = { token, email: `${randomUUID()}@example.test`, name: 'Community user', password };
    assert.equal((await request('POST', '/api/account/join', payload, { origin: 'https://outside.example' })).status, 403);
    assert.equal((await request('POST', '/api/account/join', { ...payload, access: 'lifetime' })).status, 400);
    const joined = await request('POST', '/api/account/join', payload);
    assert.equal(joined.status, 201, await joined.clone().text());
    const user = await login(payload.email);
    assert.equal((await (await user.call('GET', '/api/me/access')).json()).status, 'trial');
    assert.equal((await user.call('GET', '/api/admin/share-invitations')).status, 403);
    assert.equal((await user.call('POST', `/api/admin/users/${user.id}/lifetime`, { lifetime: true })).status, 403);
    const initial = await (await user.call('GET', '/api/me/state')).json();
    await pool.query("UPDATE account_access SET trial_ends_at = now() - interval '1 second' WHERE user_id = $1", [user.id]);
    assert.equal((await (await user.call('GET', '/api/me/access')).json()).status, 'expired');
    const denied = await user.call('PUT', '/api/me/settings', { expectedRevision: initial.revision, settings: initial.data.settings });
    assert.equal(denied.status, 402);
    assert.equal((await denied.json()).code, 'CLOUD_ACCESS_REQUIRED');
    assert.equal((await user.call('GET', '/api/me/state')).status, 200);
    assert.equal((await user.call('DELETE', `/api/me/logs/${randomUUID()}`)).status, 200);
    assert.equal((await admin.call('POST', `/api/admin/users/${user.id}/lifetime`, { lifetime: true })).status, 200);
    assert.equal((await (await user.call('GET', '/api/me/access')).json()).status, 'lifetime');
    assert.equal((await admin.call('POST', `/api/admin/users/${user.id}/lifetime`, { lifetime: false })).status, 200);
    assert.equal((await (await user.call('GET', '/api/me/access')).json()).status, 'expired');
    assert.equal((await admin.call('POST', `/api/admin/share-invitations/${issued.invitation.id}/revoke`, {})).status, 200);
    assert.equal((await request('POST', '/api/account/share-info', { token })).status, 400);
    let limited: Response | undefined;
    for (let count = 0; count < 11; count++) limited = await request('POST', '/api/account/join', { ...payload, token: 'invalid' }, { 'x-test-ip': '203.0.113.241' });
    assert.equal(limited!.status, 429);
  });
});
