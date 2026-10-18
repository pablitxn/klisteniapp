import {
  EnrollmentSchema,
  OccurrenceSchema,
  type Enrollment,
  type Occurrence,
} from '@klisteniapp/b2b-contracts/product-v2';
import type { AuthorizedProductContext } from '../product-context.ts';
import { missing } from '../errors.ts';

export async function enrollment(
  context: AuthorizedProductContext,
  id: string,
  lock = false,
): Promise<Enrollment> {
  const result = await context.db.query(
    `SELECT r.content FROM b2b_enrollment e JOIN b2b_enrollment_revision r
     ON (r.organization_id,r.branch_id,r.enrollment_id,r.revision)=(e.organization_id,e.branch_id,e.id,e.revision)
     WHERE e.organization_id=$1 AND e.branch_id=$2 AND e.id=$3 ${lock ? 'FOR UPDATE OF e' : ''}`,
    [context.organizationId, context.branchId, id],
  );
  if (!result.rows[0]) throw missing();
  return EnrollmentSchema.parse(result.rows[0].content);
}
export async function occurrence(
  context: AuthorizedProductContext,
  id: string,
): Promise<Occurrence> {
  const result = await context.db.query(
    `SELECT r.snapshot FROM b2b_occurrence o JOIN b2b_occurrence_revision r
     ON (r.organization_id,r.branch_id,r.occurrence_id,r.revision)=(o.organization_id,o.branch_id,o.id,o.revision)
     WHERE o.organization_id=$1 AND o.branch_id=$2 AND o.id=$3`,
    [context.organizationId, context.branchId, id],
  );
  if (!result.rows[0]) throw missing();
  return OccurrenceSchema.parse(result.rows[0].snapshot);
}
export async function memberOccurrences(context: AuthorizedProductContext, memberId: string) {
  const result = await context.db.query(
    `SELECT r.snapshot FROM b2b_occurrence o JOIN b2b_occurrence_revision r
     ON (r.organization_id,r.branch_id,r.occurrence_id,r.revision)=(o.organization_id,o.branch_id,o.id,o.revision)
     WHERE o.organization_id=$1 AND o.branch_id=$2 AND o.member_id=$3 ORDER BY o.id`,
    [context.organizationId, context.branchId, memberId],
  );
  return result.rows.map((row) => OccurrenceSchema.parse(row.snapshot));
}
export async function persistOccurrence(
  context: AuthorizedProductContext,
  value: Occurrence,
  fresh: boolean,
) {
  OccurrenceSchema.parse(value);
  if (
    value.scope.organizationId !== context.organizationId ||
    value.scope.branchId !== context.branchId
  )
    throw missing();
  const scope = [context.organizationId, context.branchId, value.scope.memberId, value.id];
  if (fresh) {
    await context.db.query(
      `INSERT INTO b2b_occurrence(organization_id,branch_id,member_id,id,enrollment_id,issued_enrollment_revision,
       stage_id,slot_id,slot_ordinal,program_id,program_version,original_date,original_week_start,time_zone,
       scheduled_date,current_week_start,permitted_date_override,revision,eligibility,cancellation_reason)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        ...scope,
        value.enrollmentId,
        value.issuedEnrollmentRevision,
        value.stageId,
        value.slotId,
        value.slotOrdinal,
        value.routine.programId,
        value.routine.version,
        value.originalDate,
        value.originalWeek.startDate,
        value.originalWeek.timeZone,
        value.scheduledDate,
        value.currentWeek.startDate,
        value.permittedDateOverride,
        value.revision,
        value.eligibility,
        value.cancellationReason,
      ],
    );
  } else {
    const result = await context.db.query(
      `UPDATE b2b_occurrence SET scheduled_date=$5,current_week_start=$6,permitted_date_override=$7,
       revision=$8,eligibility=$9,cancellation_reason=$10
       WHERE organization_id=$1 AND branch_id=$2 AND member_id=$3 AND id=$4 AND revision=$11`,
      [
        ...scope,
        value.scheduledDate,
        value.currentWeek.startDate,
        value.permittedDateOverride,
        value.revision,
        value.eligibility,
        value.cancellationReason,
        value.revision - 1,
      ],
    );
    if (result.rowCount !== 1) throw new Error('Concurrent occurrence revision');
  }
  await context.db.query(
    `INSERT INTO b2b_occurrence_revision(organization_id,branch_id,member_id,occurrence_id,revision,snapshot,actor_id)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [...scope, value.revision, value, context.actorId],
  );
}
