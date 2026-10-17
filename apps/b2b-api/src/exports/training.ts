import {
  decodeRoutine,
  EnrollmentSchema,
  LegacyExecutionRecordSchema,
  LegacySupplementSchema,
  OccurrenceSchema,
  SessionRevisionSchema,
  TrainingInterchangeSchema,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2';
import type { AuthorizedProductIdentityContext } from '../product-context.ts';
import { HttpError } from '../errors.ts';

type Training = ProductOutput<'personalExport'>['training'][number];
const invalidHistory = () =>
  new HttpError(409, 'CONTEXT_REVOKED', 'No se pudo verificar el historial completo.');

/** Read only original issued snapshots, never mutable drafts/current catalog.
 * The caller holds the organization/membership locks in its transaction. All
 * accepted revisions are retained; consumers must not collapse by ID alone. */
export async function trainingExport(
  context: AuthorizedProductIdentityContext,
  exportedAt: string,
): Promise<Training[]> {
  const { db, organizationId, actorId } = context;
  const parameters = [organizationId, actorId];
  // A broken current pointer must fail the whole download rather than present
  // a seemingly complete accepted-history export with missing records.
  const incomplete = await db.query(
    `SELECT 1 FROM b2b_enrollment e WHERE e.organization_id=$1 AND e.member_id=$2
       AND NOT EXISTS(SELECT 1 FROM b2b_enrollment_revision r WHERE
         (r.organization_id,r.branch_id,r.enrollment_id,r.revision)=(e.organization_id,e.branch_id,e.id,e.revision))
     UNION ALL SELECT 1 FROM b2b_occurrence o WHERE o.organization_id=$1 AND o.member_id=$2
       AND NOT EXISTS(SELECT 1 FROM b2b_occurrence_revision r WHERE
         (r.organization_id,r.branch_id,r.occurrence_id,r.revision)=(o.organization_id,o.branch_id,o.id,o.revision))
     UNION ALL SELECT 1 FROM b2b_training_session s WHERE s.organization_id=$1 AND s.member_id=$2
       AND s.revision>0 AND NOT EXISTS(SELECT 1 FROM b2b_session_revision r WHERE
         (r.organization_id,r.branch_id,r.session_id,r.revision)=(s.organization_id,s.branch_id,s.id,s.revision))
     LIMIT 1`,
    parameters,
  );
  if (incomplete.rowCount) throw invalidHistory();
  const branches = new Map<string, Training>();
  const branch = (branchId: string) => {
    let value = branches.get(branchId);
    if (!value) {
      value = {
        format: 'klisteni-training',
        version: 2,
        exportedAt,
        ownerId: actorId,
        scope: { organizationId, branchId, memberId: actorId },
        routines: [],
        legacyExecutions: [],
        enrollments: [],
        occurrences: [],
        sessionRevisions: [],
        supplements: [],
      };
      branches.set(branchId, value);
    }
    return value;
  };
  const references = new Map<string, Map<string, { programId: string; version: number }>>();
  function reference(branchId: string, programId: string, version: number) {
    branch(branchId);
    let entries = references.get(branchId);
    if (!entries) references.set(branchId, (entries = new Map()));
    entries.set(`${programId}:${version}`, { programId, version });
  }
  function scoped(
    scope: { organizationId: string; branchId: string; memberId: string },
    branchId: string,
  ) {
    if (
      scope.organizationId !== organizationId ||
      scope.memberId !== actorId ||
      scope.branchId !== branchId
    )
      throw invalidHistory();
  }
  // Include inactive assignments and archived branches; these are own history,
  // not a grant to browse operational resources in a revoked branch.
  const assignments = await db.query(
    'SELECT branch_id,program_id,version FROM b2b_program_assignment WHERE organization_id=$1 AND member_id=$2 ORDER BY branch_id,id',
    parameters,
  );
  for (const row of assignments.rows) reference(row.branch_id, row.program_id, row.version);

  const enrollments = await db.query(
    `SELECT branch_id,enrollment_id,revision,content FROM b2b_enrollment_revision
     WHERE organization_id=$1 AND member_id=$2 ORDER BY branch_id,enrollment_id,revision`,
    parameters,
  );
  for (const row of enrollments.rows) {
    const enrollment = EnrollmentSchema.parse(row.content);
    scoped(enrollment.scope, row.branch_id);
    if (enrollment.id !== row.enrollment_id || enrollment.revision !== row.revision)
      throw invalidHistory();
    branch(row.branch_id).enrollments.push(enrollment);
    for (const stage of enrollment.content.stages)
      for (const slot of stage.slots)
        reference(row.branch_id, slot.routine.programId, slot.routine.version);
  }
  const occurrences = await db.query(
    `SELECT r.branch_id,r.occurrence_id,r.revision,r.snapshot FROM b2b_occurrence_revision r
     WHERE r.organization_id=$1 AND r.member_id=$2 ORDER BY r.branch_id,r.occurrence_id,r.revision`,
    parameters,
  );
  for (const row of occurrences.rows) {
    const occurrence = OccurrenceSchema.parse(row.snapshot);
    scoped(occurrence.scope, row.branch_id);
    if (occurrence.id !== row.occurrence_id || occurrence.revision !== row.revision)
      throw invalidHistory();
    branch(row.branch_id).occurrences.push(occurrence);
    reference(row.branch_id, occurrence.routine.programId, occurrence.routine.version);
  }
  const sessions = await db.query(
    `SELECT branch_id,session_id,revision,snapshot FROM b2b_session_revision
     WHERE organization_id=$1 AND member_id=$2 AND schema_version=2
     ORDER BY branch_id,session_id,revision`,
    parameters,
  );
  for (const row of sessions.rows) {
    const session = SessionRevisionSchema.parse(row.snapshot);
    scoped(session.scope, row.branch_id);
    if (session.id !== row.session_id || session.revision !== row.revision) throw invalidHistory();
    branch(row.branch_id).sessionRevisions.push(session);
    reference(row.branch_id, session.origin.routine.programId, session.origin.routine.version);
  }
  const executions = await db.query(
    `SELECT e.branch_id,e.id,e.assignment_id,e.data,e.created_at,v.schema_version,v.snapshot
     FROM b2b_execution e JOIN b2b_program_assignment a
       ON (a.organization_id,a.branch_id,a.id,a.member_id)=(e.organization_id,e.branch_id,e.assignment_id,e.member_id)
     JOIN b2b_program_version v
       ON (v.organization_id,v.branch_id,v.program_id,v.version)=(a.organization_id,a.branch_id,a.program_id,a.version)
     WHERE e.organization_id=$1 AND e.member_id=$2 ORDER BY e.branch_id,e.created_at,e.id`,
    parameters,
  );
  for (const row of executions.rows) {
    // A legacy execution attached to a v2 routine is an anomaly, not an omission.
    if (row.schema_version !== 1) throw invalidHistory();
    const record = LegacyExecutionRecordSchema.parse({
      schemaVersion: 1,
      revision: 0,
      scope: branch(row.branch_id).scope,
      original: row.data,
      routine: row.snapshot,
      createdAt: row.created_at.toISOString(),
    });
    if (record.original.id !== row.id || record.original.assignmentId !== row.assignment_id)
      throw invalidHistory();
    branch(row.branch_id).legacyExecutions.push(record);
  }
  for (const [branchId, entries] of [...references].sort(([a], [b]) => a.localeCompare(b))) {
    for (const { programId, version } of [...entries.values()].sort(
      (a, b) => a.programId.localeCompare(b.programId) || a.version - b.version,
    )) {
      const row = (
        await db.query(
          `SELECT schema_version,snapshot FROM b2b_program_version
           WHERE organization_id=$1 AND branch_id=$2 AND program_id=$3 AND version=$4`,
          [organizationId, branchId, programId, version],
        )
      ).rows[0];
      if (!row) throw invalidHistory();
      const stored = decodeRoutine(row.schema_version, row.snapshot);
      if (stored.snapshot.programId !== programId || stored.snapshot.version !== version)
        throw invalidHistory();
      if (stored.schemaVersion === 2) {
        if (
          stored.snapshot.scope.organizationId !== organizationId ||
          stored.snapshot.scope.branchId !== branchId
        )
          throw invalidHistory();
      } else if (stored.snapshot.branchId && stored.snapshot.branchId !== branchId)
        throw invalidHistory();
      branch(branchId).routines.push(stored);
      const supplement = (
        await db.query(
          `SELECT source_snapshot_hash,snapshot FROM b2b_routine_supplement
           WHERE organization_id=$1 AND branch_id=$2 AND program_id=$3 AND program_version=$4`,
          [organizationId, branchId, programId, version],
        )
      ).rows[0];
      if (supplement) {
        const exported = LegacySupplementSchema.parse({
          schemaVersion: 2,
          scope: branch(branchId).scope,
          programId,
          version,
          sourceSnapshotHash: supplement.source_snapshot_hash,
          supplement: supplement.snapshot,
        });
        if (
          stored.schemaVersion !== 1 ||
          exported.supplement.scope.organizationId !== organizationId ||
          exported.supplement.scope.branchId !== branchId ||
          exported.supplement.programId !== programId ||
          exported.supplement.version !== version
        )
          throw invalidHistory();
        branch(branchId).supplements.push(exported);
      }
    }
  }
  return [...branches.values()]
    .sort((a, b) => a.scope.branchId.localeCompare(b.scope.branchId))
    .map((value) => TrainingInterchangeSchema.parse(value));
}
