import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createAuth } from '../src/auth.ts';
import { createApiServer } from '../src/http.ts';
import { B2BService } from '../src/service.ts';
import { ProductAccessSchema, PersonalExportSchema } from '@klisteniapp/b2b-contracts/product-v2';
import { fixture, seedHistory } from './wp06/fixture.ts';
import { emptyHealth, grantInput, measurement } from './fixtures/health.ts';
import { createHealthServices } from '../src/health/index.ts';
import { databaseUrl } from './support/product-fixture.ts';

async function httpFixture(
  run: (f: {
    source: Parameters<Parameters<typeof fixture>[0]>[0];
    client: (
      actor: string,
      host?: string,
    ) => {
      login: (contract?: string) => Promise<Response>;
      request: (
        method: string,
        path: string,
        value?: unknown,
        extra?: Record<string, string>,
      ) => Promise<Response>;
      cookie: string;
    };
  }) => Promise<void>,
) {
  await fixture(async (source) => {
    const config = {
      ...source.config,
      origin: 'http://atlas.b2b.test',
      whiteLabel: true,
      proxySecret: 'inactive-http-proxy-secret-12345678901234567890',
      domainProtocol: 'http' as const,
      b2cInvitationUrl: 'https://separate-product.example.test/join',
    };
    const auth = createAuth(source.pool, config),
      service = new B2BService(source.pool, auth, config);
    const password = 'synthetic-inactive-http-password';
    const hash = await (await auth.$context).password.hash(password);
    for (const id of ['member', 'super', 'inactive', 'foreign'])
      await source.pool.query(
        `INSERT INTO b2b_auth_account(id,"userId","accountId","providerId",password,"createdAt","updatedAt") VALUES($1,$2,$2,'credential',$3,now(),now())`,
        [`http-${id}`, id, hash],
      );
    const server = createApiServer({ config, pool: source.pool, auth, service });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/b2b`;
    const client = (actor: string, host = 'atlas.b2b.test') => {
      const c = {
        cookie: '',
        request: async (
          method: string,
          path: string,
          value?: unknown,
          extra: Record<string, string> = {},
        ) =>
          fetch(base + path, {
            method,
            headers: {
              origin: `http://${host}`,
              'content-type': 'application/json',
              'x-klisteni-b2b-host': host,
              'x-klisteni-b2b-proto': 'http',
              'x-klisteni-b2b-proxy-secret': config.proxySecret,
              'x-klisteni-b2b-account': actor,
              'x-klisteni-b2b-contract': '2',
              ...(c.cookie ? { cookie: c.cookie } : {}),
              ...extra,
            },
            ...(value === undefined ? {} : { body: JSON.stringify(value) }),
          }),
        login: async (contract = '2') => {
          await source.pool.query('DELETE FROM b2b_auth_rate_limit');
          const r = await c.request(
            'POST',
            '/auth/sign-in/email',
            { email: `${actor}@example.test`, password },
            { 'x-klisteni-b2b-contract': contract },
          );
          if (r.ok)
            c.cookie = r.headers
              .getSetCookie()
              .map((v) => v.split(';')[0])
              .join('; ');
          return r;
        },
      };
      return c;
    };
    try {
      await run({ source, client });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
}
const status = async (response: Response, expected: number) =>
  assert.equal(response.status, expected, await response.clone().text());

test(
  'inactive correct-host login admits only own complete export/discovery/invitation and denies gym, media and retry routes',
  { skip: !databaseUrl },
  async () =>
    httpFixture(async ({ source, client }) => {
      const history = await seedHistory(source.pool, 'inactive', 'inactive-');
      const c = client('inactive');
      await status(await c.login(), 200);
      const accessResponse = await c.request('GET', '/orgs/atlas/product/v2/access');
      await status(accessResponse, 200);
      const access = ProductAccessSchema.parse(await accessResponse.json());
      assert.equal(access.accessMode, 'export-only');
      assert.deepEqual(access.branches, []);
      assert.deepEqual(access.capabilities, ['export-own-records']);
      await status(await c.request('GET', '/orgs/atlas/product/v2/capabilities'), 200);
      const exported = await c.request('GET', '/self/exports?organizationId=atlas', undefined, {
        'x-klisteni-b2b-branch': 'revoked-branch',
        'x-klisteni-b2b-role': 'superadmin',
      });
      await status(exported, 200);
      assert.match(exported.headers.get('cache-control') ?? '', /private.*|no-store/);
      assert.match(exported.headers.get('content-disposition') ?? '', /attachment/);
      const data = PersonalExportSchema.parse(await exported.json());
      assert.equal(data.ownerId, 'inactive');
      assert.equal(data.serverAcceptedOnly, true);
      assert.deepEqual(data.training[0].routines[0], {
        schemaVersion: 1,
        snapshot: history.routine,
      });
      assert.equal(data.training[0].sessionRevisions.length, 2);
      const invitation = await c.request('GET', '/self/b2c-invitation?organizationId=atlas');
      await status(invitation, 200);
      assert.deepEqual(await invitation.json(), {
        separateProduct: true,
        paid: true,
        automaticConversion: false,
        url: 'https://separate-product.example.test/join',
      });
      for (const [method, path] of [
        ['GET', '/me'],
        ['GET', '/context'],
        ['GET', '/auth/get-session'],
        ['POST', '/auth/change-password'],
        ['GET', '/orgs/atlas/product/v2/routines'],
        ['GET', '/orgs/atlas/product/v2/health/own'],
        ['GET', '/orgs/atlas/product/v2/members/inactive/sessions'],
        ['POST', '/orgs/atlas/product/v2/sessions/new/revisions'],
        ['GET', '/orgs/atlas/product/v2/operations/accepted'],
        ['GET', '/orgs/atlas/assignments'],
        ['GET', '/history/executions'],
        ['GET', '/media/private'],
        ['HEAD', '/media/private'],
        ['HEAD', '/self/exports?organizationId=atlas'],
        ['POST', '/self/exports?organizationId=atlas'],
        ['POST', '/orgs/atlas/media'],
      ])
        await status(await c.request(method, path, method === 'POST' ? {} : undefined), 403);
      await status(
        await c.request('GET', '/self/exports?organizationId=atlas', undefined, {
          range: 'bytes=0-10',
        }),
        403,
      );
      for (const query of [
        'organizationId=atlas&organizationId=sur',
        'organizationId=atlas&ownerId=member',
        'organizationId=atlas&branchId=atlas-north',
      ])
        await status(await c.request('GET', `/self/exports?${query}`), 400);
      await status(await c.request('GET', '/self/exports?organizationId=sur'), 403);
      const copied = client('inactive', 'sur.b2b.test');
      copied.cookie = c.cookie;
      await status(await copied.request('GET', '/self/exports?organizationId=sur'), 401);
      await source.pool.query("UPDATE b2b_organization SET product_active=false WHERE id='atlas'");
      await status(
        await c.request('POST', '/auth/sign-out', {}, { 'x-klisteni-b2b-contract': '' }),
        200,
      );
      await status(await c.request('GET', '/self/exports?organizationId=atlas'), 401);
    }),
);

