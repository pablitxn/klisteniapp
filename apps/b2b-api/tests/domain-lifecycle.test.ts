import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { test } from 'node:test';
import { Pool } from 'pg';
import { createAuth } from '../src/auth.ts';
import type { Config } from '../src/config.ts';
import { migrate } from '../src/migrate.ts';
import { resolveDomainContext } from '../src/domain-context.ts';
import {
  requestDomain,
  verifyDomain,
  activateDomain,
  pauseDomain,
  reassignDomain,
  domainDiagnostics,
  type DomainProbe,
} from '../src/domain-operator.ts';

const databaseUrl = process.env.B2B_TEST_DATABASE_URL;
test(
  'domain lifecycle verifies every stage, revokes immediately and prevents automatic reassignment',
  { skip: !databaseUrl },
  async () => {
    const target = new URL(databaseUrl!);
    assert.match(target.pathname, /b2b.*test|test.*b2b/);
    assert.equal(target.searchParams.has('options'), false);
    const administrator = new Pool({ connectionString: target.href });
    const schema = `b2b_domains_${randomUUID().replaceAll('-', '')}`;
    target.searchParams.set('options', `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: target.href });
    const config: Config = {
      databaseUrl: target.href,
      secret: 'domain-lifecycle-only-secret-with-thirty-two-characters',
      origin: 'https://directory.b2b.test',
      host: '127.0.0.1',
      port: 4201,
      production: false,
      demoMode: false,
      whiteLabel: true,
      domainProtocol: 'https',
      proxySecret: 'domain-lifecycle-proxy-secret-with-thirty-two-characters',
    };
    const probe: DomainProbe = async () => ({
      ownership: true,
      addresses: ['192.0.2.10'],
      tlsExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      certificateFingerprint: 'test-fixture-evidence',
    });
    function resolve(host: string) {
      const socket = new Socket();
      Object.defineProperty(socket, 'remoteAddress', { value: '127.0.0.1' });
      const request = new IncomingMessage(socket);
      request.headers = {
        'x-klisteni-b2b-host': host,
        'x-klisteni-b2b-proto': 'https',
        'x-klisteni-b2b-proxy-secret': config.proxySecret,
      };
      return resolveDomainContext(pool, config, request);
    }
    try {
      await administrator.query(`CREATE SCHEMA ${schema}`);
      await migrate(pool, createAuth(pool, config, { migrating: true }));
      await pool.query(`INSERT INTO b2b_organization(id,slug,brand) VALUES
      ('atlas','atlas','{"name":"Atlas"}'),('sur','sur','{"name":"Sur"}')`);
      await requestDomain(pool, 'atlas', 'Atlas.b2b.test');
      await assert.rejects(resolve('atlas.b2b.test'));
      await assert.rejects(activateDomain(pool, 'atlas.b2b.test', true), /Verify/);
      await assert.rejects(verifyDomain(pool, 'atlas.b2b.test', ['192.0.2.99'], probe), /DNS/);
      await verifyDomain(pool, 'atlas.b2b.test', ['192.0.2.10'], probe);
      await assert.rejects(resolve('atlas.b2b.test'));
      await activateDomain(pool, 'atlas.b2b.test', true);
      const atlas = await resolve('atlas.b2b.test');
      assert.equal(atlas?.organizationId, 'atlas');
      await requestDomain(pool, 'atlas', 'alias.b2b.test');
      await verifyDomain(pool, 'alias.b2b.test', ['192.0.2.10'], probe);
      await activateDomain(pool, 'alias.b2b.test');
      assert.equal((await resolve('alias.b2b.test'))?.canonicalOrigin, 'https://atlas.b2b.test');
      await activateDomain(pool, 'alias.b2b.test', true);
      assert.equal((await resolve('atlas.b2b.test'))?.canonicalOrigin, 'https://alias.b2b.test');
      assert.ok((await resolve('atlas.b2b.test'))!.generation > atlas!.generation);
      await pauseDomain(pool, 'alias.b2b.test');
      await assert.rejects(resolve('alias.b2b.test'));
      await assert.rejects(resolve('atlas.b2b.test'));
      await assert.rejects(activateDomain(pool, 'alias.b2b.test', true), /fresh verification/);
      await assert.rejects(requestDomain(pool, 'sur', 'alias.b2b.test'), /already registered/);
      await assert.rejects(reassignDomain(pool, 'atlas.b2b.test', 'sur'), /Pause/);
      await reassignDomain(pool, 'alias.b2b.test', 'sur');
      await assert.rejects(resolve('alias.b2b.test'));
      await verifyDomain(pool, 'alias.b2b.test', ['192.0.2.10'], probe);
      await activateDomain(pool, 'alias.b2b.test', true);
      assert.equal((await resolve('alias.b2b.test'))?.organizationId, 'sur');
      await assert.rejects(
        verifyDomain(pool, 'alias.b2b.test', ['192.0.2.10'], async () => ({
          ...(await probe('alias.b2b.test', '')),
          ownership: false,
        })),
        /ownership/,
      );
      await assert.rejects(resolve('alias.b2b.test'));
      assert.equal(
        (await domainDiagnostics(pool)).find((row) => row.host === 'alias.b2b.test')?.status,
        'paused',
      );
      await verifyDomain(pool, 'alias.b2b.test', ['192.0.2.10'], probe);
      await activateDomain(pool, 'alias.b2b.test', true);
      await pool.query(
        "UPDATE b2b_domain SET tls_verified_at=now()-interval '2 days',tls_expires_at=now()-interval '1 second' WHERE host='alias.b2b.test'",
      );
      await assert.rejects(resolve('alias.b2b.test'));
      assert.equal(
        (await domainDiagnostics(pool)).find((row) => row.host === 'alias.b2b.test')?.diagnostic,
        'expired',
      );
      assert.ok(
        (await pool.query("SELECT id FROM b2b_audit WHERE action LIKE 'domain.%'")).rowCount! >= 10,
      );
    } finally {
      await pool.end();
      await administrator.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await administrator.end();
    }
  },
);
