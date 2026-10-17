import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { Pool, type PoolClient } from 'pg';
import { createAuth } from '../../src/auth.ts';
import { migrate } from '../../src/migrate.ts';
import type { Config } from '../../src/config.ts';
import type { AuthorizedProductContext } from '../../src/product-context.ts';
import { createHealthServices } from '../../src/health/index.ts';
import { HttpError } from '../../src/errors.ts';

export const NOW = new Date('2026-10-17T12:00:00Z');
export const emptyHealth = () => ({
  version: 1 as const,
  profile: {},
  measurements: [],
  sleep: [],
  activity: [],
  nutrition: [],
  supplements: [],
  goals: [],
});
export const measurement = (id = 'weight') => ({
  id,
  date: '2026-10-16',
  recordedAt: '2026-10-16T10:00:00Z',
  source: { kind: 'manual' as const, externalId: `synthetic-${id}` },
  weightKg: 80,
});
export const importFile = (records: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: 'klisteniapp.health',
    version: 1,
    exportedAt: '2026-10-17T10:00:00Z',
    timeZone: 'UTC',
    records: {
      measurements: [measurement()],
      sleep: [],
      activity: [],
      nutrition: [],
      supplements: [],
      ...records,
    },
  });
export const grantInput = (id = 'consent', operationId = randomUUID()) => ({
  id,
  operationId,
  expectedRevision: 0,
  categories: ['measurements'] as const as ['measurements'],
  audience: 'current-authorized-branch-trainers' as const,
  disclosureVersion: 1 as const,
});
export const errorCode = (code: string) => (error: unknown) =>
  error instanceof HttpError && error.code === code;

export async function healthFixture() {
  const connectionString = process.env.B2B_TEST_DATABASE_URL;
  assert.ok(
    connectionString,
    'WP05 requires disposable PostgreSQL; unset URL is a failure, never a skip',
  );
  const url = new URL(connectionString);
  assert.equal(url.hostname, '127.0.0.1');
  assert.match(url.pathname, /^\/klisteni_b2b_test$/);
  const owner = new Pool({ connectionString });
  const schema = `wp05_${randomUUID().replaceAll('-', '')}`;
  await owner.query(`CREATE SCHEMA ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const pool = new Pool({
    connectionString: url.href,
    max: 12,
    application_name: schema,
    statement_timeout: 10000,
  });
  try {
    const config: Config = {
      databaseUrl: url.href,
      secret: 'wp05-synthetic-secret-12345678901234567890',
      origin: 'http://localhost:4200',
      host: '127.0.0.1',
      port: 0,
      production: false,
      demoMode: false,
    };
    await migrate(pool, createAuth(pool, config, { migrating: true }));
    await pool.query(`INSERT INTO b2b_auth_user(id,name,email,"emailVerified","createdAt","updatedAt")
      SELECT id,id,id||'@example.test',true,now(),now() FROM unnest(ARRAY['member','other','coach','later','admin','superadmin','foreign']) AS id;
      INSERT INTO b2b_organization(id,slug,brand) VALUES ('atlas','atlas','{"name":"Atlas"}'),('sur','sur','{"name":"Sur"}');
      INSERT INTO b2b_branch(id,organization_id,slug,name) VALUES ('atlas-east','atlas','east','East'),('sur-east','sur','east','East');
      INSERT INTO b2b_membership(organization_id,user_id,role,product_role) VALUES
       ('atlas','member','member','member'),('atlas','other','member','member'),('atlas','coach','coach','coach'),('atlas','later','coach','coach'),
       ('atlas','admin','admin','admin'),('atlas','superadmin','admin','superadmin'),('sur','member','member','member'),('sur','coach','coach','coach'),('sur','foreign','member','member');
      INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES ('atlas','atlas-east','member','member'),('atlas','atlas-east','coach','coach'),('atlas','atlas-east','other','member');`);
    let now = NOW;
    const services = createHealthServices({ now: () => now });
    async function context(
      db: PoolClient,
      actorId = 'member',
      organizationId = 'atlas',
      branchId = `${organizationId}-principal`,
    ): Promise<AuthorizedProductContext> {
      const row = (
        await db.query(
          'SELECT active,product_role,access_revision FROM b2b_membership WHERE organization_id=$1 AND user_id=$2',
          [organizationId, actorId],
        )
      ).rows[0];
      assert.ok(row, 'Synthetic fixture membership exists');
      return {
        db,
        actorId,
        organizationId,
        branchId,
        role: row.product_role,
        accessMode: row.active ? 'active' : 'export-only',
        accessRevision: Number(row.access_revision),
        capabilities: new Set(
          row.active
            ? ['manage-own-health', 'read-consented-health', 'export-own-records']
            : ['export-own-records'],
        ),
        async authorizeMember(memberId) {
          if (
            !(
              await db.query(
                'SELECT 1 FROM b2b_membership WHERE organization_id=$1 AND user_id=$2',
                [organizationId, memberId],
              )
            ).rowCount
          )
            throw new HttpError(403, 'CONTEXT_REVOKED', 'Synthetic target outside scope');
        },
      };
    }
    async function transaction<T>(run: (db: PoolClient) => Promise<T>) {
      const db = await pool.connect();
      try {
        await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
        const result = await run(db);
        await db.query('COMMIT');
        return result;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      } finally {
        db.release();
      }
    }
    const as = <T>(
      run: (c: AuthorizedProductContext) => Promise<T>,
      actorId = 'member',
      organizationId = 'atlas',
      branchId = `${organizationId}-principal`,
    ) => transaction(async (db) => run(await context(db, actorId, organizationId, branchId)));
    return {
      pool,
      services,
      context,
      transaction,
      as,
      schema,
      setNow(value: Date) {
        now = value;
      },
      async close() {
        await pool.end();
        await owner.query(`DROP SCHEMA ${schema} CASCADE`);
        await owner.end();
      },
    };
  } catch (error) {
    await pool.end();
    await owner.query(`DROP SCHEMA ${schema} CASCADE`);
    await owner.end();
    throw error;
  }
}

export async function withHealthFixture(
  run: (fixture: Awaited<ReturnType<typeof healthFixture>>) => Promise<void>,
) {
  const fixture = await healthFixture();
  try {
    await run(fixture);
  } finally {
    await fixture.close();
  }
}

/** Poll the database lock wait, not a guessed timing delay, before releasing a race barrier. */
export async function queued(fixture: Awaited<ReturnType<typeof healthFixture>>) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (
      (
        await fixture.pool.query(
          "SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",
          [fixture.schema],
        )
      ).rowCount
    )
      return;
    await setTimeout(5);
  }
  assert.fail('Concurrent transaction did not reach the expected lock');
}
