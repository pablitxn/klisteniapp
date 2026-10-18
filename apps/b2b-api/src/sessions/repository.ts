import {
  LegacyExecutionRecordSchema,
  SessionRecordSchema,
  SessionRevisionSchema,
  type SessionRevision,
} from '@klisteniapp/b2b-contracts/product-v2';
import type { AuthorizedProductContext } from '../product-context.ts';
import { missing } from '../errors.ts';

export async function latestSessions(
  context: AuthorizedProductContext,
  memberId: string,
): Promise<SessionRevision[]> {
  const result = await context.db.query(
    `SELECT r.snapshot FROM b2b_training_session s JOIN b2b_session_revision r
     ON (r.organization_id,r.branch_id,r.session_id,r.revision)=(s.organization_id,s.branch_id,s.id,s.revision)
     WHERE s.organization_id=$1 AND s.branch_id=$2 AND s.member_id=$3 AND r.schema_version=2 ORDER BY s.id`,
    [context.organizationId, context.branchId, memberId],
  );
  return result.rows.map((row) => SessionRevisionSchema.parse(row.snapshot));
}
export async function legacyRecords(
  context: AuthorizedProductContext,
  memberId: string,
  id?: string,
) {
  const result = await context.db.query(
    `SELECT e.id,e.data,e.created_at,v.snapshot FROM b2b_execution e
     JOIN b2b_program_assignment a ON (a.organization_id,a.branch_id,a.id,a.member_id)=(e.organization_id,e.branch_id,e.assignment_id,e.member_id)
     JOIN b2b_program_version v ON (v.organization_id,v.branch_id,v.program_id,v.version)=(a.organization_id,a.branch_id,a.program_id,a.version)
     WHERE e.organization_id=$1 AND e.branch_id=$2 AND e.member_id=$3 AND v.schema_version=1
     ${id ? 'AND e.id=$4' : ''} ORDER BY e.created_at,e.id`,
    [context.organizationId, context.branchId, memberId, ...(id ? [id] : [])],
  );
  return result.rows.map((row) =>
    LegacyExecutionRecordSchema.parse({
      schemaVersion: 1,
      revision: 0,
      scope: { organizationId: context.organizationId, branchId: context.branchId, memberId },
      original: row.data,
      routine: row.snapshot,
      createdAt: row.created_at.toISOString(),
    }),
  );
}
export async function sessionHead(context: AuthorizedProductContext, id: string) {
  const result = await context.db.query(
    'SELECT * FROM b2b_training_session WHERE organization_id=$1 AND branch_id=$2 AND id=$3 FOR UPDATE',
    [context.organizationId, context.branchId, id],
  );
  return result.rows[0];
}
export async function revisions(context: AuthorizedProductContext, id: string) {
  const result = await context.db.query(
    'SELECT snapshot FROM b2b_session_revision WHERE organization_id=$1 AND branch_id=$2 AND session_id=$3 ORDER BY revision',
    [context.organizationId, context.branchId, id],
  );
  return result.rows.map((row) => SessionRecordSchema.parse(row.snapshot));
}
export async function routineSnapshot(
  context: AuthorizedProductContext,
  programId: string,
  version: number,
) {
  const result = await context.db.query(
    'SELECT schema_version,snapshot FROM b2b_program_version WHERE organization_id=$1 AND branch_id=$2 AND program_id=$3 AND version=$4',
    [context.organizationId, context.branchId, programId, version],
  );
  if (!result.rows[0]) throw missing();
  return result.rows[0] as { schema_version: number; snapshot: unknown };
}
