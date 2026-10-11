import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool, type PoolClient } from 'pg';
import {
  BrandInputSchema,
  ExerciseInputSchema,
  ExecutionInputSchema,
  MachineInputSchema,
  ProgramInputSchema,
  UnitInputSchema,
  type Role,
} from '@klisteniapp/b2b-contracts';
import { SCHEMA, LIFECYCLE_SCHEMA, CONTENT_SCHEMA } from '../src/database.ts';
import { WHITE_LABEL_SCHEMA } from '../src/white-label-schema.ts';
import { CatalogModule } from '../src/catalog/index.ts';
import { EquipmentModule } from '../src/equipment/index.ts';
import { TrainingModule } from '../src/training/index.ts';
import type { Context } from '../src/organization-context.ts';
import { HttpError } from '../src/errors.ts';

const databaseUrl = process.env.B2B_TEST_DATABASE_URL;
const center = 'atlas-principal';
const north = 'atlas-north';
const code = (expected: string) => (error: unknown) =>
  error instanceof HttpError && error.code === expected;

async function fixture(run: (db: PoolClient) => Promise<void>) {
  const parsed = new URL(databaseUrl!);
  assert.match(parsed.pathname, /b2b.*test|test.*b2b/i);
  assert.equal(parsed.searchParams.has('options'), false);
  const admin = new Pool({ connectionString: parsed.href });
  const schema = `b2b_wl_training_${randomUUID().replaceAll('-', '')}`;
  let pool: Pool | undefined;
  let db: PoolClient | undefined;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    parsed.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: parsed.href });
    db = await pool.connect();
    await db.query(`CREATE TABLE b2b_auth_user(id text PRIMARY KEY,name text NOT NULL);
      CREATE TABLE b2b_auth_session(id text PRIMARY KEY)`);
    await db.query(SCHEMA);
    await db.query(LIFECYCLE_SCHEMA);
    await db.query(CONTENT_SCHEMA);
    await db.query(WHITE_LABEL_SCHEMA);
    await db.query(`
      INSERT INTO b2b_auth_user VALUES('admin','Admin'),('coach','Coach'),('member','Member'),('other','Other member');
      INSERT INTO b2b_organization(id,slug,brand) VALUES('atlas','atlas','{"name":"Atlas"}'),('sur','sur','{"name":"Sur"}');
      INSERT INTO b2b_branch(id,organization_id,slug,name) VALUES('atlas-north','atlas','north','North');
      INSERT INTO b2b_membership(organization_id,user_id,role) VALUES
        ('atlas','admin','admin'),('atlas','coach','coach'),('atlas','member','member'),('atlas','other','member');
      INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES
        ('atlas','atlas-north','coach','coach'),('atlas','atlas-north','member','member');
      INSERT INTO b2b_coach_assignment(organization_id,branch_id,coach_id,member_id) VALUES
        ('atlas','atlas-principal','coach','member');
    `);
    await run(db);
  } finally {
    db?.release();
    await pool?.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}

function context(db: PoolClient, branchId: string, role: Role = 'admin'): Context {
  return {
    db,
    branchId,
    role,
    actorId: role,
    org: {
      id: 'atlas',
      slug: 'atlas',
      brand: BrandInputSchema.parse({ name: 'Atlas' }),
      service_enabled: true,
      service_ends_at: null,
    },
  };
}

const catalog = new CatalogModule(async () => {});
const equipment = new EquipmentModule(catalog, async () => {});
const training = new TrainingModule({
  catalog,
  equipment,
  async memberAccess(c, memberId) {
    const result = await c.db.query(
      `SELECT 1 FROM b2b_branch_grant g WHERE g.organization_id=$1 AND g.branch_id=$2
       AND g.user_id=$3 AND g.role='member' AND g.active AND ($4='admin' OR
         ($4='member' AND g.user_id=$5) OR EXISTS(SELECT 1 FROM b2b_coach_assignment a
           WHERE a.organization_id=g.organization_id AND a.branch_id=g.branch_id
           AND a.member_id=g.user_id AND a.coach_id=$5))`,
      [c.org.id, c.branchId, memberId, c.role, c.actorId],
    );
    if (!result.rowCount) throw new HttpError(403, 'FORBIDDEN', 'Forbidden');
  },
  async members() {
    return [];
  },
});

