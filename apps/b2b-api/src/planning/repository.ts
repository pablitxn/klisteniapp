import { ProgramInputSchema } from '@klisteniapp/b2b-contracts';
import {
  EnrollmentSchema,
  GoalProgramSchema,
  OccurrenceSchema,
  RoutineDraftV2Schema,
  decodeRoutine,
  type Enrollment,
  type Occurrence,
  type ProductOutput,
  type RoutineDraftContent,
  type RoutineVersionV2,
} from '@klisteniapp/b2b-contracts/product-v2';
import { missing } from '../errors.ts';
import type { AuthorizedProductContext } from '../product-context.ts';
import type { PlanningSessionHead } from './schedule-change.ts';

type RoutineRow = {
  id: string;
  data: unknown;
  schema_version: number;
  published_version: number | null;
  revision: number;
  archived_at: Date | null;
};
type GoalRow = {
  content: unknown;
  id: string;
  member_id: string;
  revision: number;
  status: string;
  archived_at: Date | null;
};
type EnrollmentRow = { snapshot: unknown };

/** Projection changes no legacy bytes and infers neither load nor laterality. */
function legacyDraft(value: unknown): RoutineDraftContent {
  const original = ProgramInputSchema.parse(value);
  return {
    name: original.name,
    description: original.description,
    steps: original.steps.map((step) => ({
      id: step.id,
      exerciseId: step.exerciseId,
      substitutionPolicy: 'reviewed',
      dose: {
        mode: step.reps === null ? 'duration' : 'repetitions',
        sets: { kind: 'fixed', value: step.sets },
        repetitions: step.reps === null ? null : { kind: 'fixed', value: step.reps },
        durationSeconds:
          step.durationSeconds === null ? null : { kind: 'fixed', value: step.durationSeconds },
        load:
          step.loadKg === null
            ? { mode: 'unspecified' }
            : { mode: 'external', kilograms: { kind: 'fixed', value: step.loadKg } },
        restSeconds: { kind: 'fixed', value: step.restSeconds },
        laterality: null,
        targetRpe: step.targetRpe,
        notes: step.notes,
      },
    })),
  };
}

