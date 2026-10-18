/** Real API fixture for browser acceptance. Never point TEST_DATABASE_URL at production. */
import { randomUUID } from 'node:crypto';
import { cleanupFixture, fixtureDatabaseUrl } from "./fixture-safety.ts";
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
const baseUrl = fixtureDatabaseUrl(databaseUrl, { allowCiServiceHost: process.env.CI === "true" });
const admin = createPool({ databaseUrl: baseUrl.href });
const scopedUrl = new URL(baseUrl.href);
scopedUrl.searchParams.set('options', `-c search_path=${schema}`);
const config = readConfig({
  DATABASE_URL: scopedUrl.toString(),
  BETTER_AUTH_SECRET: 'accounts-browser-tests-only-secret-do-not-use-in-production',
  APP_ORIGIN: process.env.B2C_QA_WEB_ORIGIN ?? 'http://127.0.0.1:4181',
  HOST: '127.0.0.1', PORT: process.env.B2C_QA_API_PORT ?? '4182', NODE_ENV: 'test',
  // Each browser uses a documentation-range IP to retain the real per-IP limiter
  // without unrelated tests consuming one localhost login allowance.
  TRUSTED_CLIENT_IP_HEADER: 'x-klisteniapp-test-client-ip',
});
const pool = createPool(config);
const auth = createAuth(pool, config);
const server = createApiServer({ config, pool, auth });
let created = false;
let stopping = false;
let startup: Promise<void>;
let closing: Promise<void> | undefined;
function close(): Promise<void> {
  stopping = true;
  return closing ??= (async () => {
    await startup.catch(() => {});
    await cleanupFixture([
      () => server.closeRecovery(),
      async () => {
        if (!server.listening) return;
        await new Promise<void>(resolve => {
          server.closeAllConnections();
          server.close(() => resolve());
        });
      },
      () => pool.end(),
      async () => { if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`); },
      () => admin.end(),
    ]);
  })();
}
function shutdown() { void close().catch(() => { console.error('Accounts fixture cleanup failed'); process.exitCode = 1; }); }
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
startup = (async () => {
  await admin.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  if (stopping) return;
  await migrate(pool, auth);
  if (stopping) return;
  for (const name of ['Alice', 'Bob', 'Offline', 'Planner', 'Restore', 'Expired', 'Lifetime', ...(process.env.B2C_QA_FIXTURES === '1' ? ['QARoutine', 'QAYoga', 'QAYogaLoss', 'QALoss', 'QASession', 'QAPassword', 'QAHealth', 'QAPlan', 'QAImport', 'QAIsolation', 'QAActive'] : [])]) {
    const user = await createProvisionedUser(pool, config, { email: `${name.toLowerCase()}@accounts.test`, name, password: 'Only-for-browser-tests-2026!' });
    if (name === 'Expired') {
      await new StateRepository(pool).addLog(user, { kind: 'cardio', log: { id: 'expired-cloud-history', date: '2026-10-01', activity: 'walk', minutes: 26 } });
      await pool.query("UPDATE account_access SET trial_ends_at = now() - interval '1 day' WHERE user_id = $1", [user.id]);
    }
    if (name === 'QAYogaLoss') {
      const practice = { id: 'qa-yoga-response-loss', name: 'Pausa QA', intention: '', steps: [{ id: 'qa-tadasana', asanaId: 'tadasana' as const, durationSeconds: 5, side: 'both' as const }] };
      await new StateRepository(pool).yoga(user, { expectedRevision: 0, yoga: { practices: [practice], logs: [{ id: 'qa-yoga-prior-log', date: '2026-10-07', completedAt: '2026-10-07T10:00:00Z', timeZone: 'Etc/UTC', practiceSnapshot: practice, durationSeconds: 5, completedSteps: [{ stepId: 'qa-tadasana', asanaId: 'tadasana', durationSeconds: 5, side: 'both' }] }] } });
    }
    if (name === 'QAActive') await pool.query("UPDATE account_access SET paid_through = now() + interval '30 days', trial_ends_at = now() - interval '1 day' WHERE user_id = $1", [user.id]);
    if (name === 'Lifetime') await pool.query("UPDATE account_access SET lifetime = true, trial_ends_at = now() - interval '1 day' WHERE user_id = $1", [user.id]);
  }
  const accounts = new AccountAdministration(pool, auth, config, null);
  const bootstrap = await accounts.bootstrap({ email: 'admin@accounts.test', name: 'Admin', sendEmail: false });
  const bootstrapToken = new URLSearchParams(new URL(bootstrap.url).hash.slice(1)).get('token');
  if (!bootstrapToken) throw new Error('The test administrator bootstrap did not issue a token.');
  await accounts.activate({ token: bootstrapToken, name: 'Admin', password: 'Only-for-browser-tests-2026!' });
  if (stopping) return;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, resolve);
  });
  console.info(`Accounts browser fixture ready on 127.0.0.1:${config.port} with an isolated database schema`);
})();
try {
  await startup;
} catch (error) {
  console.error('Accounts browser fixture failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
  await close();
}
