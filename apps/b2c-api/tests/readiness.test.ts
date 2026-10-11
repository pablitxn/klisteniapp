import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { Pool } from 'pg';
import { createAuth } from '../src/auth.ts';
import type { Config } from '../src/config.ts';
import { createPool } from '../src/database.ts';
import { createApiServer } from '../src/http.ts';
import { migrate } from '../src/migrate.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;

test('readiness includes cached auth schema failures after an external migration', { skip: !databaseUrl }, async () => {
  const administrator = new Pool({ connectionString: databaseUrl });
  const schema = `klisteni_readiness_${randomUUID().replaceAll('-', '')}`;
  const scoped = new URL(databaseUrl!);
  scoped.searchParams.set('options', `-c search_path=${schema}`);
  const config: Config = {
    databaseUrl: scoped.href, secret: 'readiness-only-secret-12345678901234567890',
    origin: 'http://localhost:5173', host: '127.0.0.1', port: 3001, production: false,
  };
  const pool = createPool(config), migrationPool = createPool(config);
  const servers: Server[] = [];
  async function start(auth: ReturnType<typeof createAuth>) {
    const server = createApiServer({ pool, auth, config });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  }
  try {
    await administrator.query(`CREATE SCHEMA ${schema}`);
    const auth = createAuth(pool, config);
    await assert.rejects(async () => (await auth.$context).checkSchema?.());
    const base = await start(auth);
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    assert.equal((await fetch(`${base}/readyz`)).status, 503);

    await migrate(migrationPool, createAuth(migrationPool, config));
    await pool.query('SELECT provider_id, paid_through FROM billing_payment LIMIT 0');
    assert.equal((await fetch(`${base}/readyz`)).status, 503);
    const failedLogin = await fetch(`${base}/auth/sign-in/email`, {
      method: 'POST', headers: { origin: config.origin, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.test', password: 'readiness-test-password' }),
    });
    assert.equal(failedLogin.status, 500);

    const restarted = await start(createAuth(pool, config));
    assert.equal((await fetch(`${restarted}/readyz`)).status, 200);
    assert.equal((await fetch(`${base}/readyz`)).status, 503);
  } finally {
    for (const server of servers) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await Promise.all([pool.end(), migrationPool.end()]);
    await administrator.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await administrator.end();
  }
});
