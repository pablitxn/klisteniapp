// Browser acceptance tests own one disposable schema in an explicitly named test DB.
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGateway } from './b2b-gateway.mjs';
import { createAuth } from '../apps/b2b-api/src/auth.ts';
import { createPool } from '../apps/b2b-api/src/database.ts';
import { createApiServer } from '../apps/b2b-api/src/http.ts';
import { migrate } from '../apps/b2b-api/src/migrate.ts';
import { seedDemo } from '../apps/b2b-api/src/demo.ts';

const requireApi = createRequire(new URL('../apps/b2b-api/package.json', import.meta.url));
const { Pool } = requireApi('pg');
const source = process.env.B2B_TEST_DATABASE_URL;
if (!source) throw new Error('B2B_TEST_DATABASE_URL must point to a dedicated disposable B2B test database.');
const url = new URL(source);
if (!/^postgres(?:ql)?:$/.test(url.protocol) || !/(?:b2b.*test|test.*b2b)/i.test(decodeURIComponent(url.pathname))) throw new Error('Refusing browser tests: database name must explicitly include b2b and test.');
if (url.searchParams.has('options')) throw new Error('Browser runner owns its schema; remove connection options from B2B_TEST_DATABASE_URL.');
const schema = `b2b_browser_${randomUUID().replaceAll('-', '')}`;
const mediaRoot = mkdtempSync(join(tmpdir(), 'klisteni-b2b-browser-media-'));
const owner = new Pool({ connectionString: source });
let pool, server, gateway, created = false, closing;
async function close() {
  if (closing) return closing;
  closing = (async () => {
    if (gateway) { gateway.closeAllConnections(); await new Promise(resolve => gateway.close(resolve)); }
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await pool?.end();
    if (created) await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await owner.end();
    rmSync(mediaRoot, { recursive: true, force: true });
  })();
  return closing;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void close().catch(() => { process.exitCode = 1; }); });
try {
  await owner.query(`CREATE SCHEMA ${schema}`); created = true;
  url.searchParams.set('options', `-c search_path=${schema}`);
  const config = { databaseUrl: url.href, secret: randomBytes(40).toString('hex'), origin: 'http://127.0.0.1:4202', host: '127.0.0.1', port: 4203, production: false, demoMode: true, mediaRoot, mediaQuotaMb: 32 };
  pool = createPool(config);
  await migrate(pool, createAuth(pool, config, { migrating: true }));
  const auth = createAuth(pool, config);
  // All browser contexts share localhost, so their independent login scenarios
  // consume one IP bucket. Raise its capacity only in this disposable test server.
  (await auth.$context).rateLimit.customRules = { '/sign-in/email': { window: 60, max: 100 } };
  await seedDemo(pool, auth, config, 'browser-tests-only-password-2026');
  server = createApiServer({ config, pool, auth });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4203, '127.0.0.1', resolve); });
  gateway = createGateway({ apiPort: 4203, built: true });
  await new Promise((resolve, reject) => { gateway.once('error', reject); gateway.listen(4202, '127.0.0.1', resolve); });
  console.info('Isolated B2B browser test environment ready on 127.0.0.1:4202.');
} catch (error) {
  console.error(error instanceof Error ? error.message.replaceAll(source, '[test database]') : 'B2B browser environment failed');
  process.exitCode = 1;
  await close();
}
