import type {
  AuthorizedProductContext,
  AuthorizedProductIdentityContext,
} from '../product-context.ts';
import { HttpError } from '../errors.ts';

const revoked = () =>
  new HttpError(403, 'CONTEXT_REVOKED', 'El acceso cambió. Actualizá la sesión.');

/** ACCESS still owns session/host/entitlement authorization. These checks fence
 * stale contexts and serialize health against membership and branch changes.
 * All helpers reuse its READ COMMITTED transaction and never open a connection. */
export async function currentIdentity(context: AuthorizedProductIdentityContext) {
  const row = (
    await context.db.query<{
      active: boolean;
      product_role: string;
      access_revision: string;
      service_enabled: boolean;
      service_current: boolean;
    }>(
      `SELECT m.active,m.product_role,m.access_revision,o.service_enabled,
        (o.service_ends_at IS NULL OR o.service_ends_at>clock_timestamp()) AS service_current
       FROM b2b_membership m JOIN b2b_organization o ON o.id=m.organization_id
       WHERE m.organization_id=$1 AND m.user_id=$2 FOR SHARE OF m,o`,
      [context.organizationId, context.actorId],
    )
  ).rows[0];
  if (
    !row ||
    Number(row.access_revision) !== context.accessRevision ||
    context.accessMode !== (row.active ? 'active' : 'export-only')
  )
    throw revoked();
  return row;
}

export async function currentHealthContext(
  context: AuthorizedProductContext,
  capability: 'manage-own-health' | 'read-consented-health',
) {
  const identity = await currentIdentity(context);
  if (
    !identity.active ||
    !identity.service_enabled ||
    !identity.service_current ||
    identity.product_role !== context.role ||
    !context.capabilities.has(capability)
  )
    throw revoked();
  const branch = (
    await context.db.query(
      `SELECT id FROM b2b_branch WHERE organization_id=$1 AND id=$2 AND status='active' FOR SHARE`,
      [context.organizationId, context.branchId],
    )
  ).rows[0];
  if (!branch) throw revoked();
  // Administrative scope alone is never the disclosed trainer audience.
  if (
    capability === 'read-consented-health' ||
    context.role === 'coach' ||
    context.role === 'member'
  ) {
    const role = capability === 'read-consented-health' ? 'coach' : context.role;
    if (
      !(
        await context.db.query(
          `SELECT 1 FROM b2b_branch_grant
           WHERE organization_id=$1 AND branch_id=$2 AND user_id=$3 AND role=$4 AND active FOR SHARE`,
          [context.organizationId, context.branchId, context.actorId, role],
        )
      ).rowCount
    )
      throw revoked();
  }
}

/** Identity-global lock also covers absent health rows and consent in another
 * organization. Membership/organization locks must be acquired before this. */
export async function lockHealthOwner(
  context: Pick<AuthorizedProductIdentityContext, 'db'>,
  ownerId: string,
) {
  await context.db.query("SELECT pg_advisory_xact_lock(hashtextextended('b2b-health:' || $1,0))", [
    ownerId,
  ]);
}

export async function currentHealthTarget(context: AuthorizedProductContext, memberId: string) {
  await context.authorizeMember(memberId, 'history');
  if (
    !(
      await context.db.query(
        `SELECT 1 FROM b2b_membership m JOIN b2b_branch_grant g
         ON g.organization_id=m.organization_id AND g.user_id=m.user_id
         WHERE m.organization_id=$1 AND m.user_id=$2 AND m.active
         AND g.branch_id=$3 AND g.role='member' AND g.active FOR SHARE OF m,g`,
        [context.organizationId, memberId, context.branchId],
      )
    ).rowCount
  )
    throw revoked();
}
