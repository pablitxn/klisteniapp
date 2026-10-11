import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Pool } from 'pg';
import { createEmptyHealthData } from '@klisteniapp/scene-schema';
import { AccessRepository, describeAccess, initializeAccess } from '../src/access.ts';
import { AccountAdministration, ShareRedemptionInputSchema, type AdminActor } from '../src/accounts.ts';
import { createAuth } from '../src/auth.ts';
import type { Config } from '../src/config.ts';
import { createPool } from '../src/database.ts';
import { migrate } from '../src/migrate.ts';
import { createProvisionedUser } from '../src/operator-service.ts';
import { StateRepository } from '../src/state.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
const password = 'subscription-tests-only-password';
const baseline = new Date('2026-10-04T12:00:00.000Z');
const tokenFrom = (issued: { url: string }) => new URL(issued.url).hash.slice('#token='.length);

test('entitlements expire at the exact boundary and missing rows fail closed', () => {
  const row = { lifetime: false, trial_ends_at: baseline, paid_through: null };
  assert.equal(describeAccess(row, new Date(baseline.getTime() - 1)).status, 'trial');
  assert.equal(describeAccess(row, baseline).cloudWrite, false);
  assert.equal(describeAccess(undefined, baseline).status, 'expired');
  assert.equal(describeAccess({ ...row, paid_through: new Date(baseline.getTime() + 1) }, baseline).status, 'active');
  assert.equal(describeAccess({ ...row, lifetime: true }, baseline).status, 'lifetime');
});