test(
  'failed inactive or foreign login cleans the fresh session and returns no cookie',
  { skip: !databaseUrl },
  async () =>
    httpFixture(async ({ source, client }) => {
      const sessions = async (id: string) =>
        (
          await source.pool.query('SELECT id FROM b2b_auth_session WHERE "userId"=$1 ORDER BY id', [
            id,
          ])
        ).rows;
      const before = await sessions('inactive');
      const c = client('inactive');
      const legacy = await c.login('1');
      await status(legacy, 426);
      assert.deepEqual(legacy.headers.getSetCookie(), []);
      assert.deepEqual(await sessions('inactive'), before);
      await source.pool.query("UPDATE b2b_organization SET product_active=false WHERE id='atlas'");
      const inactive = await c.login();
      await status(inactive, 409);
      assert.deepEqual(inactive.headers.getSetCookie(), []);
      assert.deepEqual(await sessions('inactive'), before);
      const foreignBefore = await sessions('foreign');
      const foreign = await client('foreign').login();
      await status(foreign, 401);
      assert.deepEqual(foreign.headers.getSetCookie(), []);
      assert.deepEqual(await sessions('foreign'), foreignBefore);
    }),
);

test(
  'stale active cookies become export-only atomically and reactivation restores history without consent or revoked grants',
  { skip: !databaseUrl },
  async () =>
    httpFixture(async ({ source, client }) => {
      await seedHistory(source.pool);
      const health = createHealthServices();
      await source.scoped('member', 'atlas-principal', true, (c) =>
        health.saveOwnHealth(c, {
          operationId: 'http-private',
          expectedRevision: 0,
          data: { ...emptyHealth(), measurements: [measurement()] },
        }),
      );
      await source.scoped('member', 'atlas-principal', true, (c) =>
        health.grantHealthConsent(c, grantInput()),
      );
      const member = client('member'),
        admin = client('super');
      await status(await member.login(), 200);
      await status(await admin.login(), 200);
      const paused = await admin.request(
        'POST',
        '/orgs/atlas/product/v2/people/member',
        { memberId: 'member', active: false, expectedRevision: 0, operationId: 'http-pause' },
        { 'x-klisteni-b2b-branch': 'atlas-principal', 'x-klisteni-b2b-role': 'superadmin' },
      );
      await status(paused, 200);
      const changed = await paused.json();
      await status(
        await member.request('GET', '/orgs/atlas/product/v2/health/own', undefined, {
          'x-klisteni-b2b-branch': 'atlas-principal',
        }),
        403,
      );
      const download = await member.request('GET', '/self/exports?organizationId=atlas');
      await status(download, 200);
      assert.equal(
        PersonalExportSchema.parse(await download.json()).health.data.measurements[0].weightKg,
        80,
      );
      assert.ok(
        (
          await source.pool.query(
            "SELECT revoked_at FROM b2b_health_consent WHERE owner_id='member'",
          )
        ).rows[0].revoked_at,
      );
      await source.pool.query(
        "UPDATE b2b_branch_grant SET active=false WHERE organization_id='atlas' AND user_id='member'",
      );
      await status(
        await admin.request(
          'POST',
          '/orgs/atlas/product/v2/people/member',
          {
            memberId: 'member',
            active: true,
            expectedRevision: changed.revision,
            operationId: 'http-resume',
          },
          { 'x-klisteni-b2b-branch': 'atlas-principal', 'x-klisteni-b2b-role': 'superadmin' },
        ),
        200,
      );
      await status(await member.request('GET', '/self/exports?organizationId=atlas'), 200);
      await status(
        await member.request('GET', '/orgs/atlas/product/v2/members/member/sessions', undefined, {
          'x-klisteni-b2b-branch': 'atlas-principal',
        }),
        403,
      );
      assert.ok(
        (
          await source.pool.query(
            "SELECT revoked_at FROM b2b_health_consent WHERE owner_id='member'",
          )
        ).rows[0].revoked_at,
      );
      assert.equal(
        (
          await source.pool.query(
            "SELECT count(*)::int AS count FROM b2b_branch_grant WHERE organization_id='atlas' AND user_id='member' AND active",
          )
        ).rows[0].count,
        0,
      );
    }),
);
