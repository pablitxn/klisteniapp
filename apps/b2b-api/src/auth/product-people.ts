import { createHash, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  HealthConsentSchema,
  ProductMemberSchema,
  type OrganizationRoleV2,
  type ProductInput,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2';
import type { AuthorizedProductContext } from '../product-context.ts';
import { conflict, denied, HttpError, missing } from '../errors.ts';
import { productOperation, writeProductAudit } from '../audit/product-audit.ts';
import { mayManageRole } from './product-policy.ts';

type Grant = ProductOutput<'people'>[number]['branchGrants'][number];
export async function productPeople(c: AuthorizedProductContext): Promise<ProductOutput<'people'>> {
  const administrator = c.capabilities.has('manage-people');
  const found = await c.db.query(
    `SELECT m.*,u.name,u.email FROM b2b_membership m JOIN b2b_auth_user u ON u.id=m.user_id
     WHERE m.organization_id=$1 AND ($4 OR m.user_id=$2 OR ($5 AND EXISTS(
       SELECT 1 FROM b2b_branch_grant g WHERE g.organization_id=m.organization_id
       AND g.user_id=m.user_id AND g.branch_id=$3 AND g.role='member')))
     ORDER BY u.name,m.user_id`,
    [c.organizationId, c.actorId, c.branchId, administrator, c.role === 'coach'],
  );
  const grants = (
    await c.db.query(
      `SELECT user_id,branch_id,role,active FROM b2b_branch_grant WHERE organization_id=$1
     AND ($3 OR branch_id=$2) ORDER BY branch_id,role`,
      [c.organizationId, c.branchId, administrator],
    )
  ).rows;
  const assignments = (
    await c.db.query(
      `SELECT member_id,coach_id FROM b2b_coach_assignment WHERE organization_id=$1
     AND branch_id=$2 ORDER BY coach_id`,
      [c.organizationId, c.branchId],
    )
  ).rows;
  return found.rows.map((m) =>
    ProductMemberSchema.parse({
      schemaVersion: 2,
      userId: m.user_id,
      name: m.name,
      email: m.email,
      role: m.product_role,
      active: m.active,
      revision: Number(m.access_revision),
      branchGrants: grants
        .filter((g) => g.user_id === m.user_id)
        .map((g) => ({
          branchId: g.branch_id,
          role: g.role,
          active: g.active,
        })),
      coachIds: assignments.filter((a) => a.member_id === m.user_id).map((a) => a.coach_id),
    }),
  );
}

async function validateGrants(c: AuthorizedProductContext, grants: Grant[]) {
  for (const grant of grants) {
    if (
      !(
        await c.db.query(
          `SELECT 1 FROM b2b_branch WHERE organization_id=$1 AND id=$2
       AND (NOT $3 OR status='active') FOR SHARE`,
          [c.organizationId, grant.branchId, grant.active],
        )
      ).rowCount
    )
      throw missing();
  }
}

/** The same organization transaction orders deactivation and disclosures.
 * Reactivation deliberately has no corresponding grant/consent restoration. */
export async function revokeMembershipConsents(
  db: PoolClient,
  organizationId: string,
  ownerId: string,
  actorId: string,
) {
  const revoked = (
    await db.query(
      `UPDATE b2b_health_consent SET revoked_at=clock_timestamp(),revision=revision+1
     WHERE organization_id=$1 AND owner_id=$2 AND revoked_at IS NULL RETURNING *`,
      [organizationId, ownerId],
    )
  ).rows;
  for (const row of revoked) {
    const snapshot = HealthConsentSchema.parse({
      schemaVersion: 2,
      id: row.id,
      ownerId,
      scope: { organizationId, branchId: row.branch_id },
      revision: row.revision,
      status: 'revoked',
      categories: row.categories,
      audience: row.audience,
      disclosureVersion: row.disclosure_version,
      grantedAt: row.granted_at.toISOString(),
      revokedAt: row.revoked_at.toISOString(),
    });
    await db.query(
      `INSERT INTO b2b_health_consent_revision(organization_id,branch_id,owner_id,
       consent_id,revision,snapshot,actor_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,'membership-inactive')`,
      [organizationId, row.branch_id, ownerId, row.id, row.revision, snapshot, actorId],
    );
  }
}

export async function updateProductMember(
  c: AuthorizedProductContext,
  input: ProductInput<'updateMember'>,
): Promise<ProductOutput<'updateMember'>> {
  if (!c.capabilities.has('manage-people')) throw denied();
  // Role changes may not generate an implicit Principal grant through old triggers.
  const previous = (
    await c.db.query<{
      product_role: OrganizationRoleV2;
      active: boolean;
      access_revision: string;
    }>(
      'SELECT product_role,active,access_revision FROM b2b_membership WHERE organization_id=$1 AND user_id=$2 FOR UPDATE',
      [c.organizationId, input.memberId],
    )
  ).rows[0];
  if (!previous) throw missing();
  const role = input.role ?? previous.product_role,
    active = input.active ?? previous.active;
  if (!mayManageRole(c.role, previous.product_role) || !mayManageRole(c.role, role)) throw denied();
  return productOperation(c, 'membership.update', input, input.memberId, async () => {
    if (Number(previous.access_revision) !== input.expectedRevision) throw conflict();
    if (
      previous.active &&
      previous.product_role === 'superadmin' &&
      (!active || role !== 'superadmin')
    ) {
      if (
        !(
          await c.db.query(
            `SELECT 1 FROM b2b_membership WHERE organization_id=$1 AND user_id<>$2
         AND active AND product_role='superadmin'`,
            [c.organizationId, input.memberId],
          )
        ).rowCount
      )
        throw new HttpError(
          409,
          'LAST_SUPERADMIN',
          'La marca debe conservar un superadministrador activo.',
        );
    }
    if (input.branchGrants) await validateGrants(c, input.branchGrants);
    const changedFields: string[] = [];
    if (role !== previous.product_role) changedFields.push('role');
    if (active !== previous.active) changedFields.push('active');
    if (input.branchGrants) {
      const before = (
        await c.db.query(
          `SELECT branch_id,role,active FROM b2b_branch_grant WHERE organization_id=$1 AND user_id=$2 ORDER BY branch_id,role`,
          [c.organizationId, input.memberId],
        )
      ).rows;
      const next = new Map(input.branchGrants.map((g) => [`${g.branchId}:${g.role}`, g]));
      let grantsChanged = false;
      // Retain revoked rows as historical scope; omitted grants are revoked.
      for (const old of before) {
        const grant = next.get(`${old.branch_id}:${old.role}`);
        if (old.active !== (grant?.active ?? false)) grantsChanged = true;
      }
      for (const grant of input.branchGrants) {
        if (!before.some((g) => g.branch_id === grant.branchId && g.role === grant.role))
          grantsChanged = true;
      }
      if (grantsChanged) {
        changedFields.push('branchGrants');
        await c.db.query(
          'UPDATE b2b_branch_grant SET active=false WHERE organization_id=$1 AND user_id=$2',
          [c.organizationId, input.memberId],
        );
        for (const grant of input.branchGrants)
          await c.db.query(
            `INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role,active) VALUES($1,$2,$3,$4,$5)
           ON CONFLICT(organization_id,branch_id,user_id,role) DO UPDATE SET active=EXCLUDED.active`,
            [c.organizationId, grant.branchId, input.memberId, grant.role, grant.active],
          );
      }
    }
    await c.db.query("SELECT set_config('b2b.explicit_branch_scope','on',true)");
    // The SQL role trigger advances role/active revisions; advance exactly once
    // for grants-only updates. Exact no-op operations retain the current revision.
    await c.db.query(
      `UPDATE b2b_membership SET role=$3,product_role=$4,active=$5,
       access_revision=access_revision+CASE WHEN $6 AND product_role=$4 AND active=$5 THEN 1 ELSE 0 END
       WHERE organization_id=$1 AND user_id=$2`,
      [
        c.organizationId,
        input.memberId,
        role === 'superadmin' ? 'admin' : role,
        role,
        active,
        changedFields.includes('branchGrants'),
      ],
    );
    if (!active) await revokeMembershipConsents(c.db, c.organizationId, input.memberId, c.actorId);
    const response = (await productPeople(c)).find((member) => member.userId === input.memberId)!;
    if (changedFields.length)
      await writeProductAudit(c, {
        action: 'membership.update',
        resourceId: input.memberId,
        operationId: input.operationId,
        beforeRevision: Number(previous.access_revision),
        afterRevision: response.revision,
        changedFields,
      });
    return { response, revision: response.revision };
  });
}

export async function inviteProductMember(
  c: AuthorizedProductContext,
  input: ProductInput<'inviteMember'>,
  origin: string,
): Promise<ProductOutput<'inviteMember'>> {
  if (!c.capabilities.has('manage-people') || !mayManageRole(c.role, input.role)) throw denied();
  return productOperation(c, 'invitation.create', input, input.id, async () => {
    if (input.expectedRevision !== 0) throw conflict();
    await validateGrants(c, input.branchGrants);
    const privileged = ['superadmin', 'admin'].includes(input.role);
    // Frozen SQL stores one invitation branch. Reject unrepresentable grants;
    // CONTRACT owns the additive multi-grant invitation amendment.
    if (
      privileged
        ? input.branchGrants.length !== 0
        : input.branchGrants.length !== 1 ||
          input.branchGrants[0].branchId !== c.branchId ||
          input.branchGrants[0].role !== input.role ||
          !input.branchGrants[0].active
    )
      throw new HttpError(
        400,
        'INVALID_INPUT',
        'La invitación requiere una función en la sede actual.',
      );
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    const created = await c.db.query(
      `INSERT INTO b2b_invitation(id,organization_id,email,name,role,product_role,token_hash,
       expires_at,created_by,branch_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT(id) DO NOTHING RETURNING id`,
      [
        input.id,
        c.organizationId,
        input.email,
        input.name,
        input.role === 'superadmin' ? 'admin' : input.role,
        input.role,
        createHash('sha256').update(token).digest('hex'),
        expiresAt,
        c.actorId,
        privileged ? null : c.branchId,
      ],
    );
    if (!created.rowCount) throw conflict();
    const response: ProductOutput<'inviteMember'> = {
      schemaVersion: 2,
      id: input.id,
      role: input.role,
      expiresAt: expiresAt.toISOString(),
      invitationUrl: `${origin}/app/invite#token=${encodeURIComponent(token)}`,
    };
    await writeProductAudit(c, {
      action: 'invitation.create',
      resourceId: input.id,
      operationId: input.operationId,
      beforeRevision: 0,
      afterRevision: 1,
      changedFields: ['role', 'branchGrants'],
    });
    return { response, revision: 1 };
  });
}