test(
  'WL catalog isolates private branches, allows explicit sharing and preserves ownership on edits',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (db) => {
      const own = context(db, center, 'coach');
      const foreign = context(db, north, 'coach');
      let movement = await catalog.createExercise(
        own,
        ExerciseInputSchema.parse({
          name: 'Private movement',
          instructions: ['Original instructions'],
        }),
      );
      assert.equal(movement.branchId, center);
      assert.equal((await catalog.exercises(foreign)).length, 0);
      await assert.rejects(
        catalog.resolveExercises(foreign, [movement.id], false),
        code('EXERCISE_UNAVAILABLE'),
      );
      movement = await catalog.reviewExercise(own, movement.id, movement.revision);
      movement = await catalog.publishExercise(own, movement.id, movement.revision);
      await db.query(
        "INSERT INTO b2b_branch_catalog(organization_id,branch_id,kind,resource_id,enabled) VALUES('atlas',$1,'exercise',$2,true)",
        [north, movement.id],
      );
      assert.equal((await catalog.exercises(foreign))[0].id, movement.id);
      await assert.rejects(
        catalog.updateExercise(
          foreign,
          movement.id,
          ExerciseInputSchema.parse({ name: 'Changed', instructions: ['Changed'] }),
          movement.revision,
        ),
        code('REVISION_CONFLICT'),
      );
      await assert.rejects(
        catalog.reviewExercise(foreign, movement.id, movement.revision),
        code('REVISION_CONFLICT'),
      );
      await assert.rejects(
        catalog.publishExercise(foreign, movement.id, movement.revision),
        code('REVISION_CONFLICT'),
      );
      movement = await catalog.updateExercise(
        own,
        movement.id,
        ExerciseInputSchema.parse({ name: 'Private revision', instructions: ['Not published'] }),
        movement.revision,
      );
      assert.equal((await catalog.exercises(foreign)).length, 0);
      await assert.rejects(
        catalog.resolveExercises(foreign, [movement.id], false),
        code('EXERCISE_UNAVAILABLE'),
      );
      movement = await catalog.reviewExercise(own, movement.id, movement.revision);
      movement = await catalog.publishExercise(own, movement.id, movement.revision);
      await db.query('UPDATE b2b_branch_catalog SET enabled=false WHERE branch_id=$1', [north]);
      assert.equal((await catalog.exercises(foreign)).length, 0);
      assert.equal((await catalog.publishedCatalog(db, 'atlas', north)).exercises.length, 0);
      assert.equal(
        (await catalog.publishedCatalog(db, 'atlas', center)).exercises[0].id,
        movement.id,
      );
      assert.equal(
        (await catalog.publishedCatalog(db, 'sur', 'sur-principal')).exercises.length,
        0,
      );
    });
  },
);

test(
  'WL physical inventory and idempotent batches remain scoped even with identical labels and batch IDs',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (db) => {
      await db.query(
        "INSERT INTO b2b_machine(id,data,status) VALUES('base-machine',$1,'published')",
        [MachineInputSchema.parse({ name: 'Machine', type: 'cable' })],
      );
      const input = {
        id: 'same-batch',
        units: [UnitInputSchema.parse({ machineId: 'base-machine', label: 'Polea 01' })],
      };
      const first = await equipment.batchUnits(context(db, center), input);
      const second = await equipment.batchUnits(context(db, north), input);
      assert.notEqual(first[0].id, second[0].id);
      assert.equal(first[0].branchId, center);
      assert.equal(second[0].branchId, north);
      assert.deepEqual(await equipment.batchUnits(context(db, center), input), first);
      assert.deepEqual(await equipment.batchUnits(context(db, north), input), second);
      assert.deepEqual(
        (await equipment.units(context(db, center))).map((unit) => unit.id),
        [first[0].id],
      );
      await assert.rejects(
        equipment.updateUnit(context(db, north), first[0].id, input.units[0], 0),
        code('REVISION_CONFLICT'),
      );
      assert.deepEqual(
        (
          await equipment.publicUnits(
            db,
            { id: 'atlas', slug: 'atlas' },
            new Set(['base-machine']),
            north,
          )
        ).map((unit) => unit.id),
        [second[0].id],
      );
      assert.equal(
        (
          await equipment.units({
            ...context(db, 'sur-principal'),
            org: { ...context(db, center).org, id: 'sur' },
          })
        ).length,
        0,
      );
    });
  },
);

