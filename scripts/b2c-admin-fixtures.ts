/** Disposable local fixtures. No SMTP, payment provider or production database. */
import { randomUUID } from 'node:crypto';
import { cleanupFixture, fixtureDatabaseUrl } from "./fixture-safety.ts";
import { createAuth } from '../apps/b2c-api/src/auth.ts';
import { readConfig } from '../apps/b2c-api/src/config.ts';
import { createPool } from '../apps/b2c-api/src/database.ts';
import { createApiServer } from '../apps/b2c-api/src/http.ts';
import { migrate } from '../apps/b2c-api/src/migrate.ts';
import { createProvisionedUser } from '../apps/b2c-api/src/operator-service.ts';
import { AccountAdministration } from '../apps/b2c-api/src/accounts.ts';

export const adminPassword = 'B2C-admin-fixtures-only-2026!';
export function fixtureConfig() {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  const schema = process.env.KLISTENI_ADMIN_SCHEMA;
  if (!databaseUrl || !schema || !/^klisteni_admin_[a-f0-9]{32}$/.test(schema)) throw new Error('A disposable TEST_DATABASE_URL and KLISTENI_ADMIN_SCHEMA are required.');
  const url = fixtureDatabaseUrl(databaseUrl);
  url.searchParams.set('options', `-c search_path=${schema}`);
  return readConfig({ DATABASE_URL: url.href, BETTER_AUTH_SECRET: 'b2c-admin-ui-tests-only-secret-never-use-in-production', APP_ORIGIN: 'http://127.0.0.1:4187', HOST: '127.0.0.1', PORT: '4188', NODE_ENV: 'test', TRUSTED_CLIENT_IP_HEADER: 'x-klisteniapp-test-client-ip' });
}

export async function serveAdminFixtures() {
  const config = fixtureConfig();
  const admin = createPool({ databaseUrl: fixtureDatabaseUrl(process.env.TEST_DATABASE_URL).href });
  const pool = createPool(config);
  const auth = createAuth(pool, config);
  const schema = process.env.KLISTENI_ADMIN_SCHEMA!;
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
  function shutdown() {
    void close().catch(() => { console.error("Admin fixture cleanup failed."); process.exitCode = 1; });
  }
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  startup = (async () => {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    if (stopping) return;
    await migrate(pool, auth);
    if (stopping) return;
    const accounts = new AccountAdministration(pool, auth, config, null);
    const issued = await accounts.bootstrap({ email: 'admin@admin.test', name: 'Admin QA', sendEmail: false });
    await accounts.activate({ token: new URL(issued.url).hash.slice('#token='.length), name: 'Admin QA', password: adminPassword });
    for (const name of ['Trial', 'Expired', 'Lifetime', 'Paid', 'Disabled']) {
      const user = await createProvisionedUser(pool, config, { email: `${name.toLowerCase()}@admin.test`, name, password: adminPassword });
      if (name === 'Expired' || name === 'Lifetime' || name === 'Paid') await pool.query("UPDATE account_access SET trial_ends_at = now() - interval '1 day', lifetime = $2, paid_through = $3 WHERE user_id = $1", [user.id, name === 'Lifetime', name === 'Paid' ? new Date(Date.now() + 86400000) : null]);
      if (name === 'Disabled') await pool.query('UPDATE auth_user SET disabled = true WHERE id = $1', [user.id]);
    }
    if (stopping) return;
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(config.port, config.host, resolve); });
    console.info('B2C admin UI fixture ready on loopback, billing and mail disabled.');
  })();
  try {
    await startup;
  } catch (error) { await close(); throw error; }
}
if (process.argv[1]?.endsWith('/b2c-admin-fixtures.ts')) {
  process.env.KLISTENI_ADMIN_SCHEMA ??= `klisteni_admin_${randomUUID().replaceAll('-', '')}`;
  await serveAdminFixtures();
}