describe('cloud entitlements and campaign invitations with PostgreSQL', { skip: !databaseUrl }, () => {
  let adminPool: Pool;
  let pool: Pool;
  let auth: ReturnType<typeof createAuth>;
  let config: Config;
  let service: AccountAdministration;
  let actor: AdminActor;
  let clock = baseline;
  let access: AccessRepository;
  const schema = `klisteni_access_${randomUUID().replaceAll('-', '')}`;

  before(async () => {
    adminPool = new Pool({ connectionString: databaseUrl });
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    config = { databaseUrl: url.href, origin: 'http://localhost:5173', secret: 'access-tests-only-secret-123456789012345', host: '127.0.0.1', port: 3001, production: false };
    pool = createPool(config);
    auth = createAuth(pool, config);
    await migrate(pool, auth);
    service = new AccountAdministration(pool, auth, config, null, () => clock);
    access = new AccessRepository(pool, () => clock);
    const bootstrap = await service.bootstrap({ email: 'admin@example.test', name: 'Admin', sendEmail: false });
    const admin = await service.activate({ token: tokenFrom(bootstrap), name: 'Admin', password });
    await auth.api.signInEmail({ body: { email: admin.user.email, password } });
    const session = await pool.query('SELECT id FROM auth_session WHERE "userId" = $1', [admin.user.id]);
    actor = { id: admin.user.id, sessionId: session.rows[0].id };
  });
  beforeEach(() => { clock = new Date(baseline); });
  after(async () => {
    await pool?.end();
    if (adminPool) { await adminPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await adminPool.end(); }
  });

  async function invited(lifetime = false) {
    const invitation = await service.invite(actor, { email: `${randomUUID()}@example.test`, name: 'Friend', sendEmail: false, access: lifetime ? 'lifetime' : 'trial' });
    const activated = await service.activate({ token: tokenFrom(invitation), name: 'Friend', password });
    return activated.user;
  }

  test('bootstrap is lifetime; normal trials begin on activation and survive migration replay', async () => {
    assert.equal((await access.get(actor.id)).status, 'lifetime');
    const invitation = await service.invite(actor, { email: `${randomUUID()}@example.test`, sendEmail: false });
    clock = new Date(baseline.getTime() + 23 * 3600000);
    const { user } = await service.activate({ token: tokenFrom(invitation), name: 'Later activation', password });
    const initial = await access.get(user.id);
    assert.equal(initial.status, 'trial');
    assert.equal(initial.trialEndsAt, new Date(clock.getTime() + 15 * 86400000).toISOString());
    await migrate(pool, auth);
    assert.deepEqual(await access.get(user.id), initial);
    const client = await pool.connect();
    try { await initializeAccess(client, user.id, true, new Date(clock.getTime() + 5 * 86400000)); }
    finally { client.release(); }
    assert.deepEqual(await access.get(user.id), initial);
  });

  test('operator creates credentials and 15-day trial together', async () => {
    const before = Date.now();
    const user = await createProvisionedUser(pool, config, { email: `${randomUUID()}@example.test`, name: 'Operator-created', password });
    const after = Date.now();
    const grant = await access.get(user.id);
    const deadline = new Date(grant.trialEndsAt!).getTime();
    assert.ok(deadline >= before + 15 * 86400000 && deadline <= after + 15 * 86400000);
    assert.equal((await auth.api.signInEmail({ body: { email: user.email, password } })).user.id, user.id);
  });

  test('legacy migration preserves accounts once and never overwrites explicit trials', async () => {
    const trial = await invited();
    const original = await access.get(trial.id);
    const id = randomUUID();
    await pool.query(`INSERT INTO auth_user (id, name, email, "emailVerified", "createdAt", "updatedAt", disabled, role)
      VALUES ($1,'Legacy',$2,false,now(),now(),false,'user')`, [id, `${id}@example.test`]);
    // Recreate the pre-feature migration boundary in this isolated test schema.
    await pool.query("DELETE FROM app_migration WHERE id = 'account-access-v1'");
    await migrate(pool, auth);
    assert.equal((await access.get(id)).status, 'lifetime');
    assert.deepEqual(await access.get(trial.id), original);
    await pool.query('DELETE FROM account_access WHERE user_id = $1', [id]);
    await migrate(pool, auth);
    assert.equal((await access.get(id)).status, 'expired');
    assert.deepEqual(await access.get(trial.id), original);
  });

  test('expired accounts can read and delete but all cloud write paths roll back', async () => {
    const user = await invited();
    const repository = new StateRepository(pool, () => clock);
    const log = { kind: 'cardio' as const, log: { id: randomUUID(), date: '2026-10-04', activity: 'walk' as const, minutes: 20 } };
    const saved = await repository.addLog(user, log);
    clock = new Date((await access.get(user.id)).trialEndsAt!);
    const denied = { status: 402, code: 'CLOUD_ACCESS_REQUIRED' };
    await assert.rejects(repository.addLog(user, { ...log, log: { ...log.log, id: randomUUID() } }), denied);
    await assert.rejects(repository.settings(user, { expectedRevision: saved.revision, settings: saved.data.settings }), denied);
    await assert.rejects(repository.health(user, { expectedRevision: saved.revision, health: createEmptyHealthData() }), denied);
    await assert.rejects(repository.import(user, { data: saved.data }), denied);
    assert.deepEqual(await repository.get(user), saved);
    const deleted = await repository.deleteLog(user, log.log.id);
    assert.equal(deleted.data.progress.cardio.length, 0);
    assert.equal(deleted.revision, saved.revision + 1);
  });

  test('expired health deletion permits only retained original values and checks revisions', async () => {
    const user = await invited();
    const repository = new StateRepository(pool, () => clock);
    const initial = await repository.get(user);
    const health = createEmptyHealthData();
    health.profile = { heightCm: 170, context: 'Private context' };
    const saved = await repository.health(user, { expectedRevision: initial.revision, health });
    clock = new Date((await access.get(user.id)).trialEndsAt!);
    await assert.rejects(repository.health(user, { expectedRevision: saved.revision, health: { ...health, profile: { heightCm: 180 } } }), { status: 402 });
    await assert.rejects(repository.health(user, { expectedRevision: 0, health: createEmptyHealthData() }), { code: 'REVISION_CONFLICT' });
    const removed = await repository.health(user, { expectedRevision: saved.revision, health: { ...health, profile: { heightCm: 170 } } });
    assert.deepEqual(removed.data.settings.health?.profile, { heightCm: 170 });
    const cleared = await repository.health(user, { expectedRevision: removed.revision, health: createEmptyHealthData() });
    assert.deepEqual(cleared.data.settings.health?.profile, {});
    await assert.rejects(repository.health(user, { expectedRevision: cleared.revision, health }), { status: 402 });
  });

  test('lifetime is independent of admin role; revocation preserves paid/trial deadlines', async () => {
    const user = await invited();
    const trial = await access.get(user.id);
    await service.setLifetime(actor, user.id, true);
    assert.equal((await access.get(user.id)).status, 'lifetime');
    assert.equal((await pool.query('SELECT role FROM auth_user WHERE id = $1', [user.id])).rows[0].role, 'user');
    await auth.api.signInEmail({ body: { email: user.email, password } });
    const session = (await pool.query('SELECT id FROM auth_session WHERE "userId" = $1', [user.id])).rows[0];
    await assert.rejects(service.setLifetime({ id: user.id, sessionId: session.id }, user.id, true), { code: 'ADMIN_REQUIRED' });
    await service.setLifetime(actor, user.id, false);
    assert.deepEqual(await access.get(user.id), trial);
    clock = new Date(trial.trialEndsAt!);
    assert.equal((await access.get(user.id)).status, 'expired');
    const paid = new Date(clock.getTime() + 86400000);
    await pool.query('UPDATE account_access SET paid_through = $2 WHERE user_id = $1', [user.id, paid]);
    await service.setLifetime(actor, user.id, true);
    await service.setLifetime(actor, user.id, false);
    assert.equal((await access.get(user.id)).status, 'active');
    assert.equal((await access.get(user.id)).paidThrough, paid.toISOString());
    clock = paid;
    assert.equal((await access.get(user.id)).status, 'expired');
  });

  test('named lifetime invitations preserve the entitlement through reissue', async () => {
    const original = await service.invite(actor, { email: `${randomUUID()}@example.test`, sendEmail: false, access: 'lifetime' });
    const next = await service.reissue(actor, original.invitation.id, false);
    assert.equal((await service.tokenInfo(tokenFrom(next))).access, 'lifetime');
    await assert.rejects(service.tokenInfo(tokenFrom(original)), { code: 'INVALID_TOKEN' });
    const { user } = await service.activate({ token: tokenFrom(next), name: 'Lifetime friend', password });
    assert.equal((await access.get(user.id)).status, 'lifetime');
    assert.equal(user.role, 'user');
    const listed = (await service.users(actor)).users.find(item => item.id === user.id);
    assert.equal(listed?.access.status, 'lifetime');
  });

  test('campaign tokens are hashed and final use is consumed atomically under concurrency', async () => {
    const issued = await service.createShareInvitation(actor, { label: 'Public launch', maxUses: 1, expiresInDays: 30 });
    const token = tokenFrom(issued);
    const row = (await pool.query('SELECT * FROM account_share_invitation WHERE id = $1', [issued.invitation.id])).rows[0];
    assert.equal(row.token_hash, createHash('sha256').update(token).digest('hex'));
    assert.equal(JSON.stringify(await service.shareInvitations(actor)).includes(token), false);
    assert.deepEqual(await service.shareInfo(token), { label: 'Public launch', expiresAt: issued.invitation.expiresAt, trialDays: 15 });
    const emails = [`${randomUUID()}@example.test`, `${randomUUID()}@example.test`];
    const results = await Promise.allSettled(emails.map(email => service.redeemShare({ token, email, name: 'Public user', password })));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const accounts = await pool.query('SELECT id, email, "emailVerified", role FROM auth_user WHERE email = ANY($1::text[])', [emails]);
    assert.equal(accounts.rowCount, 1);
    assert.equal(accounts.rows[0].emailVerified, false);
    assert.equal(accounts.rows[0].role, 'user');
    assert.equal((await access.get(accounts.rows[0].id)).status, 'trial');
    assert.equal((await auth.api.signInEmail({ body: { email: accounts.rows[0].email, password } })).user.id, accounts.rows[0].id);
    const metadata = (await service.shareInvitations(actor)).invitations.find(item => item.id === issued.invitation.id);
    assert.equal(metadata?.uses, 1);
    assert.equal(metadata?.status, 'exhausted');
    await assert.rejects(service.shareInfo(token), { code: 'INVALID_TOKEN' });
  });

  test('duplicate emails do not consume uses; campaign payload cannot request lifetime', async () => {
    const user = await invited();
    const issued = await service.createShareInvitation(actor, { label: 'Friends', maxUses: 3, expiresInDays: 1 });
    const payload = { token: tokenFrom(issued), email: user.email.toUpperCase(), name: 'Duplicate', password };
    await assert.rejects(service.redeemShare(payload), { code: 'USER_EXISTS' });
    assert.equal((await service.shareInvitations(actor)).invitations.find(item => item.id === issued.invitation.id)?.uses, 0);
    assert.equal(ShareRedemptionInputSchema.safeParse({ ...payload, access: 'lifetime' }).success, false);
    assert.equal(ShareRedemptionInputSchema.safeParse({ ...payload, role: 'admin' }).success, false);
    const revoked = await service.createShareInvitation(actor, { label: 'Revoked', maxUses: 1, expiresInDays: 1 });
    await service.revokeShareInvitation(actor, revoked.invitation.id);
    await assert.rejects(service.redeemShare({ ...payload, token: tokenFrom(revoked) }), { code: 'INVALID_TOKEN' });
    clock = new Date(issued.invitation.expiresAt);
    await assert.rejects(service.shareInfo(tokenFrom(issued)), { code: 'INVALID_TOKEN' });
    await assert.rejects(service.redeemShare(payload), { code: 'INVALID_TOKEN' });
  });
});
