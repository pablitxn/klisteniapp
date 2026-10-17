import { createHmac } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  ProductBootstrapSchema,
  type ProductBootstrap,
  type OrganizationRoleV2,
} from '@klisteniapp/b2b-contracts/product-v2';
import type { Config } from './config.ts';
import type { DomainContext } from './domain-context.ts';
import { requireIdentityRealm } from './product-identity.ts';
import { assertProductMigrations } from './product-readiness.ts';

export async function productBootstrap(
  db: PoolClient,
  actorId: string,
  sessionId: string,
  config: Config,
  domain?: DomainContext | null,
): Promise<ProductBootstrap> {
  const own = (
    await db.query(
      'SELECT organization_id FROM b2b_membership WHERE user_id=$1 AND ($2::text IS NULL OR organization_id=$2) ORDER BY organization_id',
      [actorId, domain?.organizationId ?? null],
    )
  ).rows;
  await db.query('SELECT id FROM b2b_organization WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE', [
    own.map((row) => row.organization_id),
  ]);
  await requireIdentityRealm(
    db,
    actorId,
    sessionId,
    domain,
    config.productUnified ? config.origin : undefined,
  );
  const user = (
    await db.query('SELECT id,name,email FROM b2b_auth_user WHERE id=$1 FOR SHARE', [actorId])
  ).rows[0];
  const rows = (
    await db.query<{
      id: string;
      name: string;
      product_role: OrganizationRoleV2;
      product_active: boolean;
      active: boolean;
      access_revision: string;
    }>(
      `SELECT o.id,o.brand->>'name' AS name,o.product_active,m.product_role,m.active,m.access_revision FROM b2b_organization o JOIN b2b_membership m ON m.organization_id=o.id
     WHERE m.user_id=$1 AND ($2::text IS NULL OR o.id=$2) ORDER BY o.id FOR SHARE OF o,m`,
      [actorId, domain?.organizationId ?? null],
    )
  ).rows;
  if (rows.some((row) => row.product_active)) await assertProductMigrations(db);
  const memberships: ProductBootstrap['memberships'] = [];
  for (const row of rows) {
    const choices: ProductBootstrap['memberships'][number]['choices'] = [];
    if (row.active) {
      const branches = (
        await db.query<{ id: string; name: string }>(
          `SELECT id,name FROM b2b_branch WHERE organization_id=$1 AND status='active' ORDER BY name,id FOR SHARE`,
          [row.id],
        )
      ).rows;
      const grants = (
        await db.query<{ branch_id: string; role: 'coach' | 'member' }>(
          `SELECT branch_id,role FROM b2b_branch_grant WHERE organization_id=$1 AND user_id=$2 AND active ORDER BY branch_id,role FOR SHARE`,
          [row.id, actorId],
        )
      ).rows;
      for (const branch of branches) {
        if (row.product_role === 'superadmin' || row.product_role === 'admin')
          choices.push({ branchId: branch.id, name: branch.name, role: row.product_role });
        for (const grant of grants.filter((g) => g.branch_id === branch.id))
          choices.push({ branchId: branch.id, name: branch.name, role: grant.role });
      }
    }
    memberships.push({
      organizationId: row.id,
      name: row.name,
      role: row.product_role,
      activated: row.product_active,
      accessMode: row.active ? 'active' : 'export-only',
      accessRevision: Number(row.access_revision),
      choices,
    });
  }
  // Opaque lifetime identity, never an authentication token or reusable authority.
  const key = createHmac('sha256', config.secret)
    .update(JSON.stringify([sessionId, domain?.host ?? config.origin, domain?.generation ?? 0]))
    .digest('hex');
  return ProductBootstrapSchema.parse({
    schemaVersion: 2,
    user,
    realm: { mode: domain ? 'white-label' : config.productUnified ? 'unified' : 'legacy', key },
    memberships,
  });
}
