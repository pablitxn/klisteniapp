import assert from 'node:assert/strict';
import { test } from 'node:test';
import { productFixture, databaseUrl } from './support/product-fixture.ts';
import { inviteProductMember } from '../src/auth/product-people.ts';
import { B2BService } from '../src/service.ts';
import { createAuth } from '../src/auth.ts';
import { createApiServer } from '../src/http.ts';
const tokenOf = (url: string) => new URLSearchParams(new URL(url).hash.slice(1)).get('token')!;
const password = 'synthetic-invitation-only-password';

test(
  'explicit invitation arrays retain mixed multibranch/inactive grants; empty arrays never gain Principal',
  { skip: !databaseUrl },
  async () => {
    await productFixture(async ({ scoped, pool, service }) => {
      const lists = [
        [
          { branchId: 'atlas-north', role: 'coach' as const, active: true },
          { branchId: 'atlas-north', role: 'member' as const, active: true },
          { branchId: 'atlas-principal', role: 'member' as const, active: false },
        ],
        [],
      ];
      for (const [i, branchGrants] of lists.entries()) {
        const input = {
          id: `explicit-${i}`,
          email: `explicit-${i}@example.test`,
          name: 'Explicit recipient',
          role: 'coach' as const,
          operationId: `invite-${i}`,
          expectedRevision: 0,
          branchGrants,
        };
        const invitation = await scoped('super', 'atlas-principal', true, (c) =>
          inviteProductMember(c, input, 'http://localhost:4200'),
        );
        assert.deepEqual(
          await scoped('super', 'atlas-principal', true, (c) =>
            inviteProductMember(c, input, 'http://localhost:4200'),
          ),
          invitation,
        );
        const stored = (
          await pool.query('SELECT branch_id,branch_grants FROM b2b_invitation WHERE id=$1', [
            input.id,
          ])
        ).rows[0];
        assert.equal(stored.branch_id, null);
        assert.deepEqual(stored.branch_grants, branchGrants);
        await service.acceptInvitation(tokenOf(invitation.invitationUrl), {
          name: input.name,
          password,
        });
        const actual = (
          await pool.query(
            'SELECT g.branch_id AS "branchId",g.role,g.active FROM b2b_branch_grant g JOIN b2b_auth_user u ON u.id=g.user_id WHERE u.email=$1 ORDER BY g.branch_id,g.role',
            [input.email],
          )
        ).rows;
        assert.deepEqual(
          actual,
          [...branchGrants].sort((a, b) =>
            `${a.branchId}:${a.role}`.localeCompare(`${b.branchId}:${b.role}`),
          ),
        );
      }
    });
  },
);
test(
  'grant acceptance revalidates branch status and malformed persisted snapshots never fall back to Principal',
  { skip: !databaseUrl },
  async () => {
    await productFixture(async ({ scoped, pool, service }) => {
      const make = (id: string) =>
        scoped('super', 'atlas-principal', true, (c) =>
          inviteProductMember(
            c,
            {
              id,
              email: `${id}@example.test`,
              name: id,
              role: 'member',
              operationId: id,
              expectedRevision: 0,
              branchGrants: [{ branchId: 'atlas-north', role: 'member', active: true }],
            },
            'http://localhost:4200',
          ),
        );
      const revoked = await make('branch-revoked');
      await pool.query("UPDATE b2b_branch SET status='archived' WHERE id='atlas-north'");
      await assert.rejects(
        service.acceptInvitation(tokenOf(revoked.invitationUrl), { name: 'Recipient', password }),
        { status: 404 },
      );
      await pool.query("UPDATE b2b_branch SET status='active' WHERE id='atlas-north'");
      const invalid = await make('invalid-snapshot');
      await pool.query(
        'UPDATE b2b_invitation SET branch_grants=\'[{"branchId":"atlas-north","role":"member","active":true},{"branchId":"atlas-north","role":"member","active":true}]\' WHERE id=\'invalid-snapshot\'',
      );
      await assert.rejects(
        service.acceptInvitation(tokenOf(invalid.invitationUrl), { name: 'Recipient', password }),
      );
      assert.equal(
        (
          await pool.query(
            "SELECT 1 FROM b2b_auth_user WHERE email IN ('branch-revoked@example.test','invalid-snapshot@example.test')",
          )
        ).rowCount,
        0,
      );
      assert.equal(
        (await pool.query('SELECT 1 FROM b2b_invitation WHERE used_at IS NOT NULL')).rowCount,
        0,
      );
    });
  },
);
test(
  'unified invitation password admission consumes exact grants and binds only the fresh session; failed admission forwards no cookie',
  { skip: !databaseUrl },
  async () => {
    await productFixture(async (f) => {
      const config = { ...f.config, productUnified: true };
      const auth = createAuth(f.pool, config);
      const hash = await (await auth.$context).password.hash(password);
      await f.pool.query(
        `INSERT INTO b2b_auth_user(id,name,email,"emailVerified","createdAt","updatedAt") VALUES('invitee','Invitee','invitee@example.test',true,now(),now())`,
      );
      await f.pool.query(
        `INSERT INTO b2b_auth_account(id,"userId","accountId","providerId",password,"createdAt","updatedAt") VALUES('invitee-account','invitee','invitee','credential',$1,now(),now())`,
        [hash],
      );
      const invitation = await f.scoped('super', 'atlas-principal', true, (c) =>
        inviteProductMember(
          c,
          {
            id: 'unified-invite',
            email: 'invitee@example.test',
            name: 'Invitee',
            role: 'member',
            operationId: 'unified-invite',
            expectedRevision: 0,
            branchGrants: [{ branchId: 'atlas-north', role: 'member', active: true }],
          },
          config.origin,
        ),
      );
      const server = createApiServer({ config, auth, pool: f.pool });
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      const base = `http://127.0.0.1:${address.port}/api/b2b`;
      const headers = {
        'content-type': 'application/json',
        origin: config.origin,
        'x-klisteni-b2b-contract': '2',
      };
      const post = (path: string, body: unknown) =>
        fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
      try {
        const ordinary = await post('/auth/sign-in/email', {
          email: 'invitee@example.test',
          password,
        });
        assert.equal(ordinary.status, 401);
        assert.equal(
          (await f.pool.query('SELECT 1 FROM b2b_auth_session WHERE "userId"=\'invitee\''))
            .rowCount,
          0,
        );
        const invalid = await post('/invitations/sign-in', {
          email: 'invitee@example.test',
          password,
          token: 'x'.repeat(40),
          consent: true,
        });
        assert.equal(invalid.status, 400);
        assert.deepEqual(invalid.headers.getSetCookie(), []);
        assert.equal(
          (await f.pool.query('SELECT 1 FROM b2b_auth_session WHERE "userId"=\'invitee\''))
            .rowCount,
          0,
        );
        const accepted = await post('/invitations/sign-in', {
          email: 'invitee@example.test',
          password,
          token: tokenOf(invitation.invitationUrl),
          consent: true,
        });
        assert.equal(accepted.status, 200, await accepted.clone().text());
        const cookie = accepted.headers
          .getSetCookie()
          .map((c) => c.split(';')[0])
          .join('; ');
        const bootstrap = await fetch(base + '/bootstrap/v2', {
          headers: { ...headers, cookie, 'x-klisteni-b2b-account': 'invitee' },
        });
        assert.equal(bootstrap.status, 200, await bootstrap.clone().text());
        const data = (await bootstrap.json()) as {
          user: { id: string };
          memberships: { choices: { branchId: string; role: string }[] }[];
        };
        assert.equal(data.user.id, 'invitee');
        assert.deepEqual(
          data.memberships[0]!.choices.map((c) => [c.branchId, c.role]),
          [['atlas-north', 'member']],
        );
        assert.equal((await fetch(base + '/me', { headers: { ...headers, cookie } })).status, 503);
        assert.equal(
          (
            await f.pool.query(
              'SELECT 1 FROM b2b_unified_session_context b JOIN b2b_auth_session s ON s.id=b.session_id WHERE s."userId"=\'invitee\' AND b.origin=$1',
              [config.origin],
            )
          ).rowCount,
          1,
        );
        const newInvite = await f.scoped('super', 'atlas-principal', true, (c) =>
          inviteProductMember(
            c,
            {
              id: 'new-unified',
              email: 'new-unified@example.test',
              name: 'New',
              role: 'member',
              operationId: 'new-unified',
              expectedRevision: 0,
              branchGrants: [],
            },
            config.origin,
          ),
        );
        const created = await post('/invitations/accept', {
          token: tokenOf(newInvite.invitationUrl),
          name: 'New',
          password,
        });
        assert.equal(created.status, 201, await created.clone().text());
        assert.deepEqual(created.headers.getSetCookie(), []);
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((e) => (e ? reject(e) : resolve())),
        );
      }
    });
  },
);
test(
  'bound unified joins revalidate positive realm inside acceptance and do not consume invitations after revocation',
  { skip: !databaseUrl },
  async () => {
    await productFixture(async (f) => {
      const config = { ...f.config, productUnified: true };
      const service = new B2BService(f.pool, f.auth, config);
      const invitation = await f.scoped('super', 'atlas-principal', true, (c) =>
        inviteProductMember(
          c,
          {
            id: 'bound-join',
            email: 'foreign@example.test',
            name: 'Foreign',
            role: 'member',
            operationId: 'bound-join',
            expectedRevision: 0,
            branchGrants: [],
          },
          config.origin,
        ),
      );
      const existing = { userId: 'foreign', sessionId: 'session-foreign' };
      await assert.rejects(
        service.acceptInvitation(tokenOf(invitation.invitationUrl), undefined, existing),
        { code: 'UNIFIED_SESSION_REQUIRED' },
      );
      assert.equal(
        (await f.pool.query("SELECT used_at FROM b2b_invitation WHERE id='bound-join'")).rows[0]
          .used_at,
        null,
      );
      await f.pool.query(
        'INSERT INTO b2b_unified_session_context(session_id,origin) VALUES($1,$2)',
        [existing.sessionId, config.origin],
      );
      const writer = await f.pool.connect();
      try {
        await writer.query('BEGIN');
        await writer.query("SELECT id FROM b2b_organization WHERE id='atlas' FOR UPDATE");
        const queued = service
          .acceptInvitation(tokenOf(invitation.invitationUrl), undefined, existing)
          .then(
            () => 'accepted',
            (error) => error.code,
          );
        let waiting = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const blocked = await f.pool.query(
            "SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%SELECT * FROM b2b_organization%'",
            [f.schema],
          );
          if (blocked.rowCount) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.ok(waiting, 'Acceptance must be queued behind the organization lock');
        await writer.query('DELETE FROM b2b_unified_session_context WHERE session_id=$1', [
          existing.sessionId,
        ]);
        await writer.query('COMMIT');
        assert.equal(await queued, 'UNIFIED_SESSION_REQUIRED');
        assert.equal(
          (await f.pool.query("SELECT used_at FROM b2b_invitation WHERE id='bound-join'")).rows[0]
            .used_at,
          null,
        );
      } finally {
        await writer.query('ROLLBACK');
        writer.release();
      }
      await f.pool.query(
        'INSERT INTO b2b_unified_session_context(session_id,origin) VALUES($1,$2)',
        [existing.sessionId, config.origin],
      );
      await service.acceptInvitation(tokenOf(invitation.invitationUrl), undefined, existing);
      assert.equal(
        (
          await f.pool.query(
            "SELECT 1 FROM b2b_branch_grant WHERE user_id='foreign' AND organization_id='atlas'",
          )
        ).rowCount,
        0,
      );
    });
  },
);
