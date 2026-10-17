import { pathToFileURL } from 'node:url';
import { getMigrations } from 'better-auth/db/migration';
import type { Pool } from 'pg';
import type { Auth } from './auth.ts';
import { createAuth } from './auth.ts';
import { readConfig } from './config.ts';
import { createPool, SCHEMA, LIFECYCLE_SCHEMA, CONTENT_SCHEMA } from './database.ts';
import { seedBaseCatalog } from './service.ts';
import { WHITE_LABEL_SCHEMA, WHITE_LABEL_PROFILE_SCHEMA } from './white-label-schema.ts';
import { PRODUCT_SCHEMA, PRODUCT_MIGRATION_ID } from './product-schema.ts';
export async function migrate(pool: Pool, auth: Auth) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtextextended('klisteni-b2b:migrate',0))");
    const migrations = await getMigrations(auth.options);
    if (migrations.schemaProblems.length || migrations.unsafeChanges.length)
      throw new Error('B2B auth schema requires manual migration review');
    await migrations.runMigrations();
    await client.query('BEGIN');
    await client.query(
      'CREATE TABLE IF NOT EXISTS b2b_migration (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    if (!(await client.query("SELECT id FROM b2b_migration WHERE id='001-initial'")).rowCount) {
      await client.query(SCHEMA);
      await client.query("INSERT INTO b2b_migration(id) VALUES ('001-initial')");
    }
    if (
      !(await client.query("SELECT id FROM b2b_migration WHERE id='002-catalog-lifecycle'"))
        .rowCount
    ) {
      await client.query(LIFECYCLE_SCHEMA);
      await client.query("INSERT INTO b2b_migration(id) VALUES ('002-catalog-lifecycle')");
    }
    if (
      !(await client.query("SELECT id FROM b2b_migration WHERE id='003-content-media'")).rowCount
    ) {
      await client.query(CONTENT_SCHEMA);
      await seedBaseCatalog(client);
      await client.query("INSERT INTO b2b_migration(id) VALUES ('003-content-media')");
    }
    if (!(await client.query("SELECT id FROM b2b_migration WHERE id='004-white-label'")).rowCount) {
      await client.query(WHITE_LABEL_SCHEMA);
      await client.query("INSERT INTO b2b_migration(id) VALUES ('004-white-label')");
    }
    if (
      !(
        await client.query("SELECT id FROM b2b_migration WHERE id='005-branch-publication-profile'")
      ).rowCount
    ) {
      await client.query(WHITE_LABEL_PROFILE_SCHEMA);
      await client.query("INSERT INTO b2b_migration(id) VALUES ('005-branch-publication-profile')");
    }
    if (
      !(await client.query('SELECT id FROM b2b_migration WHERE id=$1', [PRODUCT_MIGRATION_ID]))
        .rowCount
    ) {
      await client.query(PRODUCT_SCHEMA);
      await client.query('INSERT INTO b2b_migration(id) VALUES ($1)', [PRODUCT_MIGRATION_ID]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtextextended('klisteni-b2b:migrate',0))")
      .catch(() => undefined);
    client.release();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let pool: Pool | undefined;
  try {
    const config = readConfig({
      ...process.env,
      B2B_DATABASE_URL: process.env.B2B_MIGRATION_DATABASE_URL ?? process.env.B2B_DATABASE_URL,
    });
    pool = createPool(config);
    await migrate(pool, createAuth(pool, config, { migrating: true }));
    console.info('B2B migrations completed');
  } catch {
    console.error('B2B migration failed; check dedicated database configuration and schema');
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
