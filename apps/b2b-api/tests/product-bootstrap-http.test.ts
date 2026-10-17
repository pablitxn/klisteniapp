import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiServer } from '../src/http.ts';
import { createAuth } from '../src/auth.ts';
import { ProductBootstrapSchema } from '@klisteniapp/b2b-contracts/product-v2';
import { productFixture, databaseUrl } from './support/product-fixture.ts';

test(
  'explicit unified bootstrap preserves full topology and requires a positive origin session',
  { skip: !databaseUrl },
  async () =>
    productFixture(async (f) => {
      const config = { ...f.config, productUnified: true };
      const auth = createAuth(f.pool, config);
      const password = 'synthetic-unified-bootstrap-password';
      const hash = await (await auth.$context).password.hash(password);
      await f.pool.query(
        `INSERT INTO b2b_auth_account(id,"userId","accountId","providerId",password,"createdAt","updatedAt") SELECT 'http-'||id,id,id,'credential',$1,now(),now() FROM b2b_auth_user WHERE id IN ('super','member','inactive')`,
        [hash],
      );
      const server = createApiServer({ config, auth, pool: f.pool });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      const base = `http://127.0.0.1:${address.port}/api/b2b`;
      try {
        for (const actor of ['super', 'member', 'inactive']) {
          await f.pool.query('DELETE FROM b2b_auth_rate_limit');
          const headers = {
            'content-type': 'application/json',
            origin: config.origin,
            'x-klisteni-b2b-contract': '2',
          };
          const login = await fetch(base + '/auth/sign-in/email', {
            method: 'POST',
            headers,
            body: JSON.stringify({ email: actor + '@example.test', password }),
          });
          assert.equal(login.status, 200, await login.clone().text());
          const cookie = login.headers
            .getSetCookie()
            .map((c) => c.split(';')[0])
            .join('; ');
          const h = { ...headers, cookie, 'x-klisteni-b2b-account': actor };
          const get = await fetch(base + '/bootstrap/v2', { headers: h });
          assert.equal(get.status, 200, await get.clone().text());
          const boot = ProductBootstrapSchema.parse(await get.json());
          assert.equal(boot.realm.mode, 'unified');
          assert.equal(boot.user.id, actor);
          const atlas = boot.memberships.find((m) => m.organizationId === 'atlas')!;
          assert.ok(atlas);
          if (actor === 'super') {
            assert.equal(boot.memberships.length, 2);
            assert.ok(
              atlas.choices.some((c) => c.branchId === 'atlas-north' && c.role === 'superadmin'),
            );
          }
          if (actor === 'inactive') {
            assert.equal(atlas.accessMode, 'export-only');
            assert.deepEqual(atlas.choices, []);
          }
          const access = await fetch(base + '/orgs/atlas/product/v2/access', {
            headers: {
              ...h,
              'x-klisteni-b2b-branch': 'atlas-principal',
              'x-klisteni-b2b-role': actor === 'super' ? 'superadmin' : 'member',
            },
          });
          assert.equal(access.status, 200, await access.clone().text());
          assert.equal((await fetch(base + '/me', { headers: h })).status, 503);
          assert.equal((await fetch(base + '/auth/get-session', { headers: h })).status, 503);
          const payload = (await login.json()) as { token: string };
          await f.pool.query(
            'DELETE FROM b2b_unified_session_context WHERE session_id=(SELECT id FROM b2b_auth_session WHERE token=$1)',
            [payload.token],
          );
          assert.equal((await fetch(base + '/bootstrap/v2', { headers: h })).status, 401);
          assert.equal(
            (await fetch(base + '/orgs/atlas/product/v2/access', { headers: h })).status,
            401,
          );
        }
        assert.equal(
          (await f.pool.query("SELECT count(*) FROM b2b_branch WHERE organization_id='atlas'"))
            .rows[0].count,
          '2',
        );
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    }),
);