export class PlanningRepository {
  readonly context: AuthorizedProductContext;
  readonly scope: { organizationId: string; branchId: string };
  constructor(context: AuthorizedProductContext) {
    this.context = context;
    this.scope = { organizationId: context.organizationId, branchId: context.branchId };
  }
  get parameters(): [string, string] {
    return [this.context.organizationId, this.context.branchId];
  }
  private routineDTO(row: RoutineRow) {
    if (row.schema_version !== 1 && row.schema_version !== 2)
      throw new Error('Unknown routine schema version.');
    return RoutineDraftV2Schema.parse({
      ...(row.schema_version === 1 ? legacyDraft(row.data) : (row.data as RoutineDraftContent)),
      schemaVersion: 2,
      id: row.id,
      scope: this.scope,
      revision: row.revision,
      publishedVersion: row.published_version,
      archivedAt: row.archived_at?.toISOString() ?? null,
    });
  }
  async routines() {
    const rows = await this.context.db.query<RoutineRow>(
      'SELECT * FROM b2b_program WHERE organization_id=$1 AND branch_id=$2 ORDER BY id',
      this.parameters,
    );
    return rows.rows.map((row) => this.routineDTO(row));
  }
  async routine(id: string, lock = false) {
    const row = (
      await this.context.db.query<RoutineRow>(
        `SELECT * FROM b2b_program WHERE organization_id=$1 AND branch_id=$2 AND id=$3${lock ? ' FOR UPDATE' : ''}`,
        [...this.parameters, id],
      )
    ).rows[0];
    return row ? this.routineDTO(row) : null;
  }
  async saveRoutine(id: string, content: RoutineDraftContent, previousRevision: number | null) {
    const result =
      previousRevision === null
        ? await this.context.db.query<RoutineRow>(
            'INSERT INTO b2b_program(organization_id,branch_id,id,data,schema_version,revision) VALUES($1,$2,$3,$4,2,1) ON CONFLICT(id) DO NOTHING RETURNING *',
            [...this.parameters, id, content],
          )
        : await this.context.db.query<RoutineRow>(
            'UPDATE b2b_program SET data=$4,schema_version=2,revision=revision+1 WHERE organization_id=$1 AND branch_id=$2 AND id=$3 AND revision=$5 RETURNING *',
            [...this.parameters, id, content, previousRevision],
          );
    return result.rows[0] ? this.routineDTO(result.rows[0]) : null;
  }
  async publishRoutine(snapshot: RoutineVersionV2): Promise<void> {
    await this.context.db.query(
      'INSERT INTO b2b_program_version(organization_id,branch_id,program_id,version,snapshot,schema_version,published_at) VALUES($1,$2,$3,$4,$5,2,$6)',
      [...this.parameters, snapshot.programId, snapshot.version, snapshot, snapshot.publishedAt],
    );
    await this.context.db.query(
      'UPDATE b2b_program SET published_version=$4,revision=revision+1 WHERE organization_id=$1 AND branch_id=$2 AND id=$3',
      [...this.parameters, snapshot.programId, snapshot.version],
    );
  }
  async version(reference: { programId: string; version: number; schemaVersion: number }) {
    const row = (
      await this.context.db.query<{
        schema_version: number;
        snapshot: unknown;
        archived_at: Date | null;
      }>(
        'SELECT v.schema_version,v.snapshot,p.archived_at FROM b2b_program_version v JOIN b2b_program p ON p.organization_id=v.organization_id AND p.branch_id=v.branch_id AND p.id=v.program_id WHERE v.organization_id=$1 AND v.branch_id=$2 AND v.program_id=$3 AND v.version=$4 FOR SHARE OF p,v',
        [...this.parameters, reference.programId, reference.version],
      )
    ).rows[0];
    if (!row || row.schema_version !== reference.schemaVersion) throw missing();
    return {
      stored: decodeRoutine(row.schema_version, row.snapshot),
      archived: row.archived_at !== null,
    };
  }
  async archiveRoutine(id: string, timestamp: string) {
    await this.context.db.query(
      'UPDATE b2b_program SET archived_at=$4,revision=revision+1 WHERE organization_id=$1 AND branch_id=$2 AND id=$3',
      [...this.parameters, id, timestamp],
    );
    return (await this.routine(id))!;
  }
  private goalDTO(row: GoalRow) {
    return GoalProgramSchema.parse({
      ...(row.content as object),
      schemaVersion: 2,
      id: row.id,
      scope: { ...this.scope, memberId: row.member_id },
      revision: row.revision,
      status: row.status,
      archivedAt: row.archived_at?.toISOString() ?? null,
    });
  }
  async goals(memberId: string) {
    const rows = await this.context.db.query<GoalRow>(
      'SELECT * FROM b2b_goal_program WHERE organization_id=$1 AND branch_id=$2 AND member_id=$3 ORDER BY id',
      [...this.parameters, memberId],
    );
    return rows.rows.map((row) => this.goalDTO(row));
  }
  async goal(id: string, lock = false) {
    const row = (
      await this.context.db.query<GoalRow>(
        `SELECT * FROM b2b_goal_program WHERE organization_id=$1 AND branch_id=$2 AND id=$3${lock ? ' FOR UPDATE' : ''}`,
        [...this.parameters, id],
      )
    ).rows[0];
    return row ? this.goalDTO(row) : null;
  }
  async saveGoal(goal: ProductOutput<'saveGoal'>): Promise<void> {
    const { name, goal: objective, timeZone, stages } = goal;
    await this.context.db.query(
      'INSERT INTO b2b_goal_program(organization_id,branch_id,member_id,id,content,revision,status,archived_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(organization_id,branch_id,id) DO UPDATE SET content=excluded.content,revision=excluded.revision,status=excluded.status,archived_at=excluded.archived_at',
      [
        ...this.parameters,
        goal.scope.memberId,
        goal.id,
        { name, goal: objective, timeZone, stages },
        goal.revision,
        goal.status,
        goal.archivedAt,
      ],
    );
    await this.context.db.query(
      'INSERT INTO b2b_goal_program_revision(organization_id,branch_id,member_id,goal_program_id,revision,content,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [...this.parameters, goal.scope.memberId, goal.id, goal.revision, goal, this.context.actorId],
    );
  }
  async enrollment(id: string, lock = false): Promise<Enrollment | null> {
    const row = (
      await this.context.db.query<EnrollmentRow>(
        `SELECT r.content AS snapshot FROM b2b_enrollment e JOIN b2b_enrollment_revision r ON r.organization_id=e.organization_id AND r.branch_id=e.branch_id AND r.enrollment_id=e.id AND r.revision=e.revision WHERE e.organization_id=$1 AND e.branch_id=$2 AND e.id=$3${lock ? ' FOR UPDATE OF e' : ''}`,
        [...this.parameters, id],
      )
    ).rows[0];
    return row ? EnrollmentSchema.parse(row.snapshot) : null;
  }
  async enrollments(memberId: string): Promise<Enrollment[]> {
    const rows = await this.context.db.query<EnrollmentRow>(
      'SELECT r.content AS snapshot FROM b2b_enrollment e JOIN b2b_enrollment_revision r ON r.organization_id=e.organization_id AND r.branch_id=e.branch_id AND r.enrollment_id=e.id AND r.revision=e.revision WHERE e.organization_id=$1 AND e.branch_id=$2 AND e.member_id=$3 ORDER BY e.created_at,e.id',
      [...this.parameters, memberId],
    );
    return rows.rows.map((row) => EnrollmentSchema.parse(row.snapshot));
  }
  async saveEnrollment(enrollment: Enrollment): Promise<void> {
    await this.context.db.query(
      'INSERT INTO b2b_enrollment(organization_id,branch_id,member_id,id,goal_program_id,issued_goal_revision,revision,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(organization_id,branch_id,id) DO UPDATE SET revision=excluded.revision,status=excluded.status',
      [
        ...this.parameters,
        enrollment.scope.memberId,
        enrollment.id,
        enrollment.goalProgramId,
        enrollment.issuedGoalRevision,
        enrollment.revision,
        enrollment.status,
        enrollment.createdAt,
      ],
    );
    await this.context.db.query(
      'INSERT INTO b2b_enrollment_revision(organization_id,branch_id,member_id,enrollment_id,revision,content,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        ...this.parameters,
        enrollment.scope.memberId,
        enrollment.id,
        enrollment.revision,
        enrollment,
        this.context.actorId,
      ],
    );
    for (const [ordinal, stage] of enrollment.content.stages.entries()) {
      await this.context.db.query(
        'INSERT INTO b2b_stage_revision(organization_id,branch_id,enrollment_id,enrollment_revision,id,ordinal,start_date,end_date,content) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          ...this.parameters,
          enrollment.id,
          enrollment.revision,
          stage.id,
          ordinal,
          stage.startDate,
          stage.endDate,
          stage,
        ],
      );
    }
  }
  async scheduleState(
    enrollmentId: string,
  ): Promise<{ occurrences: Occurrence[]; sessions: PlanningSessionHead[] }> {
    const occurrences = await this.context.db.query<{ snapshot: unknown }>(
      'SELECT r.snapshot FROM b2b_occurrence o JOIN b2b_occurrence_revision r ON r.organization_id=o.organization_id AND r.branch_id=o.branch_id AND r.occurrence_id=o.id AND r.revision=o.revision WHERE o.organization_id=$1 AND o.branch_id=$2 AND o.enrollment_id=$3 ORDER BY o.id FOR UPDATE OF o',
      [...this.parameters, enrollmentId],
    );
    const sessions = await this.context.db.query<PlanningSessionHead>(
      'SELECT s.id,s.occurrence_id AS "occurrenceId",s.revision,r.snapshot FROM b2b_training_session s JOIN b2b_occurrence o ON o.organization_id=s.organization_id AND o.branch_id=s.branch_id AND o.id=s.occurrence_id JOIN b2b_session_revision r ON r.organization_id=s.organization_id AND r.branch_id=s.branch_id AND r.session_id=s.id AND r.revision=s.revision WHERE s.organization_id=$1 AND s.branch_id=$2 AND o.enrollment_id=$3 ORDER BY s.id FOR UPDATE OF s',
      [...this.parameters, enrollmentId],
    );
    const count = (
      await this.context.db.query<{ count: string }>(
        'SELECT count(*) FROM b2b_occurrence WHERE organization_id=$1 AND branch_id=$2 AND enrollment_id=$3',
        [...this.parameters, enrollmentId],
      )
    ).rows[0]!;
    if (Number(count.count) !== occurrences.rowCount)
      throw new Error('Issued occurrence revision is missing.');
    const sessionCount = (
      await this.context.db.query<{ count: string }>(
        'SELECT count(*) FROM b2b_training_session s JOIN b2b_occurrence o ON o.organization_id=s.organization_id AND o.branch_id=s.branch_id AND o.id=s.occurrence_id WHERE s.organization_id=$1 AND s.branch_id=$2 AND o.enrollment_id=$3',
        [...this.parameters, enrollmentId],
      )
    ).rows[0]!;
    if (Number(sessionCount.count) !== sessions.rowCount)
      throw new Error('Accepted session revision is missing.');
    return {
      occurrences: occurrences.rows.map((row) => OccurrenceSchema.parse(row.snapshot)),
      sessions: sessions.rows,
    };
  }
  async legacyAssignmentIds(memberId: string): Promise<string[]> {
    return (
      await this.context.db.query<{ id: string }>(
        'SELECT a.id FROM b2b_program_assignment a WHERE a.organization_id=$1 AND a.branch_id=$2 AND a.member_id=$3 ORDER BY a.id',
        [...this.parameters, memberId],
      )
    ).rows.map((row) => row.id);
  }
}
