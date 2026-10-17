import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { ExerciseInputSchema, type Exercise } from '@klisteniapp/b2b-contracts';
import {
  OccurrenceSchema,
  type Enrollment,
  type Occurrence,
  type ProductOutput,
  type RoutineDraftContent,
} from '@klisteniapp/b2b-contracts/product-v2';
import { createAuth } from '../../src/auth.ts';
import { migrate } from '../../src/migrate.ts';
import { HttpError } from '../../src/errors.ts';
import type { AuthorizedProductContext } from '../../src/product-context.ts';
import { PlanningModule } from '../../src/planning/index.ts';
import { createPlanningResources } from '../../src/planning/resources.ts';
import type { PlanningSchedule, ScheduleChange } from '../../src/planning/schedule-change.ts';

export const databaseUrl = process.env.B2B_TEST_DATABASE_URL;
export const legacy = JSON.parse(
  readFileSync(
    new URL('../../../../packages/b2b-contracts/tests/fixtures/product-v2.json', import.meta.url),
    'utf8',
  ),
);
export const content = (): RoutineDraftContent => ({
  name: 'Routine',
  description: '',
  steps: [
    {
      id: 'step',
      exerciseId: 'exercise',
      dose: structuredClone(legacy.dose),
      substitutionPolicy: 'reviewed',
    },
  ],
});
export const goalContent = (
  reference = { programId: 'routine', version: 1, schemaVersion: 2 as const },
): ProductOutput<'enroll'>['content'] => ({
  name: 'Goal',
  goal: 'Build a habit',
  timeZone: 'America/New_York',
  stages: [
    {
      id: 'stage',
      name: 'First',
      startDate: '2026-10-05',
      endDate: '2026-10-18',
      slots: [{ id: 'slot', weekday: 1, routine: reference }],
    },
  ],
});
export const errorCode =
  (code: string) =>
  (error: unknown): boolean =>
    error instanceof HttpError && error.code === code;
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function week(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  return addDays(date, 1 - day);
}
function dates(start: string, end: string, weekday: number): string[] {
  const result: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1))
    if ((new Date(`${date}T12:00:00Z`).getUTCDay() || 7) === weekday) result.push(date);
  return result;
}

/** Synthetic WP03 stand-in for planning's transaction/seam tests only. This
 * deliberately limited ledger does not establish WP03 reconciliation acceptance. */
