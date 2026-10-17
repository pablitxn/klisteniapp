import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import {
  EnrollmentSchema,
  RoutineVersionV2Schema,
  SessionContentSchema,
  type Enrollment,
} from '@klisteniapp/b2b-contracts/product-v2';
import { createAuth } from '../../src/auth.ts';
import { migrate } from '../../src/migrate.ts';
import type { AuthorizedProductContext } from '../../src/product-context.ts';
import { HttpError } from '../../src/errors.ts';
import { prepareReconciliation, persistReconciliation } from '../../src/schedule/index.ts';

export const databaseUrl = process.env.B2B_TEST_DATABASE_URL;
export const legacy = JSON.parse(
  readFileSync(
    new URL('../../../../packages/b2b-contracts/tests/fixtures/product-v2.json', import.meta.url),
    'utf8',
  ),
);
export const scope = legacy.scope;
export const now = () => new Date('2026-11-10T12:00:00Z');
export const routine = RoutineVersionV2Schema.parse({
  schemaVersion: 2,
  programId: 'routine-v2',
  version: 1,
  scope: { organizationId: 'atlas', branchId: 'atlas-principal' },
  publishedAt: '2026-10-01T10:00:00Z',
  name: 'Issued routine',
  description: '',
  steps: [
    { id: 'step', exerciseId: 'exercise', dose: legacy.dose, substitutionPolicy: 'reviewed' },
  ],
  exercises: [],
  machines: [],
  relations: [],
});
export function planned(
  startDate = '2026-10-19',
  endDate = '2026-10-25',
  revision = 1,
): Enrollment {
  return EnrollmentSchema.parse({
    schemaVersion: 2,
    id: 'enrollment',
    scope,
    goalProgramId: 'goal',
    issuedGoalRevision: 1,
    revision,
    status: 'active',
    createdAt: '2026-10-01T10:00:00Z',
    content: {
      name: 'Goal',
      goal: 'Synthetic',
      timeZone: 'America/New_York',
      stages: [
        {
          id: 'stage',
          name: 'Stage',
          startDate,
          endDate,
          slots: [1, 2, 3, 4].map((weekday) => ({
            id: `slot-${weekday}`,
            weekday,
            routine: { programId: 'routine-v2', version: 1, schemaVersion: 2 },
          })),
        },
      ],
    },
  });
}
export function content(status: 'draft' | 'partial' | 'completed' | 'void' = 'completed') {
  return SessionContentSchema.parse({
    status,
    explicitCompletion: status === 'completed',
    performedAt: '2026-10-22T14:00:00Z',
    notes: '',
    correctionReason: '',
    segments: [
      {
        segmentId: 'source',
        originalStepId: 'step',
        exerciseId: 'exercise',
        dose: legacy.dose,
        relation: null,
        confirmedConditions: [],
        createdAt: '2026-10-22T14:00:00Z',
      },
    ],
    selectedSegments: [{ originalStepId: 'step', segmentId: 'source' }],
    sets:
      status === 'draft'
        ? []
        : [1, 2, 3].map((ordinal) => ({
            performedSetId: `actual-${ordinal}`,
            segmentId: 'source',
            ordinal,
            side: 'both',
            repetitions: 1,
            durationSeconds: null,
            loadKg: null,
            rpe: null,
            notes: '',
          })),
  });
}
export type Ledger = {
  pool: Pool;
  run<T>(
    callback: (context: AuthorizedProductContext) => Promise<T>,
    actor?: string,
    branch?: string,
  ): Promise<T>;
};
export async function withLedger(
  callback: (ledger: Ledger) => Promise<void>,
  issuedRoutine = routine,
) {
  assert.ok(databaseUrl, 'Use a disposable synthetic B2B PostgreSQL database');
  const url = new URL(databaseUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /b2b.*test|test.*b2b/i);
  const owner = new Pool({ connectionString: url.href });
  const schema = `wp03_${randomUUID().replaceAll('-', '')}`;
  let pool: Pool | undefined;
  try {
    await owner.query(`CREATE SCHEMA ${schema}`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: url.href, max: 10, statement_timeout: 10000 });
    const auth = createAuth(
      pool,
      {
        databaseUrl: url.href,
        secret: 'wp03-synthetic-test-secret-123456789012345',
        origin: 'http://localhost:4200',
        host: '127.0.0.1',
        port: 0,
        production: false,
        demoMode: false,
      },
      { migrating: true },
    );
    await migrate(pool, auth);
    await pool.query(`INSERT INTO b2b_auth_user(id,name,email,"emailVerified","createdAt","updatedAt") VALUES
      ('admin','Admin','admin@example.test',true,now(),now()),('coach','Coach','coach@example.test',true,now(),now()),
      ('member','Member','member@example.test',true,now(),now()),('other','Other','other@example.test',true,now(),now());
      INSERT INTO b2b_organization(id,slug,brand) VALUES('atlas','atlas','{"name":"Atlas"}'),('sur','sur','{"name":"Sur"}');
      INSERT INTO b2b_branch(id,organization_id,slug,name) VALUES('atlas-east','atlas','east','East'),('sur-east','sur','east','East');
      INSERT INTO b2b_membership(organization_id,user_id,role) VALUES('atlas','admin','admin'),('atlas','coach','coach'),('atlas','member','member'),('atlas','other','member'),('sur','admin','admin'),('sur','other','member');
      INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas','atlas-principal','member','member'),('atlas','atlas-principal','other','member'),('atlas','atlas-principal','coach','coach') ON CONFLICT DO NOTHING;`);
    await pool.query(
      'INSERT INTO b2b_program(id,organization_id,branch_id,data,schema_version) VALUES($1,$2,$3,$4,2)',
      ['routine-v2', 'atlas', 'atlas-principal', issuedRoutine],
    );
    await pool.query(
      'INSERT INTO b2b_program_version(organization_id,branch_id,program_id,version,snapshot,schema_version) VALUES($1,$2,$3,1,$4,2)',
      ['atlas', 'atlas-principal', 'routine-v2', issuedRoutine],
    );
    await pool.query(
      "INSERT INTO b2b_program(id,organization_id,branch_id,data) VALUES('routine','atlas','atlas-principal',$1)",
      [{ name: 'Legacy', description: '', steps: legacy.legacyRoutine.steps }],
    );
    await pool.query(
      "INSERT INTO b2b_program_version(organization_id,branch_id,program_id,version,snapshot) VALUES('atlas','atlas-principal','routine',1,$1)",
      [legacy.legacyRoutine],
    );
    await pool.query(
      "INSERT INTO b2b_program_assignment(id,organization_id,branch_id,member_id,program_id,version,assigned_by) VALUES('assignment','atlas','atlas-principal','member','routine',1,'coach')",
    );
    await pool.query(
      "INSERT INTO b2b_execution(organization_id,branch_id,id,member_id,assignment_id,data) VALUES('atlas','atlas-principal','execution','member','assignment',$1)",
      [legacy.legacyRetry],
    );
    const scopedPool = pool;
    const ledger: Ledger = {
      pool,
      async run(run, actor = 'member', branch = 'atlas-principal') {
        const db = await scopedPool.connect();
        try {
          await db.query('BEGIN');
          const membership = await db.query(
            "SELECT active,product_role FROM b2b_membership WHERE organization_id='atlas' AND user_id=$1 FOR SHARE",
            [actor],
          );
          if (!membership.rows[0]?.active)
            throw new HttpError(403, 'CONTEXT_REVOKED', 'Inactive actor');
          const role = membership.rows[0].product_role;
          const grant = await db.query(
            "SELECT active FROM b2b_branch_grant WHERE organization_id='atlas' AND branch_id=$1 AND user_id=$2 FOR SHARE",
            [branch, actor],
          );
          if (role === 'member' || role === 'coach')
            if (!grant.rows[0]?.active)
              throw new HttpError(403, 'CONTEXT_REVOKED', 'Revoked branch');
          const context: AuthorizedProductContext = {
            db,
            actorId: actor,
            organizationId: 'atlas',
            branchId: branch,
            role,
            accessMode: 'active',
            accessRevision: 1,
            capabilities: new Set(
              role === 'member'
                ? ['edit-own-sessions']
                : ['edit-planning', 'read-training-history'],
            ),
            async authorizeMember(memberId, purpose) {
              const target = await db.query(
                "SELECT m.active,g.active AS granted FROM b2b_membership m JOIN b2b_branch_grant g ON g.organization_id=m.organization_id AND g.user_id=m.user_id WHERE m.organization_id='atlas' AND m.user_id=$1 AND g.branch_id=$2 AND g.role='member' FOR SHARE OF m,g",
                [memberId, branch],
              );
              if (
                !target.rows[0]?.granted ||
                (purpose === 'planning' && !target.rows[0].active) ||
                (role === 'member' && memberId !== actor)
              )
                throw new HttpError(403, 'CONTEXT_REVOKED', 'Current target access required');
            },
          };
          const result = await run(context);
          await db.query('COMMIT');
          return result;
        } catch (error) {
          await db.query('ROLLBACK');
          throw error;
        } finally {
          db.release();
        }
      },
    };
    await ledger.run(async (context) => {
      const next = planned();
      await context.db.query(
        "INSERT INTO b2b_goal_program(organization_id,branch_id,member_id,id,content,revision) VALUES('atlas','atlas-principal','member','goal',$1,1)",
        [next.content],
      );
      await context.db.query(
        "INSERT INTO b2b_goal_program_revision(organization_id,branch_id,member_id,goal_program_id,revision,content,actor_id) VALUES('atlas','atlas-principal','member','goal',1,$1,'coach')",
        [next.content],
      );
      await context.db.query(
        "INSERT INTO b2b_enrollment(organization_id,branch_id,member_id,id,goal_program_id,issued_goal_revision,revision,status) VALUES('atlas','atlas-principal','member','enrollment','goal',1,1,'active')",
      );
      await writeEnrollment(context, next);
      const { planned: occurrences } = await prepareReconciliation(context, null, next);
      await persistReconciliation(context, [], occurrences);
    }, 'coach');
    await callback(ledger);
  } finally {
    await pool?.end();
    await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await owner.end();
  }
}
export async function writeEnrollment(context: AuthorizedProductContext, value: Enrollment) {
  await context.db.query(
    `INSERT INTO b2b_enrollment_revision(organization_id,branch_id,member_id,enrollment_id,revision,content,actor_id)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,
    ['atlas', 'atlas-principal', 'member', value.id, value.revision, value, context.actorId],
  );
  for (const [ordinal, stage] of value.content.stages.entries())
    await context.db.query(
      `INSERT INTO b2b_stage_revision(organization_id,branch_id,enrollment_id,enrollment_revision,id,ordinal,start_date,end_date,content)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        'atlas',
        'atlas-principal',
        value.id,
        value.revision,
        stage.id,
        ordinal,
        stage.startDate,
        stage.endDate,
        stage,
      ],
    );
  await context.db.query(
    "UPDATE b2b_enrollment SET revision=$1 WHERE organization_id='atlas' AND branch_id='atlas-principal' AND id=$2",
    [value.revision, value.id],
  );
}
