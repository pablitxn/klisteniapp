import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createAuth } from '../../src/auth.ts';
import { migrate } from '../../src/migrate.ts';
import { B2BService } from '../../src/service.ts';
import type { Config } from '../../src/config.ts';
import type { AuthorizedProductContext } from '../../src/product-context.ts';
import type { DomainContext } from '../../src/domain-context.ts';

export const databaseUrl = process.env.B2B_TEST_DATABASE_URL;
export async function productFixture(
  run: (fixture: {
    pool: Pool;
    service: B2BService;
    schema: string;
    auth: ReturnType<typeof createAuth>;
    config: Config;
    scoped: <T>(
      actor: string,
      branch: string | undefined,
      write: boolean,
      operation: (c: AuthorizedProductContext) => Promise<T>,
      options?: { role?: string; organizationId?: string; domain?: DomainContext },
    ) => Promise<T>;
  }) => Promise<void>,
) {
  assert.ok(databaseUrl, 'A disposable B2B_TEST_DATABASE_URL is required');
  const url = new URL(databaseUrl);
  assert.match(url.pathname, /b2b.*test|test.*b2b/i);
  const owner = new Pool({ connectionString: url.href });
  const schema = `b2b_wp01_${randomUUID().replaceAll('-', '')}`;
  let pool: Pool | undefined;
  try {
    await owner.query(`CREATE SCHEMA ${schema}`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: url.href, application_name: schema, max: 10 });
    const config: Config = {
      databaseUrl: url.href,
      secret: 'wp01-synthetic-only-secret-1234567890123456',
      origin: 'http://localhost:4200',
      host: '127.0.0.1',
      port: 0,
      production: false,
      demoMode: false,
    };
    const auth = createAuth(pool, config, { migrating: true });
    await migrate(pool, auth);
    await pool.query(`INSERT INTO b2b_auth_user(id,name,email,"emailVerified","createdAt","updatedAt")
      SELECT id,id,id||'@example.test',true,now(),now() FROM unnest(ARRAY['super','second','admin','coach','other-coach','member','unassigned','inactive','north-member','foreign']) id;
      INSERT INTO b2b_organization(id,slug,brand,product_active) VALUES ('atlas','atlas','{"name":"Atlas"}',true),('sur','sur','{"name":"Sur"}',true);
      INSERT INTO b2b_branch(id,organization_id,slug,name) VALUES ('atlas-north','atlas','north','North'),('sur-north','sur','north','North');
      INSERT INTO b2b_membership(organization_id,user_id,role,product_role) VALUES
      ('atlas','super','admin','superadmin'),('atlas','second','admin','superadmin'),('atlas','admin','admin','admin'),
      ('atlas','coach','coach','coach'),('atlas','other-coach','coach','coach'),('atlas','member','member','member'),
      ('atlas','unassigned','member','member'),('atlas','inactive','member','member'),('atlas','north-member','member','member'),
      ('sur','foreign','member','member'),('sur','super','admin','superadmin');
      UPDATE b2b_membership SET active=false WHERE user_id='inactive';
      UPDATE b2b_branch_grant SET active=false WHERE user_id='north-member';
      INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES ('atlas','atlas-north','north-member','member');
      INSERT INTO b2b_coach_assignment(organization_id,branch_id,coach_id,member_id) VALUES ('atlas','atlas-principal','other-coach','member');
      INSERT INTO b2b_auth_session(id,"userId",token,"expiresAt","createdAt","updatedAt")
      SELECT 'session-'||id,id,'token-'||id,now()+interval '1 day',now(),now() FROM b2b_auth_user;
    `);
    const service = new B2BService(pool, auth, config);
    await run({
      pool,
      service,
      schema,
      auth,
      config,
      scoped: (actor, branch, write, operation, options = {}) =>
        service.productOrganization(
          actor,
          options.organizationId ?? 'atlas',
          `session-${actor}`,
          write,
          '2',
          operation,
          { branchId: branch, role: options.role, domain: options.domain },
        ),
    });
  } finally {
    await pool?.end();
    await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await owner.end();
  }
}
