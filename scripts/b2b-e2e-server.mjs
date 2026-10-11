// Every browser project owns a disposable schema in an explicitly named test DB.
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
const sourceUrl = new URL(source);
if (!/^postgres(?:ql)?:$/.test(sourceUrl.protocol) || !/(?:b2b.*test|test.*b2b)/i.test(decodeURIComponent(sourceUrl.pathname))) throw new Error('Refusing browser tests: database name must explicitly include b2b and test.');
if (sourceUrl.searchParams.has('options')) throw new Error('Browser runner owns its schemas; remove connection options from B2B_TEST_DATABASE_URL.');
const owner = new Pool({ connectionString: source });
const environments = [];
let closing;
async function close() {
  if (closing) return closing;
  closing = (async () => {
    // Finish all cleanup even when one connection fails, including partial startup.
    const results = await Promise.allSettled(environments.map(async ({ pool, server, gateway, schema, mediaRoot, created }) => {
      try {
        for (const listener of [gateway, server]) {
          if (listener?.listening) {
            listener.closeAllConnections();
            await new Promise(resolve => listener.close(resolve));
          }
        }
        await pool?.end();
      } finally {
        try { if (created) await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
        finally { rmSync(mediaRoot, { recursive: true, force: true }); }
      }
    }));
    await owner.end();
    if (results.some(result => result.status === 'rejected')) throw new Error('B2B browser environment cleanup failed.');
  })();
  return closing;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void close().catch(() => { process.exitCode = 1; }); });
try {
  for (const gatewayPort of [4202, 4204, 4206]) {
    const environment = {
      schema: `b2b_browser_${randomUUID().replaceAll('-', '')}`,
      mediaRoot: mkdtempSync(join(tmpdir(), 'klisteni-b2b-browser-media-')),
      created: false,
    };
    environments.push(environment);
    const { schema, mediaRoot } = environment;
    await owner.query(`CREATE SCHEMA ${schema}`);
    environment.created = true;
    const url = new URL(sourceUrl);
    url.searchParams.set('options', `-c search_path=${schema}`);
    const apiPort = gatewayPort + 1;
    const config = { databaseUrl: url.href, secret: randomBytes(40).toString('hex'), origin: `http://127.0.0.1:${gatewayPort}`, host: '127.0.0.1', port: apiPort, production: false, demoMode: true, mediaRoot, mediaQuotaMb: 32 };
    const pool = environment.pool = createPool(config);
    await migrate(pool, createAuth(pool, config, { migrating: true }));
    const auth = createAuth(pool, config);
    // All contexts in a project share localhost; raise only this disposable server's bucket.
    (await auth.$context).rateLimit.customRules = { '/sign-in/email': { window: 60, max: 100 } };
    await seedDemo(pool, auth, config, 'browser-tests-only-password-2026');
    const server = environment.server = createApiServer({ config, pool, auth });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(apiPort, '127.0.0.1', resolve); });
    const gateway = environment.gateway = createGateway({ apiPort, built: true });
    await new Promise((resolve, reject) => { gateway.once('error', reject); gateway.listen(gatewayPort, '127.0.0.1', resolve); });
    console.info(`Isolated B2B browser test environment ready on 127.0.0.1:${gatewayPort}.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message.replaceAll(source, '[test database]') : 'B2B browser environment failed');
  process.exitCode = 1;
  await close();
}
