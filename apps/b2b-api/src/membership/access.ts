import type { PoolClient } from 'pg';
import {
  ProductAccessSchema,
  type OrganizationRoleV2,
  type ProductAccess,
} from '@klisteniapp/b2b-contracts/product-v2';
import type { AuthorizedProductIdentityContext } from '../product-context.ts';
import type { DomainContext } from '../domain-context.ts';
import { HttpError } from '../errors.ts';
import { assertProductCapability } from '../product-context.ts';
import { assertProductMigrations } from '../product-readiness.ts';
import { requireActiveDomain } from '../white-label-access.ts';

const revoked = () => new HttpError(403, 'CONTEXT_REVOKED', 'El acceso cambió.');

/** Explicit inactive-login admission seam. Call only after password auth has
 * created a fresh session, in the same transaction as the brand binding.
 * Active login keeps its existing path; an existing foreign binding is never
 * rebound. This changes only the brand binding; restricted purpose is derived
 * from current membership on every request. */
export async function bindInactiveBrandSession(
  db: PoolClient,
  actorId: string,
  sessionId: string,
  domain: DomainContext,
  contractHeader?: string,
): Promise<AuthorizedProductIdentityContext> {
  const org = (
    await db.query<{ product_active: boolean }>(
      'SELECT product_active FROM b2b_organization WHERE id=$1 FOR SHARE',
      [domain.organizationId],
    )
  ).rows[0];
  if (!org) throw revoked();
  assertProductCapability(contractHeader, org.product_active);
  await assertProductMigrations(db);
  const session = await db.query(
    `SELECT id FROM b2b_auth_session WHERE id=$1 AND "userId"=$2
     AND "expiresAt">clock_timestamp() FOR SHARE`,
    [sessionId, actorId],
  );
  if (!session.rowCount) throw revoked();
  const inactive = await db.query(
    `SELECT 1 FROM b2b_membership WHERE organization_id=$1 AND user_id=$2 AND NOT active FOR SHARE`,
    [domain.organizationId, actorId],
  );
  if (!inactive.rowCount)
    throw new HttpError(403, 'MEMBERSHIP_REQUIRED', 'Tu acceso a esta marca cambió.');
  await requireActiveDomain(db, domain);
  await db.query(
    `INSERT INTO b2b_session_context(session_id,organization_id,domain_host,domain_generation)
     VALUES($1,$2,$3,$4) ON CONFLICT(session_id) DO NOTHING`,
    [sessionId, domain.organizationId, domain.host, domain.generation],
  );
  return authorizeExportIdentity(db, actorId, domain.organizationId, sessionId, {
    contractHeader,
    whiteLabel: true,
    domain,
  });
}

/** Identity-only authorization for the self endpoints. This does not authorize
 * an operational context or weaken requireBrandSession's active-member check.
 * The caller owns the transaction; export reuses this exact connection. */
export async function authorizeExportIdentity(
  db: PoolClient,
  actorId: string,
  organizationId: string,
  sessionId: string,
  options: { contractHeader?: string; whiteLabel?: boolean; domain?: DomainContext | null },
): Promise<AuthorizedProductIdentityContext> {
  if (options.whiteLabel && !options.domain) throw revoked();
  if (options.domain && options.domain.organizationId !== organizationId) throw revoked();
  const org = (
    await db.query<{ product_active: boolean }>(
      'SELECT product_active FROM b2b_organization WHERE id=$1 FOR SHARE',
      [organizationId],
    )
  ).rows[0];
  if (!org) throw revoked();
  const session = await db.query(
    `SELECT id FROM b2b_auth_session WHERE id=$1 AND "userId"=$2
     AND "expiresAt">clock_timestamp() FOR SHARE`,
    [sessionId, actorId],
  );
  if (!session.rowCount) throw revoked();
  const membership = (
    await db.query<{ active: boolean; access_revision: string }>(
      'SELECT active,access_revision FROM b2b_membership WHERE organization_id=$1 AND user_id=$2 FOR SHARE',
      [organizationId, actorId],
    )
  ).rows[0];
  if (!membership)
    throw new HttpError(403, 'MEMBERSHIP_REQUIRED', 'Tu acceso a esta marca cambió.');
  if (options.domain) {
    const domain = options.domain;
    const binding = await db.query(
      `SELECT s.session_id FROM b2b_session_context s JOIN b2b_domain d
       ON d.host=s.domain_host AND d.organization_id=s.organization_id
       WHERE s.session_id=$1 AND s.organization_id=$2 AND s.domain_host=$3
       AND s.domain_generation=$4 AND d.generation=s.domain_generation
       AND d.status='active' AND d.verified_at IS NOT NULL AND d.dns_verified_at IS NOT NULL
       AND d.tls_verified_at IS NOT NULL AND d.tls_expires_at>clock_timestamp() FOR SHARE OF s,d`,
      [sessionId, organizationId, domain.host, domain.generation],
    );
    if (!binding.rowCount)
      throw new HttpError(401, 'BRAND_SESSION_REQUIRED', 'Iniciá sesión en esta marca.');
  }
  assertProductCapability(options.contractHeader, org.product_active);
  await assertProductMigrations(db);
  return {
    db,
    actorId,
    organizationId,
    accessMode: membership.active ? 'active' : 'export-only',
    accessRevision: Number(membership.access_revision),
    capabilities: new Set(['export-own-records']),
  };
}

/** Inactive discovery contains no operational grants, even if retained in SQL.
 * Active access continues through ACCESS's selected-branch authorization. */
export function inactiveAccess(
  identity: AuthorizedProductIdentityContext,
  role: OrganizationRoleV2,
): ProductAccess {
  if (identity.accessMode !== 'export-only') throw revoked();
  return ProductAccessSchema.parse({
    schemaVersion: 2,
    organizationId: identity.organizationId,
    userId: identity.actorId,
    role,
    accessMode: 'export-only',
    accessRevision: identity.accessRevision,
    branches: [],
    capabilities: ['export-own-records'],
  });
}

/** Deny by default. Apply after resolving the CURRENT selected membership and
 * before media/range/body handling; HEAD never inherits a GET permission.
 * Authentication/login is a separate host-bound gate owned by ACCESS. */
export function inactiveRouteAllowed(
  method: string,
  pathname: string,
  organizationId: string,
  contractHeader?: string,
  range?: string,
): boolean {
  if (range !== undefined) return false;
  if (method === 'POST' && pathname === '/api/b2b/auth/sign-out') return true;
  if (method !== 'GET' || contractHeader !== '2') return false;
  return (
    pathname === '/api/b2b/self/exports' ||
    pathname === '/api/b2b/self/b2c-invitation' ||
    pathname === `/api/b2b/orgs/${organizationId}/product/v2/access` ||
    pathname === `/api/b2b/orgs/${organizationId}/product/v2/capabilities`
  );
}