test(
  'WL prescriptions, coach relations, execution retries and own history preserve branch isolation',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (db) => {
      await db.query(
        "INSERT INTO b2b_exercise(id,data,status) VALUES('base-movement',$1,'published')",
        [ExerciseInputSchema.parse({ name: 'Base', instructions: ['Original'] })],
      );
      const input = ProgramInputSchema.parse({
        name: 'Routine',
        steps: [{ id: 'step', exerciseId: 'base-movement', sets: 1, reps: 10 }],
      });
      const c = context(db, center);
      const n = context(db, north);
      const program = await training.createProgram(c, input);
      const version = await training.publishProgram(c, program.id, 0);
      const otherProgram = await training.createProgram(n, input);
      const otherVersion = await training.publishProgram(n, otherProgram.id, 0);
      assert.deepEqual(
        (await training.programs(n)).map((p) => p.id),
        [otherProgram.id],
      );
      await assert.rejects(training.programVersion(n, program.id, 1), code('NOT_FOUND'));
      await assert.rejects(
        training.updateProgram(n, program.id, input, 1),
        code('REVISION_CONFLICT'),
      );
      const assignment = await training.assignProgram(c, {
        memberId: 'member',
        programId: program.id,
        version: 1,
      });
      const northAssignment = await training.assignProgram(n, {
        memberId: 'member',
        programId: otherProgram.id,
        version: otherVersion.version,
      });
      assert.equal((await training.assignments(context(db, center, 'coach')))[0].id, assignment.id);
      assert.equal((await training.assignments(context(db, north, 'coach'))).length, 0);
      assert.equal(northAssignment.branchId, north);
      const record = ExecutionInputSchema.parse({
        id: 'record',
        assignmentId: assignment.id,
        status: 'completed',
        sets: [{ stepId: 'step', set: 1, exerciseId: 'base-movement', reps: 10 }],
        completedAt: new Date().toISOString(),
      });
      const member = context(db, center, 'member');
      await assert.rejects(
        training.recordExecution(context(db, north, 'member'), record),
        code('NOT_FOUND'),
      );
      const execution = await training.recordExecution(member, record);
      assert.equal(execution.branchId, center);
      assert.equal(execution.program.branchId, center);
      assert.deepEqual(execution.program, version);
      await assert.rejects(
        training.recordExecution(context(db, north, 'member'), {
          ...record,
          assignmentId: northAssignment.id,
        }),
        code('EXECUTION_CONFLICT'),
      );
      await db.query(
        "INSERT INTO b2b_branch_catalog(organization_id,branch_id,kind,resource_id,enabled) VALUES('atlas',$1,'exercise','base-movement',false)",
        [center],
      );
      await assert.rejects(
        training.assignProgram(c, { memberId: 'member', programId: program.id, version: 1 }),
        code('EXERCISE_UNAVAILABLE'),
      );
      // Removing new catalogue availability does not mutate an existing prescription.
      assert.deepEqual(await training.recordExecution(member, record), execution);
      await db.query('UPDATE b2b_program_assignment SET active=false WHERE id=$1', [assignment.id]);
      assert.deepEqual(await training.recordExecution(member, record), execution);
      await assert.rejects(
        training.recordExecution(member, { ...record, id: 'new-record' }),
        code('ASSIGNMENT_INACTIVE'),
      );
      await db.query(
        "UPDATE b2b_branch_grant SET active=false WHERE branch_id=$1 AND user_id='member'",
        [center],
      );
      const history = { ...context(db, north, 'member'), branchId: undefined, history: true };
      assert.equal((await training.executions(history))[0].branchId, center);
      assert.equal((await training.executions(context(db, north, 'member'))).length, 0);
      await assert.rejects(training.executions(history, 'other'), code('FORBIDDEN'));
      await assert.rejects(training.recordExecution(history, record), code('FORBIDDEN'));
      assert.equal((await training.executions({ ...history, actorId: 'other' })).length, 0);
      assert.equal((await training.executions(context(db, north, 'coach'))).length, 0);
      const stored = (
        await db.query('SELECT snapshot FROM b2b_program_version WHERE program_id=$1', [program.id])
      ).rows[0].snapshot;
      assert.deepEqual(stored, version);
    });
  },
);
