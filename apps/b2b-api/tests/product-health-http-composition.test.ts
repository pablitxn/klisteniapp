import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiServer } from '../src/http.ts';
import { createUser } from '../src/service.ts';
import { databaseUrl, productFixture } from './support/product-fixture.ts';
import { emptyHealth, grantInput, measurement } from './fixtures/health.ts';

test(
  'composed HTTP health uses current selected roles, private cache headers and revocable category consent',
  { skip: !databaseUrl },
  async () =>
    productFixture(async ({ pool, service, auth, config }) => {
      // Explicit single-branch HTTP fixture, not acceptance of full-topology unified mode.
      await pool.query(
        "DELETE FROM b2b_branch_grant WHERE branch_id IN ('atlas-north','sur-north'); DELETE FROM b2b_branch WHERE id IN ('atlas-north','sur-north')",
      );
      const identity = async (name: string, coach: boolean) => {
        const user = await service.transaction(async (db) => {
          const user = await createUser(db, auth, {
            name,
            email: `${name}@example.test`,
            password: 'synthetic-http-health-password',
          });
          await db.query(
            "INSERT INTO b2b_membership(organization_id,user_id,role,product_role) VALUES('atlas',$1,'member','member')",
            [user.id],
          );
          if (coach)
            await db.query(
              "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas','atlas-principal',$1,'coach')",
              [user.id],
            );
          return user;
        });
        const login = await auth.handler(
          new Request(`${config.origin}/api/b2b/auth/sign-in/email`, {
            method: 'POST',
            headers: { origin: config.origin, 'content-type': 'application/json' },
            body: JSON.stringify({ email: user.email, password: 'synthetic-http-health-password' }),
          }),
        );
        assert.equal(login.status, 200);
        return {
          user,
          headers: {
            cookie: login.headers
              .getSetCookie()
              .map((v) => v.split(';')[0])
              .join('; '),
            origin: config.origin,
            'content-type': 'application/json',
            'x-klisteni-b2b-account': user.id,
            'x-klisteni-b2b-branch': 'atlas-principal',
            'x-klisteni-b2b-role': coach ? 'coach' : 'member',
            'x-klisteni-b2b-contract': '2',
          },
        };
      };
      const owner = await identity('http-health-owner', false),
        trainer = await identity('http-health-trainer', true);
      const server = createApiServer({ config, pool, auth, service });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      const base = `http://127.0.0.1:${address.port}/api/b2b/orgs/atlas/product/v2`;
      const privateResponse = (response: Response) => {
        assert.match(response.headers.get('cache-control') ?? '', /private/);
        assert.match(response.headers.get('cache-control') ?? '', /no-store/);
        assert.match(response.headers.get('surrogate-control') ?? '', /no-store/);
        assert.equal(response.headers.get('pragma'), 'no-cache');
      };
      const call = async (path: string, actor: typeof owner, body?: unknown) => {
        const response = await fetch(`${base}${path}`, {
          headers: actor.headers,
          ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
        });
        privateResponse(response);
        return response;
      };
      try {
        const anonymous = await fetch(`${base}/health/own`);
        assert.equal(anonymous.status, 401);
        privateResponse(anonymous);
        assert.equal((await call(`/members/${owner.user.id}/health`, trainer)).status, 403);
        const saved = await call('/health/own', owner, {
          operationId: 'http-health-save',
          expectedRevision: 0,
          data: {
            ...emptyHealth(),
            profile: { context: 'Private owner context' },
            measurements: [measurement()],
          },
        });
        assert.equal(saved.status, 200, await saved.clone().text());
        const grant = await call('/health/consents/http-consent', owner, {
          ...grantInput('http-consent'),
          operationId: 'http-health-grant',
        });
        assert.equal(grant.status, 200, await grant.clone().text());
        const consent = await grant.json();
        const disclosed = await call(`/members/${owner.user.id}/health`, trainer);
        assert.equal(disclosed.status, 200, await disclosed.clone().text());
        const projection = await disclosed.json();
        assert.deepEqual(
          projection.categories.map((c: { category: string }) => c.category),
          ['measurements'],
        );
        assert.equal(projection.categories[0].records[0].weightKg, 80);
        assert.equal('profile' in projection, false);
        assert.equal('goals' in projection, false);
        const wrongRole = {
          ...trainer,
          headers: { ...trainer.headers, 'x-klisteni-b2b-role': 'member' },
        };
        assert.equal((await call(`/members/${owner.user.id}/health`, wrongRole)).status, 403);
        const revoke = await call('/health/consents/http-consent/revoke', owner, {
          id: 'http-consent',
          operationId: 'http-health-revoke',
          expectedRevision: consent.revision,
        });
        assert.equal(revoke.status, 200, await revoke.clone().text());
        assert.equal((await call(`/members/${owner.user.id}/health`, trainer)).status, 403);
        assert.equal((await call('/health/own', owner)).status, 200);
        const unsupported = await call('/health/import-preview', owner, {
          operationId: 'http-unsupported-import',
          expectedRevision: 1,
          format: 'csv',
          version: 1,
          raw: 'unsupported',
        });
        assert.equal(unsupported.status, 400);
        assert.equal((await call('/health/own', owner).then((r) => r.json())).revision, 1);
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    }),
);