export const syntheticSchedule: PlanningSchedule = {
  plan(change) {
    return change.occurrences.map((occurrence) => {
      const stage = change.after.content.stages.find((stage) => stage.id === occurrence.stageId);
      const slot = stage?.slots.find((slot) => slot.id === occurrence.slotId);
      const afterDate =
        stage && slot && change.after.status === 'active'
          ? (dates(stage.startDate, stage.endDate, slot.weekday)[occurrence.slotOrdinal] ?? null)
          : null;
      return {
        occurrenceId: occurrence.id,
        expectedRevision: occurrence.revision,
        beforeDate: occurrence.scheduledDate,
        afterDate,
        beforeEligibility: occurrence.eligibility,
        afterEligibility: afterDate ? 'required' : 'cancelled',
        linkedSessionIds: change.sessions
          .filter((session) => session.occurrenceId === occurrence.id)
          .map((session) => session.id),
        reason: afterDate
          ? 'Period schedule changes; actual records retain their performed date.'
          : 'Outside the revised period; retain linked actual work.',
      };
    });
  },
  async apply(context, change, impacts) {
    if (!change.before) {
      for (const stage of change.after.content.stages)
        for (const slot of stage.slots) {
          for (const [ordinal, date] of dates(
            stage.startDate,
            stage.endDate,
            slot.weekday,
          ).entries()) {
            const occurrence = OccurrenceSchema.parse({
              schemaVersion: 2,
              id: randomUUID(),
              scope: change.after.scope,
              enrollmentId: change.after.id,
              issuedEnrollmentRevision: change.after.revision,
              stageId: stage.id,
              slotId: slot.id,
              slotOrdinal: ordinal,
              routine: slot.routine,
              originalDate: date,
              originalWeek: { startDate: week(date), timeZone: change.after.content.timeZone },
              scheduledDate: date,
              currentWeek: { startDate: week(date), timeZone: change.after.content.timeZone },
              permittedDateOverride: null,
              revision: 1,
              eligibility: 'required',
              cancellationReason: null,
            });
            await context.db.query(
              "INSERT INTO b2b_occurrence(organization_id,branch_id,member_id,id,enrollment_id,issued_enrollment_revision,stage_id,slot_id,slot_ordinal,program_id,program_version,original_date,original_week_start,time_zone,scheduled_date,current_week_start,revision,eligibility) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$12,$13,1,'required')",
              [
                context.organizationId,
                context.branchId,
                occurrence.scope.memberId,
                occurrence.id,
                occurrence.enrollmentId,
                occurrence.issuedEnrollmentRevision,
                occurrence.stageId,
                occurrence.slotId,
                occurrence.slotOrdinal,
                occurrence.routine.programId,
                occurrence.routine.version,
                date,
                week(date),
                occurrence.originalWeek.timeZone,
              ],
            );
            await appendOccurrence(context, occurrence);
          }
        }
    } else {
      for (const impact of impacts) {
        const before = change.occurrences.find(
          (occurrence) => occurrence.id === impact.occurrenceId,
        )!;
        const after = OccurrenceSchema.parse({
          ...before,
          scheduledDate: impact.afterDate ?? before.scheduledDate,
          currentWeek: {
            ...before.currentWeek,
            startDate: week(impact.afterDate ?? before.scheduledDate),
          },
          revision: before.revision + 1,
          eligibility: impact.afterEligibility,
          cancellationReason: impact.afterEligibility === 'cancelled' ? impact.reason : null,
        });
        await context.db.query(
          'UPDATE b2b_occurrence SET scheduled_date=$4,current_week_start=$5,revision=$6,eligibility=$7,cancellation_reason=$8 WHERE organization_id=$1 AND branch_id=$2 AND id=$3',
          [
            context.organizationId,
            context.branchId,
            after.id,
            after.scheduledDate,
            after.currentWeek.startDate,
            after.revision,
            after.eligibility,
            after.cancellationReason,
          ],
        );
        await appendOccurrence(context, after);
      }
    }
  },
};
async function appendOccurrence(context: AuthorizedProductContext, occurrence: Occurrence) {
  await context.db.query(
    'INSERT INTO b2b_occurrence_revision(organization_id,branch_id,member_id,occurrence_id,revision,snapshot,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [
      context.organizationId,
      context.branchId,
      occurrence.scope.memberId,
      occurrence.id,
      occurrence.revision,
      occurrence,
      context.actorId,
    ],
  );
}
export type Fixture = {
  pool: Pool;
  module: PlanningModule;
  time: { now: number };
  transaction<T>(
    run: (context: AuthorizedProductContext) => Promise<T>,
    options?: { actorId?: string; organizationId?: string; branchId?: string },
  ): Promise<T>;
};
export async function fixture(
  run: (fixture: Fixture) => Promise<void>,
  schedule = syntheticSchedule,
) {
  assert.ok(
    databaseUrl,
    'B2B_TEST_DATABASE_URL must select a disposable PostgreSQL test database.',
  );
  const url = new URL(databaseUrl);
  assert.match(url.pathname, /b2b.*test|test.*b2b/i);
  assert.ok(
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
    'Use a local synthetic database only.',
  );
  const owner = new Pool({ connectionString: url.href });
  const schema = `wp02_${randomUUID().replaceAll('-', '')}`;
  let pool: Pool | undefined;
  try {
    await owner.query(`CREATE SCHEMA ${schema}`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: url.href, max: 10 });
    const auth = createAuth(
      pool,
      {
        databaseUrl: url.href,
        secret: 'wp02-synthetic-secret-12345678901234567890',
        origin: 'http://localhost:4200',
        host: '127.0.0.1',
        port: 0,
        production: false,
        demoMode: false,
      },
      { migrating: true },
    );
    await migrate(pool, auth);
    await pool.query(`
      INSERT INTO b2b_auth_user(id,name,email,"emailVerified","createdAt","updatedAt") VALUES
        ('admin','Admin','admin@example.test',true,now(),now()),('coach','Coach','coach@example.test',true,now(),now()),('other-coach','Other coach','other@example.test',true,now(),now()),('member','Member','member@example.test',true,now(),now()),('foreign','Foreign','foreign@example.test',true,now(),now());
      INSERT INTO b2b_organization(id,slug,brand) VALUES ('atlas','atlas','{"name":"Atlas"}'),('sur','sur','{"name":"Sur"}');
      INSERT INTO b2b_branch(id,organization_id,slug,name) VALUES ('atlas-east','atlas','east','East'),('sur-east','sur','east','East');
      INSERT INTO b2b_membership(organization_id,user_id,role) VALUES ('atlas','admin','admin'),('atlas','coach','coach'),('atlas','other-coach','coach'),('atlas','member','member'),('sur','admin','admin'),('sur','foreign','member');
      INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES ('atlas','atlas-east','coach','coach');
    `);
    const exercise = ExerciseInputSchema.parse({
      name: 'Exercise',
      instructions: ['Use the configured dose.'],
    });
    await pool.query(
      "INSERT INTO b2b_exercise(id,organization_id,branch_id,data,status) VALUES('exercise',null,null,$1,'published'),('foreign-exercise','sur','sur-principal',$1,'published')",
      [exercise],
    );
    const time = { now: Date.parse('2026-10-17T12:01:00Z') };
    const module = new PlanningModule({
      ...createPlanningResources(async () => []),
      schedule,
      now: () => time.now,
    });
    const database = pool;
    const transaction: Fixture['transaction'] = async (callback, options = {}) => {
      const db = await database.connect();
      try {
        await db.query('BEGIN');
        const actorId = options.actorId ?? 'coach',
          organizationId = options.organizationId ?? 'atlas',
          branchId = options.branchId ?? `${organizationId}-principal`;
        const row = (
          await db.query<{
            product_role: AuthorizedProductContext['role'];
            active: boolean;
            access_revision: number;
          }>(
            'SELECT product_role,active,access_revision FROM b2b_membership WHERE organization_id=$1 AND user_id=$2 FOR SHARE',
            [organizationId, actorId],
          )
        ).rows[0];
        if (!row) throw new HttpError(403, 'MEMBERSHIP_REQUIRED', 'Membership required.');
        const branchGrant = await db.query(
          'SELECT 1 FROM b2b_branch_grant WHERE organization_id=$1 AND branch_id=$2 AND user_id=$3 AND active',
          [organizationId, branchId, actorId],
        );
        if (
          !branchGrant.rowCount &&
          row.product_role !== 'superadmin' &&
          row.product_role !== 'admin'
        )
          throw new HttpError(403, 'FORBIDDEN', 'Branch grant required.');
        const context: AuthorizedProductContext = {
          db,
          actorId,
          organizationId,
          branchId,
          role: row.product_role,
          accessMode: row.active ? 'active' : 'export-only',
          accessRevision: Number(row.access_revision),
          capabilities: new Set(
            row.active
              ? [
                  'read-training-history',
                  ...(row.product_role === 'member' ? [] : ['edit-planning' as const]),
                ]
              : ['export-own-records'],
          ),
          async authorizeMember(memberId, purpose) {
            const target = (
              await db.query<{ active: boolean }>(
                "SELECT active FROM b2b_membership WHERE organization_id=$1 AND user_id=$2 AND product_role='member'",
                [organizationId, memberId],
              )
            ).rows[0];
            const grant = await db.query(
              "SELECT 1 FROM b2b_branch_grant WHERE organization_id=$1 AND branch_id=$2 AND user_id=$3 AND role='member' AND active",
              [organizationId, branchId, memberId],
            );
            if (
              !target ||
              (purpose === 'planning' && !target.active) ||
              !grant.rowCount ||
              (row.product_role === 'member' && memberId !== actorId)
            )
              throw new HttpError(403, 'FORBIDDEN', 'Member is outside the authorized scope.');
          },
        };
        const result = await callback(context);
        await db.query('COMMIT');
        return result;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      } finally {
        db.release();
      }
    };
    await run({ pool, module, time, transaction });
  } finally {
    await pool?.end();
    await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await owner.end();
  }
}
export async function publish(f: Fixture, id = 'routine') {
  const saved = await f.transaction((context) =>
    f.module.saveRoutine(context, {
      id,
      operationId: `save-${id}`,
      expectedRevision: 0,
      content: content(),
    }),
  );
  return f.transaction((context) =>
    f.module.publishRoutine(context, {
      id,
      operationId: `publish-${id}`,
      expectedRevision: saved.revision,
    }),
  );
}
export async function enroll(
  f: Fixture,
  content = goalContent(),
  id = 'enrollment',
): Promise<Enrollment> {
  const goal = await f.transaction((context) =>
    f.module.saveGoal(context, {
      id: `goal-${id}`,
      memberId: 'member',
      operationId: `goal-${id}`,
      expectedRevision: 0,
      content,
    }),
  );
  return f.transaction((context) =>
    f.module.enroll(context, {
      id,
      memberId: 'member',
      goalProgramId: goal.id,
      issuedGoalRevision: goal.revision,
      expectedRevision: 0,
      operationId: `enroll-${id}`,
      content,
    }),
  );
}
export async function occurrenceRows(f: Fixture) {
  return (
    await f.pool.query<{ snapshot: Occurrence }>(
      'SELECT r.snapshot FROM b2b_occurrence o JOIN b2b_occurrence_revision r ON r.organization_id=o.organization_id AND r.branch_id=o.branch_id AND r.occurrence_id=o.id AND r.revision=o.revision ORDER BY o.original_date,o.slot_id',
    )
  ).rows.map((row) => row.snapshot);
}
export type { Exercise, ScheduleChange };
