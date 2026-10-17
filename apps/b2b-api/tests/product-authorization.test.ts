import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpError } from '../src/errors.ts';
import {
  productPeople,
  updateProductMember,
  inviteProductMember,
} from '../src/auth/product-people.ts';
import { productCapabilities } from '../src/auth/product-policy.ts';
import { databaseUrl, productFixture } from './support/product-fixture.ts';
import { createApiServer } from '../src/http.ts';
import { createUser } from '../src/service.ts';
import { productOperation } from '../src/audit/product-audit.ts';

const code =
  (...codes: string[]) =>
  (error: unknown) =>
    error instanceof HttpError && codes.includes(error.code);
const branch = 'atlas-principal';

test(
  'v2 reads and retries queued behind revocation recheck session, membership, branch and host generation',
  { skip: !databaseUrl },
  async () => {
    for (const [revoked, mode] of ['session', 'membership', 'branch', 'domain'].flatMap((revoked) =>
      ['read', 'retry'].map((mode) => [revoked, mode]),
    )) {
      await productFixture(async ({ scoped, pool, schema }) => {
        const domain =
          revoked === 'domain'
            ? {
                id: 'atlas.b2b.test',
                host: 'atlas.b2b.test',
                organizationId: 'atlas',
                generation: 1,
                origin: 'https://atlas.b2b.test',
                canonicalOrigin: 'https://atlas.b2b.test',
                primaryHost: 'atlas.b2b.test',
                isPrimary: true,
              }
            : undefined;
        if (domain)
          await pool.query(`INSERT INTO b2b_domain(host,organization_id,status,primary_domain,verified_at,dns_verified_at,tls_verified_at,tls_expires_at)
        VALUES('atlas.b2b.test','atlas','active',true,now(),now(),now(),now()+interval '1 day');
        INSERT INTO b2b_session_context(session_id,organization_id,domain_host,domain_generation) VALUES('session-coach','atlas','atlas.b2b.test',1);`);
        const retry = { operationId: 'accepted-before-revocation', expectedRevision: 0 };
        if (mode === 'retry')
          await scoped(
            'coach',
            branch,
            true,
            (c) =>
              productOperation(c, 'planning.edit', retry, 'routine', async () => ({
                response: { revision: 1 },
                revision: 1,
              })),
            { domain },
          );
        const lock = await pool.connect();
        let executed = false;
        try {
          await lock.query('BEGIN');
          await lock.query("SELECT id FROM b2b_organization WHERE id='atlas' FOR UPDATE");
          const pending = scoped(
            'coach',
            branch,
            mode === 'retry',
            async (c) => {
              executed = true;
              if (mode === 'retry')
                return productOperation(c, 'planning.edit', retry, 'routine', async () => {
                  throw new Error('A retry must return its prior receipt');
                });
              return undefined;
            },
            { domain },
          );
          // Attach a rejection handler before releasing the lock.
          const rejected = assert.rejects(
            pending,
            code(
              'UNAUTHENTICATED',
              'MEMBERSHIP_REQUIRED',
              'BRANCH_FORBIDDEN',
              'BRAND_SESSION_REQUIRED',
            ),
          );
          let queued = false;
          for (let attempt = 0; attempt < 100; attempt++) {
            queued = Boolean(
              (
                await pool.query(
                  `SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE 'SELECT * FROM b2b_organization%'`,
                  [schema],
                )
              ).rowCount,
            );
            if (queued) break;
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          assert.ok(queued, 'Request queued behind organization revocation lock');
          if (revoked === 'session')
            await lock.query("DELETE FROM b2b_auth_session WHERE id='session-coach'");
          if (revoked === 'membership')
            await lock.query(
              "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='coach'",
            );
          if (revoked === 'branch')
            await lock.query(
              "UPDATE b2b_branch_grant SET active=false WHERE organization_id='atlas' AND user_id='coach'",
            );
          if (revoked === 'domain')
            await lock.query(
              "UPDATE b2b_domain SET generation=generation+1 WHERE host='atlas.b2b.test'",
            );
          await lock.query('COMMIT');
          await rejected;
          assert.equal(executed, false);
        } finally {
          await lock.query('ROLLBACK');
          lock.release();
        }
      });
    }
  },
);

test(
  'HTTP mounts composed v2 handlers, validates path IDs and versions, and keeps activation disabled',
  { skip: !databaseUrl },
  async () =>
    productFixture(async ({ pool, service, auth, config }) => {
      // Unified HTTP supports one branch per brand; multi-branch HTTP requires the
      // separately tested white-label domain boundary.
      await pool.query(
        "DELETE FROM b2b_branch_grant WHERE branch_id IN ('atlas-north','sur-north'); DELETE FROM b2b_branch WHERE id IN ('atlas-north','sur-north')",
      );
      const user = await service.transaction(async (db) => {
        const user = await createUser(db, auth, {
          name: 'HTTP Admin',
          email: 'http-admin@example.test',
          password: 'synthetic-http-password',
        });
        await db.query(
          "INSERT INTO b2b_membership(organization_id,user_id,role,product_role) VALUES('atlas',$1,'admin','superadmin')",
          [user.id],
        );
        return user;
      });
      const login = await auth.handler(
        new Request(`${config.origin}/api/b2b/auth/sign-in/email`, {
          method: 'POST',
          headers: { origin: config.origin, 'content-type': 'application/json' },
          body: JSON.stringify({ email: user.email, password: 'synthetic-http-password' }),
        }),
      );
      assert.equal(login.status, 200);
      const cookie = login.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
      const server = createApiServer({ config, pool, auth, service });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      const base = `http://127.0.0.1:${address.port}/api/b2b/orgs/atlas/product/v2`;
      const headers = {
        cookie,
        origin: config.origin,
        'x-klisteni-b2b-account': user.id,
        'x-klisteni-b2b-branch': branch,
        'x-klisteni-b2b-contract': '2',
        'content-type': 'application/json',
      };
      try {
        assert.equal((await fetch(`${base}/people`, { headers })).status, 200);
        const anonymous = await fetch(`${base}/capabilities`);
        assert.equal(anonymous.status, 401);
        assert.equal(
          (
            await fetch(`${base}/people`, {
              headers: { ...headers, 'x-klisteni-b2b-contract': '1' },
            })
          ).status,
          426,
        );
        const routines = await fetch(`${base}/routines`, { headers });
        assert.equal(routines.status, 200);
        assert.deepEqual(await routines.json(), []);
        const catalog = await fetch(`${base}/catalog/exercises`, { headers });
        assert.equal(catalog.status, 200);
        assert.ok(
          (await catalog.json()).some((exercise: { id: string }) => exercise.id === 'pushup'),
        );
        const publications = await fetch(`${base}/routine-publications`, { headers });
        assert.equal(publications.status, 200);
        assert.deepEqual(await publications.json(), []);
        assert.equal((await fetch(`${base}/routines/unknown/versions/1`, { headers })).status, 404);
        assert.equal(
          (await fetch(`${base}/routines/unknown/versions/01`, { headers })).status,
          400,
        );
        assert.equal(
          (
            await fetch(`${base}/people/member`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                memberId: 'foreign',
                operationId: 'path-mismatch',
                expectedRevision: 0,
                active: false,
              }),
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await fetch(`${base}/people/member`, {
              method: 'POST',
              headers: { ...headers, 'x-klisteni-b2b-account': 'foreign' },
              body: JSON.stringify({
                memberId: 'member',
                operationId: 'account-mismatch',
                expectedRevision: 0,
                active: false,
              }),
            })
          ).status,
          401,
        );
        await pool.query("UPDATE b2b_organization SET product_active=false WHERE id='atlas'");
        const discovery = await fetch(`${base}/capabilities`, { headers });
        assert.equal(discovery.status, 200);
        assert.equal((await discovery.json()).activated, false);
        assert.equal((await fetch(`${base}/people`, { headers })).status, 409);
        assert.equal(
          (await pool.query("SELECT product_active FROM b2b_organization WHERE id='sur'")).rows[0]
            .product_active,
          true,
        );
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    }),
);
test('product role capabilities preserve hierarchy without platform or health bypass powers', () => {
  assert.ok(productCapabilities('superadmin').includes('manage-admins'));
  assert.ok(productCapabilities('admin').includes('manage-people'));
  assert.ok(!productCapabilities('admin').includes('manage-admins'));
  assert.ok(!productCapabilities('coach').includes('manage-people'));
  assert.ok(productCapabilities('coach').includes('read-consented-health'));
  assert.ok(productCapabilities('superadmin').every((c) => !c.includes('platform')));
});

test(
  'unassigned trainers share only the selected authorized branch; inactive history is distinct from planning',
  { skip: !databaseUrl },
  async () =>
    productFixture(async ({ scoped, pool }) => {
      await scoped('coach', branch, false, async (c) => {
        await c.authorizeMember('member', 'planning');
        await c.authorizeMember('unassigned', 'history');
        await c.authorizeMember('inactive', 'history');
        await assert.rejects(c.authorizeMember('inactive', 'planning'), code('NOT_FOUND'));
        await assert.rejects(c.authorizeMember('north-member', 'planning'), code('NOT_FOUND'));
        await assert.rejects(c.authorizeMember('foreign', 'history'), code('NOT_FOUND'));
        const roster = await productPeople(c);
        assert.ok(roster.some((m) => m.userId === 'unassigned'));
        assert.ok(!roster.some((m) => m.userId === 'foreign'));
        assert.ok(
          !roster.some((m) => m.userId === 'north-member' && m.branchGrants.some((g) => g.active)),
        );
        assert.ok(roster.every((m) => m.branchGrants.every((g) => g.branchId === branch)));
      });
      await assert.rejects(
        scoped('coach', 'atlas-north', false, async () => true),
        code('BRANCH_FORBIDDEN'),
      );
      await assert.rejects(
        scoped('coach', 'sur-principal', false, async () => true),
        code('NOT_FOUND'),
      );
      await scoped('coach', undefined, false, async (c) => assert.equal(c.branchId, branch));
      await pool.query(
        "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas','atlas-north','coach','member')",
      );
      await assert.rejects(
        scoped('coach', undefined, false, async () => true),
        code('BRANCH_REQUIRED'),
      );
      await scoped('coach', 'atlas-north', false, async (c) => {
        assert.equal(c.role, 'member');
        assert.ok(!c.capabilities.has('edit-planning'));
        await assert.rejects(c.authorizeMember('north-member', 'history'), code('FORBIDDEN'));
      });
    }),
);

test(
  'admin cannot create or promote privileged roles; superadmin promotion preserves branch grants',
  { skip: !databaseUrl },
  async () =>
    productFixture(async ({ scoped, pool }) => {
      for (const role of ['admin', 'superadmin'] as const) {
        await assert.rejects(
          scoped('admin', branch, true, (c) =>
            updateProductMember(c, {
              memberId: 'member',
              role,
              operationId: `promote-${role}`,
              expectedRevision: 0,
            }),
          ),
          code('FORBIDDEN'),
        );
        await assert.rejects(
          scoped('admin', branch, true, (c) =>
            inviteProductMember(
              c,
              {
                id: `invite-${role}`,
                role,
                name: 'Invite',
                email: 'invite@example.test',
                branchGrants: [],
                operationId: `invite-${role}`,
                expectedRevision: 0,
              },
              'http://localhost:4200',
            ),
          ),
          code('FORBIDDEN'),
        );
      }
      await assert.rejects(
        scoped('admin', branch, true, (c) =>
          updateProductMember(c, {
            memberId: 'super',
            active: false,
            operationId: 'disable-super',
            expectedRevision: 0,
          }),
        ),
        code('FORBIDDEN'),
      );
      const before = (await pool.query("SELECT * FROM b2b_branch_grant WHERE user_id='member'"))
        .rows;
      const promoted = await scoped('super', branch, true, (c) =>
        updateProductMember(c, {
          memberId: 'member',
          role: 'admin',
          operationId: 'allowed-promotion',
          expectedRevision: 0,
        }),
      );
      assert.equal(promoted.role, 'admin');
      assert.deepEqual(
        (await pool.query("SELECT * FROM b2b_branch_grant WHERE user_id='member'")).rows,
        before,
      );
      assert.equal(
        (await pool.query("SELECT count(*) FROM b2b_platform_admin WHERE user_id='member'")).rows[0]
          .count,
        '0',
      );
      await assert.rejects(
        scoped('coach', branch, true, (c) =>
          updateProductMember(c, {
            memberId: 'coach',
            role: 'superadmin',
            operationId: 'self-escalate',
            expectedRevision: 0,
          }),
        ),
        code('FORBIDDEN'),
      );
    }),
);

test(
  'permission retries return original receipts after successors; branch changes advance revisions and reject foreign grants',
  { skip: !databaseUrl },
  async () =>
    productFixture(async ({ scoped, pool }) => {
      const first = {
        memberId: 'member',
        active: false,
        operationId: 'pause',
        expectedRevision: 0,
      };
      const paused = await scoped('super', branch, true, (c) => updateProductMember(c, first));
      await scoped('super', branch, true, (c) =>
        updateProductMember(c, {
          memberId: 'member',
          active: true,
          operationId: 'resume',
          expectedRevision: paused.revision,
        }),
      );
      assert.deepEqual(
        await scoped('super', branch, true, (c) => updateProductMember(c, first)),
        paused,
      );
      await assert.rejects(
        scoped('super', branch, true, (c) => updateProductMember(c, { ...first, active: true })),
        code('OPERATION_CONFLICT'),
      );
      await assert.rejects(
        scoped('super', branch, true, (c) =>
          updateProductMember(c, {
            memberId: 'member',
            branchGrants: [{ branchId: 'sur-principal', role: 'coach', active: true }],
            operationId: 'foreign-grant',
            expectedRevision: 2,
          }),
        ),
        code('NOT_FOUND'),
      );
      const changed = await scoped('super', branch, true, (c) =>
        updateProductMember(c, {
          memberId: 'member',
          branchGrants: [],
          operationId: 'revoke-grant',
          expectedRevision: 2,
        }),
      );
      assert.equal(changed.revision, 3);
      assert.ok(changed.branchGrants.every((g) => !g.active));
      assert.equal(
        (await pool.query("SELECT count(*) FROM b2b_audit WHERE operation_id='pause'")).rows[0]
          .count,
        '1',
      );
    }),
);

test(
  'competing superadmin removals serialize and preserve the last active superadmin',
  { skip: !databaseUrl },
  async () =>
    productFixture(async ({ scoped, pool }) => {
      const results = await Promise.allSettled([
        scoped('super', branch, true, (c) =>
          updateProductMember(c, {
            memberId: 'super',
            active: false,
            expectedRevision: 0,
            operationId: 'remove-one',
          }),
        ),
        scoped('second', branch, true, (c) =>
          updateProductMember(c, {
            memberId: 'second',
            active: false,
            expectedRevision: 0,
            operationId: 'remove-two',
          }),
        ),
      ]);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      const rejected = results.find((r) => r.status === 'rejected');
      assert.ok(rejected?.status === 'rejected' && code('LAST_SUPERADMIN')(rejected.reason));
      assert.equal(
        (
          await pool.query(
            "SELECT count(*) FROM b2b_membership WHERE organization_id='atlas' AND active AND product_role='superadmin'",
          )
        ).rows[0].count,
        '1',
      );
    }),
);
