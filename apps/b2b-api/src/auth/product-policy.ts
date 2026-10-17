import type { PoolClient } from 'pg';
import type { OrganizationRoleV2, ProductAccess } from '@klisteniapp/b2b-contracts/product-v2';
import { denied, HttpError, missing } from '../errors.ts';

export function productCapabilities(role: OrganizationRoleV2): ProductAccess['capabilities'] {
  const own: ProductAccess['capabilities'] = ['manage-own-health', 'export-own-records'];
  if (role === 'member') return [...own, 'edit-own-sessions', 'read-training-history'];
  const staff: ProductAccess['capabilities'] = [
    ...own,
    'edit-planning',
    'read-training-history',
    'read-consented-health',
  ];
  if (role === 'coach') return staff;
  return [...staff, 'manage-people', ...(role === 'superadmin' ? ['manage-admins' as const] : [])];
}

export function mayManageRole(actor: OrganizationRoleV2, target: OrganizationRoleV2): boolean {
  return actor === 'superadmin' || (actor === 'admin' && ['coach', 'member'].includes(target));
}

/** Membership is not a substitute for a branch grant. In unified legacy mode,
 * only an unambiguous, permitted Principal branch is a safe default. */
export async function principalScope(
  db: PoolClient,
  organizationId: string,
  actorId: string,
  organizationRole?: OrganizationRoleV2,
) {
  const found = await db.query<{ id: string }>(
    `SELECT b.id FROM b2b_branch b WHERE b.organization_id=$1 AND b.status='active'
     AND b.id=b2b_principal_branch_id($1) AND ($3 OR EXISTS(
       SELECT 1 FROM b2b_branch_grant g WHERE g.organization_id=b.organization_id
       AND g.branch_id=b.id AND g.user_id=$2 AND g.active))
     AND CASE WHEN $3 THEN (SELECT count(*) FROM b2b_branch available
       WHERE available.organization_id=$1 AND available.status='active')=1 ELSE
       (SELECT count(DISTINCT g.branch_id) FROM b2b_branch_grant g
       JOIN b2b_branch allowed ON allowed.organization_id=g.organization_id AND allowed.id=g.branch_id
       WHERE g.organization_id=$1 AND g.user_id=$2 AND g.active AND allowed.status='active')=1 END`,
    [organizationId, actorId, organizationRole === 'superadmin' || organizationRole === 'admin'],
  );
  if (!found.rows[0]) throw new HttpError(400, 'BRANCH_REQUIRED', 'Elegí una sede autorizada.');
  return found.rows[0].id;
}

/** Current branch role, never highest role in a different branch. */
export async function productBranchScope(
  db: PoolClient,
  organizationId: string,
  actorId: string,
  organizationRole: OrganizationRoleV2,
  branchId: string,
  selectedRole?: string,
): Promise<OrganizationRoleV2> {
  const branch = await db.query<{ status: string }>(
    'SELECT status FROM b2b_branch WHERE organization_id=$1 AND id=$2 FOR SHARE',
    [organizationId, branchId],
  );
  if (!branch.rows[0]) throw missing();
  if (branch.rows[0].status !== 'active')
    throw new HttpError(403, 'BRANCH_ARCHIVED', 'Esta sede está archivada.');
  if (
    ['superadmin', 'admin'].includes(organizationRole) &&
    (!selectedRole ||
      selectedRole === organizationRole ||
      (organizationRole === 'superadmin' && selectedRole === 'admin'))
  )
    return selectedRole === 'admin' ? 'admin' : organizationRole;
  if (selectedRole && !['coach', 'member'].includes(selectedRole)) throw denied();
  const grants = await db.query<{ role: 'coach' | 'member' }>(
    `SELECT role FROM b2b_branch_grant WHERE organization_id=$1 AND branch_id=$2
     AND user_id=$3 AND active FOR SHARE`,
    [organizationId, branchId, actorId],
  );
  if (selectedRole && grants.rows.some((g) => g.role === selectedRole))
    return selectedRole as 'coach' | 'member';
  if (!selectedRole && grants.rows.length === 1) return grants.rows[0].role;
  if (!selectedRole && grants.rows.length > 1)
    throw new HttpError(400, 'ROLE_REQUIRED', 'Elegí una función para esta sede.');
  throw new HttpError(403, 'BRANCH_FORBIDDEN', 'Ya no tenés acceso a esta sede.');
}

export async function authorizeProductMember(
  db: PoolClient,
  organizationId: string,
  branchId: string,
  actorId: string,
  role: OrganizationRoleV2,
  memberId: string,
  purpose: 'planning' | 'history',
): Promise<void> {
  if (role === 'member' && actorId !== memberId) throw denied();
  const found = await db.query(
    `SELECT 1 FROM b2b_membership m WHERE m.organization_id=$1 AND m.user_id=$2
     AND ($4='history' OR m.active) AND (
       EXISTS(SELECT 1 FROM b2b_branch_grant g WHERE g.organization_id=m.organization_id
         AND g.user_id=m.user_id AND g.branch_id=$3 AND g.role='member'
         AND ($4='history' OR g.active))
       OR ($4='history' AND (EXISTS(SELECT 1 FROM b2b_program_assignment a
         WHERE a.organization_id=m.organization_id AND a.member_id=m.user_id AND a.branch_id=$3)
         OR EXISTS(SELECT 1 FROM b2b_enrollment e WHERE e.organization_id=m.organization_id
           AND e.member_id=m.user_id AND e.branch_id=$3)))) FOR SHARE OF m`,
    [organizationId, memberId, branchId, purpose],
  );
  if (!found.rowCount) throw missing();
}
