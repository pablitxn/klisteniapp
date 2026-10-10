import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import type { Pool } from 'pg';
import { BrandInputSchema } from '@klisteniapp/b2b-contracts';
import { createAuth } from './auth.ts';
import type { Auth } from './auth.ts';
import { readConfig } from './config.ts';
import { createPool } from './database.ts';
import { B2BService, createUser, seedBaseCatalog } from './service.ts';
import type { Config } from './config.ts';
import { resetDemo, seedDemo } from './demo.ts';

export async function bootstrap(
  pool: Pool,
  auth: Auth,
  config: Config,
  raw: { email: string; name: string; password: string; slug: string; organizationName: string },
) {
  const input = z
    .object({
      email: z.email().transform((v) => v.toLowerCase()),
      name: z.string().trim().min(1).max(100),
      password: z.string().min(12).max(128),
      slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .max(100),
      organizationName: z.string().trim().min(1).max(100),
    })
    .parse(raw);
  return new B2BService(pool, auth, config).transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended('klisteni-b2b:bootstrap',0))");
    if ((await db.query('SELECT user_id FROM b2b_platform_admin LIMIT 1')).rowCount)
      throw new Error('B2B bootstrap already completed');
    if ((await db.query('SELECT id FROM b2b_auth_user WHERE email=$1', [input.email])).rowCount)
      throw new Error('Bootstrap email already exists; use an operator-reviewed migration');
    const user = await createUser(db, auth, input);
    const organizationId = input.slug;
    await db.query('INSERT INTO b2b_platform_admin(user_id) VALUES($1)', [user.id]);
    await db.query('INSERT INTO b2b_organization(id,slug,brand) VALUES($1,$1,$2)', [
      organizationId,
      BrandInputSchema.parse({ name: input.organizationName }),
    ]);
    await db.query(
      "INSERT INTO b2b_membership(organization_id,user_id,role) VALUES($1,$2,'admin')",
      [organizationId, user.id],
    );
    await seedBaseCatalog(db);
    return { user, organizationId, slug: input.slug };
  });
}
export async function setServiceAccess(
  pool: Pool,
  slug: string,
  enabled: boolean,
  endsAt: string | null,
) {
  if (endsAt !== null) z.iso.datetime({ offset: true }).parse(endsAt);
  const result = await pool.query(
    'UPDATE b2b_organization SET service_enabled=$2,service_ends_at=$3 WHERE slug=$1 RETURNING id',
    [slug, enabled, endsAt],
  );
  if (!result.rowCount) throw new Error('Unknown B2B organization');
  return { organizationId: result.rows[0].id, enabled, endsAt };
}
export async function createOrganization(
  pool: Pool,
  auth: Auth,
  config: Config,
  raw: { email: string; name: string; password?: string; slug: string; organizationName: string },
) {
  const input = z
    .object({
      email: z.email().transform((v) => v.toLowerCase()),
      name: z.string().trim().min(1).max(100),
      password: z.string().min(12).max(128).optional(),
      slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .max(100),
      organizationName: z.string().trim().min(1).max(100),
    })
    .parse(raw);
  return new B2BService(pool, auth, config).transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended('klisteni-b2b:bootstrap',0))");
    if (!(await db.query('SELECT user_id FROM b2b_platform_admin LIMIT 1')).rowCount)
      throw new Error('Bootstrap the platform before adding an organization');
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `b2b:email:${input.email}`,
    ]);
    const existingUser = (
      await db.query<{ id: string; name: string; email: string }>(
        'SELECT id,name,email FROM b2b_auth_user WHERE email=$1',
        [input.email],
      )
    ).rows[0];
    const existingOrg = (
      await db.query<{ id: string; brand: { name: string } }>(
        'SELECT id,brand FROM b2b_organization WHERE slug=$1',
        [input.slug],
      )
    ).rows[0];
    if (existingOrg) {
      const sameAdmin =
        existingUser &&
        (
          await db.query(
            "SELECT 1 FROM b2b_membership WHERE organization_id=$1 AND user_id=$2 AND role='admin' AND active",
            [existingOrg.id, existingUser.id],
          )
        ).rowCount;
      if (!sameAdmin || existingOrg.brand.name !== input.organizationName)
        throw new Error('Organization slug already exists with different configuration');
      return {
        organizationId: existingOrg.id,
        slug: input.slug,
        admin: existingUser,
        created: false,
        reusedIdentity: true,
      };
    }
    if (!existingUser && !input.password)
      throw new Error('A new administrator requires B2B_ADMIN_PASSWORD');
    const user =
      existingUser ??
      (await createUser(db, auth, {
        email: input.email,
        name: input.name,
        password: input.password!,
      }));
    await db.query('INSERT INTO b2b_organization(id,slug,brand) VALUES($1,$1,$2)', [
      input.slug,
      BrandInputSchema.parse({ name: input.organizationName }),
    ]);
    await db.query(
      "INSERT INTO b2b_membership(organization_id,user_id,role) VALUES($1,$2,'admin')",
      [input.slug, user.id],
    );
    await db.query(
      "INSERT INTO b2b_audit(organization_id,action,resource_id) VALUES($1,'operator.organization.create',$1)",
      [input.slug],
    );
    await seedBaseCatalog(db);
    return {
      organizationId: input.slug,
      slug: input.slug,
      admin: user,
      created: true,
      reusedIdentity: Boolean(existingUser),
    };
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let pool: Pool | undefined;
  try {
    const operation = process.argv[2];
    const config = readConfig(
      operation === 'reset-demo'
        ? {
            ...process.env,
            B2B_DATABASE_URL:
              process.env.B2B_MIGRATION_DATABASE_URL ?? process.env.B2B_DATABASE_URL,
          }
        : process.env,
    );
    pool = createPool(config);
    const auth = createAuth(pool, config);
    let output: unknown;
    if (operation === 'seed-demo')
      output = await seedDemo(pool, auth, config, process.env.B2B_DEMO_PASSWORD ?? '');
    else if (operation === 'reset-demo')
      output = await resetDemo(pool, config, process.argv.includes('--confirm-demo-reset'));
    else if (operation === 'bootstrap')
      output = await bootstrap(pool, auth, config, {
        email: process.env.B2B_BOOTSTRAP_EMAIL ?? '',
        name: process.env.B2B_BOOTSTRAP_NAME ?? '',
        password: process.env.B2B_BOOTSTRAP_PASSWORD ?? '',
        slug: process.env.B2B_ORG_SLUG ?? '',
        organizationName: process.env.B2B_ORG_NAME ?? '',
      });
    else if (operation === 'create-organization')
      output = await createOrganization(pool, auth, config, {
        email: process.env.B2B_ADMIN_EMAIL ?? '',
        name: process.env.B2B_ADMIN_NAME ?? '',
        ...(process.env.B2B_ADMIN_PASSWORD ? { password: process.env.B2B_ADMIN_PASSWORD } : {}),
        slug: process.env.B2B_ORG_SLUG ?? '',
        organizationName: process.env.B2B_ORG_NAME ?? '',
      });
    else if (operation === 'service-access')
      output = await setServiceAccess(
        pool,
        process.env.B2B_ORG_SLUG ?? '',
        z.enum(['true', 'false']).parse(process.env.B2B_SERVICE_ENABLED) === 'true',
        process.env.B2B_SERVICE_ENDS_AT || null,
      );
    else throw new Error('Unknown B2B operator command');
    console.info(JSON.stringify(output));
  } catch {
    console.error(
      'B2B operator command failed. Verify arguments, database isolation, demo guards and configuration.',
    );
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
