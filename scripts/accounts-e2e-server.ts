/** Real API fixture for browser acceptance. Never point TEST_DATABASE_URL at production. */
import { randomUUID } from 'node:crypto';
import { createAuth } from '../apps/b2c-api/src/auth.ts';
import { readConfig } from '../apps/b2c-api/src/config.ts';
import { createPool } from '../apps/b2c-api/src/database.ts';
import { createApiServer } from '../apps/b2c-api/src/http.ts';
import { migrate } from '../apps/b2c-api/src/migrate.ts';
import { createProvisionedUser } from '../apps/b2c-api/src/operator-service.ts';
import { AccountAdministration } from '../apps/b2c-api/src/accounts.ts';
import { StateRepository } from '../apps/b2c-api/src/state.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('Accounts browser tests require TEST_DATABASE_URL for a disposable PostgreSQL database.');
const schema = `klisteni_e2e_${randomUUID().replaceAll('-', '')}`;
const admin = createPool({ databaseUrl });
const scopedUrl = new URL(databaseUrl);
scopedUrl.searchParams.set('options', `-c search_path=${schema}`);
const config = readConfig({
  DATABASE_URL: scopedUrl.toString(),
  BETTER_AUTH_SECRET: 'accounts-browser-tests-only-secret-do-not-use-in-production',
  APP_ORIGIN: 'http://127.0.0.1:4181',
  HOST: '127.0.0.1', PORT: '4182', NODE_ENV: 'test',
  // Each browser uses a documentation-range IP to retain the real per-IP limiter
  // without unrelated tests consuming one localhost login allowance.
  TRUSTED_CLIENT_IP_HEADER: 'x-klisteniapp-test-client-ip',
});
const pool = createPool(config);
const auth = createAuth(pool, config);
const server = createApiServer({ config, pool, auth });
let created = false;
let stopping = false;
async function close() {
  if (stopping) return;
  stopping = true;
  await new Promise<void>((resolve) => {
    if (!server.listening) return resolve();
    server.closeAllConnections();
    server.close(() => resolve());
  });
  await pool.end();
  if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
}
function shutdown() { void close().catch(() => { console.error('Accounts fixture cleanup failed'); process.exitCode = 1; }); }
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
try {
  await admin.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  await migrate(pool, auth);
  for (const name of ['Alice', 'Bob', 'Offline', 'Planner', 'Restore', 'Expired', 'Lifetime']) {
    const user = await createProvisionedUser(pool, config, { email: `${name.toLowerCase()}@accounts.test`, name, password: 'Only-for-browser-tests-2026!' });
    if (name === 'Expired') {
      await new StateRepository(pool).addLog(user, { kind: 'cardio', log: { id: 'expired-cloud-history', date: '2026-10-01', activity: 'walk', minutes: 26 } });
      await pool.query("UPDATE account_access SET trial_ends_at = now() - interval '1 day' WHERE user_id = $1", [user.id]);
    }
    if (name === 'Lifetime') await pool.query("UPDATE account_access SET lifetime = true, trial_ends_at = now() - interval '1 day' WHERE user_id = $1", [user.id]);
  }
  const accounts = new AccountAdministration(pool, auth, config, null);
  const bootstrap = await accounts.bootstrap({ email: 'admin@accounts.test', name: 'Admin', sendEmail: false });
  const bootstrapToken = new URLSearchParams(new URL(bootstrap.url).hash.slice(1)).get('token');
  if (!bootstrapToken) throw new Error('The test administrator bootstrap did not issue a token.');
  await accounts.activate({ token: bootstrapToken, name: 'Admin', password: 'Only-for-browser-tests-2026!' });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, resolve);
  });
  console.info('Accounts browser fixture ready on 127.0.0.1:4182 with an isolated database schema');
} catch (error) {
  console.error('Accounts browser fixture failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
  await close();
}
