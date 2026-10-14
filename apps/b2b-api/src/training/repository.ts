import type {
  Execution,
  ExecutionInput,
  Program,
  ProgramVersion,
} from '@klisteniapp/b2b-contracts';
import type { Context } from '../organization-context.ts';
import { ExecutionSchema, ProgramSchema, ProgramVersionSchema } from '@klisteniapp/b2b-contracts';
import { HttpError } from '../errors.ts';
import type { ProgramInput } from './rules.ts';

type ProgramRow = {
  id: string;
  data: ProgramInput;
  published_version: number | null;
  revision: number;
  branch_id: string;
};

export type AssignmentRow = {
  id: string;
  member_id: string;
  name: string;
  assigned_by: string;
  created_at: Date;
  snapshot: ProgramVersion;
  branch_id: string;
  active: boolean;
};

type ExecutionRow = {
  data: ExecutionInput;
  member_id: string;
  name: string;
  created_at: Date;
  snapshot: ProgramVersion;
  branch_id: string;
};

const programDTO = (row: ProgramRow): Program =>
  ProgramSchema.parse({
    ...row.data,
    id: row.id,
    publishedVersion: row.published_version,
    revision: row.revision,
    branchId: row.branch_id,
  });

/** All queries reuse the authorized organization's existing transaction. This
 * repository neither acquires connections nor chooses its tenant from input. */
export class TrainingRepository {
  private readonly context: Context;

  constructor(context: Context) {
    this.context = context;
  }

  async programs(): Promise<Program[]> {
    const { db, org, branchId } = this.context;
    const found = await db.query<ProgramRow>(
      'SELECT * FROM b2b_program WHERE organization_id=$1 AND ($2::text IS NULL OR branch_id=$2) ORDER BY id',
      [org.id, branchId ?? null],
    );
    return found.rows.map(programDTO);
  }

  async program(id: string): Promise<Program | undefined> {
    const { db, org, branchId } = this.context;
    const found = await db.query<ProgramRow>(
      'SELECT * FROM b2b_program WHERE organization_id=$1 AND id=$2 AND ($3::text IS NULL OR branch_id=$3)',
      [org.id, id, branchId ?? null],
    );
    return found.rows[0] ? programDTO(found.rows[0]) : undefined;
  }

  async createProgram(id: string, input: ProgramInput): Promise<Program | undefined> {
    const { db, org, branchId } = this.context;
    const found = await db.query<ProgramRow>(
      'INSERT INTO b2b_program(id,organization_id,data,branch_id) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING *',
      [id, org.id, input, branchId ?? null],
    );
    return found.rows[0] ? programDTO(found.rows[0]) : undefined;
  }

  async createdByActor(action: string, id: string): Promise<boolean> {
    const { db, org, actorId } = this.context;
    return Boolean(
      (
        await db.query(
          'SELECT 1 FROM b2b_audit WHERE organization_id=$1 AND actor_id=$2 AND action=$3 AND resource_id=$4',
          [org.id, actorId, action, id],
        )
      ).rowCount,
    );
  }

  async updateProgram(
    id: string,
    input: ProgramInput,
    revision: number,
  ): Promise<Program | undefined> {
    const { db, org, branchId } = this.context;
    const found = await db.query<ProgramRow>(
      'UPDATE b2b_program SET data=$3,revision=revision+1 WHERE organization_id=$1 AND id=$2 AND revision=$4 AND ($5::text IS NULL OR branch_id=$5) RETURNING *',
      [org.id, id, input, revision, branchId ?? null],
    );
    return found.rows[0] ? programDTO(found.rows[0]) : undefined;
  }

  async publishProgram(snapshot: ProgramVersion): Promise<void> {
    const { db, org, branchId } = this.context;
    await db.query(
      'INSERT INTO b2b_program_version(organization_id,program_id,version,snapshot,branch_id) VALUES($1,$2,$3,$4,$5)',
      [org.id, snapshot.programId, snapshot.version, snapshot, branchId ?? null],
    );
    await db.query(
      'UPDATE b2b_program SET published_version=$3,revision=revision+1 WHERE organization_id=$1 AND id=$2 AND ($4::text IS NULL OR branch_id=$4)',
      [org.id, snapshot.programId, snapshot.version, branchId ?? null],
    );
  }

  async programVersion(id: string, version: number): Promise<ProgramVersion | undefined> {
    const { db, org, branchId } = this.context;
    const found = await db.query<{ snapshot: ProgramVersion; branch_id: string }>(
      'SELECT snapshot,branch_id FROM b2b_program_version WHERE organization_id=$1 AND program_id=$2 AND version=$3 AND ($4::text IS NULL OR branch_id=$4)',
      [org.id, id, version, branchId ?? null],
    );
    return found.rows[0]
      ? ProgramVersionSchema.parse({ ...found.rows[0].snapshot, branchId: found.rows[0].branch_id })
      : undefined;
  }

