import { pathToFileURL } from 'node:url';
import { getMigrations } from 'better-auth/db/migration';
import type { Pool } from 'pg';
import type { BetterAuthOptions } from 'better-auth';
import { createAuth } from './auth.ts';
import { readConfig } from './config.ts';
import { APP_SCHEMA_SQL, createPool } from './database.ts';
import { BILLING_SCHEMA_SQL } from './billing.ts';

export async function migrate(pool: Pool, auth: { options: BetterAuthOptions }): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtextextended('klisteniapp:migrations', 0))");
    const migrations = await getMigrations(auth.options);
    if (migrations.schemaProblems.length || migrations.unsafeChanges.length) throw new Error('Auth schema requires manual migration review');
    await migrations.runMigrations();
    await client.query('BEGIN');
    await client.query(APP_SCHEMA_SQL);
    await client.query(BILLING_SCHEMA_SQL);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtextextended('klisteniapp:migrations', 0))").catch(() => undefined);
    client.release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let pool: Pool | undefined;
  try {
    const config = readConfig();
    pool = createPool(config);
    await migrate(pool, createAuth(pool, config));
    console.info('Database migrations completed');
  } catch { console.error('Database migration failed. Check configuration, connectivity, and schema compatibility.'); process.exitCode = 1; }
  finally { await pool?.end(); }
}
