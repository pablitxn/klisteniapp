// Migrate and seed only the databases owned by the root development Compose.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { setupDev } from './dev-environment.mjs';
import { readConfig as readB2C } from '../apps/b2c-api/src/config.ts';
import { createPool as createB2CPool } from '../apps/b2c-api/src/database.ts';
import { createAuth as createB2CAuth } from '../apps/b2c-api/src/auth.ts';
import { migrate as migrateB2C } from '../apps/b2c-api/src/migrate.ts';
import { createProvisionedUser } from '../apps/b2c-api/src/operator-service.ts';
import { StateRepository } from '../apps/b2c-api/src/state.ts';
import { readConfig as readB2B } from '../apps/b2b-api/src/config.ts';
import { createPool as createB2BPool } from '../apps/b2b-api/src/database.ts';
import { createAuth as createB2BAuth } from '../apps/b2b-api/src/auth.ts';
import { migrate as migrateB2B } from '../apps/b2b-api/src/migrate.ts';
import { seedDemo } from '../apps/b2b-api/src/demo.ts';

const product = process.argv[2];
if (!['b2c', 'b2b'].includes(product ?? '')) throw new Error('Use prepare-dev.ts b2c|b2b');
const local = setupDev();
const pool = product === 'b2c'
  ? createB2CPool(readB2C(local.b2c))
  : createB2BPool(readB2B({ ...local.b2b, B2B_DATABASE_URL: local.b2b.B2B_MIGRATION_DATABASE_URL }));
try {
  console.info(`Waiting for local ${product.toUpperCase()} PostgreSQL (docker compose up)…`);
  const deadline = Date.now() + 60_000;
  while (true) {
    try { await pool.query('SELECT 1'); break; }
    catch {
      if (Date.now() >= deadline) throw new Error('Local PostgreSQL is unavailable. Run docker compose up from the root in another terminal.');
      await delay(1000);
    }
  }
  if (product === 'b2c') {
    const config = readB2C(local.b2c);
    await migrateB2C(pool, createB2CAuth(pool, config));
    const login = JSON.parse(readFileSync(local.loginPath, 'utf8')) as { email: string; name: string; password: string };
    if (login.email !== 'dev-admin@example.test') throw new Error('Unexpected local B2C demo account.');
    const existing = await pool.query<{ id: string; name: string }>('SELECT id, name FROM auth_user WHERE email = $1', [login.email]);
    const user = existing.rows[0] ?? await createProvisionedUser(pool, config, login);
    await pool.query("UPDATE auth_user SET role = 'admin' WHERE id = $1", [user.id]);
    await pool.query('UPDATE account_access SET lifetime = true WHERE user_id = $1', [user.id]);
    await new StateRepository(pool).get(user);
  } else {
    const config = readB2B(local.b2b);
    await migrateB2B(pool, createB2BAuth(pool, config, { migrating: true }));
    // The runtime role receives the grants configured by init-b2b-db.sh.
    const runtime = createB2BPool(config);
    try {
      const accounts = await seedDemo(runtime, createB2BAuth(runtime, config), config, local.b2b.B2B_DEMO_PASSWORD);
      writeFileSync(resolve(local.cache, 'b2b-demo.private.json'), JSON.stringify(accounts, null, 2) + '\n', { mode: 0o600 });
    } finally { await runtime.end(); }
  }
  console.info(`${product.toUpperCase()} schema and demo accounts ready; existing records preserved.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Local development preparation failed.');
  process.exitCode = 1;
} finally { await pool.end(); }
