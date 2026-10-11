import assert from 'node:assert/strict';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { test } from 'node:test';
import type { Pool } from 'pg';
import type { Config } from '../src/config.ts';
import {
  assertRequestOrigin,
  canonicalOrganizationOrigin,
  canonicalRedirect,
  normalizeDomainHost,
  resolveDomainContext,
  trustedDomainHost,
  type DomainContext,
} from '../src/domain-context.ts';
import { validateDomainEvidence } from '../src/domain-operator.ts';

const config: Config = {
  databaseUrl: 'postgres://localhost/b2b_test',
  secret: 'test-secret-with-at-least-thirty-two-characters',
  origin: 'https://directory.b2b.test',
  host: '127.0.0.1',
  port: 4201,
  production: false,
  demoMode: false,
  whiteLabel: true,
  proxySecret: 'different-proxy-test-secret-with-thirty-two-characters',
  domainProtocol: 'https',
};
function request(extra: Record<string, string> = {}, peer = '127.0.0.1') {
  const socket = new Socket();
  Object.defineProperty(socket, 'remoteAddress', { value: peer });
  const result = new IncomingMessage(socket);
  result.headers = {
    host: '127.0.0.1:4201',
    'x-klisteni-b2b-host': 'Atlas.B2B.test',
    'x-klisteni-b2b-proto': 'https',
    'x-klisteni-b2b-proxy-secret': config.proxySecret,
    ...extra,
  };
  result.rawHeaders = Object.entries(result.headers).flatMap(([key, value]) => [
    key,
    String(value),
  ]);
  return result;
}
const context: DomainContext = {
  id: 'alias.b2b.test',
  host: 'alias.b2b.test',
  organizationId: 'atlas',
  generation: 2,
  origin: 'https://alias.b2b.test',
  canonicalOrigin: 'https://atlas.b2b.test',
  primaryHost: 'atlas.b2b.test',
  isPrimary: false,
};

test('strict host normalization rejects ambiguous authority syntax', () => {
  assert.equal(normalizeDomainHost('Atlas.B2B.test.:0443'), 'atlas.b2b.test');
  assert.equal(normalizeDomainHost('Atlas.B2B.test:80', 'http'), 'atlas.b2b.test');
  assert.equal(normalizeDomainHost('Atlas.B2B.test:4443'), 'atlas.b2b.test:4443');
  for (const host of [
    'https://atlas.test',
    'atlas.test/a',
    'atlas.test@evil.test',
    'atlas.test,evil.test',
    'atlas.test:0',
    'atlas.test:65536',
    ' atlas.test',
    'atlas..test',
    '-atlas.test',
    'atlas_test',
    'atlas.test%2f',
    'atlas.test\\evil',
    '[::1]',
    'a'.repeat(64) + '.test',
  ])
    assert.throws(() => normalizeDomainHost(host), host);
});
test('only the authenticated peer can provide a host; ordinary proxy headers cannot override it', () => {
  assert.equal(
    trustedDomainHost(
      request({ 'x-forwarded-host': 'sur.b2b.test', forwarded: 'host=sur.b2b.test' }),
      config,
    ),
    'atlas.b2b.test',
  );
  assert.throws(() => trustedDomainHost(request({}, '203.0.113.9'), config), /Dominio/);
  assert.throws(() =>
    trustedDomainHost(request({ 'x-klisteni-b2b-proxy-secret': 'forged' }), config),
  );
  assert.throws(() => trustedDomainHost(request({ 'x-klisteni-b2b-proto': 'http' }), config));
  const duplicate = request();
  duplicate.rawHeaders.push('X-Klisteni-B2B-Host', 'sur.b2b.test');
  assert.throws(() => trustedDomainHost(duplicate, config));
  assert.equal(trustedDomainHost(request({}, '::ffff:127.0.0.1'), config), 'atlas.b2b.test');
});
test('origins compare exactly with the resolved brand, including duplicate rejection', () => {
  assertRequestOrigin(request({ origin: 'https://atlas.b2b.test' }), 'https://atlas.b2b.test');
  for (const origin of [
    'https://sur.b2b.test',
    'https://atlas.b2b.test/',
    'https://atlas.b2b.test.evil.test',
  ])
    assert.throws(() => assertRequestOrigin(request({ origin }), 'https://atlas.b2b.test'));
  assert.throws(() => assertRequestOrigin(request(), 'https://atlas.b2b.test'));
  const duplicate = request({ origin: 'https://atlas.b2b.test' });
  duplicate.rawHeaders.push('Origin', 'https://atlas.b2b.test');
  assert.throws(() => assertRequestOrigin(duplicate, 'https://atlas.b2b.test'));
});
test('domain registry is consulted for every request and has no default organization', async () => {
  let reads = 0;
  const pool = {
    query: async (_sql: string, values: unknown[]) => {
      assert.deepEqual(values, ['atlas.b2b.test']);
      reads++;
      return {
        rows:
          reads === 1
            ? [
                {
                  host: 'atlas.b2b.test',
                  organization_id: 'atlas',
                  generation: 4,
                  primary_host: 'atlas.b2b.test',
                },
              ]
            : [],
      };
    },
  } as unknown as Pick<Pool, 'query'>;
  const first = await resolveDomainContext(pool, config, request());
  assert.equal(first?.organizationId, 'atlas');
  assert.equal(first?.generation, 4);
  await assert.rejects(resolveDomainContext(pool, config, request()));
  assert.equal(reads, 2);
  assert.equal(await resolveDomainContext(pool, { ...config, whiteLabel: false }, request()), null);
});
test('canonical URLs come from the verified registry; alias redirects cannot transfer secrets', async () => {
  assert.equal(canonicalRedirect(context, '/sedes/centro'), 'https://atlas.b2b.test/sedes/centro#');
  assert.equal(canonicalRedirect({ ...context, isPrimary: true }, '/'), null);
  for (const path of [
    '/login?token=secret',
    '/app#token=secret',
    '/api/b2b/auth/get-session',
    '/invite',
    '/invitations/accept',
    '//evil.test/path',
    '/\\evil.test',
  ])
    assert.throws(() => canonicalRedirect(context, path), path);
  assert.throws(() => canonicalRedirect(context, '/app', 'POST'));
  const pool = { query: async () => ({ rows: [{ host: 'atlas.b2b.test' }] }) } as unknown as Pick<
    Pool,
    'query'
  >;
  assert.equal(await canonicalOrganizationOrigin(pool, config, 'atlas'), 'https://atlas.b2b.test');
});
test('activation evidence requires ownership, exclusive correct DNS and an unexpired certificate', () => {
  const evidence = {
    ownership: true,
    addresses: ['192.0.2.10'],
    tlsExpiresAt: '2030-01-01T00:00:00.000Z',
    certificateFingerprint: 'AA:BB',
  };
  const now = new Date('2026-10-11T00:00:00Z');
  assert.equal(validateDomainEvidence(evidence, ['192.0.2.10'], now).getUTCFullYear(), 2030);
  assert.throws(() =>
    validateDomainEvidence({ ...evidence, ownership: false }, ['192.0.2.10'], now),
  );
  assert.throws(() =>
    validateDomainEvidence(
      { ...evidence, addresses: ['192.0.2.10', '192.0.2.99'] },
      ['192.0.2.10'],
      now,
    ),
  );
  assert.throws(() =>
    validateDomainEvidence({ ...evidence, tlsExpiresAt: '2025-01-01' }, ['192.0.2.10'], now),
  );
});
