import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProductEndpoints } from '@klisteniapp/b2b-contracts/product-v2';
import {
  authorizeExportIdentity,
  bindInactiveBrandSession,
  inactiveAccess,
  inactiveRouteAllowed,
} from '../src/membership/access.ts';
import { requireBrandSession } from '../src/white-label-access.ts';
import { domain, errorCode, fixture } from './wp06/fixture.ts';

test('WP06 inactive identity is export-only without weakening operational brand authorization', async () => {
  await fixture(async (f) => {
    await f.own(async (c) => {
      assert.equal(c.accessMode, 'export-only');
      const access = inactiveAccess(c, 'member');
      assert.deepEqual(access.branches, []);
      assert.deepEqual(access.capabilities, ['export-own-records']);
    }, 'inactive');
    await assert.rejects(
      f.service.transaction((db) =>
        requireBrandSession(db, 'inactive', 'session-inactive', domain),
      ),
      errorCode('BRAND_SESSION_REQUIRED'),
    );
    await assert.rejects(
      f.scoped('inactive', 'atlas-principal', true, async () => 'queued write'),
      errorCode('MEMBERSHIP_REQUIRED'),
    );
  });
});

test('WP06 inactive allowlist denies every operational endpoint, media, HEAD, range, mutation and encoded deep link', () => {
  const permitted = new Set(['personalExport', 'b2cInvitation', 'access', 'capabilities']);
  for (const [key, endpoint] of Object.entries(ProductEndpoints)) {
    const path =
      endpoint.scope === 'self'
        ? `/api/b2b${endpoint.path}`
        : `/api/b2b/orgs/atlas${endpoint.path}`;
    const resolved = path.replace(/:[A-Za-z]+/g, 'record');
    assert.equal(
      inactiveRouteAllowed(endpoint.method, resolved, 'atlas', '2'),
      permitted.has(key),
      key,
    );
    for (const method of ['HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
      assert.equal(inactiveRouteAllowed(method, resolved, 'atlas', '2'), false, `${method} ${key}`);
    assert.equal(inactiveRouteAllowed('GET', resolved, 'atlas', '2', 'bytes=0-9'), false);
  }
  for (const path of [
    '/api/b2b/media/private',
    '/api/b2b/orgs/atlas/executions',
    '/api/b2b/orgs/atlas/units',
    '/api/b2b/self/exports/',
    '/api/b2b/self/%65xports',
    '/api/b2b/orgs/sur/product/v2/access',
    '/api/b2b/auth/change-password',
    '/api/b2b/orgs/atlas/product/v2/operations/replay',
  ])
    for (const method of ['GET', 'HEAD', 'POST'])
      assert.equal(inactiveRouteAllowed(method, path, 'atlas', '2'), false);
  assert.equal(inactiveRouteAllowed('GET', '/api/b2b/self/exports', 'atlas'), false);
  assert.equal(inactiveRouteAllowed('POST', '/api/b2b/auth/sign-out', 'atlas'), true);
});

test('WP06 identity rejects missing/foreign memberships, copied cookies, generation changes and expired sessions', async () => {
  await fixture(async (f) => {
    await assert.rejects(
      f.own(async () => null, 'foreign'),
      errorCode('MEMBERSHIP_REQUIRED'),
    );
    await assert.rejects(
      f.own(async () => null, 'member', 'sur', {
        ...domain,
        organizationId: 'sur',
        host: 'sur.b2b.test',
      }),
      errorCode('MEMBERSHIP_REQUIRED'),
    );
    await assert.rejects(
      f.own(async () => null, 'member', 'atlas', { ...domain, host: 'sur.b2b.test' }),
      errorCode('BRAND_SESSION_REQUIRED'),
    );
    await f.pool.query("UPDATE b2b_domain SET generation=2 WHERE host='atlas.b2b.test'");
    await assert.rejects(
      f.own(async () => null),
      errorCode('BRAND_SESSION_REQUIRED'),
    );
    await f.pool.query(
      "UPDATE b2b_domain SET generation=1 WHERE host='atlas.b2b.test'; UPDATE b2b_auth_session SET \"expiresAt\"=now()-interval '1 hour' WHERE id='session-member'",
    );
    await assert.rejects(
      f.own(async () => null),
      errorCode('CONTEXT_REVOKED'),
    );
    await assert.rejects(
      f.service.transaction((db) =>
        authorizeExportIdentity(db, 'inactive', 'atlas', 'session-inactive', {
          whiteLabel: true,
          contractHeader: '2',
        }),
      ),
      errorCode('CONTEXT_REVOKED'),
    );
  });
});

test('WP06 inactive and active memberships stay tenant-specific and activation/version fences remain strict', async () => {
  await fixture(async (f) => {
    await f.pool.query(
      "INSERT INTO b2b_membership(organization_id,user_id,role) VALUES('sur','inactive','member')",
    );
    await f.own(async (c) => assert.equal(c.accessMode, 'export-only'), 'inactive');
    await f.own(async (c) => assert.equal(c.accessMode, 'active'), 'inactive', 'sur', null);
    await assert.rejects(
      f.scoped('inactive', 'atlas-principal', false, async () => null),
      errorCode('MEMBERSHIP_REQUIRED'),
    );
    await assert.rejects(
      f.service.transaction((db) =>
        authorizeExportIdentity(db, 'inactive', 'atlas', 'session-inactive', {
          domain,
          contractHeader: '1',
        }),
      ),
      errorCode('UPGRADE_REQUIRED'),
    );
    await f.pool.query("UPDATE b2b_organization SET product_active=false WHERE id='atlas'");
    await assert.rejects(
      f.own(async () => null, 'inactive'),
      errorCode('PRODUCT_NOT_ACTIVE'),
    );
  });
});

test('WP06 inactive login admission binds only its verified host and cannot rebind a copied session', async () => {
  await fixture(async (f) => {
    await f.pool.query("DELETE FROM b2b_session_context WHERE session_id='session-inactive'");
    const bind = (selected = domain, actor = 'inactive', header = '2') =>
      f.service.transaction((db) =>
        bindInactiveBrandSession(db, actor, `session-${actor}`, selected, header),
      );
    await assert.rejects(bind(domain, 'foreign'), errorCode('MEMBERSHIP_REQUIRED'));
    await assert.rejects(bind(domain, 'member'), errorCode('MEMBERSHIP_REQUIRED'));
    await assert.rejects(bind(domain, 'inactive', '1'), errorCode('UPGRADE_REQUIRED'));
    await assert.rejects(bind({ ...domain, generation: 2 }), errorCode('DOMAIN_UNAVAILABLE'));
    assert.equal((await bind()).accessMode, 'export-only');
    // An active foreign membership supplies no authority to rebind this cookie.
    await f.pool.query(
      "INSERT INTO b2b_membership(organization_id,user_id,role,active) VALUES('sur','inactive','member',false)",
    );
    await assert.rejects(
      bind({ ...domain, organizationId: 'sur', host: 'sur.b2b.test' }),
      errorCode('BRAND_SESSION_REQUIRED'),
    );
    assert.equal(
      (
        await f.pool.query(
          "SELECT organization_id FROM b2b_session_context WHERE session_id='session-inactive'",
        )
      ).rows[0].organization_id,
      'atlas',
    );
    await f.pool.query("UPDATE b2b_domain SET status='paused' WHERE host='atlas.b2b.test'");
    await assert.rejects(bind(), errorCode('DOMAIN_UNAVAILABLE'));
  });
});
