import {
  decodeRoutine,
  EnrollmentSchema,
  OccurrenceSchema,
  type ProductInput,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2';
import type { AuthorizedProductContext } from './product-context.ts';
import { denied, missing } from './errors.ts';
function history(context: AuthorizedProductContext) {
  if (context.accessMode !== 'active' || !context.capabilities.has('read-training-history'))
    throw denied();
}
function scope(
  context: AuthorizedProductContext,
  value: { scope: { organizationId: string; branchId: string; memberId: string } },
  memberId: string,
) {
  if (
    value.scope.organizationId !== context.organizationId ||
    value.scope.branchId !== context.branchId ||
    value.scope.memberId !== memberId
  )
    throw missing();
}
export async function legacyAssignments(
  context: AuthorizedProductContext,
  input: ProductInput<'legacyAssignments'>,
): Promise<ProductOutput<'legacyAssignments'>> {
  history(context);
  await context.authorizeMember(input.memberId, 'history');
  const rows = (
    await context.db.query(
      `SELECT a.id,a.active,a.assigned_by,a.created_at,v.schema_version,v.snapshot,p.archived_at,a.program_id,a.version
    FROM b2b_program_assignment a JOIN b2b_program_version v ON (v.organization_id,v.branch_id,v.program_id,v.version)=(a.organization_id,a.branch_id,a.program_id,a.version)
    JOIN b2b_program p ON (p.organization_id,p.branch_id,p.id)=(a.organization_id,a.branch_id,a.program_id)
    WHERE a.organization_id=$1 AND a.branch_id=$2 AND a.member_id=$3 ORDER BY a.created_at,a.id`,
      [context.organizationId, context.branchId, input.memberId],
    )
  ).rows;
  return rows.map((row) => {
    const stored = decodeRoutine(row.schema_version, row.snapshot);
    if (
      stored.snapshot.programId !== row.program_id ||
      stored.snapshot.version !== row.version ||
      (stored.schemaVersion === 2 &&
        (stored.snapshot.scope.organizationId !== context.organizationId ||
          stored.snapshot.scope.branchId !== context.branchId))
    )
      throw missing();
    return {
      schemaVersion: 2,
      id: row.id,
      scope: {
        organizationId: context.organizationId,
        branchId: context.branchId,
        memberId: input.memberId,
      },
      active: row.active,
      assignedBy: row.assigned_by,
      createdAt: row.created_at.toISOString(),
      routine: {
        programId: row.program_id,
        version: row.version,
        schemaVersion: stored.schemaVersion,
      },
      name: stored.snapshot.name,
      archivedAt: row.archived_at?.toISOString() ?? null,
    };
  });
}
export async function enrollmentRevision(
  context: AuthorizedProductContext,
  input: ProductInput<'enrollmentRevision'>,
): Promise<ProductOutput<'enrollmentRevision'>> {
  history(context);
  const row = (
    await context.db.query(
      `SELECT member_id,content,actor_id,created_at FROM b2b_enrollment_revision WHERE organization_id=$1 AND branch_id=$2 AND enrollment_id=$3 AND revision=$4`,
      [context.organizationId, context.branchId, input.id, input.revision],
    )
  ).rows[0];
  if (!row) throw missing();
  await context.authorizeMember(row.member_id, 'history');
  const enrollment = EnrollmentSchema.parse(row.content);
  scope(context, enrollment, row.member_id);
  if (enrollment.id !== input.id || enrollment.revision !== input.revision) throw missing();
  return { enrollment, actorId: row.actor_id, recordedAt: row.created_at.toISOString() };
}
export async function occurrence(
  context: AuthorizedProductContext,
  input: ProductInput<'occurrence'>,
): Promise<ProductOutput<'occurrence'>> {
  history(context);
  const row = (
    await context.db.query(
      `SELECT o.member_id,r.snapshot,er.content FROM b2b_occurrence o
    JOIN b2b_occurrence_revision r ON (r.organization_id,r.branch_id,r.occurrence_id,r.revision)=(o.organization_id,o.branch_id,o.id,o.revision)
    JOIN b2b_enrollment e ON (e.organization_id,e.branch_id,e.id)=(o.organization_id,o.branch_id,o.enrollment_id)
    JOIN b2b_enrollment_revision er ON (er.organization_id,er.branch_id,er.enrollment_id,er.revision)=(e.organization_id,e.branch_id,e.id,e.revision)
    WHERE o.organization_id=$1 AND o.branch_id=$2 AND o.id=$3`,
      [context.organizationId, context.branchId, input.id],
    )
  ).rows[0];
  if (!row) throw missing();
  await context.authorizeMember(row.member_id, 'history');
  const occurrence = OccurrenceSchema.parse(row.snapshot),
    enrollment = EnrollmentSchema.parse(row.content);
  scope(context, occurrence, row.member_id);
  scope(context, enrollment, row.member_id);
  if (occurrence.id !== input.id || occurrence.enrollmentId !== enrollment.id) throw missing();
  return { occurrence, enrollment };
}
export async function historySubjects(
  context: AuthorizedProductContext,
): Promise<ProductOutput<'historySubjects'>> {
  history(context);
  if (context.role === 'member') throw denied();
  const rows = (
    await context.db.query(
      `SELECT m.user_id,u.name,m.active FROM b2b_membership m JOIN b2b_auth_user u ON u.id=m.user_id
    WHERE m.organization_id=$1 AND (EXISTS(SELECT 1 FROM b2b_branch_grant g WHERE g.organization_id=m.organization_id AND g.branch_id=$2 AND g.user_id=m.user_id AND g.role='member')
    OR EXISTS(SELECT 1 FROM b2b_program_assignment a WHERE a.organization_id=m.organization_id AND a.branch_id=$2 AND a.member_id=m.user_id)
    OR EXISTS(SELECT 1 FROM b2b_enrollment e WHERE e.organization_id=m.organization_id AND e.branch_id=$2 AND e.member_id=m.user_id)) ORDER BY u.name,m.user_id FOR SHARE OF m`,
      [context.organizationId, context.branchId],
    )
  ).rows;
  return {
    schemaVersion: 2,
    scope: { organizationId: context.organizationId, branchId: context.branchId },
    members: rows.map((row) => ({ userId: row.user_id, name: row.name, active: row.active })),
  };
}