  async assignments(memberId?: string): Promise<AssignmentRow[]> {
    const { db, org, actorId, role, branchId } = this.context;
    const found = await db.query<AssignmentRow>(
      `SELECT a.*,u.name,v.snapshot
       FROM b2b_program_assignment a
       JOIN b2b_auth_user u ON u.id=a.member_id
       JOIN b2b_program_version v ON v.organization_id=a.organization_id AND v.program_id=a.program_id AND v.version=a.version
       WHERE a.organization_id=$1 AND ($4::text IS NULL OR a.member_id=$4)
       AND ($5::text IS NULL OR a.branch_id=$5)
       AND ($3='admin' OR ($3='member' AND a.member_id=$2)
         OR ($3='coach' AND EXISTS(
           SELECT 1 FROM b2b_coach_assignment ca
           WHERE ca.organization_id=a.organization_id AND ca.member_id=a.member_id AND ca.coach_id=$2
           AND ($5::text IS NULL OR ca.branch_id=a.branch_id)
         )))
       ORDER BY a.created_at DESC,a.id`,
      [org.id, actorId, role, memberId ?? null, branchId ?? null],
    );
    return found.rows.map((row) => ({
      ...row,
      snapshot: ProgramVersionSchema.parse({ ...row.snapshot, branchId: row.branch_id }),
    }));
  }

  async assignProgram(
    id: string,
    input: { memberId: string; programId: string; version: number },
  ): Promise<boolean> {
    const { db, org, actorId, branchId } = this.context;
    const result = await db.query(
      'INSERT INTO b2b_program_assignment(id,organization_id,member_id,program_id,version,assigned_by,branch_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING RETURNING id',
      [id, org.id, input.memberId, input.programId, input.version, actorId, branchId ?? null],
    );
    return Boolean(result.rowCount);
  }

  async executions(memberId?: string): Promise<Execution[]> {
    const { db, org, actorId, role, branchId } = this.context;
    const found = await db.query<ExecutionRow>(
      `SELECT e.*,u.name,v.snapshot
       FROM b2b_execution e
       JOIN b2b_auth_user u ON u.id=e.member_id
       JOIN b2b_program_assignment a ON a.organization_id=e.organization_id AND a.id=e.assignment_id
       JOIN b2b_program_version v ON v.organization_id=a.organization_id AND v.program_id=a.program_id AND v.version=a.version
       WHERE e.organization_id=$1 AND ($4::text IS NULL OR e.member_id=$4)
       AND ($5::text IS NULL OR e.branch_id=$5)
       AND (NOT $6::boolean OR e.member_id=$2)
       AND ($3='admin' OR ($3='member' AND e.member_id=$2)
         OR ($3='coach' AND EXISTS(
           SELECT 1 FROM b2b_coach_assignment ca
           WHERE ca.organization_id=e.organization_id AND ca.member_id=e.member_id AND ca.coach_id=$2
           AND ($5::text IS NULL OR ca.branch_id=e.branch_id)
         )))
       ORDER BY e.created_at DESC,e.id`,
      [
        org.id,
        actorId,
        role,
        memberId ?? null,
        this.context.history ? null : (branchId ?? null),
        this.context.history ?? false,
      ],
    );
    return found.rows.map((row) =>
      ExecutionSchema.parse({
        ...row.data,
        memberId: row.member_id,
        memberName: row.name,
        createdAt: row.created_at.toISOString(),
        branchId: row.branch_id,
        program: { ...row.snapshot, branchId: row.branch_id },
      }),
    );
  }

  async priorExecution(
    id: string,
  ): Promise<{ member_id: string; data: ExecutionInput } | undefined> {
    const { db, org, branchId } = this.context;
    const found = await db.query<{ member_id: string; data: ExecutionInput }>(
      'SELECT member_id,data FROM b2b_execution WHERE organization_id=$1 AND id=$2 AND ($3::text IS NULL OR branch_id=$3)',
      [org.id, id, branchId ?? null],
    );
    return found.rows[0];
  }

  async recordExecution(input: ExecutionInput): Promise<void> {
    const { db, org, actorId, branchId } = this.context;
    const created = await db.query(
      'INSERT INTO b2b_execution(organization_id,id,member_id,assignment_id,data,branch_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(organization_id,id) DO NOTHING RETURNING id',
      [org.id, input.id, actorId, input.assignmentId, input, branchId ?? null],
    );
    if (!created.rowCount)
      throw new HttpError(
        409,
        'EXECUTION_CONFLICT',
        'Ese identificador ya pertenece a otro registro.',
      );
  }
}
